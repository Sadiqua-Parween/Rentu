import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { NotificationService } from '../notifications/notification.service';
import { RealtimeService } from '../realtime/realtime.service';

const router = Router();

const sendMessageSchema = z.object({
  booking_id: z.string().uuid('Invalid booking ID format'),
  receiver_id: z.string().optional(),
  content: z.string().trim().min(1, 'Message cannot be empty').max(2000, 'Message cannot exceed 2000 characters'),
});

// Helper to get user's id and firebase_uid
async function getUserIdentity(userId: string): Promise<{ id: string; firebaseUid: string | null }> {
  const res = await query('SELECT id, firebase_uid FROM users WHERE id = $1', [userId]);
  return {
    id: userId,
    firebaseUid: res.rows[0]?.firebase_uid || null,
  };
}

// Get User's Active Conversations
router.get('/conversations', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { firebaseUid } = await getUserIdentity(userId);

    // Get bookings that involve the user, ordered by most recent message or booking date
    const result = await query(
      `SELECT * FROM (
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
          CASE WHEN (b.borrower_id = $1 OR ($2::text IS NOT NULL AND b.borrower_id = $2)) THEN lender.id ELSE borrower.id END AS partner_id,
          CASE WHEN (b.borrower_id = $1 OR ($2::text IS NOT NULL AND b.borrower_id = $2)) THEN lender.name ELSE borrower.name END AS partner_name,
          CASE WHEN (b.borrower_id = $1 OR ($2::text IS NOT NULL AND b.borrower_id = $2)) THEN lender.avatar_url ELSE borrower.avatar_url END AS partner_avatar,
          CASE WHEN (b.borrower_id = $1 OR ($2::text IS NOT NULL AND b.borrower_id = $2)) THEN lender.phone ELSE borrower.phone END AS partner_phone,
          CASE WHEN (b.borrower_id = $1 OR ($2::text IS NOT NULL AND b.borrower_id = $2)) THEN 'Lender' ELSE 'Renter' END AS partner_role,
          m.content AS last_message,
          m.created_at AS last_message_at,
          COALESCE(unread.unread_count, 0)::int AS unread_count
        FROM bookings b
        JOIN items i ON b.item_id = i.id
        JOIN users borrower ON (b.borrower_id = borrower.id OR (borrower.firebase_uid IS NOT NULL AND b.borrower_id = borrower.firebase_uid))
        JOIN users lender ON (b.lender_id = lender.id OR (lender.firebase_uid IS NOT NULL AND b.lender_id = lender.firebase_uid))
        LEFT JOIN LATERAL (
          SELECT content, created_at FROM messages 
          WHERE booking_id = b.id 
          ORDER BY created_at DESC LIMIT 1
        ) m ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS unread_count
          FROM messages
          WHERE booking_id = b.id AND (receiver_id = $1 OR ($2::text IS NOT NULL AND receiver_id = $2)) AND is_read = false
        ) unread ON true
        WHERE (b.borrower_id = $1 OR b.lender_id = $1 OR ($2::text IS NOT NULL AND (b.borrower_id = $2 OR b.lender_id = $2)))
        ORDER BY b.id, m.created_at DESC NULLS LAST
      ) convos
      ORDER BY COALESCE(last_message_at, booking_created_at) DESC`,
      [userId, firebaseUid]
    );

    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Get Messages for a Booking
router.get('/:bookingId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;
    const { firebaseUid } = await getUserIdentity(userId);

    const uuidValidation = z.string().uuid().safeParse(bookingId);
    if (!uuidValidation.success) {
      return sendError(res, 'INVALID_BOOKING_ID', 'Invalid booking ID format', 400);
    }

    // Ensure user is part of the booking
    const bookingCheck = await query(
      `SELECT id, borrower_id, lender_id FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (bookingCheck.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Conversation not found', 404);
    }

    const booking = bookingCheck.rows[0];
    const isBorrower = booking.borrower_id === userId || (firebaseUid && booking.borrower_id === firebaseUid);
    const isLender = booking.lender_id === userId || (firebaseUid && booking.lender_id === firebaseUid);

    if (!isBorrower && !isLender) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this conversation', 403);
    }

    // Mark unread messages sent to this user as read
    const updateRes = await query(
      `UPDATE messages 
       SET is_read = true, read_at = NOW() 
       WHERE booking_id = $1 AND (receiver_id = $2 OR ($3::text IS NOT NULL AND receiver_id = $3)) AND is_read = false
       RETURNING id, sender_id`,
      [bookingId, userId, firebaseUid]
    ).catch(() => ({ rows: [] }));

    if (updateRes.rows && updateRes.rows.length > 0) {
      // Broadcast to other participant that messages have been read
      const otherParticipantId = isBorrower ? booking.lender_id : booking.borrower_id;
      RealtimeService.sendToUsers([otherParticipantId], 'messages_read', { booking_id: bookingId });
    }

    // Also mark corresponding in-app notifications as read
    await query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE (user_id = $2 OR ($3::text IS NOT NULL AND user_id = $3)) AND (data->>'booking_id')::text = $1 AND read_at IS NULL`,
      [bookingId, userId, firebaseUid]
    ).catch(() => {});

    const bookingRes = await query(
      `SELECT 
        b.*, 
        i.title AS item_title, 
        i.image_urls AS item_images, 
        i.price_per_day,
        i.locality AS item_locality,
        CASE WHEN (b.borrower_id = $2 OR ($3::text IS NOT NULL AND b.borrower_id = $3)) THEN lender.id ELSE borrower.id END AS partner_id,
        CASE WHEN (b.borrower_id = $2 OR ($3::text IS NOT NULL AND b.borrower_id = $3)) THEN lender.name ELSE borrower.name END AS partner_name,
        CASE WHEN (b.borrower_id = $2 OR ($3::text IS NOT NULL AND b.borrower_id = $3)) THEN lender.avatar_url ELSE borrower.avatar_url END AS partner_avatar,
        CASE WHEN (b.borrower_id = $2 OR ($3::text IS NOT NULL AND b.borrower_id = $3)) THEN lender.phone ELSE borrower.phone END AS partner_phone,
        CASE WHEN (b.borrower_id = $2 OR ($3::text IS NOT NULL AND b.borrower_id = $3)) THEN 'Lender' ELSE 'Renter' END AS partner_role
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       JOIN users borrower ON (b.borrower_id = borrower.id OR (borrower.firebase_uid IS NOT NULL AND b.borrower_id = borrower.firebase_uid))
       JOIN users lender ON (b.lender_id = lender.id OR (lender.firebase_uid IS NOT NULL AND b.lender_id = lender.firebase_uid))
       WHERE b.id = $1`,
      [bookingId, userId, firebaseUid]
    );

    const messagesRes = await query(
      `SELECT 
        m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.created_at,
        m.is_read, m.read_at,
        COALESCE(u.name, 'Member') AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       LEFT JOIN users u ON (m.sender_id = u.id OR (u.firebase_uid IS NOT NULL AND m.sender_id = u.firebase_uid))
       WHERE m.booking_id = $1
       ORDER BY m.created_at ASC`,
      [bookingId]
    );

    return sendSuccess(res, {
      booking: bookingRes.rows[0],
      messages: messagesRes.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Send Message
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = sendMessageSchema.parse(req.body);
    const senderId = req.user!.id;
    const { firebaseUid } = await getUserIdentity(senderId);

    // Verify booking membership
    const bookingRes = await query(
      `SELECT id, borrower_id, lender_id FROM bookings WHERE id = $1`,
      [validated.booking_id]
    );

    if (bookingRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookingRes.rows[0];
    const isBorrower = booking.borrower_id === senderId || (firebaseUid && booking.borrower_id === firebaseUid);
    const isLender = booking.lender_id === senderId || (firebaseUid && booking.lender_id === firebaseUid);

    if (!isBorrower && !isLender) {
      return sendError(res, 'FORBIDDEN', 'Cannot send message to this booking', 403);
    }

    // Securely derive legitimate recipient from database record (cannot be spoofed by client)
    const legitimateReceiverId = isBorrower ? booking.lender_id : booking.borrower_id;

    // Fetch receiver details to ensure delivery across any user aliases
    const receiverRes = await query(
      'SELECT id, firebase_uid, name FROM users WHERE id = $1 OR firebase_uid = $1',
      [legitimateReceiverId]
    );
    const receiverObj = receiverRes.rows[0];
    const receiverAliases = [legitimateReceiverId, receiverObj?.id, receiverObj?.firebase_uid].filter(Boolean);
    const senderAliases = [senderId, firebaseUid].filter(Boolean);

    const result = await query(
      `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [validated.booking_id, senderId, legitimateReceiverId, validated.content]
    );

    const message = result.rows[0];

    // Fetch sender avatar for complete payload
    const senderUserRes = await query('SELECT avatar_url FROM users WHERE id = $1', [senderId]);
    const senderAvatar = senderUserRes.rows[0]?.avatar_url || null;

    // Format message with sender display details for instant real-time consumption
    const messageWithSender = {
      ...message,
      sender_name: req.user!.name,
      sender_avatar: senderAvatar,
      status: 'sent',
    };

    // 1. Deliver in real-time to receiver and sender immediately via SSE
    RealtimeService.sendToUsers(receiverAliases, 'message', messageWithSender);
    RealtimeService.sendToUsers(senderAliases, 'message', messageWithSender);

    // 2. Trigger in-app notification & web push to the message recipient
    await NotificationService.create({
      userId: receiverObj?.id || legitimateReceiverId,
      type: 'NEW_MESSAGE',
      title: `Message from ${req.user!.name}`,
      body: validated.content.length > 80 ? `${validated.content.substring(0, 80)}...` : validated.content,
      data: {
        booking_id: booking.id,
        message_id: message.id,
        sender_id: senderId,
        sender_name: req.user!.name,
      },
    });

    return sendSuccess(res, messageWithSender, 'Message sent', 200);
  } catch (error) {
    next(error);
  }
});

// Explicitly mark conversation messages as read
router.patch('/:bookingId/read', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;
    const { firebaseUid } = await getUserIdentity(userId);

    const uuidValidation = z.string().uuid().safeParse(bookingId);
    if (!uuidValidation.success) {
      return sendError(res, 'INVALID_BOOKING_ID', 'Invalid booking ID format', 400);
    }

    const bookingRes = await query(
      `SELECT id, borrower_id, lender_id FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (bookingRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookingRes.rows[0];
    const isBorrower = booking.borrower_id === userId || (firebaseUid && booking.borrower_id === firebaseUid);
    const isLender = booking.lender_id === userId || (firebaseUid && booking.lender_id === firebaseUid);

    if (!isBorrower && !isLender) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this conversation', 403);
    }

    const updateRes = await query(
      `UPDATE messages 
       SET is_read = true, read_at = NOW() 
       WHERE booking_id = $1 AND (receiver_id = $2 OR ($3::text IS NOT NULL AND receiver_id = $3)) AND is_read = false
       RETURNING id`,
      [bookingId, userId, firebaseUid]
    ).catch(() => ({ rows: [] }));

    if (updateRes.rows && updateRes.rows.length > 0) {
      const otherParticipantId = isBorrower ? booking.lender_id : booking.borrower_id;
      RealtimeService.sendToUsers([otherParticipantId], 'messages_read', { booking_id: bookingId });
    }

    await query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE (user_id = $2 OR ($3::text IS NOT NULL AND user_id = $3)) AND (data->>'booking_id')::text = $1 AND read_at IS NULL`,
      [bookingId, userId, firebaseUid]
    ).catch(() => {});

    return sendSuccess(res, { success: true }, 'Messages marked as read');
  } catch (error) {
    next(error);
  }
});

export default router;
