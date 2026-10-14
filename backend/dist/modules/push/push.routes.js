"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const env_1 = require("../../config/env");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const push_service_1 = require("./push.service");
const router = (0, express_1.Router)();
const subscribeSchema = zod_1.z.object({
    subscription: zod_1.z.object({
        endpoint: zod_1.z.string().url('Invalid push endpoint URL'),
        keys: zod_1.z.object({
            p256dh: zod_1.z.string().min(1, 'p256dh key is required'),
            auth: zod_1.z.string().min(1, 'auth secret is required'),
        }),
    }),
});
const unsubscribeSchema = zod_1.z.object({
    endpoint: zod_1.z.string().url('Invalid push endpoint URL'),
});
/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key needed by browsers to subscribe to push notifications.
 */
router.get('/vapid-public-key', (req, res) => {
    return (0, response_1.sendSuccess)(res, { publicKey: env_1.ENV.VAPID_PUBLIC_KEY });
});
/**
 * POST /api/push/subscribe
 * Register or update the authenticated user's push subscription
 */
router.post('/subscribe', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { subscription } = subscribeSchema.parse(req.body);
        const userId = req.user.id;
        await push_service_1.PushService.saveSubscription(userId, subscription);
        return (0, response_1.sendSuccess)(res, { subscribed: true }, 'Push notifications registered successfully');
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/push/unsubscribe
 * Deregister the push subscription when user turns off notifications
 */
router.post('/unsubscribe', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { endpoint } = unsubscribeSchema.parse(req.body);
        const userId = req.user.id;
        await push_service_1.PushService.removeSubscription(userId, endpoint);
        return (0, response_1.sendSuccess)(res, { subscribed: false }, 'Push notifications unregistered successfully');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
