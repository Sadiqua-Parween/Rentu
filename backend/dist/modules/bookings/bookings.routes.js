"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const notification_service_1 = require("../notifications/notification.service");
const router = (0, express_1.Router)();
const createBookingSchema = zod_1.z.object({
    item_id: zod_1.z.string().uuid('Invalid item ID format'),
    start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    start_time: zod_1.z.string().optional(),
    duration_days: zod_1.z.number().int().positive('Duration must be at least 1 day').max(90, 'Duration cannot exceed 90 days'),
    message: zod_1.z.string().max(2000, 'Message cannot exceed 2000 characters').optional(),
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED']),
});
// Create Booking Proposal ("Snag for the Weekend")
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const validated = createBookingSchema.parse(req.body);
        const borrowerId = req.user.id;
        // Validate date is not in the past
        const startDateObj = new Date(`${validated.start_date}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (isNaN(startDateObj.getTime()) || startDateObj < today) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Start date cannot be in the past', 400);
        }
        // Fetch Item & Owner
        const itemRes = await (0, db_1.query)('SELECT id, owner_id, price_per_day, title, status, max_duration_days FROM items WHERE id = $1', [validated.item_id]);
        if (itemRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Item not found', 404);
        }
        const item = itemRes.rows[0];
        if (item.status === 'UNAVAILABLE') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This gear is currently marked unavailable', 400);
        }
        if (item.owner_id === borrowerId) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'You cannot borrow your own gear 😉', 400);
        }
        if (item.max_duration_days && validated.duration_days > item.max_duration_days) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', `Maximum rental duration for this item is ${item.max_duration_days} days`, 400);
        }
        // Check for overlapping confirmed/accepted bookings (prevent double-booking)
        const overlapRes = await (0, db_1.query)(`SELECT id FROM bookings
       WHERE item_id = $1
         AND status = 'ACCEPTED'
         AND start_date <= ($2::date + ($3::integer - 1) * INTERVAL '1 day')
         AND ($2::date <= start_date + (duration_days - 1) * INTERVAL '1 day')`, [item.id, validated.start_date, validated.duration_days]);
        if (overlapRes.rows.length > 0) {
            return (0, response_1.sendError)(res, 'CONFLICT', 'This item already has a confirmed booking for the selected dates', 409);
        }
        const totalPrice = Number(item.price_per_day) * validated.duration_days;
        const bookingRes = await (0, db_1.query)(`INSERT INTO bookings
        (item_id, borrower_id, lender_id, start_date, start_time, duration_days, total_price, status, message)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)
       RETURNING *`, [
            item.id,
            borrowerId,
            item.owner_id,
            validated.start_date,
            validated.start_time || '10:00',
            validated.duration_days,
            totalPrice,
            validated.message || `Hey! Would love to rent your ${item.title}.`,
        ]);
        const booking = bookingRes.rows[0];
        // Seed initial message if provided
        if (validated.message) {
            await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, $4)`, [booking.id, borrowerId, item.owner_id, validated.message]);
        }
        // Trigger in-app notification to the item owner
        await notification_service_1.NotificationService.create({
            userId: item.owner_id,
            type: 'BOOKING_REQUEST',
            title: `New Rental Proposal for ${item.title}`,
            body: `${req.user.name} requested to rent your ${item.title} for ${validated.duration_days} day(s).`,
            data: {
                booking_id: booking.id,
                item_id: item.id,
                borrower_id: borrowerId,
                borrower_name: req.user.name,
                start_date: validated.start_date,
                duration_days: validated.duration_days,
                total_price: totalPrice,
            },
        });
        return (0, response_1.sendSuccess)(res, booking, 'Proposal sent to lender! You will be notified when they accept.', 201);
    }
    catch (error) {
        next(error);
    }
});
// Get User's Bookings (as Borrower and Lender)
router.get('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { role } = req.query; // 'borrower' | 'lender' | all
        let sql = `
      SELECT 
        b.id, b.item_id, b.borrower_id, b.lender_id, 
        b.start_date, b.start_time, b.duration_days, b.total_price, 
        b.status, b.message, b.created_at,
        i.title AS item_title, i.image_urls AS item_images, i.category AS item_category,
        i.locality AS item_locality, i.price_per_day AS item_rate,
        borrower.name AS borrower_name, borrower.avatar_url AS borrower_avatar, 
        borrower.phone AS borrower_phone, borrower.email AS borrower_email,
        lender.name AS lender_name, lender.avatar_url AS lender_avatar,
        lender.phone AS lender_phone, lender.email AS lender_email
      FROM bookings b
      JOIN items i ON b.item_id = i.id
      JOIN users borrower ON b.borrower_id = borrower.id
      JOIN users lender ON b.lender_id = lender.id
      WHERE (b.borrower_id = $1 OR b.lender_id = $1)
    `;
        const params = [userId];
        if (role === 'borrower') {
            sql += ` AND b.borrower_id = $1`;
        }
        else if (role === 'lender') {
            sql += ` AND b.lender_id = $1`;
        }
        sql += ` ORDER BY b.created_at DESC`;
        const result = await (0, db_1.query)(sql, params);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
// Update Booking Status (Accept / Reject / Complete / Cancel)
router.patch('/:id/status', auth_1.authMiddleware, async (req, res, next) => {
    const client = await db_1.pool.connect();
    try {
        const { id } = req.params;
        const { status: targetStatus } = updateStatusSchema.parse(req.body);
        const userId = req.user.id;
        await client.query('BEGIN');
        // Lock booking row for update to prevent concurrent race conditions
        const bookingRes = await client.query(`SELECT b.*, i.title AS item_title, lender.name AS lender_name, borrower.name AS borrower_name
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       JOIN users lender ON b.lender_id = lender.id
       JOIN users borrower ON b.borrower_id = borrower.id
       WHERE b.id = $1
       FOR UPDATE OF b`, [id]);
        if (bookingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        const isLender = booking.lender_id === userId;
        const isBorrower = booking.borrower_id === userId;
        const isAdmin = req.user.role === 'ADMIN';
        if (!isLender && !isBorrower && !isAdmin) {
            await client.query('ROLLBACK');
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Permission denied for this booking', 403);
        }
        // Terminal states cannot be changed
        const terminalStates = ['REJECTED', 'COMPLETED', 'CANCELLED'];
        if (terminalStates.includes(booking.status)) {
            await client.query('ROLLBACK');
            return (0, response_1.sendError)(res, 'BAD_REQUEST', `Booking is already in terminal state '${booking.status}' and cannot be updated`, 400);
        }
        // State Transition Rules
        if (targetStatus === 'ACCEPTED' || targetStatus === 'REJECTED') {
            if (!isLender && !isAdmin) {
                await client.query('ROLLBACK');
                return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the gear owner can accept or reject proposals', 403);
            }
            if (booking.status !== 'PENDING') {
                await client.query('ROLLBACK');
                return (0, response_1.sendError)(res, 'BAD_REQUEST', `Only PENDING proposals can be ${targetStatus.toLowerCase()}`, 400);
            }
        }
        if (targetStatus === 'COMPLETED') {
            if (booking.status !== 'ACCEPTED') {
                await client.query('ROLLBACK');
                return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Only ACCEPTED bookings can be marked as COMPLETED', 400);
            }
        }
        if (targetStatus === 'CANCELLED') {
            if (booking.status !== 'PENDING' && booking.status !== 'ACCEPTED') {
                await client.query('ROLLBACK');
                return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Only PENDING or ACCEPTED bookings can be cancelled', 400);
            }
        }
        // If accepting, ensure no other active reservation overlaps
        if (targetStatus === 'ACCEPTED') {
            const overlapRes = await client.query(`SELECT id FROM bookings
         WHERE item_id = $1
           AND id != $2
           AND status = 'ACCEPTED'
           AND start_date <= ($3::date + ($4::integer - 1) * INTERVAL '1 day')
           AND ($3::date <= start_date + (duration_days - 1) * INTERVAL '1 day')`, [booking.item_id, booking.id, booking.start_date, booking.duration_days]);
            if (overlapRes.rows.length > 0) {
                await client.query('ROLLBACK');
                return (0, response_1.sendError)(res, 'CONFLICT', 'Cannot accept: another booking is already confirmed for these dates', 409);
            }
        }
        // Update status
        const updateRes = await client.query(`UPDATE bookings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`, [targetStatus, id]);
        // Sync item status if accepted or completed
        if (targetStatus === 'ACCEPTED') {
            await client.query(`UPDATE items SET status = 'RENTED' WHERE id = $1`, [booking.item_id]);
            await client.query(`INSERT INTO messages (booking_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, '🎉 Proposal accepted! You can coordinate pickup/dropoff here.')`, [id, booking.lender_id, booking.borrower_id]);
        }
        else if (targetStatus === 'COMPLETED' || targetStatus === 'CANCELLED' || targetStatus === 'REJECTED') {
            // Revert item to AVAILABLE if no other overlapping accepted bookings exist
            const activeAccepted = await client.query(`SELECT id FROM bookings WHERE item_id = $1 AND status = 'ACCEPTED' AND id != $2`, [booking.item_id, booking.id]);
            if (activeAccepted.rows.length === 0) {
                await client.query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
            }
        }
        await client.query('COMMIT');
        const updatedBooking = updateRes.rows[0];
        // Trigger in-app notifications
        if (targetStatus === 'ACCEPTED') {
            await notification_service_1.NotificationService.create({
                userId: booking.borrower_id,
                type: 'BOOKING_ACCEPTED',
                title: 'Proposal Accepted! 🎉',
                body: `${booking.lender_name || 'The owner'} accepted your rental request for ${booking.item_title}. Coordinate pickup now!`,
                data: { booking_id: booking.id, item_id: booking.item_id },
            });
        }
        else if (targetStatus === 'REJECTED') {
            await notification_service_1.NotificationService.create({
                userId: booking.borrower_id,
                type: 'BOOKING_REJECTED',
                title: 'Rental Request Declined',
                body: `${booking.lender_name || 'The owner'} was unable to accept your request for ${booking.item_title}.`,
                data: { booking_id: booking.id, item_id: booking.item_id },
            });
        }
        else if (targetStatus === 'CANCELLED') {
            const recipientId = userId === booking.lender_id ? booking.borrower_id : booking.lender_id;
            await notification_service_1.NotificationService.create({
                userId: recipientId,
                type: 'BOOKING_CANCELLED',
                title: 'Booking Cancelled',
                body: `The booking for ${booking.item_title} was cancelled by ${req.user.name}.`,
                data: { booking_id: booking.id, item_id: booking.item_id },
            });
        }
        else if (targetStatus === 'COMPLETED') {
            const recipientId = userId === booking.lender_id ? booking.borrower_id : booking.lender_id;
            await notification_service_1.NotificationService.create({
                userId: recipientId,
                type: 'BOOKING_COMPLETED',
                title: 'Rental Completed! 🌟',
                body: `The rental for ${booking.item_title} has been marked complete. Don't forget to leave a review!`,
                data: { booking_id: booking.id, item_id: booking.item_id },
            });
        }
        return (0, response_1.sendSuccess)(res, updatedBooking, `Proposal updated to ${targetStatus}`);
    }
    catch (error) {
        await client.query('ROLLBACK').catch(() => { });
        next(error);
    }
    finally {
        client.release();
    }
});
exports.default = router;
