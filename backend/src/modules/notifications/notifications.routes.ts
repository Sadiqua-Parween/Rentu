import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { NotificationService } from './notification.service';

const router = Router();

// All notification endpoints require authenticated user
router.use(authMiddleware);

const getNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  unread_only: z.enum(['true', 'false']).optional(),
});

/**
 * GET /api/notifications
 * Fetch notifications belonging strictly to the authenticated user.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const query = getNotificationsQuerySchema.parse(req.query);
    const unreadOnly = query.unread_only === 'true';

    const [notifications, unreadCount] = await Promise.all([
      NotificationService.getUserNotifications(userId, {
        limit: query.limit,
        offset: query.offset,
        unreadOnly,
      }),
      NotificationService.getUnreadCount(userId),
    ]);

    return sendSuccess(res, {
      notifications,
      unread_count: unreadCount,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/unread-count
 * Fast endpoint for badge counts.
 */
router.get('/unread-count', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const count = await NotificationService.getUnreadCount(userId);
    return sendSuccess(res, { unread_count: count });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark an individual notification as read.
 */
router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Validate UUID format
    const uuidValidation = z.string().uuid().safeParse(id);
    if (!uuidValidation.success) {
      return sendError(res, 'INVALID_ID', 'Notification ID must be a valid UUID', 400);
    }

    // Verify ownership strictly
    const checkRes = await query('SELECT user_id, read_at FROM notifications WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Notification not found', 404);
    }

    if (checkRes.rows[0].user_id !== userId) {
      return sendError(res, 'FORBIDDEN', 'Access denied: notification belongs to another user', 403);
    }

    const updated = await NotificationService.markAsRead(id, userId);
    return sendSuccess(res, updated || { id, read: true }, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications belonging to the authenticated user as read.
 */
router.patch('/read-all', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const count = await NotificationService.markAllAsRead(userId);
    return sendSuccess(res, { marked_count: count, count }, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
});


export default router;
