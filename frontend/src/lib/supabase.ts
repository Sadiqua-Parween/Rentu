import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://mkvpscrnqvkaddpmqtbm.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_4vho7OeDJupwXGGZn7TDFQ_Uryz7NwR';

const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const BUCKET_NAME = 'item-photos';

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api` 
  : '/api';

/**
 * Convert a File or Blob into a base64 data string
 */
function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Server-side upload fallback via backend proxy (/api/upload)
 */
async function uploadViaBackend(file: File, folder: string): Promise<string> {
  const base64Data = await fileToBase64(file);
  const token = localStorage.getItem('borrowflex_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'image/jpeg',
      folder,
      data: base64Data,
    }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error?.message || errJson.message || `Server upload returned status ${res.status}`);
  }

  const json = await res.json();
  const url = json.data?.publicUrl || json.data?.url;
  if (!url) {
    throw new Error('Upload endpoint did not return an image URL');
  }
  return url;
}

/**
 * Upload an image file directly to Cloudinary via backend proxy (/api/upload),
 * with automatic fallback to Supabase Storage if backend proxy fails.
 */
export async function uploadItemPhoto(file: File, folder: string = 'items'): Promise<string> {
  // Strategy 1: Primary Cloudinary upload via backend proxy
  try {
    return await uploadViaBackend(file, folder);
  } catch (backendErr: any) {
    console.warn('Backend Cloudinary upload notice, checking fallback storage:', backendErr);
  }

  // Strategy 2: Fallback to Supabase Storage if configured
  if (supabase) {
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const cleanExt = fileExt.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${cleanExt}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, {
          cacheControl: '3600',
          contentType: file.type || 'image/jpeg',
          upsert: true,
        });

      if (!error && data?.path) {
        const { data: publicData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(data.path);

        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      }
    } catch (clientErr) {
      console.warn('Fallback storage upload failed:', clientErr);
    }
  }

  throw new Error('Failed to upload photo. Please check your connection and try again.');
}
