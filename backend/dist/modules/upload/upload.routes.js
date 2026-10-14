"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const supabase_1 = require("../../config/supabase");
const response_1 = require("../../middleware/response");
const router = (0, express_1.Router)();
const uploadPayloadSchema = zod_1.z.object({
    base64Data: zod_1.z.string().min(1, 'Base64 image data is required'),
    contentType: zod_1.z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).default('image/jpeg'),
    folder: zod_1.z.enum(['items', 'avatars', 'banners']).default('items'),
});
/**
 * POST /api/upload - Authenticated, validated image upload to Supabase Storage
 */
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { base64Data, contentType, folder } = uploadPayloadSchema.parse(req.body);
        // Strip data URL scheme prefix if present (e.g., data:image/png;base64,...)
        const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9-+.]+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        if (buffer.length > 5 * 1024 * 1024) {
            return (0, response_1.sendError)(res, 'PAYLOAD_TOO_LARGE', 'Uploaded image cannot exceed 5MB', 413);
        }
        const extMap = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/gif': 'gif',
        };
        const ext = extMap[contentType] || 'jpg';
        const uniqueName = `${crypto_1.default.randomUUID()}.${ext}`;
        const filePath = `${folder}/${uniqueName}`;
        const publicUrl = await (0, supabase_1.uploadItemPhoto)(filePath, buffer, contentType);
        return (0, response_1.sendSuccess)(res, { url: publicUrl, path: filePath }, 'Image uploaded successfully', 201);
    }
    catch (err) {
        if (err.message?.includes('Invalid image binary content') || err.message?.includes('Unsupported image type')) {
            return (0, response_1.sendError)(res, 'INVALID_FILE', err.message, 400);
        }
        next(err);
    }
});
exports.default = router;
