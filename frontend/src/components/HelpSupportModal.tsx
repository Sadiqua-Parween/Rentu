import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Lightbulb,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldAlert,
  HelpCircle,
  FileQuestion,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Edit2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { SupportTicket } from '../lib/types';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'NEW' | 'HISTORY';
}

const CONCERN_CATEGORIES = [
  'Booking & Handover Logistics',
  'Item Quality or Damage',
  'Payment & Deposit Settlement',
  'Neighbor Conduct & Safety',
  'App Bug or Technical Glitch',
  'Other Concern',
];

const FEEDBACK_CATEGORIES = [
  'New Feature Suggestion',
  'Design & User Experience',
  'Categories & Neighborhoods',
  'Love Rentu / Compliment',
  'General Thought',
];

const QUICK_PRESETS = [
  {
    icon: '⏱️',
    label: 'Late Handover',
    type: 'CONCERN' as const,
    category: 'Booking & Handover Logistics',
    priority: 'NORMAL' as const,
    subject: 'Late Handover / Timing Issue',
    placeholder: 'Neighbor was late or could not make the scheduled handover time...',
  },
  {
    icon: '💳',
    label: 'Deposit / Payment',
    type: 'CONCERN' as const,
    category: 'Payment & Deposit Settlement',
    priority: 'NORMAL' as const,
    subject: 'Deposit / Payment Settlement Inquiry',
    placeholder: 'Questions regarding deposit release, UPI payout, or transaction...',
  },
  {
    icon: '📷',
    label: 'Item Damage / Quality',
    type: 'CONCERN' as const,
    category: 'Item Quality or Damage',
    priority: 'HIGH' as const,
    subject: 'Gear Condition or Damage Report',
    placeholder: 'Item condition was not as described, or damage occurred during rental...',
  },
  {
    icon: '⚠️',
    label: 'Neighbor Safety',
    type: 'CONCERN' as const,
    category: 'Neighbor Conduct & Safety',
    priority: 'HIGH' as const,
    subject: 'Neighbor Safety & Conduct Concern',
    placeholder: 'Describe any inappropriate communication, safety, or conduct issue...',
  },
  {
    icon: '🐛',
    label: 'App Bug / Glitch',
    type: 'CONCERN' as const,
    category: 'App Bug or Technical Glitch',
    priority: 'NORMAL' as const,
    subject: 'App Bug / Technical Glitch in Rentu',
    placeholder: 'Encountered an error, button not responding, or page display issue...',
  },
  {
    icon: '💡',
    label: 'Feature Idea',
    type: 'FEEDBACK' as const,
    category: 'New Feature Suggestion',
    priority: 'NORMAL' as const,
    subject: 'Feature Suggestion for Rentu',
    placeholder: 'I would love if Rentu had this feature or improvement...',
  },
  {
    icon: '❤️',
    label: 'Compliment Rentu',
    type: 'FEEDBACK' as const,
    category: 'Love Rentu / Compliment',
    priority: 'NORMAL' as const,
    subject: 'Compliment & Great Experience on Rentu',
    placeholder: 'Tell us what you loved about your peer-to-peer rental experience...',
  },
];

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({ isOpen, onClose, initialTab = 'NEW' }) => {
  const { user, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>(initialTab);
  const [ticketType, setTicketType] = useState<'CONCERN' | 'FEEDBACK'>('CONCERN');
  const [category, setCategory] = useState<string>(CONCERN_CATEGORIES[0]);
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [userEmail, setUserEmail] = useState(user?.email || '');
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // History state
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialTab === 'HISTORY' && isAuthenticated) {
        setActiveTab('HISTORY');
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab, isAuthenticated]);

  // Keyboard accessibility: Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    // Reset category to default when switching between concern and feedback
    if (ticketType === 'CONCERN') {
      setCategory(CONCERN_CATEGORIES[0]);
    } else {
      setCategory(FEEDBACK_CATEGORIES[0]);
    }
  }, [ticketType]);

  // Auto-poll history every 10s while tab is open so updates don't become stale
  useEffect(() => {
    if (isOpen && activeTab === 'HISTORY' && isAuthenticated) {
      loadHistory();
      const interval = setInterval(() => {
        loadHistory(true);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen, activeTab, isAuthenticated]);

  const loadHistory = async (silent = false) => {
    if (!silent) setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const tickets = await api.getMySupportTickets();
      setMyTickets(Array.isArray(tickets) ? tickets : []);
    } catch (err: any) {
      console.error('Failed to load tickets history:', err);
      if (!silent) {
        setHistoryError(err.message || 'Failed to load your past submissions.');
      }
    } finally {
      if (!silent) setIsLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setSelectedPresetLabel(preset.label);
    setTicketType(preset.type);
    setCategory(preset.category);
    setPriority(preset.priority);
    setSubject(preset.subject);
    if (!description || description.trim() === '') {
      setDescription(preset.placeholder);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDesc = description.trim();
    const trimmedEmail = userEmail.trim();

    if (!trimmedDesc) {
      setErrorMsg('Please describe what happened or how we can help.');
      return;
    }
    if (trimmedDesc.length < 3) {
      setErrorMsg('Please write at least 3 characters.');
      return;
    }
    if (!isAuthenticated && !trimmedEmail) {
      setErrorMsg('Please enter a valid contact email so our team can follow up with you.');
      return;
    }

    const trimmedSubject = subject.trim() || selectedPresetLabel || trimmedDesc.split('\n')[0].slice(0, 50).trim() || `${category} Inquiry`;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const ticket = await api.submitSupportTicket({
        type: ticketType,
        category,
        subject: trimmedSubject,
        description: trimmedDesc,
        priority: ticketType === 'CONCERN' ? priority : 'NORMAL',
        user_email: trimmedEmail || undefined,
      });

      // Notify any active admin listeners in the app to refresh immediately
      window.dispatchEvent(new CustomEvent('rentu-ticket-submitted', { detail: ticket }));

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });

      setSubmitSuccess(true);
      setSubject('');
      setDescription('');
      setSelectedPresetLabel(null);
    } catch (err: any) {
      console.error('Failed to submit support ticket:', err);
      setErrorMsg(err.message || 'Could not submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmitSuccess(false);
    setErrorMsg('');
    setSubject('');
    setDescription('');
    setSelectedPresetLabel(null);
    setShowAdvanced(false);
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-support-modal-title"
        className="relative bg-surface rounded-2xl sm:rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-auto border border-divider max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-divider bg-canvas/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 id="help-support-modal-title" className="text-xs sm:text-sm font-black text-ink uppercase tracking-wider font-display">
                Help & Community Care
              </h2>
              <p className="text-[10px] sm:text-[11px] text-ink-secondary">
                Directly connected to Rentu Founders & Support Admin
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Help & Support dialog"
            className="p-1.5 rounded-full hover:bg-canvas text-ink-secondary hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Mode Tabs: New Submission vs My History */}
        <div className="flex border-b border-divider text-xs font-bold bg-canvas/20 shrink-0">
          <button
            onClick={() => { setActiveTab('NEW'); handleResetForm(); }}
            className={`flex-1 py-2.5 sm:py-3 text-center border-b-2 transition-colors cursor-pointer ${activeTab === 'NEW'
              ? 'border-brand text-brand font-black'
              : 'border-transparent text-ink-secondary hover:text-ink'
              }`}
          >
            Submit Concern or Feedback
          </button>
          {isAuthenticated && (
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex-1 py-2.5 sm:py-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'HISTORY'
                ? 'border-brand text-brand font-black'
                : 'border-transparent text-ink-secondary hover:text-ink'
                }`}
            >
              <span>My Submissions & Replies</span>
              {myTickets.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand/10 text-brand text-[10px] flex items-center justify-center font-bold">
                  {myTickets.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* TAB 1: NEW SUBMISSION */}
        {activeTab === 'NEW' && (
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
            {submitSuccess ? (
              <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-150">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-ink font-display">
                    {ticketType === 'CONCERN' ? 'Concern Submitted' : 'Feedback Received'}
                  </h3>
                  <p className="text-xs text-ink-secondary max-w-sm mx-auto mt-1 leading-relaxed">
                    Thank you! Your message was delivered directly to the Rentu Admin Portal.
                    {ticketType === 'CONCERN'
                      ? ' Our team will review the issue and post a resolution update directly to your account notifications.'
                      : ' We appreciate your insights to make peer-to-peer sharing even better!'}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={handleResetForm}
                    className="btn-secondary text-xs px-4 py-2 cursor-pointer font-bold"
                  >
                    Submit Another
                  </button>
                  <button
                    onClick={onClose}
                    className="btn-primary text-xs px-6 py-2 shadow-pink cursor-pointer font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1-Click Quick Topics */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-ink">
                      Quick Topic <span className="text-[10px] text-ink-muted font-normal">(Click one to auto-fill)</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PRESETS.map((preset) => {
                      const isSelected = selectedPresetLabel === preset.label;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className={`text-[11px] px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-brand text-white shadow-xs ring-2 ring-brand/30'
                              : 'bg-canvas border border-divider text-ink-secondary hover:text-ink hover:bg-surface'
                          }`}
                        >
                          <span>{preset.icon}</span>
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Type Selection: Concern vs Feedback */}
                <div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTicketType('CONCERN');
                        setSelectedPresetLabel(null);
                      }}
                      className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${ticketType === 'CONCERN'
                        ? 'bg-red-500/10 border-red-500/40 text-red-500 shadow-xs'
                        : 'bg-canvas border-divider text-ink-secondary hover:text-ink hover:bg-surface'
                        }`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                      <div>
                        <div className="text-xs font-black">Raise a Concern</div>
                        <div className="text-[10px] text-ink-secondary leading-tight">
                          Rental issue, damage, or bug
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTicketType('FEEDBACK');
                        setSelectedPresetLabel(null);
                      }}
                      className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${ticketType === 'FEEDBACK'
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-xs'
                        : 'bg-canvas border-divider text-ink-secondary hover:text-ink hover:bg-surface'
                        }`}
                    >
                      <Lightbulb className="w-4 h-4 shrink-0 text-amber-500" />
                      <div>
                        <div className="text-xs font-black">Share Feedback</div>
                        <div className="text-[10px] text-ink-secondary leading-tight">
                          Ideas & feature suggestions
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Category Selector */}
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    {(ticketType === 'CONCERN' ? CONCERN_CATEGORIES : FEEDBACK_CATEGORIES).map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => {
                          setCategory(cat);
                          setSelectedPresetLabel(null);
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer ${category === cat
                          ? 'bg-brand text-white shadow-xs'
                          : 'bg-canvas border border-divider text-ink-secondary hover:text-ink hover:bg-surface'
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Message / Details Text Area */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-ink">
                      Your Message / What happened? <span className="text-brand font-black">*</span>
                    </label>
                    <span className="text-[10px] text-ink-muted">
                      {description.length > 0 ? `${description.length} chars` : 'min 3 chars'}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      ticketType === 'CONCERN'
                        ? 'Describe what happened (dates, gear, or neighbor name)... Admin will assist you immediately.'
                        : 'Tell us your idea, suggestion, or feedback for Rentu...'
                    }
                    className="w-full bg-canvas border border-divider rounded-xl p-3 text-xs font-medium text-ink outline-none focus:border-brand resize-none leading-relaxed"
                    required
                  />
                </div>

                {/* Collapsible Advanced Options: Custom Subject & Urgency */}
                <div className="border border-divider/60 rounded-xl overflow-hidden bg-canvas/30">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full px-3 py-2 text-left flex items-center justify-between text-xs font-bold text-ink-secondary hover:text-ink cursor-pointer"
                  >
                    <span>{showAdvanced ? 'Hide Subject & Urgency' : '+ Add Custom Subject or Urgency (Optional)'}</span>
                    {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showAdvanced && (
                    <div className="p-3 border-t border-divider/60 space-y-3 bg-surface/50 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[11px] font-bold text-ink mb-1">
                          Subject Summary (Optional)
                        </label>
                        <input
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Auto-generated from your message if left blank"
                          className="w-full bg-canvas border border-divider rounded-xl px-3 py-2 text-xs font-medium text-ink outline-none focus:border-brand"
                        />
                      </div>

                      {ticketType === 'CONCERN' && (
                        <div>
                          <label className="block text-[11px] font-bold text-ink mb-1">
                            Urgency Level
                          </label>
                          <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                            {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((lvl) => (
                              <button
                                type="button"
                                key={lvl}
                                onClick={() => setPriority(lvl)}
                                className={`py-1 rounded-lg border text-center transition-all cursor-pointer text-[10px] ${priority === lvl
                                  ? lvl === 'URGENT' || lvl === 'HIGH'
                                    ? 'bg-red-500 text-white border-red-500 shadow-xs'
                                    : 'bg-brand text-white border-brand'
                                  : 'bg-canvas border-divider text-ink-secondary hover:text-ink'
                                  }`}
                              >
                                {lvl === 'URGENT' ? 'Urgent' : lvl === 'HIGH' ? 'High' : lvl === 'LOW' ? 'Low' : 'Normal'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Contact Email confirmation */}
                <div>
                  {isAuthenticated && !isEditingEmail ? (
                    <div className="p-2.5 rounded-xl bg-canvas border border-divider flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-ink-secondary text-[11px]">
                          Replying to <strong className="text-ink">{userEmail || user?.email}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditingEmail(true)}
                        className="text-[10px] font-bold text-brand hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                        <span>Change</span>
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-ink">
                          Your Contact Email {!isAuthenticated && <span className="text-brand font-black">*</span>}
                        </label>
                        {isAuthenticated && (
                          <button
                            type="button"
                            onClick={() => setIsEditingEmail(false)}
                            className="text-[10px] text-brand font-bold hover:underline cursor-pointer"
                          >
                            Use Account Email
                          </button>
                        )}
                      </div>
                      <input
                        type="email"
                        required={!isAuthenticated}
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder={user?.email || "your-email@domain.com"}
                        className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2 text-xs font-medium text-ink outline-none focus:border-brand"
                      />
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 border-t border-divider flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary text-xs px-4 py-2 cursor-pointer font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary text-xs px-6 py-2 shadow-pink cursor-pointer font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending to Admin...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit to Admin</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: MY TICKETS & REPLIES HISTORY */}
        {activeTab === 'HISTORY' && (
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-ink">Recent Inquiries & Admin Replies</span>
              <button
                type="button"
                onClick={() => loadHistory()}
                disabled={isLoadingHistory}
                className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Refresh submissions"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoadingHistory && myTickets.length === 0 ? (
              <div className="py-16 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-brand animate-spin" />
                <span>Loading your past concerns & replies...</span>
              </div>
            ) : historyError && myTickets.length === 0 ? (
              <div className="py-12 text-center space-y-3 bg-canvas rounded-2xl border border-divider p-6">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">Failed to Load Inquiries</p>
                  <p className="text-[11px] text-ink-secondary mt-0.5">{historyError}</p>
                </div>
                <button
                  onClick={() => loadHistory()}
                  className="btn-secondary text-xs px-3.5 py-1.5 font-bold cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            ) : myTickets.length === 0 ? (
              <div className="py-16 text-center space-y-2 text-ink-secondary">
                <div className="w-10 h-10 rounded-full bg-canvas border border-divider flex items-center justify-center mx-auto text-ink-muted">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-ink">No Prior Submissions</p>
                <p className="text-[11px] max-w-xs mx-auto">
                  You haven't submitted any concerns or feedback yet. Whenever you do, admin status and replies will appear here!
                </p>
              </div>
            ) : (
              myTickets.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-canvas border border-divider space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${t.type === 'CONCERN'
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                        {t.type}
                      </span>
                      <span className="text-[10px] font-bold text-ink-secondary">
                        {t.category}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${t.status === 'RESOLVED'
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : t.status === 'IN_REVIEW'
                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        : t.status === 'CLOSED'
                        ? 'bg-zinc-600 text-zinc-200 border border-zinc-500/30'
                        : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                      }`}>
                      {t.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-black text-ink text-sm">{t.subject}</h4>
                    <p className="text-ink-secondary mt-1 text-[11px] leading-relaxed">{t.description}</p>
                  </div>

                  {/* Admin Resolution Note if present */}
                  {t.admin_notes && (
                    <div className="p-3 rounded-xl bg-surface border border-emerald-500/30 text-ink space-y-1 mt-2">
                      <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Admin Resolution Note:</span>
                      </div>
                      <p className="text-[11px] text-ink-secondary leading-relaxed pl-5">
                        {t.admin_notes}
                      </p>
                    </div>
                  )}

                  <div className="text-[10px] text-ink-muted pt-1 flex items-center justify-between border-t border-divider/50">
                    <span>Submitted on {new Date(t.created_at).toLocaleDateString()}</span>
                    {t.status === 'RESOLVED' && t.resolved_at && (
                      <span className="text-emerald-500 font-bold">
                        Resolved on {new Date(t.resolved_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
};

