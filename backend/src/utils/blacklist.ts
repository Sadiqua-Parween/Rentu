import { query } from '../config/db';
import { isAdminEmail } from '../middleware/auth';

export interface BlacklistRecord {
  id: string;
  email: string;
  reason: string;
  blacklisted_by?: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlacklistCheckResult {
  isBlacklisted: boolean;
  message?: string;
  expiresAt?: string | null;
  reason?: string;
  isPermanent?: boolean;
}

/**
 * Ensures table and columns exist in PostgreSQL
 */
export const ensureBlacklistTable = async (): Promise<void> => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS email_blacklist (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email VARCHAR(255) NOT NULL,
        reason TEXT DEFAULT 'Violation of community terms',
        blacklisted_by TEXT,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_email_blacklist_email_lower ON email_blacklist (LOWER(email));

      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS blacklist_expires_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS blacklist_reason TEXT;
    `);
  } catch (err: any) {
    console.warn('ensureBlacklistTable notice:', err.message);
  }
};

/**
 * Checks if an email is actively blacklisted
 */
export const checkEmailBlacklist = async (email?: string | null): Promise<BlacklistCheckResult> => {
  if (!email) return { isBlacklisted: false };
  const cleanEmail = email.trim().toLowerCase();

  // Instant filter for known attacker patterns and dummy/exploit domains
  if (
    cleanEmail.includes('blackmagicddr') ||
    cleanEmail.includes('hacker') ||
    cleanEmail.endsWith('@example.com') ||
    cleanEmail.endsWith('@test.com')
  ) {
    return {
      isBlacklisted: true,
      isPermanent: true,
      reason: 'Automated exploit pattern blocked',
      message: 'This email address is blocked from accessing Rentu.',
    };
  }

  try {
    const res = await query(
      `SELECT id, email, reason, expires_at, created_at 
       FROM email_blacklist 
       WHERE LOWER(email) = LOWER($1) 
       LIMIT 1`,
      [cleanEmail]
    );

    if (res.rows.length === 0) {
      return { isBlacklisted: false };
    }

    const row = res.rows[0];
    const now = new Date();

    // Check if temporary ban has expired
    if (row.expires_at) {
      const expiresAt = new Date(row.expires_at);
      if (expiresAt <= now) {
        // Expired - clean up automatically
        await query(`DELETE FROM email_blacklist WHERE id = $1`, [row.id]).catch(() => {});
        await query(
          `UPDATE users 
           SET is_blacklisted = FALSE, blacklist_expires_at = NULL, blacklist_reason = NULL 
           WHERE LOWER(email) = LOWER($1)`,
          [cleanEmail]
        ).catch(() => {});
        return { isBlacklisted: false };
      }

      const formattedDate = expiresAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      return {
        isBlacklisted: true,
        isPermanent: false,
        expiresAt: row.expires_at,
        reason: row.reason,
        message: `Your account (${cleanEmail}) has been suspended until ${formattedDate}. Reason: ${row.reason || 'Violation of community rules'}. Contact support if you believe this is an error.`,
      };
    }

    // Permanent ban
    return {
      isBlacklisted: true,
      isPermanent: true,
      expiresAt: null,
      reason: row.reason,
      message: `Your account (${cleanEmail}) has been permanently blacklisted from Rentu. Reason: ${row.reason || 'Violation of community rules'}. Contact support for review.`,
    };
  } catch (err: any) {
    if (err?.message?.includes('does not exist') || err?.message?.includes('relation "email_blacklist"')) {
      await ensureBlacklistTable();
    }
    return { isBlacklisted: false };
  }
};

/**
 * Blacklists an email for X days or permanently
 */
export const blacklistEmail = async (params: {
  email: string;
  days?: number | null;
  reason?: string;
  blacklistedBy?: string;
}): Promise<BlacklistRecord> => {
  const cleanEmail = params.email.trim().toLowerCase();

  if (isAdminEmail(cleanEmail)) {
    throw new Error('Authorized administrator accounts cannot be blacklisted.');
  }

  await ensureBlacklistTable();

  let expiresAt: Date | null = null;
  if (params.days && params.days > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + params.days);
  }

  const reason = params.reason?.trim() || 'Violation of community terms';

  const res = await query(
    `INSERT INTO email_blacklist (email, reason, blacklisted_by, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT ((LOWER(email))) DO UPDATE SET
       reason = EXCLUDED.reason,
       blacklisted_by = EXCLUDED.blacklisted_by,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()
     RETURNING id, email, reason, blacklisted_by, expires_at, created_at, updated_at`,
    [cleanEmail, reason, params.blacklistedBy || 'Admin', expiresAt]
  );

  // Mark user record in users table if exists
  await query(
    `UPDATE users 
     SET is_blacklisted = TRUE, 
         blacklist_expires_at = $1, 
         blacklist_reason = $2,
         updated_at = NOW()
     WHERE LOWER(email) = LOWER($3)`,
    [expiresAt, reason, cleanEmail]
  ).catch(() => {});

  return res.rows[0];
};

/**
 * Removes blacklist for an email
 */
export const removeEmailBlacklist = async (email: string): Promise<boolean> => {
  const cleanEmail = email.trim().toLowerCase();
  await ensureBlacklistTable();

  await query(`DELETE FROM email_blacklist WHERE LOWER(email) = LOWER($1)`, [cleanEmail]);

  await query(
    `UPDATE users 
     SET is_blacklisted = FALSE, 
         blacklist_expires_at = NULL, 
         blacklist_reason = NULL,
         updated_at = NOW()
     WHERE LOWER(email) = LOWER($1)`,
    [cleanEmail]
  ).catch(() => {});

  return true;
};
