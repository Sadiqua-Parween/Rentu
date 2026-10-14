import { createClient } from '@supabase/supabase-js';
import { ENV } from './env';

export const supabase = createClient(
  ENV.SUPABASE_URL || 'https://placeholder.supabase.co',
  ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export const BUCKET_NAME = 'item-photos';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Validates image buffer magic bytes against common image file headers
 */
export function isValidImageBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) return true;
  // GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
  if (buffer.subarray(0, 3).toString('ascii') === 'GIF') return true;
  // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return true;
  return false;
}

/**
 * Upload an image buffer to Supabase Storage with strict type and size validation
 */
export async function uploadItemPhoto(
  filePath: string,
  fileBuffer: Buffer,
  contentType: string = 'image/jpeg'
): Promise<string> {
  if (!ALLOWED_MIME_TYPES.has(contentType.toLowerCase())) {
    throw new Error(`Unsupported image type: ${contentType}. Allowed: JPEG, PNG, WEBP, GIF.`);
  }

  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(fileBuffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds 5MB limit.`);
  }

  if (!isValidImageBuffer(fileBuffer)) {
    throw new Error('Invalid image binary content.');
  }

  // Sanitize path (prevent directory traversal)
  const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\/+/, '');

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(sanitizedPath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw error;
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicData.publicUrl;
}

