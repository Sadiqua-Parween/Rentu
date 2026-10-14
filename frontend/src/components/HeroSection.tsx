import React from 'react';
import { 
  Search, 
  ShieldCheck, 
  Sparkles, 
  Zap, 
  Plus, 
  CheckCircle2, 
  X,
  Compass,
  ArrowRight 
} from 'lucide-react';
import { Item, CommunityPulse } from '../lib/types';

interface HeroSectionProps {
  items: Item[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: (customQuery?: string) => void;
  onGetStarted: () => void;
  onOpenDropGear: () => void;
  onSelectItem: (item: Item) => void;
  communityStats?: CommunityPulse | null;
}

const TRENDING_SEARCHES = [
  { label: '📷 Cameras', query: 'Canon' },
  { label: '⛺ Tents', query: 'Tent' },
  { label: '📽️ Projector', query: 'Projector' },
  { label: '🎧 Audio', query: 'Headphones' },
  { label: '🎮 Gaming', query: 'PlayStation' },
  { label: '🎸 Guitar', query: 'Guitar' },
];

export const HeroSection: React.FC<HeroSectionProps> = ({
  items: _items,
  isLoading: _isLoading,
  searchQuery,
  setSearchQuery,
  onSearch,
  onGetStarted,
  onOpenDropGear,
  onSelectItem: _onSelectItem,
  communityStats: _communityStats,
}) => {
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  const handleTrendingClick = (query: string) => {
    setSearchQuery(query);
    onSearch(query);
  };

  return (
    <section className="relative overflow-hidden pt-8 sm:pt-14 pb-8 sm:pb-12 bg-gradient-to-b from-[#FFF5F7] via-[#FFF9FA] to-canvas dark:from-[#1A1218] dark:via-[#14121A] dark:to-canvas transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Centered Hero Section */}
        <div className="flex flex-col items-center text-center w-full max-w-3xl mx-auto">
          
          {/* 1. Eyebrow Label */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-white/95 dark:bg-zinc-800/95 border border-pink-200/80 dark:border-pink-900/40 text-brand shadow-xs mb-4 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span>Verified Peer-to-Peer Rental Network</span>
          </div>

          {/* 2. Main Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-ink font-display leading-[1.18] sm:leading-[1.2] tracking-tight text-center max-w-2xl mx-auto">
            Borrow, Rent and Lend. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-pink-500 to-rose-500 inline-block mt-1 sm:mt-1.5">
              Save money. Live flexible.
            </span>
          </h1>

          {/* 3. Primary Working Search Bar */}
          <div className="mt-7 sm:mt-8 max-w-2xl w-full mx-auto">
            <form 
              onSubmit={handleSearchSubmit}
              className="bg-white dark:bg-[#181922] border border-gray-200 dark:border-white/10 rounded-2xl p-2 pl-4 sm:pl-5 shadow-sm hover:shadow-md transition-all flex items-center gap-2.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 w-full"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-ink-muted shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="What gear do you need? Search cameras, tents, projectors…"
                className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm md:text-base font-medium text-ink placeholder:text-ink-muted px-1"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    onSearch('');
                  }}
                  className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Instant Search Button */}
              <button
                type="submit"
                className="bg-brand hover:bg-brand-hover text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shrink-0 shadow-xs hover:shadow-pink transition-all cursor-pointer"
              >
                <span>Search</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* 4. Compact Row of Popular Category Shortcuts */}
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xs">
              <span className="text-ink-secondary font-semibold text-[11px] mr-1">Popular:</span>
              {TRENDING_SEARCHES.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleTrendingClick(chip.query)}
                  className="px-2.5 sm:px-3 py-1 rounded-full bg-white dark:bg-[#1C1D26] border border-gray-200/90 dark:border-white/10 hover:border-brand hover:text-brand text-ink-secondary text-[11px] font-medium transition-all hover:scale-105 cursor-pointer shadow-2xs"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Two Clear Call-to-Action Buttons */}
          <div className="mt-7 sm:mt-8 flex flex-wrap items-center justify-center gap-3.5 w-full max-w-xl mx-auto">
            <button
              onClick={onGetStarted}
              className="btn-primary text-xs sm:text-sm px-6 py-3 cursor-pointer shadow-pink flex items-center gap-2 hover:scale-[1.02] transition-transform"
            >
              <Compass className="w-4 h-4" />
              <span>Explore All Gear</span>
            </button>
            <button
              onClick={onOpenDropGear}
              className="btn-secondary text-xs sm:text-sm px-6 py-3 cursor-pointer flex items-center gap-2 hover:border-brand hover:text-brand hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4 text-brand" />
              <span>List Gear & Earn ₹</span>
            </button>
          </div>

          {/* 6. Styled Trust & Community Guarantee Strip */}
          <div className="mt-8 sm:mt-10 w-full max-w-xl mx-auto">
            <div className="p-2.5 sm:px-5 sm:py-3 rounded-2xl bg-white/85 dark:bg-[#181922]/85 backdrop-blur-xs border border-gray-200/80 dark:border-white/10 shadow-2xs flex flex-wrap items-center justify-center gap-3 sm:gap-5 text-xs font-medium text-ink-secondary">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-ink">Verified Member IDs</span>
              </div>

              <span className="text-gray-300 dark:text-zinc-700 hidden sm:inline">•</span>

              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-ink">Direct Neighbor Handover</span>
              </div>

              <span className="text-gray-300 dark:text-zinc-700 hidden sm:inline">•</span>

              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-ink">Safe Community Bookings</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
