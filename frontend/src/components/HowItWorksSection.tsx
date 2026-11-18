import React from 'react';
import { Search, ShieldCheck, RotateCcw } from 'lucide-react';

interface HowItWorksSectionProps {
  onExploreGear?: () => void;
  onOpenDropGear?: () => void;
  onOpenDropWish?: () => void;
  onOpenAuth?: () => void;
  onViewCommunity?: () => void;
  showCommunityLink?: boolean;
}

export const HowItWorksSection: React.FC<HowItWorksSectionProps> = () => {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="text-center max-w-md mx-auto mb-10 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-black text-ink font-display">
          How Rentu works
        </h2>
        <p className="text-xs sm:text-sm text-ink-secondary mt-1.5 font-normal">
          Simple, secure peer rentals in three easy steps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        <div className="p-6 rounded-2xl bg-surface border border-divider text-center sm:text-left space-y-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center mx-auto sm:mx-0">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm sm:text-base text-ink">
            1. Find gear
          </h3>
          <p className="text-xs text-ink-secondary leading-relaxed">
            Browse cameras, tools, camping equipment, or tech from nearby neighbors and pick your dates.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-surface border border-divider text-center sm:text-left space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto sm:mx-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm sm:text-base text-ink">
            2. Meet & verify
          </h3>
          <p className="text-xs text-ink-secondary leading-relaxed">
            Coordinate pickup via chat and confirm handoff with a secure 6-digit code on your phone.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-surface border border-divider text-center sm:text-left space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto sm:mx-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm sm:text-base text-ink">
            3. Return & review
          </h3>
          <p className="text-xs text-ink-secondary leading-relaxed">
            Return on time, verify return handover, and build your trusted neighbor rating.
          </p>
        </div>
      </div>
    </section>
  );
};
