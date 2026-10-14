import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';
 import { uploadItemPhoto } from '../../config/supabase';
import { sendError, sendSuccess } from '../../middleware/response';

const router = Router();

const uploadPayloadSchema = z.object({
  base64Data: z.string().min(1, 'Base64 image data is required'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).default('image/jpeg'),
  folder: z.enum(['items', 'avatars', 'banners']).default('items'),
});

/**
 * POST /api/upload - Authenticated, validated image upload to Supabase Storage
 */
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { base64Data, contentType, folder } = uploadPayloadSchema.parse(req.body);

    // Strip data URL scheme prefix if present (e.g., data:image/png;base64,...)
    const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9-+.]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      return sendError(res, 'PAYLOAD_TOO_LARGE', 'Uploaded image cannot exceed 5MB', 413);
    }

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const ext = extMap[contentType] || 'jpg';
    const uniqueName = `${crypto.randomUUID()}.${ext}`;
    const filePath = `${folder}/${uniqueName}`;

    const publicUrl = await uploadItemPhoto(filePath, buffer, contentType);

    return sendSuccess(res, { url: publicUrl, path: filePath }, 'Image uploaded successfully', 201);
  } catch (err: any) {
    if (err.message?.includes('Invalid image binary content') || err.message?.includes('Unsupported image type')) {
      return sendError(res, 'INVALID_FILE', err.message, 400);
    }
    next(err);
  }
});

export default router;
