import { api } from './api';

const ITEMS_KEY = 'rentu_favorites';
const REQUESTS_KEY = 'rentu_favorite_requests';

// Get array of saved item IDs
export const getFavoriteItemIds = (): string[] => {
  try {
    const data = JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

// Get array of saved request IDs
export const getFavoriteRequestIds = (): string[] => {
  try {
    const data = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

// Check if an item is favorited
export const isItemFavorited = (itemId: string): boolean => {
  if (!itemId) return false;
  return getFavoriteItemIds().includes(String(itemId));
};

// Check if a request is favorited
export const isRequestFavorited = (requestId: string): boolean => {
  if (!requestId) return false;
  return getFavoriteRequestIds().includes(String(requestId));
};

// Total count of saved items + requests
export const getTotalSavedCount = (): number => {
  return getFavoriteItemIds().length + getFavoriteRequestIds().length;
};

// Toggle an item favorite
export const toggleItemFavorite = async (itemId: string): Promise<boolean> => {
  if (!itemId) return false;
  const current = getFavoriteItemIds();
  const exists = current.includes(itemId);
  const updated = exists ? current.filter(id => id !== itemId) : [...current, itemId];
  
  localStorage.setItem(ITEMS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('rentu_favorites_updated'));

  // Sync with backend if logged in
  try {
    const token = localStorage.getItem('token');
    if (token) {
      if (exists) {
        await api.removeFavorite('ITEM', itemId).catch(() => {});
      } else {
        await api.addFavorite(itemId, 'ITEM').catch(() => {});
      }
    }
  } catch {}

  return !exists;
};

// Toggle a request favorite
export const toggleRequestFavorite = async (requestId: string): Promise<boolean> => {
  if (!requestId) return false;
  const current = getFavoriteRequestIds();
  const exists = current.includes(requestId);
  const updated = exists ? current.filter(id => id !== requestId) : [...current, requestId];
  
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('rentu_favorites_updated'));

  // Sync with backend if logged in
  try {
    const token = localStorage.getItem('token');
    if (token) {
      if (exists) {
        await api.removeFavorite('REQUEST', requestId).catch(() => {});
      } else {
        await api.addFavorite(requestId, 'REQUEST').catch(() => {});
      }
    }
  } catch {}

  return !exists;
};

// Sync with backend on login
export const syncFavoritesWithBackend = async (): Promise<void> => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Send local IDs to backend
    const localItemIds = getFavoriteItemIds();
    const localRequestIds = getFavoriteRequestIds();

    if (localItemIds.length > 0 || localRequestIds.length > 0) {
      await api.batchSyncFavorites(localItemIds, localRequestIds).catch(() => {});
    }

    // Pull full merged list from backend
    const res = await api.getFavorites().catch(() => null);
    if (res && Array.isArray(res.item_ids) && Array.isArray(res.request_ids)) {
      localStorage.setItem(ITEMS_KEY, JSON.stringify(res.item_ids));
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(res.request_ids));
      window.dispatchEvent(new Event('rentu_favorites_updated'));
    }
  } catch (err) {
    console.error('Failed to sync favorites with backend:', err);
  }
};
