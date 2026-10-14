import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Search, 
  ArrowLeft, 
  MessageSquare, 
  Loader2, 
  AlertCircle, 
  CheckCheck, 
  Clock, 
  RotateCw, 
  Tag, 
  Calendar, 
  MapPin, 
  Sparkles, 
  Phone, 
  CheckCircle2, 
  Wifi, 
  WifiOff 
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { Conversation, Message, Booking } from '../lib/types';
import { RealtimeClient, RealtimeConnectionStatus } from '../lib/realtime';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBookingId?: string | null;
  onNavigateToExplore?: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  initialBookingId,
  onNavigateToExplore,
}) => {
  const { user, isAuthenticated } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(initialBookingId || null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [showMobileThread, setShowMobileThread] = useState<boolean>(!!initialBookingId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>(RealtimeClient.getStatus());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Track realtime connection status
  useEffect(() => {
    setConnectionStatus(RealtimeClient.getStatus());
    const unsub = RealtimeClient.on('status_change', (status: RealtimeConnectionStatus) => {
      setConnectionStatus(status);
    });
    return () => unsub();
  }, []);

  // Load conversations when modal opens
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadConversations();
    }
  }, [isOpen, isAuthenticated]);

  // Handle initialBookingId changes
  useEffect(() => {
    if (initialBookingId) {
      setSelectedBookingId(initialBookingId);
      setShowMobileThread(true);
    }
  }, [initialBookingId]);

  // Load messages when selected booking changes
  useEffect(() => {
    if (isOpen && selectedBookingId) {
      loadMessages(selectedBookingId);
    } else {
      setMessages([]);
      setActiveBooking(null);
    }
  }, [isOpen, selectedBookingId]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoadingMessages]);

  // Subscribe to real-time events via SSE
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;

    // 1. New message event
    const unsubMessage = RealtimeClient.on('message', (incomingMsg: Message) => {
      if (incomingMsg.booking_id === selectedBookingId) {
        setMessages((prev) => {
          // Reconcile optimistic message or prevent duplicates by server ID
          if (prev.some((m) => m.id === incomingMsg.id)) {
            return prev.map((m) => (m.id === incomingMsg.id ? { ...m, ...incomingMsg, status: 'sent' } : m));
          }
          // Remove temporary optimistic message with matching content and sender
          const optimisticMatch = prev.find(
            (m) => m.status === 'sending' && 
                   m.sender_id === incomingMsg.sender_id && 
                   m.content.trim() === incomingMsg.content.trim()
          );
          if (optimisticMatch) {
            return prev.map((m) => (m.id === optimisticMatch.id ? { ...incomingMsg, status: 'sent' } : m));
          }
          return [...prev, { ...incomingMsg, status: 'sent' }];
        });

        // Auto-mark as read on server since thread is currently open
        api.markMessagesAsRead(selectedBookingId).catch(() => {});
      }

      // Update conversation list preview
      setConversations((prev) => {
        const found = prev.find((c) => c.booking_id === incomingMsg.booking_id);
        if (found) {
          const isCurrentThread = incomingMsg.booking_id === selectedBookingId;
          const updated: Conversation = {
            ...found,
            last_message: incomingMsg.content,
            last_message_at: incomingMsg.created_at,
            unread_count: isCurrentThread ? 0 : (found.unread_count || 0) + 1,
          };
          const remaining = prev.filter((c) => c.booking_id !== incomingMsg.booking_id);
          return [updated, ...remaining];
        }
        return prev;
      });
    });

    // 2. Read receipts broadcast event
    const unsubRead = RealtimeClient.on('messages_read', (data: { booking_id: string }) => {
      if (data && data.booking_id === selectedBookingId) {
        setMessages((prev) =>
          prev.map((m) => {
            const isMe = m.sender_id === user?.id || (user?.firebase_uid && m.sender_id === user.firebase_uid);
            return isMe ? { ...m, is_read: true, read_at: new Date().toISOString() } : m;
          })
        );
      }
    });

    return () => {
      unsubMessage();
      unsubRead();
    };
  }, [isOpen, isAuthenticated, selectedBookingId, user]);

  // Background polling fallback while conversation thread is open (ensures messages never drop)
  useEffect(() => {
    if (!isOpen || !selectedBookingId || !isAuthenticated) return;

    const intervalId = setInterval(async () => {
      try {
        const data = await api.getMessages(selectedBookingId);
        if (data && Array.isArray(data.messages)) {
          setMessages((prev) => {
            // Retain any currently pending or failed messages
            const pendingOptimistic = prev.filter((m) => m.status === 'sending' || m.status === 'failed');
            const serverIds = new Set(data.messages.map((m) => m.id));
            const merged: Message[] = data.messages.map((m) => ({ ...m, status: 'sent' as const }));
            for (const opt of pendingOptimistic) {
              if (!serverIds.has(opt.id)) {
                merged.push(opt);
              }
            }
            return merged;
          });
        }
      } catch {
        // Silent polling catch
      }
    }, 4500);

    return () => clearInterval(intervalId);
  }, [isOpen, selectedBookingId, isAuthenticated]);

  const loadConversations = async () => {
    setIsLoadingConversations(true);
    setErrorBanner(null);
    try {
      const data = await api.getConversations();
      setConversations(data || []);

      // If no conversation currently selected and we have conversations, select the first
      if (!selectedBookingId && data && data.length > 0) {
        setSelectedBookingId(data[0].booking_id);
      }
    } catch (err: any) {
      console.warn('Failed to load conversations:', err);
      setErrorBanner(err.message || 'Could not load your conversations.');
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadMessages = async (bookingId: string) => {
    setIsLoadingMessages(true);
    setErrorBanner(null);
    try {
      const data = await api.getMessages(bookingId);
      if (data) {
        setActiveBooking(data.booking || null);
        setMessages(data.messages || []);

        // Mark as read in local conversation preview
        setConversations((prev) =>
          prev.map((c) => (c.booking_id === bookingId ? { ...c, unread_count: 0 } : c))
        );
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not load conversation messages.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedBookingId || isSending) return;

    const trimmedText = inputText.trim();
    const tempId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const myId = user?.id || 'me';
    const otherParticipantId = activeBooking?.borrower_id === user?.id 
      ? (activeBooking?.lender_id || '') 
      : (activeBooking?.borrower_id || '');

    const optimisticMessage: Message = {
      id: tempId,
      booking_id: selectedBookingId,
      sender_id: myId,
      sender_name: user?.name || 'You',
      receiver_id: otherParticipantId,
      content: trimmedText,
      created_at: new Date().toISOString(),
      is_read: false,
      status: 'sending',
    };

    // Optimistically update UI immediately
    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    setIsSending(true);
    setErrorBanner(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const savedMessage = await api.sendMessage(selectedBookingId, trimmedText);

      // Replace optimistic message with saved server message without duplication
      setMessages((prev) => {
        const alreadyReceivedViaSSE = prev.some((m) => m.id === savedMessage.id);
        if (alreadyReceivedViaSSE) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? { ...savedMessage, status: 'sent' } : m));
      });

      // Update conversations list preview
      setConversations((prev) => {
        const found = prev.find((c) => c.booking_id === selectedBookingId);
        if (found) {
          const updated = {
            ...found,
            last_message: trimmedText,
            last_message_at: new Date().toISOString(),
          };
          const rest = prev.filter((c) => c.booking_id !== selectedBookingId);
          return [updated, ...rest];
        }
        return prev;
      });
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setErrorBanner(err.message || 'Failed to send message. Please retry.');
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    } finally {
      setIsSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleRetryMessage = async (failedMsg: Message) => {
    if (!selectedBookingId || isSending) return;
    setMessages((prev) => prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'sending' } : m)));
    setIsSending(true);
    try {
      const saved = await api.sendMessage(selectedBookingId, failedMsg.content);
      setMessages((prev) => prev.map((m) => (m.id === failedMsg.id ? { ...saved, status: 'sent' } : m)));
    } catch (err: any) {
      setMessages((prev) => prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'failed' } : m)));
    } finally {
      setIsSending(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    // Auto-adjust height up to 120px
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatConvoTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d`;
      return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatBookingDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  };

  const getReturnDate = (startStr?: string, duration?: number) => {
    if (!startStr || !duration) return null;
    try {
      const d = new Date(startStr);
      if (isNaN(d.getTime())) return null;
      d.setDate(d.getDate() + Number(duration));
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Confirmed
          </span>
        );
      case 'PENDING':
        return (
          <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Proposal Pending
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
            Cancelled
          </span>
        );
      case 'REJECTED':
        return (
          <span className="bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
            Declined
          </span>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  // Active selected conversation metadata
  const selectedConvo = conversations.find((c) => c.booking_id === selectedBookingId);
  const isBorrowerOfBooking = activeBooking?.borrower_id === user?.id || (user?.firebase_uid && activeBooking?.borrower_id === user.firebase_uid);

  const partnerName = isBorrowerOfBooking 
    ? (activeBooking?.lender_name || selectedConvo?.partner_name || 'Lender') 
    : (activeBooking?.borrower_name || selectedConvo?.partner_name || 'Renter');

  const partnerAvatar = isBorrowerOfBooking 
    ? (activeBooking?.lender_avatar || selectedConvo?.partner_avatar) 
    : (activeBooking?.borrower_avatar || selectedConvo?.partner_avatar);

  const partnerRole = isBorrowerOfBooking ? 'Lender' : 'Renter';

  const partnerPhone = isBorrowerOfBooking
    ? (activeBooking?.lender_phone || selectedConvo?.partner_phone)
    : (activeBooking?.borrower_phone || selectedConvo?.partner_phone);

  const itemTitle = activeBooking?.item_title || selectedConvo?.item_title || 'Rental Item';
  const itemImage = (activeBooking?.item_images && activeBooking.item_images[0]) || 
                    (selectedConvo?.item_images && selectedConvo.item_images[0]);
  const itemRate = activeBooking?.price_per_day || activeBooking?.item_rate;
  const totalPrice = activeBooking?.total_price || selectedConvo?.total_price;
  const bookingStatus = activeBooking?.status || selectedConvo?.booking_status;
  const pickupDate = formatBookingDate(activeBooking?.start_date || selectedConvo?.start_date);
  const returnDate = getReturnDate(
    activeBooking?.start_date || selectedConvo?.start_date,
    activeBooking?.duration_days || selectedConvo?.duration_days
  );
  const locality = activeBooking?.item_locality || selectedConvo?.item_locality;

  // Search filtering across partner, item, message, and locality
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    return (
      c.partner_name?.toLowerCase().includes(query) ||
      c.item_title?.toLowerCase().includes(query) ||
      c.last_message?.toLowerCase().includes(query) ||
      c.booking_status?.toLowerCase().includes(query) ||
      c.item_locality?.toLowerCase().includes(query)
    );
  });

  return (
    <div 
      className="fixed inset-0 z-[110] overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-modal-title"
    >
      <div className="relative bg-white dark:bg-[#12131A] text-zinc-900 dark:text-zinc-100 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto border border-zinc-200 dark:border-zinc-800 h-[660px] max-h-[92vh] flex flex-col">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#161722] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-brand flex items-center justify-center shrink-0 border border-pink-100 dark:border-pink-900/30">
              <MessageSquare className="w-4 h-4 text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="chat-modal-title" className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 font-display">
                  Rental Coordination & Messages
                </h2>
                {/* Real-time Connection Indicator */}
                <span 
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/80'
                      : connectionStatus === 'connecting'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/80 animate-pulse'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                  }`}
                  title={connectionStatus === 'connected' ? 'Real-time delivery active' : 'Reconnecting to real-time service'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-emerald-500' : connectionStatus === 'connecting' ? 'bg-amber-500' : 'bg-zinc-400'
                  }`} />
                  {connectionStatus === 'connected' ? 'Live' : connectionStatus === 'connecting' ? 'Connecting...' : 'Polling Fallback'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">
                Direct gear coordination with verified community members
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Close chat modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Chat Interface */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          
          {/* Left Column: Conversation List */}
          <div className={`md:col-span-5 lg:col-span-4 border-r border-zinc-100 dark:border-zinc-800 flex-col bg-zinc-50/50 dark:bg-[#14151E] ${showMobileThread ? 'hidden md:flex' : 'flex'}`}>
            
            {/* Search messages */}
            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-[#12131A]">
              <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 rounded-full px-3 py-1.5 text-xs focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search gear or participant..."
                  className="bg-transparent border-none outline-none text-xs font-medium text-zinc-900 dark:text-zinc-100 w-full placeholder:text-zinc-400"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {isLoadingConversations && conversations.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-zinc-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-brand" />
                  <span className="text-xs font-medium">Loading conversations...</span>
                </div>
              ) : conversations.length === 0 ? (
                /* Improved Empty State */
                <div className="py-14 px-4 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/30 flex items-center justify-center mb-3 text-brand shadow-xs">
                    <MessageSquare className="w-6 h-6 text-brand" />
                  </div>
                  <h4 className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 mb-1">
                    No conversations yet
                  </h4>
                  <p className="text-[11px] text-zinc-500 max-w-[210px] leading-relaxed mb-4 font-normal">
                    Borrow or list gear with neighbors to start coordinating rental pickups here.
                  </p>
                  {onNavigateToExplore && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToExplore();
                      }}
                      className="btn-primary text-xs px-3.5 py-1.5 shadow-pink inline-flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Explore Rentals</span>
                    </button>
                  )}
                </div>
              ) : filteredConversations.length === 0 ? (
                /* Search zero-results state */
                <div className="py-14 px-4 text-center flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2.5 text-zinc-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                    No matching conversations
                  </p>
                  <p className="text-[11px] text-zinc-500 mb-3 max-w-[180px]">
                    No chats found for "{searchQuery}"
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs font-bold text-brand hover:underline cursor-pointer"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                filteredConversations.map((chat) => {
                  const isSelected = chat.booking_id === selectedBookingId;
                  const hasUnread = Number(chat.unread_count) > 0;

                  return (
                    <div
                      key={chat.booking_id}
                      onClick={() => {
                        setSelectedBookingId(chat.booking_id);
                        setShowMobileThread(true);
                      }}
                      className={`p-3 sm:p-3.5 flex items-start gap-3 cursor-pointer transition-all relative ${
                        isSelected 
                          ? 'bg-pink-50/80 dark:bg-[#1E1624] border-l-4 border-brand' 
                          : 'hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 bg-white dark:bg-[#12131A]'
                      }`}
                    >
                      {/* Avatar with unread indicator dot */}
                      <div className="relative shrink-0">
                        {chat.partner_avatar ? (
                          <img
                            src={chat.partner_avatar}
                            alt={chat.partner_name}
                            className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-100 to-rose-100 dark:from-zinc-800 dark:to-zinc-700 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-extrabold text-brand">
                            {(chat.partner_name || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        {hasUnread && (
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-brand rounded-full ring-2 ring-white dark:ring-[#12131A] animate-pulse" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`truncate text-zinc-900 dark:text-zinc-100 ${hasUnread ? 'font-black' : 'font-extrabold'}`}>
                            {chat.partner_name}
                          </span>
                          <span className="text-[10px] font-semibold text-zinc-400 shrink-0 ml-1">
                            {formatConvoTime(chat.last_message_at || chat.start_date)}
                          </span>
                        </div>

                        {/* Item Thumbnail & Title */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {chat.item_images && chat.item_images[0] ? (
                            <img
                              src={chat.item_images[0]}
                              alt={chat.item_title}
                              className="w-4 h-4 rounded-md object-cover shrink-0 border border-zinc-200 dark:border-zinc-700"
                            />
                          ) : (
                            <Tag className="w-3 h-3 text-brand shrink-0" />
                          )}
                          <span className="text-[11px] font-bold text-brand truncate">
                            {chat.item_title}
                          </span>
                        </div>

                        {/* Last message snippet & Unread count badge */}
                        <div className="flex items-center justify-between mt-1 gap-2">
                          <p className={`text-[11px] truncate leading-tight ${
                            hasUnread 
                              ? 'font-bold text-zinc-900 dark:text-zinc-100' 
                              : 'text-zinc-500 dark:text-zinc-400 font-normal'
                          }`}>
                            {chat.last_message || 'Tap to coordinate pickup...'}
                          </p>

                          {hasUnread && (
                            <span className="bg-brand text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shrink-0 shadow-xs">
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Conversation Thread */}
          <div className={`md:col-span-7 lg:col-span-8 flex-col justify-between bg-white dark:bg-[#12131A] ${showMobileThread ? 'flex' : 'hidden md:flex'}`}>
            
            {/* Active Header & Item Context */}
            {selectedBookingId ? (
              <div className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#161722] shrink-0">
                
                {/* 1. Header Bar: Partner Details & Booking Status */}
                <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setShowMobileThread(false)}
                      className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                      title="Back to conversation list"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    {partnerAvatar ? (
                      <img
                        src={partnerAvatar}
                        alt={partnerName}
                        className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-100 to-rose-100 dark:from-zinc-800 dark:to-zinc-700 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-sm font-extrabold text-brand shrink-0">
                        {(partnerName || 'U')[0].toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-zinc-100 truncate">
                          {partnerName}
                        </h4>
                        <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-200/70 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                          {partnerRole}
                        </span>
                        {getStatusBadge(bookingStatus)}
                      </div>

                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified Member
                        </span>
                        {partnerPhone && (bookingStatus === 'ACCEPTED' || bookingStatus === 'COMPLETED') && (
                          <a 
                            href={`tel:${partnerPhone}`}
                            className="flex items-center gap-1 hover:text-brand transition-colors text-[10px] font-bold text-zinc-600 dark:text-zinc-300"
                          >
                            <Phone className="w-3 h-3 text-brand" />
                            <span>{partnerPhone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Booking ID Reference */}
                  <div className="hidden sm:flex flex-col items-end text-right">
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                      Booking #{selectedBookingId.substring(0, 8)}
                    </span>
                    {totalPrice && (
                      <span className="text-xs font-black text-brand">
                        ₹{Number(totalPrice).toLocaleString('en-IN')} Total
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Rental Item Context Strip (Real DB Values Only) */}
                <div className="px-4 sm:px-6 py-2 bg-white/70 dark:bg-[#12131A]/70 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {itemImage ? (
                      <img 
                        src={itemImage} 
                        alt={itemTitle}
                        className="w-7 h-7 rounded-lg object-cover shrink-0 border border-zinc-200 dark:border-zinc-700" 
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-brand flex items-center justify-center shrink-0">
                        <Tag className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-extrabold text-zinc-900 dark:text-zinc-100 truncate text-xs">
                        {itemTitle}
                      </div>
                      {itemRate && (
                        <div className="text-[10px] text-zinc-500 font-medium">
                          ₹{Number(itemRate).toLocaleString('en-IN')}/day
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dates & Locality from Database */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                    {pickupDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-brand" />
                        <span>Pickup: {pickupDate}</span>
                      </div>
                    )}
                    {returnDate && (
                      <span className="hidden sm:inline text-zinc-400">• Return: {returnDate}</span>
                    )}
                    {locality && (
                      <div className="hidden lg:flex items-center gap-1 text-zinc-500">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="truncate max-w-[130px]">{locality.split(',')[0]}</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : null}

            {/* Error Banner */}
            {errorBanner && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-800 px-4 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorBanner}</span>
                </div>
                <button
                  onClick={() => selectedBookingId && loadMessages(selectedBookingId)}
                  className="font-bold underline hover:no-underline cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Messages Thread */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3.5 bg-zinc-50/40 dark:bg-[#101117]">
              {conversations.length === 0 ? (
                /* Right panel empty state when no chats exist */
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-pink-50 to-pink-100/60 dark:from-pink-950/40 dark:to-zinc-800 border border-pink-200/60 dark:border-pink-900/40 flex items-center justify-center mb-4 text-brand shadow-xs">
                    <MessageSquare className="w-8 h-8 text-brand" />
                  </div>
                  <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 font-display mb-1.5">
                    No active rental chats
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm leading-relaxed mb-5 font-normal">
                    When you request to borrow gear or accept rental bookings from neighbors, direct chat coordination for pickup and inspection details appears here.
                  </p>
                  {onNavigateToExplore && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToExplore();
                      }}
                      className="btn-primary text-xs sm:text-sm px-5 py-2.5 shadow-pink inline-flex items-center gap-2 cursor-pointer hover:scale-105 transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Explore Available Rentals</span>
                    </button>
                  )}
                </div>
              ) : !selectedBookingId ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                    <MessageSquare className="w-6 h-6 text-zinc-400" />
                  </div>
                  <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Select a conversation</p>
                  <p className="text-[11px] max-w-xs text-zinc-500">
                    Choose a conversation on the left to coordinate pickup dates and gear details.
                  </p>
                </div>
              ) : isLoadingMessages ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-brand" />
                  <span className="text-xs font-semibold">Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center mb-3 text-2xl">
                    👋
                  </div>
                  <h4 className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 mb-1">
                    Start coordinating with {partnerName}
                  </h4>
                  <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
                    Say hello to confirm pickup timing, handover location, or deposit verification.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === user?.id || (user?.firebase_uid && m.sender_id === user.firebase_uid);
                  const isFailed = m.status === 'failed';
                  const isSendingMsg = m.status === 'sending';

                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Counterparty avatar on left side */}
                      {!isMe && (
                        <div className="shrink-0 mb-1">
                          {m.sender_avatar || partnerAvatar ? (
                            <img
                              src={m.sender_avatar || partnerAvatar}
                              alt={m.sender_name || partnerName}
                              className="w-7 h-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-100 to-rose-100 dark:from-zinc-800 dark:to-zinc-700 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-[10px] font-extrabold text-brand">
                              {(m.sender_name || partnerName || 'U')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Sender name for other participant */}
                        {!isMe && (
                          <span className="text-[10px] font-semibold text-zinc-400 mb-0.5 ml-1">
                            {m.sender_name || partnerName}
                          </span>
                        )}

                        {/* Message Bubble */}
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed whitespace-pre-wrap break-words shadow-xs ${
                            isMe
                              ? 'bg-[#E11D74] text-white rounded-br-xs'
                              : 'bg-white dark:bg-[#1A1B26] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-xs'
                          }`}
                        >
                          {m.content}
                        </div>

                        {/* Timestamp & Status Metadata */}
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-400 px-1 font-semibold">
                          <span>{formatMessageTime(m.created_at)}</span>
                          {isMe && (
                            isSendingMsg ? (
                              <Clock className="w-2.5 h-2.5 text-zinc-400 animate-spin" />
                            ) : isFailed ? (
                              <button
                                onClick={() => handleRetryMessage(m)}
                                className="text-rose-500 flex items-center gap-0.5 hover:underline cursor-pointer"
                              >
                                <RotateCw className="w-2.5 h-2.5" />
                                <span>Failed • Retry</span>
                              </button>
                            ) : (
                              <span title={m.is_read ? 'Read by recipient' : 'Delivered'}>
                                <CheckCheck 
                                  className={`w-3.5 h-3.5 transition-colors ${
                                    m.is_read ? 'text-sky-300' : 'text-white/60'
                                  }`} 
                                />
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Multiline Reply Composer */}
            {selectedBookingId ? (
              <form 
                onSubmit={handleSendMessage} 
                className="p-3 sm:p-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-[#12131A] flex items-end gap-2 shrink-0"
              >
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl px-3.5 py-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all flex items-center">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputText}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${partnerName}... (Enter to send, Shift+Enter for newline)`}
                    maxLength={2000}
                    disabled={isSending}
                    className="w-full bg-transparent border-none outline-none text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 resize-none max-h-[120px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="w-10 h-10 rounded-2xl bg-brand text-white flex items-center justify-center shrink-0 shadow-pink transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer mb-0.5"
                  title="Send message (Enter)"
                  aria-label="Send message"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 ml-0.5" />
                  )}
                </button>
              </form>
            ) : null}

          </div>

        </div>

      </div>
    </div>
  );
};
