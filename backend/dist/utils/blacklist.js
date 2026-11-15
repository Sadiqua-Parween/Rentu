"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEmailBlacklist = exports.blacklistEmail = exports.checkEmailBlacklist = exports.ensureBlacklistTable = void 0;
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
/**
 * Ensures table and columns exist in PostgreSQL/Supabase
 */
const ensureBlacklistTable = async () => {
    try {
        await (0, db_1.query)(`
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
    }
    catch (err) {
        console.warn('ensureBlacklistTable notice:', err.message);
    }
};
exports.ensureBlacklistTable = ensureBlacklistTable;
/**
 * Checks if an email is actively blacklisted
 */
const checkEmailBlacklist = async (email) => {
    if (!email)
        return { isBlacklisted: false };
    const cleanEmail = email.trim().toLowerCase();
    try {
        const res = await (0, db_1.query)(`SELECT id, email, reason, expires_at, created_at 
       FROM email_blacklist 
       WHERE LOWER(email) = LOWER($1) 
       LIMIT 1`, [cleanEmail]);
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
                await (0, db_1.query)(`DELETE FROM email_blacklist WHERE id = $1`, [row.id]).catch(() => { });
                await (0, db_1.query)(`UPDATE users 
           SET is_blacklisted = FALSE, blacklist_expires_at = NULL, blacklist_reason = NULL 
           WHERE LOWER(email) = LOWER($1)`, [cleanEmail]).catch(() => { });
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
    }
    catch (err) {
        if (err?.message?.includes('does not exist') || err?.message?.includes('relation "email_blacklist"')) {
            await (0, exports.ensureBlacklistTable)();
        }
        return { isBlacklisted: false };
    }
};
exports.checkEmailBlacklist = checkEmailBlacklist;
/**
 * Blacklists an email for X days or permanently
 */
const blacklistEmail = async (params) => {
    const cleanEmail = params.email.trim().toLowerCase();
    if ((0, auth_1.isAdminEmail)(cleanEmail)) {
        throw new Error('Authorized administrator accounts cannot be blacklisted.');
    }
    await (0, exports.ensureBlacklistTable)();
    let expiresAt = null;
    if (params.days && params.days > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + params.days);
    }
    const reason = params.reason?.trim() || 'Violation of community terms';
    const res = await (0, db_1.query)(`INSERT INTO email_blacklist (email, reason, blacklisted_by, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT ((LOWER(email))) DO UPDATE SET
       reason = EXCLUDED.reason,
       blacklisted_by = EXCLUDED.blacklisted_by,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()
     RETURNING id, email, reason, blacklisted_by, expires_at, created_at, updated_at`, [cleanEmail, reason, params.blacklistedBy || 'Admin', expiresAt]);
    // Mark user record in users table if exists
    await (0, db_1.query)(`UPDATE users 
     SET is_blacklisted = TRUE, 
         blacklist_expires_at = $1, 
         blacklist_reason = $2,
         updated_at = NOW()
     WHERE LOWER(email) = LOWER($3)`, [expiresAt, reason, cleanEmail]).catch(() => { });
    return res.rows[0];
};
exports.blacklistEmail = blacklistEmail;
/**
 * Removes blacklist for an email
 */
const removeEmailBlacklist = async (email) => {
    const cleanEmail = email.trim().toLowerCase();
    await (0, exports.ensureBlacklistTable)();
    await (0, db_1.query)(`DELETE FROM email_blacklist WHERE LOWER(email) = LOWER($1)`, [cleanEmail]);
    await (0, db_1.query)(`UPDATE users 
     SET is_blacklisted = FALSE, 
         blacklist_expires_at = NULL, 
         blacklist_reason = NULL,
         updated_at = NOW()
     WHERE LOWER(email) = LOWER($1)`, [cleanEmail]).catch(() => { });
    return true;
};
exports.removeEmailBlacklist = removeEmailBlacklist;
