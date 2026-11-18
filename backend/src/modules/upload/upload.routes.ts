import crypto from 'crypto';
import { Router, Response } from 'express';
import { ENV } from '../../config/env';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB max upload limit matching chat attachments

const ALLOWED_MIME_TYPES = [
  // Images (Standard web image formats for listings, avatars, and proof photos)
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  // Documents (Safe rental agreements, receipts, or verification documents)
  'application/pdf',
];

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: base64Data, filename, contentType = 'image/jpeg', folder = 'items' } = req.body;

    if (!base64Data) {
      return sendError(res, 'BAD_REQUEST', 'File data is required', 400);
    }

    const cleanContentType = String(contentType).toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.includes(cleanContentType)) {
      return sendError(res, 'BAD_REQUEST', 'Unsupported file type. Please upload images, videos, or documents up to 25 MB.', 400);
    }

    // Strip data URL prefix if present (e.g. data:image/jpeg;base64, data:video/mp4;base64, etc.)
    const cleanBase64 = base64Data.replace(/^data:[a-zA-Z0-9/+-]+;base64,/i, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return sendError(res, 'BAD_REQUEST', 'File exceeds the maximum upload limit of 25 MB', 400);
    }

    // Cryptographic magic byte verification for images
    if (cleanContentType.startsWith('image/')) {
      const isJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
      const isPng = buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      const isGif = buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
      const isWebp = buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
      const isSvg = cleanContentType === 'image/svg+xml' && buffer.toString('utf8', 0, Math.min(buffer.length, 100)).includes('<svg');
      const isBmp = buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4D;

      if (!isJpeg && !isPng && !isGif && !isWebp && !isSvg && !isBmp) {
        return sendError(res, 'BAD_REQUEST', 'Invalid file contents: Uploaded file does not contain genuine image bytes', 400);
      }

      // XSS Prevention: Disallow scripts and executable event handlers inside SVG images
      if (cleanContentType === 'image/svg+xml') {
        const svgContent = buffer.toString('utf8');
        if (
          /<script\b/i.test(svgContent) ||
          /javascript\s*:/i.test(svgContent) ||
          /\bon[a-zA-Z]+\s*=/i.test(svgContent) ||
          /<foreignObject\b/i.test(svgContent) ||
          /<use\b[^>]*href\s*=\s*["']?data:/i.test(svgContent) ||
          /<animate\b/i.test(svgContent) ||
          /<set\b/i.test(svgContent)
        ) {
          return sendError(res, 'BAD_REQUEST', 'Security policy violation: SVG contains executable or dynamic script content', 400);
        }
      }
    }

    const safeFolder = ['items', 'avatars', 'banners', 'requests', 'chat', 'chat_videos', 'chat_photos', 'chat_files', 'chat_docs'].includes(folder) ? folder : 'items';

    // Cloudinary Upload
    if (!ENV.CLOUDINARY_CLOUD_NAME || !ENV.CLOUDINARY_API_KEY || !ENV.CLOUDINARY_API_SECRET) {
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Cloudinary media storage is not configured', 500);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const strToSign = `folder=${safeFolder}&timestamp=${timestamp}${ENV.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(strToSign).digest('hex');

    const formData = new URLSearchParams();
    formData.append('file', `data:${cleanContentType};base64,${cleanBase64}`);
    formData.append('api_key', ENV.CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', safeFolder);

    const resCloudinary = await fetch(`https://api.cloudinary.com/v1_1/${ENV.CLOUDINARY_CLOUD_NAME}/auto/upload`, {
      method: 'POST',
      body: formData,
    });

    const dataCloudinary = await resCloudinary.json();
    if (dataCloudinary.secure_url) {
      return sendSuccess(res, {
        publicUrl: dataCloudinary.secure_url,
        url: dataCloudinary.secure_url,
        path: dataCloudinary.public_id,
      });
    }

    console.error('Cloudinary upload failure:', dataCloudinary.error?.message || dataCloudinary);
    return sendError(res, 'UPLOAD_FAILED', dataCloudinary.error?.message || 'Media upload failed', 500);
  } catch (err: any) {
    console.error('Backend upload handler error:', err);
    const isProd = ENV.NODE_ENV === 'production';
    return sendError(res, 'INTERNAL_SERVER_ERROR', isProd ? 'An error occurred during file upload.' : (err.message || 'Upload failed'), 500);
  }
});

export default router;
