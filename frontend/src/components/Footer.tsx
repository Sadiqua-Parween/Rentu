import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  FileText,
  ExternalLink,
  X,
  Scale,
  CheckCircle2
} from 'lucide-react';
import { TabType } from '../App';

interface FooterProps {
  onNavigate: (tab: TabType) => void;
  onSelectCategory?: (category: string) => void;
  onOpenDropGear?: () => void;
  onOpenDropWish?: () => void;
  onOpenHelp?: (tab?: 'NEW' | 'HISTORY') => void;
  onOpenAuth?: (mode?: 'login' | 'signup') => void;
  isAuthenticated?: boolean;
}

type LegalModalType = 'LICENSING' | 'TERMS' | 'PRIVACY' | 'SECURITY' | null;

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onSelectCategory,
  onOpenDropGear,
  onOpenDropWish,
  onOpenHelp,
  onOpenAuth,
  isAuthenticated,
}) => {
  const [activeModal, setActiveModal] = useState<LegalModalType>(null);

  const handleCategoryClick = (cat: string) => {
    if (onSelectCategory) {
      onSelectCategory(cat);
    }
    onNavigate('explore');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavClick = (tab: TabType) => {
    onNavigate(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <footer className="mt-12 border-t border-divider bg-surface text-ink transition-colors py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          {/* Brand & Copyright */}
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => handleNavClick('home')}
              className="font-extrabold text-base tracking-tight text-ink font-display cursor-pointer"
            >
              Rentu<sup className="text-brand font-black text-xs">⁺</sup>
            </button>
            <span className="text-divider">•</span>
            <span className="text-ink-secondary">© {new Date().getFullYear()} Rentu</span>
          </div>

          {/* Clean Navigation Links */}
          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6 text-ink-secondary font-medium">
            <button
              type="button"
              onClick={() => handleNavClick('explore')}
              className="hover:text-brand transition-colors cursor-pointer"
            >
              Marketplace
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('community')}
              className="hover:text-brand transition-colors cursor-pointer"
            >
              Community
            </button>
            <button
              type="button"
              onClick={() => {
                if (onOpenHelp) onOpenHelp('NEW');
              }}
              className="hover:text-brand transition-colors cursor-pointer"
            >
              Help & Support
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('TERMS')}
              className="hover:text-brand transition-colors cursor-pointer"
            >
              Terms
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('PRIVACY')}
              className="hover:text-brand transition-colors cursor-pointer"
            >
              Privacy
            </button>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* INTERACTIVE MODAL: LICENSING, TERMS, PRIVACY & SECURITY                    */}
      {/* ========================================================================= */}
      {activeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div
            className="relative bg-surface rounded-3xl w-full max-w-2xl shadow-2xl border border-divider text-ink flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-canvas/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                  {activeModal === 'LICENSING' && <Scale className="w-4 h-4" />}
                  {activeModal === 'TERMS' && <FileText className="w-4 h-4" />}
                  {activeModal === 'PRIVACY' && <Lock className="w-4 h-4" />}
                  {activeModal === 'SECURITY' && <ShieldCheck className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-ink font-display">
                    {activeModal === 'LICENSING' && 'Software License & Open Source Attribution'}
                    {activeModal === 'TERMS' && 'Terms of Service & Community Agreement'}
                    {activeModal === 'PRIVACY' && 'Privacy Policy & Location Protection'}
                    {activeModal === 'SECURITY' && 'Handover Security & Safety Guarantee'}
                  </h3>
                  <p className="text-[11px] text-ink-secondary">
                    {activeModal === 'LICENSING' && 'Official MIT License and community content rights'}
                    {activeModal === 'TERMS' && 'Guidelines for renting and sharing gear on Rentu'}
                    {activeModal === 'PRIVACY' && 'How we protect your personal info, coordinates, and handoffs'}
                    {activeModal === 'SECURITY' && 'Two-way security codes and verified neighbor handoffs'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full hover:bg-canvas text-ink-muted hover:text-ink transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-ink-secondary leading-relaxed">
              {/* MIT LICENSE VIEW */}
              {activeModal === 'LICENSING' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-canvas border border-divider font-mono text-[11px] space-y-3 leading-relaxed text-ink">
                    <p className="font-bold text-brand">MIT License</p>
                    <p>Copyright (c) {new Date().getFullYear()} Rentu Technologies & Contributors</p>
                    <p>
                      Permission is hereby granted, free of charge, to any person obtaining a copy
                      of this software and associated documentation files (the &quot;Software&quot;), to deal
                      in the Software without restriction, including without limitation the rights
                      to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
                      copies of the Software, and to permit persons to whom the Software is
                      furnished to do so, subject to the following conditions:
                    </p>
                    <p>
                      The above copyright notice and this permission notice shall be included in all
                      copies or substantial portions of the Software.
                    </p>
                    <p className="uppercase text-[10px] text-ink-muted">
                      THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                      IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                      FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
                      AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
                      LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
                      OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
                      SOFTWARE.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-ink">Community Content Rights</h4>
                    <p>
                      Photos, item descriptions, and gear listings posted by community members remain the intellectual property of the respective user. Rentu does not claim ownership over neighbor photos or creative assets.
                    </p>
                  </div>
                </div>
              )}

              {/* TERMS OF SERVICE VIEW */}
              {activeModal === 'TERMS' && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">1. The Peer-to-Peer Agreement</h4>
                    <p>
                      Rentu operates as a peer-to-peer neighborhood sharing marketplace. Transactions are agreements between consenting community members (&quot;Lenders&quot; and &quot;Renters&quot;). Rentu provides the matching, verification, and security verification tools.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">2. Handover Security & Codes</h4>
                    <p>
                      All pickups require exchanging a secure 6-digit code generated in the app. Handing over this code confirms you have inspected the gear and accepted its physical condition. Never share the pickup or return code over chat prior to physical meetup.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">3. Timely Returns & Item Care</h4>
                    <p>
                      Borrowers must return gear on or before the scheduled return deadline in the same condition it was received. Failure to return items or intentional damage is subject to immediate suspension, community trust score deductions, and legal escalation.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">4. Prohibited Items</h4>
                    <p>
                      Hazardous materials, illegal equipment, firearms, adult content, or items prohibited under Indian law are strictly forbidden. Listings violating this policy are banned immediately.
                    </p>
                  </div>
                </div>
              )}

              {/* PRIVACY POLICY VIEW */}
              {activeModal === 'PRIVACY' && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">1. Location Privacy Protection</h4>
                    <p>
                      Your exact building/flat number is <strong>never displayed publicly</strong> on the marketplace or explore feed. We only display your general neighborhood or locality (e.g. &quot;BEML Layout 7th Phase, Bengaluru&quot;). Your precise meetup location is only revealed to your confirmed partner after an agreement is accepted.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">2. Contact & Identity Protection</h4>
                    <p>
                      Phone numbers and emails are masked in public profiles. Direct communication happens inside Rentu encrypted chat. Contact info is only shared with an active rental partner during an accepted booking for meetup coordination.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">3. Zero Data Brokering</h4>
                    <p>
                      Rentu does not sell, trade, or rent user data to third-party ad networks or brokers. All data is stored securely in encrypted cloud infrastructure.
                    </p>
                  </div>
                </div>
              )}

              {/* SECURITY & SAFETY VIEW */}
              {activeModal === 'SECURITY' && (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Double-Handshake Security: Two separate 6-digit codes protect every exchange.</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">Step 1: Pickup Inspection Code</h4>
                    <p>
                      At pickup, the renter inspects the gear. If satisfied, the renter provides their 6-digit pickup code to the owner, who inputs it to confirm the handover. This officially starts the rental clock.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">Step 2: Return Verification Code</h4>
                    <p>
                      At the end of the rental, the owner inspects the returned gear for working condition. If sound, the owner gives the 6-digit return code to the renter, who confirms it to mark the exchange complete and unlock two-way reviews.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">Community Dispute Mediation</h4>
                    <p>
                      If any dispute arises regarding item condition or scheduling, open a support ticket under the Help & Support section. Our community safety team will review the chat logs, exchange timestamps, and photos to reach a fair settlement.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-divider bg-canvas/50 flex items-center justify-between text-xs">
              <span className="text-ink-secondary text-[11px]">Rentu Community Trust Framework</span>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="btn-primary text-xs px-4 py-1.5 font-bold cursor-pointer shadow-pink"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

