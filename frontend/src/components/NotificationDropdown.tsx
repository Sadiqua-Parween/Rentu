import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Calendar, 
  MessageSquare, 
  Sparkles, 
  AlertCircle, 
  XCircle, 
  Award,
  Loader2,
  ExternalLink,
  Laptop,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { AppNotification } from '../lib/types';
import { RealtimeClient } from '../lib/realtime';
import { PushManagerClient } from '../lib/push';

interface NotificationDropdownProps {
  setActiveTab: (tab: 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile') => void;
  onOpenChat?: (bookingId?: string) => void;
  isMobileDrawer?: boolean;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  setActiveTab,
  onOpenChat,
  isMobileDrawer = false,
}) => {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isPushEnabled, setIsPushEnabled] = useState<boolean>(false);
  const [isPushLoading, setIsPushLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Clear state on logout or account change
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setNotifications([]);
      setUnreadCount(0);
      setIsOpen(false);
      setError(null);
    }
  }, [isAuthenticated, user?.id]);

  // Check Web Push subscription status
  useEffect(() => {
    if (isAuthenticated) {
      PushManagerClient.isSubscribed().then(setIsPushEnabled).catch(() => {});
    }
  }, [isAuthenticated]);

  // Fetch notifications from database
  const fetchNotifications = async (silent = false) => {
    if (!isAuthenticated || !user) return;
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const data = await api.getNotifications({ limit: 30 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err: any) {
      if (!silent) {
        setError(err.message || 'Failed to load notifications');
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Real-time notification subscription via SSE
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    fetchNotifications();

    // Listen for instant real-time notifications
    const unsubscribe = RealtimeClient.on('notification', (newNotif: AppNotification) => {
      setNotifications(prev => {
        // Prevent duplicate notifications
        if (prev.some(n => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
      setUnreadCount(prev => prev + 1);
    });

    // Fallback reconciliation poll every 45s
    const intervalId = setInterval(() => {
      fetchNotifications(true);
    }, 45000);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [isAuthenticated, user?.id]);

  // Keyboard navigation: Escape key closes the dropdown
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Outside click closes the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.markNotificationAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      const now = new Date().toISOString();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || now })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.read_at) {
      try {
        await api.markNotificationAsRead(notif.id);
        setNotifications(prev =>
          prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Error marking read:', err);
      }
    }

    setIsOpen(false);

    // Deep navigation based on notification payload
    if (notif.data?.booking_id) {
      setActiveTab('bookings');
      if (notif.type === 'NEW_MESSAGE' && onOpenChat) {
        onOpenChat(notif.data.booking_id);
      }
    }
  };

  const handleTogglePush = async () => {
    setIsPushLoading(true);
    try {
      if (isPushEnabled) {
        await PushManagerClient.unsubscribe();
        setIsPushEnabled(false);
      } else {
        const success = await PushManagerClient.subscribe();
        setIsPushEnabled(success);
      }
    } catch (err: any) {
      alert(`Desktop Alerts: ${err.message || 'Permission denied or unsupported'}`);
    } finally {
      setIsPushLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'BOOKING_REQUEST':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'BOOKING_ACCEPTED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'BOOKING_REJECTED':
        return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'BOOKING_CANCELLED':
        return <AlertCircle className="w-4 h-4 text-zinc-500" />;
      case 'BOOKING_COMPLETED':
        return <Award className="w-4 h-4 text-purple-600" />;
      case 'NEW_MESSAGE':
        return <MessageSquare className="w-4 h-4 text-brand" />;
      default:
        return <Bell className="w-4 h-4 text-brand" />;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (!isAuthenticated) return null;

  const displayedNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read_at) 
    : notifications;

  return (
    <div className={`relative ${isMobileDrawer ? 'w-full' : ''}`} ref={dropdownRef}>
      {/* Bell Trigger */}
      {isMobileDrawer ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>Notifications</span>
          </div>
          {unreadCount > 0 && (
            <span className="bg-brand text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          id="notification-bell-btn"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) fetchNotifications(true);
          }}
          className="relative p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer hidden md:flex items-center justify-center"
          title="Notifications"
          aria-label="View notifications"
          aria-expanded={isOpen}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span 
              id="unread-notification-badge"
              className="absolute -top-1 -right-1 bg-brand text-white text-[9px] font-black px-1.5 py-0.2 min-w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-pink animate-in zoom-in-75 duration-150 border-2 border-white dark:border-[#12131A]"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Solid, Opaque Notification Dropdown Panel */}
      {isOpen && (
        <div 
          id="notification-panel"
          className={`
            ${isMobileDrawer 
              ? 'mt-2 w-full static' 
              : 'absolute right-0 mt-2.5 w-[360px] sm:w-[420px] max-w-[calc(100vw-24px)] z-[100]'
            }
            bg-white dark:bg-[#12131A] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150
          `}
          role="region"
          aria-label="Notifications Panel"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-[#161722]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 font-display">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-brand/10 text-brand text-[10px] font-black px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  id="mark-all-read-btn"
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-bold text-zinc-500 hover:text-brand dark:text-zinc-400 dark:hover:text-brand flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Filter Tabs & Push Alert Toggle */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1 bg-zinc-200/70 dark:bg-zinc-800/80 p-0.5 rounded-lg text-xs font-bold">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                    filter === 'all' 
                      ? 'bg-white dark:bg-[#12131A] text-zinc-900 dark:text-zinc-50 shadow-xs' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                    filter === 'unread' 
                      ? 'bg-white dark:bg-[#12131A] text-zinc-900 dark:text-zinc-50 shadow-xs' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {/* Desktop Push Alert Action */}
              <button
                onClick={handleTogglePush}
                disabled={isPushLoading}
                className={`text-[10px] font-bold px-2 py-1 rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${
                  isPushEnabled 
                    ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' 
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-brand hover:text-brand bg-white dark:bg-[#12131A]'
                }`}
                title="Browser desktop alerts"
              >
                <Laptop className="w-3 h-3" />
                <span>{isPushLoading ? 'Updating...' : isPushEnabled ? 'Desktop Alerts On' : 'Enable Alerts'}</span>
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-white dark:bg-[#12131A]">
            {isLoading && notifications.length === 0 ? (
              <div className="py-14 flex flex-col items-center justify-center text-zinc-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-brand" />
                <span className="text-xs font-semibold">Loading notifications...</span>
              </div>
            ) : error ? (
              <div className="py-8 px-4 text-center">
                <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">{error}</p>
                <button
                  onClick={() => fetchNotifications()}
                  className="text-xs font-bold text-brand hover:underline cursor-pointer"
                >
                  Try again
                </button>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-950/30 flex items-center justify-center mb-2.5">
                  <Bell className="w-5 h-5 text-brand" />
                </div>
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                  {filter === 'unread' ? 'No unread notifications' : 'All caught up!'}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs">
                  {filter === 'unread' 
                    ? 'You have read all your notifications.' 
                    : 'When you receive rental proposals or new messages, they will appear here.'}
                </p>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const isUnread = !notif.read_at;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`
                      p-3.5 sm:p-4 flex items-start gap-3 transition-colors cursor-pointer relative group
                      ${isUnread 
                        ? 'bg-pink-50/60 hover:bg-pink-50/90 dark:bg-[#1A1522] dark:hover:bg-[#221B2D]' 
                        : 'bg-white hover:bg-zinc-50 dark:bg-[#12131A] dark:hover:bg-[#181922]'
                      }
                    `}
                  >
                    {/* Icon container */}
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      {getNotificationIcon(notif.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs truncate ${isUnread ? 'font-black text-zinc-900 dark:text-zinc-50' : 'font-bold text-zinc-700 dark:text-zinc-300'}`}>
                          {notif.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed mb-1.5 font-medium">
                        {notif.body}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
                        <span>{formatRelativeTime(notif.created_at)}</span>
                        {notif.data?.booking_id && (
                          <span className="inline-flex items-center gap-0.5 text-brand font-bold">
                            View details <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unread dot / Mark read hover */}
                    <div className="shrink-0 flex items-center self-center">
                      {isUnread && (
                        <button
                          onClick={(e) => handleMarkAsRead(notif.id, e)}
                          title="Mark as read"
                          className="w-5 h-5 rounded-full hover:bg-white dark:hover:bg-zinc-800 flex items-center justify-center transition-colors text-zinc-400 hover:text-brand cursor-pointer"
                        >
                          <span className="w-2 h-2 rounded-full bg-brand group-hover:hidden" />
                          <Check className="w-3.5 h-3.5 hidden group-hover:block" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#161722] flex items-center justify-between text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                setActiveTab('bookings');
              }}
              className="text-[11px] font-bold text-brand hover:underline py-1 cursor-pointer mx-auto"
            >
              View all bookings & coordination history →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
