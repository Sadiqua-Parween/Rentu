export interface User {
  id: string;
  firebase_uid?: string;
  email: string;
  name: string;
  phone?: string;
  locality: string;
  address_text?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  trust_score?: number;
  role: 'USER' | 'ADMIN';
  created_at: string;
}

export interface Item {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  price_per_day: number | string;
  max_duration_days: number;
  image_urls: string[];
  sticker_badge: string;
  locality: string;
  status: 'AVAILABLE' | 'RENTED' | 'UNAVAILABLE';
  created_at: string;
  owner_name?: string;
  owner_avatar?: string;
  owner_locality?: string;
  owner_trust_score?: number;
  owner_rating?: number | string;
  owner_bio?: string;
  owner_phone?: string;
  owner_email?: string;
  total_price?: number;
  duration_days?: number;
  related_items?: Item[];
}

export interface CommunityRequest {
  id: string;
  seeker_id: string;
  item_name: string;
  description: string;
  category: string;
  start_date: string;
  start_time?: string;
  duration_days: number;
  offered_amount: number | string;
  locality: string;
  status: 'OPEN' | 'FULFILLED' | 'CANCELLED';
  created_at: string;
  seeker_name?: string;
  seeker_avatar?: string;
  seeker_locality?: string;
  seeker_trust_score?: number;
  seeker_phone?: string;
  seeker_email?: string;
}

export interface Booking {
  id: string;
  item_id: string;
  borrower_id: string;
  lender_id: string;
  start_date: string;
  start_time?: string;
  duration_days: number;
  total_price: number | string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
  message?: string;
  created_at: string;
  item_title?: string;
  item_images?: string[];
  item_category?: string;
  item_locality?: string;
  item_rate?: number | string;
  price_per_day?: number | string;
  borrower_name?: string;
  borrower_avatar?: string;
  borrower_phone?: string;
  borrower_email?: string;
  lender_name?: string;
  lender_avatar?: string;
  lender_phone?: string;
  lender_email?: string;
}

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
  status?: 'sending' | 'sent' | 'failed';
  is_read?: boolean;
  read_at?: string;
}

export interface Conversation {
  booking_id: string;
  booking_status: string;
  start_date: string;
  duration_days: number;
  total_price: number | string;
  item_title: string;
  item_images?: string[];
  item_locality?: string;
  partner_id: string;
  partner_name: string;
  partner_avatar?: string;
  partner_phone?: string;
  partner_role?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}


export interface CommunityPulse {
  total_users: number;
  active_lenders: number;
  active_borrowers: number;
  available_gear: number;
  currently_rented_gear: number;
  total_bookings: number;
  completed_bookings: number;
  total_community_volume: number;
  open_wishes: number;
  fulfilled_wishes: number;
}

export interface CategoryStat {
  category: string;
  count: number;
  avg_rate: number;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  listings?: Item[];
  comparison?: any;
  availability?: any;
  toolsUsed?: string[];
  setupNotice?: string;
  timestamp: string;
}

export interface AiStatusResponse {
  configured: boolean;
  provider: string;
  model: string;
  instructions: string;
}

export interface AiSuggestion {
  label: string;
  prompt: string;
}


