import React from 'react';
import { ArrowRight, Plus, Sparkles } from 'lucide-react';

interface HeroSectionProps {
  onOpenDropGear: () => void;
  onOpenDropWish?: () => void;
  onGetStarted: () => void;
  itemsCount?: number;
  requestsCount?: number;
  activeUsersCount?: number;
  isLoading?: boolean;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  onSearch?: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenDropGear,
  onGetStarted,
  itemsCount = 0,
  activeUsersCount = 0,
  isLoading = false,
}) => {
  return (
    <section className="relative overflow-hidden pt-12 sm:pt-20 pb-12 sm:pb-16 bg-canvas text-center transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        {/* Minimal Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft/70 text-brand text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Peer-to-peer neighborhood rentals</span>
        </div>

        {/* Bold, Clean Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-ink tracking-tight font-display leading-[1.15]">
          Rent anything from{' '}
          <span className="text-brand">neighbors nearby.</span>
        </h1>

        {/* Clean, Short Subtitle */}
        <p className="mt-4 sm:mt-5 text-sm sm:text-base font-normal text-ink-secondary max-w-lg mx-auto leading-relaxed">
          Borrow cameras, camping gear, tools, and tech for a fraction of the retail cost — or earn by lending yours.
        </p>

        {/* Action Buttons with Room to Breathe */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
          <button
            type="button"
            onClick={onGetStarted}
            className="w-full sm:w-auto btn-primary text-sm px-7 py-3 font-bold shadow-pink rounded-full inline-flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.02] active:scale-95"
          >
            <span>Explore Gear</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenDropGear}
            className="w-full sm:w-auto bg-surface hover:bg-canvas text-ink border border-divider text-sm px-6 py-3 font-semibold rounded-full inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4 text-brand" />
            <span>List an Item</span>
          </button>
        </div>

        {/* Airy, Minimal Social Proof */}
        <div className="mt-12 pt-8 border-t border-divider/60 flex items-center justify-center gap-8 sm:gap-14 text-center">
          <div>
            <div className="text-xl sm:text-2xl font-black text-ink font-display">
              {isLoading ? '...' : itemsCount}
            </div>
            <div className="text-[11px] text-ink-secondary font-medium mt-0.5">Items listed</div>
          </div>
          <div className="w-px h-8 bg-divider/60" />
          <div>
            <div className="text-xl sm:text-2xl font-black text-ink font-display">
              {isLoading ? '...' : activeUsersCount || '100+'}
            </div>
            <div className="text-[11px] text-ink-secondary font-medium mt-0.5">Neighbors</div>
          </div>
          <div className="w-px h-8 bg-divider/60" />
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display">
              100%
            </div>
            <div className="text-[11px] text-ink-secondary font-medium mt-0.5">Verified</div>
          </div>
        </div>

      </div>
    </section>
  );
};
