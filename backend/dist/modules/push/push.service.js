"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushService = void 0;
const web_push_1 = __importDefault(require("web-push"));
const db_1 = require("../../config/db");
const env_1 = require("../../config/env");
// Configure Web Push VAPID credentials
if (env_1.ENV.VAPID_PUBLIC_KEY && env_1.ENV.VAPID_PRIVATE_KEY) {
    try {
        web_push_1.default.setVapidDetails(env_1.ENV.VAPID_SUBJECT, env_1.ENV.VAPID_PUBLIC_KEY, env_1.ENV.VAPID_PRIVATE_KEY);
    }
    catch (err) {
        console.warn('Failed to initialize web-push VAPID details:', err);
    }
}
class PushService {
    /**
     * Save or update a user's browser push subscription
     */
    static async saveSubscription(userId, subscription) {
        if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
            throw new Error('Invalid push subscription object');
        }
        await (0, db_1.query)(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE 
         SET user_id = EXCLUDED.user_id,
             p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth,
             created_at = CURRENT_TIMESTAMP;`, [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]);
    }
    /**
     * Remove a user's browser push subscription (when disabling notifications)
     */
    static async removeSubscription(userId, endpoint) {
        await (0, db_1.query)(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2;`, [userId, endpoint]);
    }
    /**
     * Send a Web Push notification to all active devices registered by the user
     */
    static async sendPushToUser(userId, payload) {
        try {
            const subsRes = await (0, db_1.query)(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1;`, [userId]);
            if (subsRes.rows.length === 0)
                return;
            const notificationData = JSON.stringify({
                title: payload.title,
                body: payload.body,
                icon: payload.icon || '/favicon.ico',
                badge: payload.badge || '/favicon.ico',
                url: payload.url || '/',
                tag: payload.tag || 'rentu-notification',
                data: payload.data || {},
            });
            const sendPromises = subsRes.rows.map(async (sub) => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                };
                try {
                    await web_push_1.default.sendNotification(pushSubscription, notificationData);
                }
                catch (err) {
                    // If subscription has expired or unsubscribed (404/410), prune it from database
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        await (0, db_1.query)('DELETE FROM push_subscriptions WHERE id = $1;', [sub.id]).catch(() => { });
                    }
                    else {
                        console.warn(`Web push delivery failed for endpoint ${sub.endpoint.substring(0, 30)}...:`, err.message);
                    }
                }
            });
            await Promise.all(sendPromises);
        }
        catch (err) {
            console.warn('Error in PushService.sendPushToUser:', err);
        }
    }
}
exports.PushService = PushService;
