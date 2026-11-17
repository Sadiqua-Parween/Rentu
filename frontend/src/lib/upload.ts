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
 * Upload an image file directly to Cloudinary media storage via backend proxy (/api/upload).
 */
export async function uploadItemPhoto(file: File, folder: string = 'items'): Promise<string> {
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
    throw new Error(errJson.error?.message || errJson.message || `Media upload returned status ${res.status}`);
  }

  const json = await res.json();
  const url = json.data?.publicUrl || json.data?.url;
  if (!url) {
    throw new Error('Upload endpoint did not return an image URL');
  }
  return url;
}


