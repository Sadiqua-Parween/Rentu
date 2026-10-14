import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ENV } from '../../config/env';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { PushService } from './push.service';

const router = Router();

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url('Invalid push endpoint URL'),
    keys: z.object({
      p256dh: z.string().min(1, 'p256dh key is required'),
      auth: z.string().min(1, 'auth secret is required'),
    }),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url('Invalid push endpoint URL'),
});

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key needed by browsers to subscribe to push notifications.
 */
router.get('/vapid-public-key', (req: Request, res: Response) => {
  return sendSuccess(res, { publicKey: ENV.VAPID_PUBLIC_KEY });
});

/**
 * POST /api/push/subscribe
 * Register or update the authenticated user's push subscription
 */
router.post('/subscribe', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { subscription } = subscribeSchema.parse(req.body);
    const userId = req.user!.id;

    await PushService.saveSubscription(userId, subscription);
    return sendSuccess(res, { subscribed: true }, 'Push notifications registered successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/push/unsubscribe
 * Deregister the push subscription when user turns off notifications
 */
router.post('/unsubscribe', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { endpoint } = unsubscribeSchema.parse(req.body);
    const userId = req.user!.id;

    await PushService.removeSubscription(userId, endpoint);
    return sendSuccess(res, { subscribed: false }, 'Push notifications unregistered successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
