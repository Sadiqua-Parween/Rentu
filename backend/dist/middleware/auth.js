"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.adminMiddleware = exports.isAdminEmail = exports.AUTHORIZED_ADMIN_EMAILS = exports.getAuthorizedAdminEmails = exports.optionalAuthMiddleware = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const env_1 = require("../config/env");
const db_1 = require("../config/db");
const response_1 = require("./response");
const blacklist_1 = require("../utils/blacklist");
// Initialize Firebase Admin securely for cryptographic token verification
try {
    const existingApps = (0, app_1.getApps)();
    if (!existingApps.length) {
        let credential = null;
        const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (rawSa) {
            try {
                let saObj;
                if (typeof rawSa === 'object') {
                    saObj = rawSa;
                }
                else if (rawSa.trim().startsWith('{')) {
                    saObj = JSON.parse(rawSa);
                }
                else {
                    try {
                        saObj = JSON.parse(Buffer.from(rawSa, 'base64').toString('utf-8'));
                    }
                    catch {
                        saObj = JSON.parse(rawSa);
                    }
                }
                credential = (0, app_1.cert)(saObj);
            }
            catch (err) {
                console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
            }
        }
        else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            try {
                credential = (0, app_1.cert)({
                    projectId: env_1.ENV.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                });
            }
            catch (err) {
                console.warn('Could not build credentials from FIREBASE_PRIVATE_KEY:', err.message);
            }
        }
        if (credential) {
            (0, app_1.initializeApp)({
                credential,
                projectId: env_1.ENV.FIREBASE_PROJECT_ID,
            });
            console.log('Firebase Admin initialized with verified service account credentials.');
        }
        else {
            (0, app_1.initializeApp)({ projectId: env_1.ENV.FIREBASE_PROJECT_ID });
        }
    }
}
catch (e) {
    console.warn('Firebase Admin init notice:', e.message);
}
async function resolveUserFromToken(token) {
    // 1. Try local Rentu⁺ JWT first (verified with HMAC signature)
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
        if (decoded && decoded.id) {
            // Verify user in database by strict ID
            const checkRes = await (0, db_1.query)('SELECT id, email, role, name FROM users WHERE id = $1', [decoded.id]);
            if (checkRes.rows.length > 0) {
                const u = checkRes.rows[0];
                return { id: u.id, email: u.email, role: u.role, name: u.name };
            }
            // If user is not found in database, they have been removed - do not resurrect them
            return null;
        }
    }
    catch {
        // Not a local token, try Firebase
    }
    // 2. Cryptographically verify Firebase ID token (checks signature, expiration, issuer, audience)
    try {
        const decodedToken = await (0, auth_1.getAuth)().verifyIdToken(token);
        if (decodedToken && decodedToken.uid) {
            const firebaseUid = decodedToken.uid;
            const isEmailVerified = Boolean(decodedToken.email_verified);
            const tokenEmail = decodedToken.email ? decodedToken.email.toLowerCase().trim() : null;
            // 1. Match by verified firebase_uid
            let userRes = await (0, db_1.query)('SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $1', [firebaseUid]);
            // 2. Only match by email IF the email is cryptographically verified by Firebase
            if (userRes.rows.length === 0 && tokenEmail && isEmailVerified) {
                userRes = await (0, db_1.query)('SELECT id, email, role, name FROM users WHERE LOWER(email) = LOWER($1)', [tokenEmail]);
            }
            // If user exists in database, return authenticated user
            if (userRes.rows.length > 0) {
                const u = userRes.rows[0];
                return { id: u.id, email: u.email, role: u.role, name: u.name };
            }
            // Anti-Account-Takeover: Block unverified email from colliding with an existing account
            if (tokenEmail && !isEmailVerified) {
                const conflict = await (0, db_1.query)('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [tokenEmail]);
                if (conflict.rows.length > 0) {
                    console.warn(`Blocked unverified email collision attempt for ${tokenEmail}`);
                    return null;
                }
            }
            // Auto-provision verified Firebase user in database
            try {
                const email = tokenEmail || `${firebaseUid}@firebase.rentu.internal`;
                const displayName = decodedToken.name || email.split('@')[0] || 'Rentu Member';
                const rawUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
                const autoUsername = `${rawUsername.slice(0, 18)}_${Date.now().toString().slice(-4)}`;
                const defaultAvatar = decodedToken.picture || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(displayName)}`;
                const created = await (0, db_1.query)(`INSERT INTO users (id, firebase_uid, email, name, username, locality, avatar_url, bio, role)
           VALUES ($1, $2, $3, $4, $5, '', $6, 'Member of the Rentu gear sharing community', 'USER')
           RETURNING id, email, role, name`, [firebaseUid, firebaseUid, email, displayName, autoUsername, defaultAvatar]);
                if (created.rows.length > 0) {
                    const u = created.rows[0];
                    return { id: u.id, email: u.email, role: u.role, name: u.name };
                }
            }
            catch (provisionErr) {
                console.warn('Auto-provisioning user in auth middleware notice:', provisionErr);
            }
            return null;
        }
    }
    catch {
        // Cryptographic signature/expiration verification failed
    }
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
        if (user.email && !(0, exports.isAdminEmail)(user.email)) {
            const blacklist = await (0, blacklist_1.checkEmailBlacklist)(user.email);
            if (blacklist.isBlacklisted) {
                return (0, response_1.sendError)(res, 'ACCOUNT_BLACKLISTED', blacklist.message || 'Your account has been blacklisted.', 403);
            }
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
const getAuthorizedAdminEmails = () => {
    const defaults = ['falaksadiqua786@gmail.com', 'rajsamriddhi60@gmail.com'];
    const envAdmins = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    return Array.from(new Set([...defaults, ...envAdmins]));
};
exports.getAuthorizedAdminEmails = getAuthorizedAdminEmails;
exports.AUTHORIZED_ADMIN_EMAILS = (0, exports.getAuthorizedAdminEmails)();
const isAdminEmail = (email) => {
    if (!email)
        return false;
    return (0, exports.getAuthorizedAdminEmails)().includes(email.trim().toLowerCase());
};
exports.isAdminEmail = isAdminEmail;
const adminMiddleware = async (req, res, next) => {
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
        if (user.role !== 'ADMIN' && !(0, exports.isAdminEmail)(user.email)) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access restricted to authorized platform administrators', 403);
        }
        next();
    }
    catch (err) {
        return (0, response_1.sendError)(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
    }
};
exports.adminMiddleware = adminMiddleware;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, response_1.sendError)(res, 'UNAUTHORIZED', 'Authentication required', 401);
        }
        if (role === 'ADMIN' && req.user.role !== 'ADMIN' && !(0, exports.isAdminEmail)(req.user.email)) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access restricted to authorized platform administrators', 403);
        }
        if (req.user.role !== role && req.user.role !== 'ADMIN') {
            return (0, response_1.sendError)(res, 'FORBIDDEN', `Role '${role}' required for this action`, 403);
        }
        next();
    };
};
exports.requireRole = requireRole;
