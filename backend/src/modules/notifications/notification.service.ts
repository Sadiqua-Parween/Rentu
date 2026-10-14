import { query } from '../../config/db';
import { RealtimeService } from '../realtime/realtime.service';
import { PushService } from '../push/push.service';

export type NotificationType = 
  | 'BOOKING_REQUEST'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_COMPLETED'
  | 'NEW_MESSAGE'
  | 'SYSTEM';

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export const NotificationService = {
  /**
   * Safely create an in-app notification.
   * Dispatches real-time SSE stream events and Web Push notifications.
   * If notification delivery fails, it logs without interrupting parent workflows.
   */
  async create(params: CreateNotificationParams): Promise<NotificationRecord | null> {
    try {
      const { userId, type, title, body, data = {} } = params;
      if (!userId || !title || !body) {
        console.warn('NotificationService.create: missing required parameters', { userId, title });
        return null;
      }

      const res = await query<NotificationRecord>(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING *`,
        [userId, type, title, body, JSON.stringify(data)]
      );

      const notif = res.rows[0] || null;

      if (notif) {
        // 1. Instant in-app delivery via Server-Sent Events
        RealtimeService.sendToUser(userId, 'notification', notif);

        // 2. Browser Web Push notification for background/tab-switching
        PushService.sendPushToUser(userId, {
          title,
          body,
          url: data?.booking_id ? `/bookings` : '/',
          tag: `notif-${type}-${data?.booking_id || notif.id}`,
          data: {
            notification_id: notif.id,
            type,
            ...data,
          },
        }).catch((pushErr) => {
          console.warn('Web push dispatch error:', pushErr);
        });
      }

      return notif;
    } catch (err) {
      console.error('Failed to create in-app notification:', err);
      return null;
    }
  },


  /**
   * Fetch notifications belonging exclusively to the authenticated user.
   */
  async getUserNotifications(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): Promise<NotificationRecord[]> {
    const limit = Math.min(Math.max(options.limit || 20, 1), 50);
    const offset = Math.max(options.offset || 0, 0);

    let sql = `
      SELECT id, user_id, type, title, body, data, read_at, created_at
      FROM notifications
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (options.unreadOnly) {
      sql += ` AND read_at IS NULL`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    params.push(limit, offset);

    const res = await query<NotificationRecord>(sql, params);
    return res.rows;
  },

  /**
   * Get unread notification count for authenticated user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const res = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );

    return parseInt(res.rows[0]?.count || '0', 10);
  },

  /**
   * Mark an individual notification as read.
   * Strictly verifies that the notification belongs to the authenticated user.
   */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationRecord | null> {
    const res = await query<NotificationRecord>(
      `UPDATE notifications
       SET read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL
       RETURNING *`,
      [notificationId, userId]
    );

    return res.rows[0] || null;
  },

  /**
   * Mark all unread notifications belonging to the authenticated user as read.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const res = await query(
      `UPDATE notifications
       SET read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );

    return res.rowCount || 0;
  },
};
