import { api } from './api';

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api` 
  : '/api';

const getHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('borrowflex_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const PushManagerClient = {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  getPermissionState(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return Notification.permission;
  },

  async isSubscribed(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!reg) return false;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch {
      return false;
    }
  },

  async subscribe(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported in this browser.');
    }

    // Explicit user permission prompt
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Fetch VAPID public key from backend
    const keyRes = await fetch(`${API_BASE}/push/vapid-public-key`);
    const keyData = await keyRes.json();
    const publicKey = keyData?.data?.publicKey;

    if (!publicKey) {
      throw new Error('VAPID public key not found on server.');
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // Subscribe via browser PushManager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    });

    // Save to backend
    const res = await fetch(`${API_BASE}/push/subscribe`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ subscription }),
    });

    if (!res.ok) {
      throw new Error('Failed to register push subscription on server.');
    }

    return true;
  },

  async unsubscribe(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!reg) return false;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return false;

      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      // Remove from backend
      await fetch(`${API_BASE}/push/unsubscribe`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ endpoint }),
      });

      return true;
    } catch (err) {
      console.warn('Error unsubscribing from push notifications:', err);
      return false;
    }
  },
};
