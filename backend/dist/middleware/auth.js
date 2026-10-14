"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.optionalAuthMiddleware = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const env_1 = require("../config/env");
const db_1 = require("../config/db");
const response_1 = require("./response");
// Initialize Firebase Admin app if configured
if (env_1.ENV.FIREBASE_PROJECT_ID && (0, app_1.getApps)().length === 0) {
    try {
        (0, app_1.initializeApp)({
            projectId: env_1.ENV.FIREBASE_PROJECT_ID,
        });
    }
    catch (err) {
        console.warn('Firebase Admin initialization notice:', err);
    }
}
async function resolveUserFromToken(token) {
    // 1. Try local Rentu⁺ JWT first (cryptographically verified with server secret)
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
        if (decoded && decoded.id) {
            const checkRes = await (0, db_1.query)('SELECT id, email, role, name FROM users WHERE id = $1', [decoded.id]);
            if (checkRes.rows.length > 0) {
                const u = checkRes.rows[0];
                return { id: u.id, email: u.email, role: u.role, name: u.name };
            }
        }
    }
    catch {
        // Not a valid local JWT, fall through to Firebase verification
    }
    // 2. Try Firebase ID token (strictly verified using Firebase Admin SDK)
    if (env_1.ENV.FIREBASE_PROJECT_ID && (0, app_1.getApps)().length > 0) {
        try {
            const decodedFb = await (0, auth_1.getAuth)().verifyIdToken(token);
            if (decodedFb && decodedFb.uid) {
                const firebaseUid = decodedFb.uid;
                const email = decodedFb.email || `${firebaseUid}@firebase.rentu.internal`;
                const name = decodedFb.name || 'User';
                let userRes = await (0, db_1.query)('SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $2', [firebaseUid, firebaseUid]);
                if (userRes.rows.length === 0) {
                    // Provision verified Firebase user in database
                    await (0, db_1.query)(`INSERT INTO users (id, firebase_uid, name, email, role)
             VALUES ($1, $2, $3, $4, 'USER')
             ON CONFLICT (id) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid, updated_at = NOW();`, [firebaseUid, firebaseUid, name, email]).catch(() => { });
                    userRes = await (0, db_1.query)('SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $1', [firebaseUid]);
                }
                if (userRes.rows.length > 0) {
                    const u = userRes.rows[0];
                    return { id: u.id, email: u.email, role: u.role, name: u.name };
                }
            }
        }
        catch {
            // Token rejected by Firebase Admin SDK
        }
    }
    // Never accept unverified tokens, decoded claims without signatures, or arbitrary mock tokens
    return null;
}
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return (0, response_1.sendError)(res, 'UNAUTHORIZED', 'Access token required', 401);
    }
    const token = authHeader.split(' ')[1];
    try {
        const user = await resolveUserFromToken(token);
        if (!user) {
            return (0, response_1.sendError)(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
        }
        req.user = user;
        next();
    }
    catch (err) {
        return (0, response_1.sendError)(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
    }
};
exports.authMiddleware = authMiddleware;
const optionalAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const user = await resolveUserFromToken(token);
            if (user) {
                req.user = user;
            }
        }
        catch {
            // ignore token error for optional auth
        }
    }
    next();
};
exports.optionalAuthMiddleware = optionalAuthMiddleware;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, response_1.sendError)(res, 'UNAUTHORIZED', 'Authentication required', 401);
        }
        if (req.user.role !== role && req.user.role !== 'ADMIN') {
            return (0, response_1.sendError)(res, 'FORBIDDEN', `Role '${role}' required for this action`, 403);
        }
        next();
    };
};
exports.requireRole = requireRole;
