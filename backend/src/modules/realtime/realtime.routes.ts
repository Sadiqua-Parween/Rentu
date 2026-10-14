import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { query } from '../../config/db';
import { ENV } from '../../config/env';
import { RealtimeService } from './realtime.service';

const router = Router();

async function authenticateSseRequest(req: Request): Promise<{ id: string; firebase_uid?: string | null; name: string } | null> {
  let token = '';

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) return null;

  // 1. Try local JWT verification
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
    if (decoded && decoded.id) {
      const userRes = await query('SELECT id, firebase_uid, name FROM users WHERE id = $1', [decoded.id]);
      if (userRes.rows.length > 0) {
        return { 
          id: userRes.rows[0].id, 
          firebase_uid: userRes.rows[0].firebase_uid,
          name: userRes.rows[0].name 
        };
      }
    }
  } catch {
    // Fall through to Firebase
  }

  // 2. Try Firebase ID token verification
  if (ENV.FIREBASE_PROJECT_ID && getApps().length > 0) {
    try {
      const decodedFb = await getAuth().verifyIdToken(token);
      if (decodedFb && decodedFb.uid) {
        const userRes = await query(
          'SELECT id, firebase_uid, name FROM users WHERE firebase_uid = $1 OR id = $1',
          [decodedFb.uid]
        );
        if (userRes.rows.length > 0) {
          return { 
            id: userRes.rows[0].id, 
            firebase_uid: userRes.rows[0].firebase_uid,
            name: userRes.rows[0].name 
          };
        }
      }
    } catch {
      // Token rejected
    }
  }

  return null;
}

/**
 * GET /api/realtime/stream
 * Authenticated Server-Sent Events stream for instant in-app notifications and messaging.
 */
router.get('/stream', async (req: Request, res: Response) => {
  const user = await authenticateSseRequest(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized: Valid token required for real-time stream' });
    return;
  }

  // SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.flushHeaders?.();

  RealtimeService.addClient(user.id, res);
  if (user.firebase_uid && user.firebase_uid !== user.id) {
    RealtimeService.addClient(user.firebase_uid, res);
  }
});

export default router;
