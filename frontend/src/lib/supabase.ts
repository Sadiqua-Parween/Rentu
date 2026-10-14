import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const BUCKET_NAME = 'item-photos';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Upload an image file from the browser directly to Supabase Storage bucket
 * Enforces strict type, extension, and file size constraints.
 */
export async function uploadItemPhoto(file: File, folder: string = 'items'): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size of 5MB.`);
  }

  const rawExt = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(rawExt)) {
    throw new Error(`Invalid file extension '.${rawExt}'. Only JPEG, PNG, WEBP, and GIF images are permitted.`);
  }

  if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new Error(`Invalid file format '${file.type}'. Only standard image formats are accepted.`);
  }

  // Safe folder name (only alphanumeric)
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'items';
  // Safe UUID-based filename
  const safeId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const fileName = `${safeFolder}/${safeId}.${rawExt === 'jpeg' ? 'jpg' : rawExt}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
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

