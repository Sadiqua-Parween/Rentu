"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const db_1 = require("../../config/db");
const env_1 = require("../../config/env");
const realtime_service_1 = require("./realtime.service");
const router = (0, express_1.Router)();
async function authenticateSseRequest(req) {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    else if (req.query.token && typeof req.query.token === 'string') {
        token = req.query.token;
    }
    if (!token)
        return null;
    // 1. Try local JWT verification
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
        if (decoded && decoded.id) {
            const userRes = await (0, db_1.query)('SELECT id, name FROM users WHERE id = $1', [decoded.id]);
            if (userRes.rows.length > 0) {
                return { id: userRes.rows[0].id, name: userRes.rows[0].name };
            }
        }
    }
    catch {
        // Fall through to Firebase
    }
    // 2. Try Firebase ID token verification
    if (env_1.ENV.FIREBASE_PROJECT_ID && (0, app_1.getApps)().length > 0) {
        try {
            const decodedFb = await (0, auth_1.getAuth)().verifyIdToken(token);
            if (decodedFb && decodedFb.uid) {
                const userRes = await (0, db_1.query)('SELECT id, name FROM users WHERE firebase_uid = $1 OR id = $1', [decodedFb.uid]);
                if (userRes.rows.length > 0) {
                    return { id: userRes.rows[0].id, name: userRes.rows[0].name };
                }
            }
        }
        catch {
            // Token rejected
        }
    }
    return null;
}
/**
 * GET /api/realtime/stream
 * Authenticated Server-Sent Events stream for instant in-app notifications and messaging.
 */
router.get('/stream', async (req, res) => {
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
    realtime_service_1.RealtimeService.addClient(user.id, res);
});
exports.default = router;
