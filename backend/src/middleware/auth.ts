import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ENV } from '../config/env';
import { query } from '../config/db';
import { sendError } from './response';

// Initialize Firebase Admin app if configured
if (ENV.FIREBASE_PROJECT_ID && getApps().length === 0) {
  try {
    initializeApp({
      projectId: ENV.FIREBASE_PROJECT_ID,
    });
  } catch (err) {
    console.warn('Firebase Admin initialization notice:', err);
  }
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

async function resolveUserFromToken(token: string): Promise<AuthUser | null> {
  // 1. Try local Rentu⁺ JWT first (cryptographically verified with server secret)
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as AuthUser;
    if (decoded && decoded.id) {
      const checkRes = await query(
        'SELECT id, email, role, name FROM users WHERE id = $1',
        [decoded.id]
      );
      if (checkRes.rows.length > 0) {
        const u = checkRes.rows[0];
        return { id: u.id, email: u.email, role: u.role, name: u.name };
      }
    }
  } catch {
    // Not a valid local JWT, fall through to Firebase verification
  }

  // 2. Try Firebase ID token (strictly verified using Firebase Admin SDK)
  if (ENV.FIREBASE_PROJECT_ID && getApps().length > 0) {
    try {
      const decodedFb = await getAuth().verifyIdToken(token);
      if (decodedFb && decodedFb.uid) {
        const firebaseUid = decodedFb.uid;
        const email = decodedFb.email || `${firebaseUid}@firebase.rentu.internal`;
        const name = (decodedFb.name as string) || 'User';

        let userRes = await query(
          'SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $2',
          [firebaseUid, firebaseUid]
        );

        if (userRes.rows.length === 0) {
          // Provision verified Firebase user in database
          await query(
            `INSERT INTO users (id, firebase_uid, name, email, role)
             VALUES ($1, $2, $3, $4, 'USER')
             ON CONFLICT (id) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid, updated_at = NOW();`,
            [firebaseUid, firebaseUid, name, email]
          ).catch(() => {});

          userRes = await query(
            'SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $1',
            [firebaseUid]
          );
        }

        if (userRes.rows.length > 0) {
          const u = userRes.rows[0];
          return { id: u.id, email: u.email, role: u.role, name: u.name };
        }
      }
    } catch {
      // Token rejected by Firebase Admin SDK
    }
  }

  // Never accept unverified tokens, decoded claims without signatures, or arbitrary mock tokens
  return null;
}


export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'UNAUTHORIZED', 'Access token required', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      return sendError(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
    }
    req.user = user;
    next();
  } catch (err) {
    return sendError(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
  }
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const user = await resolveUserFromToken(token);
      if (user) {
        req.user = user;
      }
    } catch {
      // ignore token error for optional auth
    }
  }
  next();
};

export const requireRole = (role: 'USER' | 'ADMIN') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }
    if (req.user.role !== role && req.user.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', `Role '${role}' required for this action`, 403);
    }
    next();
  };
};
