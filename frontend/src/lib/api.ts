import { 
  User, 
  Item, 
  CommunityRequest, 
  Booking, 
  Message, 
  Conversation, 
  CommunityPulse, 
  CategoryStat,
  AppNotification
} from './types';


const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api` 
  : '/api';

export class ApiError extends Error {
  code: string;
  details?: any;
  constructor(message: string, code: string = 'UNKNOWN', details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

const getHeaders = () => {
  const token = localStorage.getItem('borrowflex_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const errorInfo = json.error || {};
    const fallbackMsg = res.status === 401 
      ? 'Please sign in to complete this action.' 
      : res.status === 500 
      ? 'Backend service is initializing. Please try again in a moment.'
      : `Request failed (HTTP ${res.status})`;
    throw new ApiError(
      errorInfo.message || fallbackMsg,
      errorInfo.code || `HTTP_${res.status}`,
      errorInfo.details
    );
  }
  return json.data as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async register(data: {
    email: string;
    password: string;
    name: string;
    locality: string;
    phone?: string;
    avatar_url?: string;
    bio?: string;
  }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async demoLogin(role: 'lender' | 'borrower' | 'admin' | 'creator'): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    return handleResponse(res);
  },

  async firebaseSync(data: {
    firebaseUid: string;
    email: string;
    name: string;
    idToken?: string;
    avatarUrl?: string;
    locality?: string;
    phone?: string;
  }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/firebase-sync`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },



  async getMe(): Promise<User & { stats: any }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Items
  async getItems(params?: {
    category?: string;
    search?: string;
    locality?: string;
    status?: string;
    ownerId?: string;
  }): Promise<Item[]> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'All') query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    if (params?.locality) query.append('locality', params.locality);
    if (params?.status) query.append('status', params.status);
    if (params?.ownerId) query.append('ownerId', params.ownerId);

    const res = await fetch(`${API_BASE}/items?${query.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getItem(id: string): Promise<Item> {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createItem(data: {
    title: string;
    description: string;
    category: string;
    price_per_day: number;
    max_duration_days: number;
    image_urls: string[];
    sticker_badge: string;
    locality: string;
  }): Promise<Item> {
    const res = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateItem(id: string, data: Partial<Item>): Promise<Item> {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteItem(id: string): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Requests / Bounties
  async getRequests(params?: {
    category?: string;
    locality?: string;
    status?: string;
    seekerId?: string;
  }): Promise<CommunityRequest[]> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'All') query.append('category', params.category);
    if (params?.locality) query.append('locality', params.locality);
    if (params?.status) query.append('status', params.status);
    if (params?.seekerId) query.append('seekerId', params.seekerId);

    const res = await fetch(`${API_BASE}/requests?${query.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createRequest(data: {
    item_name: string;
    description: string;
    category: string;
    start_date: string;
    start_time?: string;
    duration_days: number;
    offered_amount: number;
    locality: string;
  }): Promise<CommunityRequest> {
    const res = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateRequestStatus(id: string, status: 'OPEN' | 'FULFILLED' | 'CANCELLED'): Promise<CommunityRequest> {
    const res = await fetch(`${API_BASE}/requests/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res);
  },

  // Bookings
  async getBookings(role?: 'borrower' | 'lender'): Promise<Booking[]> {
    const query = role ? `?role=${role}` : '';
    const res = await fetch(`${API_BASE}/bookings${query}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async createBooking(data: {
    item_id: string;
    start_date: string;
    start_time?: string;
    duration_days: number;
    message?: string;
  }): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateBookingStatus(id: string, status: 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res);
  },

  // Analytics ("Hustle Hub")
  async getAnalytics(): Promise<{
    pulse: CommunityPulse;
    categories: CategoryStat[];
    topLenders: any[];
  }> {
    const res = await fetch(`${API_BASE}/analytics/overview`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Messages & Coordination
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE}/messages/conversations`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getMessages(bookingId: string): Promise<{ booking: Booking; messages: Message[] }> {
    const res = await fetch(`${API_BASE}/messages/${bookingId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async sendMessage(booking_id: string, content: string, receiver_id?: string): Promise<Message> {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ booking_id, content, receiver_id }),
    });
    return handleResponse(res);
  },

  async markMessagesAsRead(bookingId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/messages/${bookingId}/read`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },


  // Users
  async getUser(id: string): Promise<User & { items: Item[]; stats: any }> {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const res = await fetch(`${API_BASE}/users/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // In-App Notifications
  async getNotifications(params?: { unreadOnly?: boolean; limit?: number; offset?: number }): Promise<{
    notifications: AppNotification[];
    total: number;
    unread_count: number;
    limit: number;
    offset: number;
  }> {
    const query = new URLSearchParams();
    if (params?.unreadOnly) query.append('unreadOnly', 'true');
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    const res = await fetch(`${API_BASE}/notifications?${query.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getUnreadNotificationCount(): Promise<{ unread_count: number }> {
    const res = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async markNotificationAsRead(id: string): Promise<AppNotification> {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async markAllNotificationsAsRead(): Promise<{ success: boolean; count: number }> {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Rentu AI Assistant
  async getAiStatus(): Promise<{
    configured: boolean;
    provider: string;
    model: string;
    instructions: string;
  }> {
    const res = await fetch(`${API_BASE}/ai/status`);
    return handleResponse(res);
  },

  async getAiSuggestions(): Promise<Array<{ label: string; prompt: string }>> {
    const res = await fetch(`${API_BASE}/ai/suggestions`);
    return handleResponse(res);
  },

  async sendAiChat(
    messages: Array<{ role: string; content: string }>,
    contextItemId?: string
  ): Promise<{
    message: string;
    listings?: Item[];
    comparison?: any;
    availability?: any;
    toolsUsed?: string[];
    isGenerative: boolean;
    setupNotice?: string;
  }> {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        messages,
        contextItemId: contextItemId || undefined,
      }),
    });
    return handleResponse(res);
  },

  async checkItemAvailability(
    itemId: string,
    startDate?: string,
    durationDays?: number
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/ai/tools/availability`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        itemId,
        startDate,
        durationDays,
      }),
    });
    return handleResponse(res);
  },
};

