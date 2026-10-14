"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const notification_service_1 = require("./notification.service");
const router = (0, express_1.Router)();
// All notification endpoints require authenticated user
router.use(auth_1.authMiddleware);
const getNotificationsQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(20),
    offset: zod_1.z.coerce.number().int().min(0).default(0),
    unread_only: zod_1.z.enum(['true', 'false']).optional(),
});
/**
 * GET /api/notifications
 * Fetch notifications belonging strictly to the authenticated user.
 */
router.get('/', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const query = getNotificationsQuerySchema.parse(req.query);
        const unreadOnly = query.unread_only === 'true';
        const [notifications, unreadCount] = await Promise.all([
            notification_service_1.NotificationService.getUserNotifications(userId, {
                limit: query.limit,
                offset: query.offset,
                unreadOnly,
            }),
            notification_service_1.NotificationService.getUnreadCount(userId),
        ]);
        return (0, response_1.sendSuccess)(res, {
            notifications,
            unread_count: unreadCount,
            limit: query.limit,
            offset: query.offset,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/notifications/unread-count
 * Fast endpoint for badge counts.
 */
router.get('/unread-count', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const count = await notification_service_1.NotificationService.getUnreadCount(userId);
        return (0, response_1.sendSuccess)(res, { unread_count: count });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /api/notifications/:id/read
 * Mark an individual notification as read.
 */
router.patch('/:id/read', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        // Validate UUID format
        const uuidValidation = zod_1.z.string().uuid().safeParse(id);
        if (!uuidValidation.success) {
            return (0, response_1.sendError)(res, 'INVALID_ID', 'Notification ID must be a valid UUID', 400);
        }
        // Verify ownership strictly
        const checkRes = await (0, db_1.query)('SELECT user_id, read_at FROM notifications WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Notification not found', 404);
        }
        if (checkRes.rows[0].user_id !== userId) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access denied: notification belongs to another user', 403);
        }
        const updated = await notification_service_1.NotificationService.markAsRead(id, userId);
        return (0, response_1.sendSuccess)(res, updated || { id, read: true }, 'Notification marked as read');
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /api/notifications/read-all
 * Mark all notifications belonging to the authenticated user as read.
 */
router.patch('/read-all', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const count = await notification_service_1.NotificationService.markAllAsRead(userId);
        return (0, response_1.sendSuccess)(res, { marked_count: count, count }, 'All notifications marked as read');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
