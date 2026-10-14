"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const notification_service_1 = require("../notifications/notification.service");
const realtime_service_1 = require("../realtime/realtime.service");
const router = (0, express_1.Router)();
const sendMessageSchema = zod_1.z.object({
    booking_id: zod_1.z.string().uuid('Invalid booking ID format'),
    receiver_id: zod_1.z.string().optional(),
    content: zod_1.z.string().trim().min(1, 'Message cannot be empty').max(2000, 'Message cannot exceed 2000 characters'),
});
// Get User's Active Conversations
router.get('/conversations', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Get bookings that involve the user, ordered by most recent message or booking date
        const result = await (0, db_1.query)(`SELECT * FROM (
        SELECT DISTINCT ON (b.id)
          b.id AS booking_id,
          b.status AS booking_status,
          b.start_date,
          b.duration_days,
          b.total_price,
          b.created_at AS booking_created_at,
          i.id AS item_id,
          i.title AS item_title,
          i.image_urls AS item_images,
          i.locality AS item_locality,
          i.price_per_day,
          CASE WHEN b.borrower_id = $1 THEN lender.id ELSE borrower.id END AS partner_id,
          CASE WHEN b.borrower_id = $1 THEN lender.name ELSE borrower.name END AS partner_name,
          CASE WHEN b.borrower_id = $1 THEN lender.avatar_url ELSE borrower.avatar_url END AS partner_avatar,
          CASE WHEN b.borrower_id = $1 THEN lender.phone ELSE borrower.phone END AS partner_phone,
          CASE WHEN b.borrower_id = $1 THEN 'Lender' ELSE 'Renter' END AS partner_role,
          m.content AS last_message,
          m.created_at AS last_message_at
        FROM bookings b
        JOIN items i ON b.item_id = i.id
        JOIN users borrower ON b.borrower_id = borrower.id
        JOIN users lender ON b.lender_id = lender.id
        LEFT JOIN LATERAL (
          SELECT content, created_at FROM messages 
          WHERE booking_id = b.id 
          ORDER BY created_at DESC LIMIT 1
        ) m ON true
        WHERE (b.borrower_id = $1 OR b.lender_id = $1)
        ORDER BY b.id, m.created_at DESC NULLS LAST
      ) convos
      ORDER BY COALESCE(last_message_at, booking_created_at) DESC`, [userId]);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
// Get Messages for a Booking
router.get('/:bookingId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        const userId = req.user.id;
        const uuidValidation = zod_1.z.string().uuid().safeParse(bookingId);
        if (!uuidValidation.success) {
            return (0, response_1.sendError)(res, 'INVALID_BOOKING_ID', 'Invalid booking ID format', 400);
        }
        // Ensure user is part of the booking
        const bookingCheck = await (0, db_1.query)(`SELECT id, borrower_id, lender_id FROM bookings WHERE id = $1`, [bookingId]);
        if (bookingCheck.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Conversation not found', 404);
        }
        const booking = bookingCheck.rows[0];
        if (booking.borrower_id !== userId && booking.lender_id !== userId) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access denied to this conversation', 403);
        }
        const bookingRes = await (0, db_1.query)(`SELECT 
        b.*, 
        i.title AS item_title, 
        i.image_urls AS item_images, 
        i.price_per_day,
        i.locality AS item_locality,
        CASE WHEN b.borrower_id = $2 THEN lender.id ELSE borrower.id END AS partner_id,
        CASE WHEN b.borrower_id = $2 THEN lender.name ELSE borrower.name END AS partner_name,
        CASE WHEN b.borrower_id = $2 THEN lender.avatar_url ELSE borrower.avatar_url END AS partner_avatar,
        CASE WHEN b.borrower_id = $2 THEN lender.phone ELSE borrower.phone END AS partner_phone,
        CASE WHEN b.borrower_id = $2 THEN 'Lender' ELSE 'Renter' END AS partner_role
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       JOIN users borrower ON b.borrower_id = borrower.id
       JOIN users lender ON b.lender_id = lender.id
       WHERE b.id = $1`, [bookingId, userId]);
        const messagesRes = await (0, db_1.query)(`SELECT 
        m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.created_at,
        u.name AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.booking_id = $1
       ORDER BY m.created_at ASC`, [bookingId]);
        return (0, response_1.sendSuccess)(res, {
            booking: bookingRes.rows[0],
            messages: messagesRes.rows,
        });
    }
    catch (error) {
        next(error);
    }
});
// Send Message
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const validated = sendMessageSchema.parse(req.body);
        const senderId = req.user.id;
        // Verify booking membership
        const bookingRes = await (0, db_1.query)(`SELECT id, borrower_id, lender_id FROM bookings WHERE id = $1`, [validated.booking_id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        if (booking.borrower_id !== senderId && booking.lender_id !== senderId) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Cannot send message to this booking', 403);
        }
        // Securely derive legitimate recipient from database record (cannot be spoofed by client)
        const legitimateReceiverId = booking.borrower_id === senderId ? booking.lender_id : booking.borrower_id;
        const result = await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [validated.booking_id, senderId, legitimateReceiverId, validated.content]);
        const message = result.rows[0];
        // Format message with sender display details for instant real-time consumption
        const messageWithSender = {
            ...message,
            sender_name: req.user.name,
        };
        // 1. Deliver in real-time to receiver and sender immediately via SSE
        realtime_service_1.RealtimeService.sendToUser(legitimateReceiverId, 'message', messageWithSender);
        realtime_service_1.RealtimeService.sendToUser(senderId, 'message', messageWithSender);
        // 2. Trigger in-app notification & web push to the message recipient
        await notification_service_1.NotificationService.create({
            userId: legitimateReceiverId,
            type: 'NEW_MESSAGE',
            title: `Message from ${req.user.name}`,
            body: validated.content.length > 80 ? `${validated.content.substring(0, 80)}...` : validated.content,
            data: {
                booking_id: booking.id,
                message_id: message.id,
                sender_id: senderId,
                sender_name: req.user.name,
            },
        });
        return (0, response_1.sendSuccess)(res, messageWithSender, 'Message sent');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
