import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronRight,
  Tag
} from 'lucide-react';
import { CuteBotAvatar } from './CuteBotAvatar';
import { api } from '../lib/api';
import { Item, AiMessage, AiStatusResponse } from '../lib/types';

interface RentuAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextItem?: Item | null;
  onClearContextItem?: () => void;
  onSelectItem: (item: Item) => void;
  onOpenBookingModal?: (item: Item) => void;
}

const DEFAULT_SUGGESTIONS = [
  { label: '📷 Cheapest camera', prompt: 'Find the cheapest camera available to rent.' },
  { label: '📅 Canon 250D tomorrow', prompt: 'Is the Canon EOS 250D DSLR available tomorrow for 2 days?' },
  { label: '💰 Cameras under ₹500', prompt: 'Which cameras can I rent for under ₹500 per day?' },
  { label: '⚖️ Compare cameras', prompt: 'Compare the available cameras by price and features.' },
  { label: '⛺ Tent for weekend', prompt: 'What is the cheapest camping tent for 3 days this weekend?' },
  { label: '📽️ Projector movie night', prompt: 'Find a portable projector for a weekend movie night.' },
];

export const RentuAiModal: React.FC<RentuAiModalProps> = ({
  isOpen,
  onClose,
  contextItem,
  onClearContextItem,
  onSelectItem,
  onOpenBookingModal,
}) => {
  const [messages, setMessages] = useState<AiMessage[]>(() => {
    // Restore session conversation if available
    try {
      const saved = sessionStorage.getItem('rentu_ai_messages');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'welcome-msg',
        role: 'assistant',
        content: `👋 **Hi! I'm Rentu AI**, your friendly rental assistant! 🤖🌸\n\nI can help you find gear and save money in your community:\n• **Find the cheapest gear** (cameras, projectors, camping...)\n• **Check real-time calendar availability** and detect booked dates\n• **Compare equipment** side-by-side with savings\n• **Calculate total rental costs** with zero security deposit\n\nWhat would you like to rent today? ✨`,
        timestamp: new Date().toISOString(),
      },
    ];
  });

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatusResponse | null>(null);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('rentu_ai_messages', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Load AI status and suggestions on initial mount
  useEffect(() => {
    api.getAiStatus()
      .then((status) => setAiStatus(status))
      .catch(() => {});

    api.getAiSuggestions()
      .then((suggs) => {
        if (Array.isArray(suggs) && suggs.length > 0) {
          setSuggestions(suggs);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isLoading]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle context item change
  useEffect(() => {
    if (contextItem && isOpen) {
      // Suggest item-specific prompts
      setSuggestions([
        { label: `📅 Is this available tomorrow?`, prompt: `Is the ${contextItem.title} available tomorrow for 2 days?` },
        { label: `💰 Total price for 3 days`, prompt: `What is the total price to rent ${contextItem.title} for 3 days?` },
        { label: `⚖️ Compare with other gear`, prompt: `Compare ${contextItem.title} with other available ${contextItem.category} listings.` },
        { label: `📷 Cheapest camera`, prompt: `Find the cheapest camera available to rent.` },
      ]);
    }
  }, [contextItem, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setErrorMsg(null);
    setInputValue('');

    const userMessage: AiMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      const apiMessages = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.sendAiChat(apiMessages, contextItem?.id);

      const assistantMessage: AiMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: res.message,
        listings: res.listings,
        comparison: res.comparison,
        availability: res.availability,
        toolsUsed: res.toolsUsed,
        setupNotice: res.setupNotice,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('AI chat failed:', err);
      setErrorMsg(err.message || 'Unable to connect to Rentu AI. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    const reset = [
      {
        id: 'welcome-msg',
        role: 'assistant' as const,
        content: `All fresh and reset! 🌸 What gear can I help you hunt down today?`,
        timestamp: new Date().toISOString(),
      },
    ];
    setMessages(reset);
    sessionStorage.removeItem('rentu_ai_messages');
    setErrorMsg(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end">
      {/* Assistant Modal Window */}
      <div 
        className="w-[92vw] sm:w-[440px] h-[85vh] sm:h-[640px] max-h-[680px] bg-white dark:bg-[#181922] border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Rentu AI Assistant"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-pink-50/90 via-white to-pink-50/50 dark:from-pink-950/40 dark:via-[#181922] dark:to-pink-950/20 border-b border-divider flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-pink-950/60 border border-pink-200/80 dark:border-pink-800/60 flex items-center justify-center shadow-xs shrink-0">
              <CuteBotAvatar size={34} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm text-ink leading-tight flex items-center gap-1">
                  <span>Rentu AI</span>
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100/80 dark:bg-pink-950/60 text-brand border border-pink-200/80 dark:border-pink-900/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E11D74] animate-pulse" />
                  <span>Online</span>
                </span>
              </div>
              <p className="text-[11px] text-ink-secondary">Smart Rental Assistant ✨</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClearHistory}
              title="Clear conversation"
              className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink-secondary hover:text-ink transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Close Rentu Bot (Esc)"
              className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Context Listing Strip (When opened from an Item Page) */}
        {contextItem && (
          <div className="px-4 py-2 bg-pink-50/80 dark:bg-pink-950/30 border-b border-pink-200/60 dark:border-pink-900/40 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2 truncate pr-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand shrink-0">Context:</span>
              <span className="font-semibold text-ink truncate">{contextItem.title}</span>
              <span className="text-ink-secondary text-[11px] shrink-0">₹{Number(contextItem.price_per_day)}/day</span>
            </div>
            {onClearContextItem && (
              <button
                onClick={onClearContextItem}
                className="text-[11px] text-ink-secondary hover:text-brand font-bold cursor-pointer shrink-0"
                title="Clear item context"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div 
                key={msg.id} 
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start items-start gap-2.5'}`}
              >
                {!isUser && (
                  <div className="shrink-0 mt-0.5">
                    <CuteBotAvatar size={28} className="shadow-2xs" />
                  </div>
                )}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[88%] space-y-2`}>
                  {/* Bubble Container */}
                  <div 
                    className={`rounded-2xl p-3 sm:p-3.5 text-xs sm:text-[13px] leading-relaxed ${
                      isUser
                        ? 'bg-brand text-white rounded-br-xs shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-900/90 border border-gray-200 dark:border-white/10 text-ink rounded-bl-xs shadow-2xs'
                    }`}
                  >
                  {/* Message Text with simple markdown formatting */}
                  <div className="whitespace-pre-wrap space-y-1">
                    {msg.content.split('\n').map((line, i) => {
                      if (!line.trim()) return <div key={i} className="h-1.5" />;
                      
                      // Handle bullet points
                      if (line.startsWith('• ') || line.startsWith('- ')) {
                        const boldText = line.substring(2);
                        return (
                          <div key={i} className="flex items-start gap-1.5 pl-1">
                            <span className="text-brand shrink-0">•</span>
                            <span>{renderFormattedText(boldText)}</span>
                          </div>
                        );
                      }

                      return <div key={i}>{renderFormattedText(line)}</div>;
                    })}
                  </div>

                  {/* Availability Result Strip */}
                  {msg.availability && (
                    <div className="mt-2.5 pt-2 border-t border-divider/60">
                      <div className={`p-2 rounded-xl text-xs font-medium flex items-start gap-2 ${
                        msg.availability.isAvailable
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                      }`}>
                        {msg.availability.isAvailable ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5">
                          <div className="font-bold">
                            {msg.availability.isAvailable ? 'Confirmed Available' : 'Date Conflict Detected'}
                          </div>
                          <div className="text-[11px] leading-snug opacity-90">
                            {msg.availability.reason}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attached Interactive Listing Cards */}
                {Array.isArray(msg.listings) && msg.listings.length > 0 && (
                  <div className="w-full max-w-[94%] space-y-2 pt-1">
                    <div className="text-[11px] font-bold text-ink-secondary flex items-center justify-between px-1">
                      <span>Matching Real Listings ({msg.listings.length})</span>
                      <span className="text-[10px] text-brand font-semibold">Live Database</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {msg.listings.map((item) => {
                        const primaryImg = item.image_urls?.[0] || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80';
                        return (
                          <div
                            key={item.id}
                            className="bg-white dark:bg-[#1E1F2A] border border-gray-200 dark:border-white/10 rounded-2xl p-2.5 shadow-2xs hover:shadow-xs transition-all flex items-center gap-3"
                          >
                            {/* Thumbnail */}
                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-divider">
                              <img src={primaryImg} alt={item.title} className="w-full h-full object-cover" />
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-ink-secondary uppercase">
                                  {item.category.split('&')[0].trim()}
                                </span>
                                {item.locality && (
                                  <span className="text-[10px] text-ink-secondary truncate">
                                    {item.locality.split(',')[0]}
                                  </span>
                                )}
                              </div>

                              <h4 className="font-extrabold text-xs text-ink truncate mt-0.5">
                                {item.title}
                              </h4>

                              <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="font-extrabold text-xs text-brand font-display">
                                  ₹{Number(item.price_per_day)}
                                </span>
                                <span className="text-[10px] text-ink-secondary font-medium">/ day</span>

                                {item.total_price && item.duration_days && item.duration_days > 1 && (
                                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 ml-1">
                                    • Total ₹{item.total_price} ({item.duration_days}d)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  onSelectItem(item);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-ink font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="View listing details"
                              >
                                <span>View</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>

                              {onOpenBookingModal && (
                                <button
                                  onClick={() => {
                                    onOpenBookingModal(item);
                                  }}
                                  className="px-2.5 py-1 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-[10px] shadow-2xs transition-colors cursor-pointer"
                                >
                                  Book
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                </div>
              </div>
            );
          })}

          {/* Cute Thinking / Loading Indicator */}
          {isLoading && (
            <div className="flex items-start gap-2.5 animate-in fade-in duration-150">
              <div className="shrink-0 mt-0.5">
                <CuteBotAvatar size={28} isThinking={true} className="animate-bounce" />
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-pink-50/80 dark:bg-pink-950/40 rounded-2xl rounded-tl-xs border border-pink-200/70 dark:border-pink-900/40 text-xs text-brand font-medium shadow-2xs">
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E11D74] animate-ping" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E11D74] animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E11D74]" />
                </span>
                <span>Checking the gear shelves... ✨</span>
              </div>
            </div>
          )}

          {/* Error Message with Retry */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={() => handleSendMessage()}
                className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 text-rose-900 dark:text-rose-200 font-bold text-[11px] cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="px-3 pt-2 pb-1 overflow-x-auto scrollbar-none flex items-center gap-1.5 border-t border-divider/60 bg-zinc-50/60 dark:bg-[#181922]">
          {suggestions.slice(0, 4).map((sugg, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(sugg.prompt)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800/80 border border-gray-200 dark:border-white/10 text-ink-secondary hover:text-brand hover:border-brand text-[11px] font-semibold whitespace-nowrap transition-all shadow-2xs hover:scale-105 cursor-pointer disabled:opacity-50"
            >
              {sugg.label}
            </button>
          ))}
        </div>

        {/* Composer Input Bar */}
        <div className="p-3 sm:p-3.5 border-t border-divider bg-white dark:bg-[#181922] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 bg-canvas border border-gray-200 dark:border-white/10 rounded-2xl p-1.5 pl-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={contextItem ? `Ask about "${contextItem.title}"...` : "Ask Rentu AI: 'Cheapest camera', 'Is tent available'..."}
              disabled={isLoading}
              className="flex-1 bg-transparent border-none outline-none text-xs sm:text-[13px] text-ink placeholder:text-ink-muted"
            />

            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="w-8 h-8 rounded-xl bg-brand hover:bg-brand-hover text-white disabled:opacity-40 disabled:hover:bg-brand flex items-center justify-center shrink-0 transition-colors shadow-xs shadow-pink cursor-pointer"
              title="Send message (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-muted px-1">
            <span>Powered by Rentu Database Tools</span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper to render bold markdown syntax **text**
function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-extrabold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
