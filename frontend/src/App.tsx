import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { CategoryTiles } from './components/CategoryTiles';
import { ExploreView } from './components/ExploreView';
import { RequestsBoard } from './components/RequestsBoard';
import { BookingsView } from './components/BookingsView';
import { ProfileView } from './components/ProfileView';
import { HustleHub } from './components/HustleHub';
import { ItemDetailModal } from './components/ItemDetailModal';
import { DropGearModal } from './components/DropGearModal';
import { DropWishModal } from './components/DropWishModal';
import { ChatModal } from './components/ChatModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { AuthModal } from './components/AuthModal';
import { SetLocationModal } from './components/SetLocationModal';
import { RentuAiModal } from './components/RentuAiModal';
import { CuteBotAvatar } from './components/CuteBotAvatar';
import { Sparkles } from 'lucide-react';
import { ItemCard } from './components/ItemCard';
import { useAuth } from './lib/authContext';
import { api } from './lib/api';
import { Item, CommunityRequest, CommunityPulse } from './lib/types';
import { extractCity } from './lib/city';

export type TabType = 'home' | 'explore' | 'requests' | 'bookings' | 'hustle' | 'profile';

const getTabFromUrl = (): TabType => {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (path === '/admin' || hash === '#admin') return 'hustle';
  if (path === '/requests' || hash === '#requests') return 'requests';
  if (path === '/bookings' || hash === '#bookings') return 'bookings';
  if (path === '/profile' || hash === '#profile') return 'profile';
  if (path === '/explore' || hash === '#explore') return 'explore';
  return 'home';
};

export const App: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  // Navigation State with URL synchronization
  const [activeTab, setActiveTabState] = useState<TabType>(getTabFromUrl);
  const [selectedLocality, setSelectedLocality] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    const targetPath = tab === 'home' ? '/' : tab === 'hustle' ? '/admin' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getTabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const activeCity = (isAuthenticated && user?.locality) ? extractCity(user.locality) : selectedLocality;

  // Auto-sync city to logged in user's city
  useEffect(() => {
    if (isAuthenticated && user?.locality) {
      setSelectedLocality(extractCity(user.locality));
    }
  }, [user, isAuthenticated]);

  // Data State
  const [items, setItems] = useState<Item[]>([]);
  const [requests, setRequests] = useState<CommunityRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isDropGearOpen, setIsDropGearOpen] = useState(false);
  const [isDropWishOpen, setIsDropWishOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isSetLocationOpen, setIsSetLocationOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiContextItem, setAiContextItem] = useState<Item | null>(null);
  const [communityPulse, setCommunityPulse] = useState<CommunityPulse | null>(null);

  // Fetch real aggregate community pulse on initial load
  useEffect(() => {
    api.getAnalytics()
      .then((data) => {
        if (data?.pulse) setCommunityPulse(data.pulse);
      })
      .catch((err) => console.warn('Could not load community pulse:', err));
  }, []);

  useEffect(() => {
    loadFeed();
  }, [selectedCategory, activeCity]);

  const loadFeed = async (overrideSearch?: string) => {
    setIsLoading(true);
    const searchToUse = overrideSearch !== undefined ? overrideSearch : searchQuery;
    try {
      const [itemsData, requestsData] = await Promise.all([
        api.getItems({
          category: selectedCategory,
          locality: activeCity,
          search: searchToUse,
        }),
        api.getRequests({
          category: selectedCategory,
          locality: activeCity,
        }),
      ]);
      setItems(itemsData);
      setRequests(requestsData);
    } catch (err) {
      console.error('Failed to load feed data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (customQuery?: string) => {
    const term = customQuery !== undefined ? customQuery : searchQuery;
    if (customQuery !== undefined) {
      setSearchQuery(customQuery);
    }
    await loadFeed(term);
    setActiveTab('explore');
  };

  const handleClaimRequest = async (req: CommunityRequest) => {
    if (!isAuthenticated) {
      setIsAuthOpen(true);
      return;
    }
    try {
      await api.updateRequestStatus(req.id, 'FULFILLED');
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: 'FULFILLED' } : r))
      );
      alert(`Awesome! You've connected to lend gear for "${req.item_name}". Reach out to ${req.seeker_name}!`);
    } catch (err: any) {
      alert(err.message || 'Could not fulfill request.');
    }
  };

  const handleOpenChatWithBooking = (bookingId: string) => {
    setChatBookingId(bookingId);
    setIsChatOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas font-sans">
      
      {/* Top Navbar matching Mockup Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedLocality={activeCity}
        setSelectedLocality={setSelectedLocality}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        onOpenDropGear={() => setIsDropGearOpen(true)}
        onOpenDropWish={() => setIsDropWishOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenChat={(bookingId) => {
          if (bookingId && typeof bookingId === 'string') {
            setChatBookingId(bookingId);
          }
          setIsChatOpen(true);
        }}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        onOpenSetLocation={() => setIsSetLocationOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1">
        
        {/* VIEW 1: HOMEPAGE / LANDING (Screen 1 in Mockup) */}
        {activeTab === 'home' && (
          <div>
            {/* Screen 1: Cream Blush Hero Section with Scrapbook Collage */}
            <HeroSection
              items={items}
              isLoading={isLoading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearch={handleSearch}
              onGetStarted={() => setActiveTab('explore')}
              onOpenDropGear={() => {
                if (!isAuthenticated) {
                  setIsAuthOpen(true);
                } else {
                  setIsDropGearOpen(true);
                }
              }}
              onSelectItem={(item) => setSelectedItem(item)}
              communityStats={communityPulse}
            />

            {/* Screen 1: 8 Soft Pastel Category Tiles Container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <CategoryTiles
                selectedCategory={selectedCategory}
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                  setActiveTab('explore');
                }}
              />
            </div>

            {/* Popular / Trending Gear */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink font-display">
                    Popular Gear Near You
                  </h2>
                  <p className="text-xs sm:text-sm text-ink-secondary">
                    Available for rent from verified community lenders
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('explore')}
                  className="text-xs font-bold text-brand hover:underline cursor-pointer"
                >
                  Explore All ({items.length}) →
                </button>
              </div>

              {isLoading && items.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="bg-surface border border-divider rounded-2xl p-3 animate-pulse">
                      <div className="aspect-[4/3] w-full rounded-xl bg-zinc-200 dark:bg-zinc-800 mb-3" />
                      <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
                      <div className="h-4 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="bg-surface border border-divider rounded-2xl p-8 text-center">
                  <p className="text-sm text-ink-secondary font-medium">No items listed in this area yet.</p>
                  <button
                    onClick={() => {
                      if (!isAuthenticated) setIsAuthOpen(true);
                      else setIsDropGearOpen(true);
                    }}
                    className="btn-primary text-xs px-4 py-2 mt-3 shadow-pink inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>List First Item</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {items.slice(0, 8).map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onClick={() => setSelectedItem(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: EXPLORE / BROWSE (Screen 2 in Mockup) */}
        {activeTab === 'explore' && (
          <ExploreView
            items={items}
            isLoading={isLoading}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedLocality={activeCity}
            onSelectItem={(item) => setSelectedItem(item)}
            onToggleToRequests={() => setActiveTab('requests')}
          />
        )}

        {/* VIEW 6: REQUESTS BOARD (WANTED BOARD - Screen 6 in Mockup) */}
        {activeTab === 'requests' && (
          <RequestsBoard
            requests={requests}
            isLoading={isLoading}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedLocality={activeCity}
            onOpenDropWish={() => setIsDropWishOpen(true)}
            onClaimRequest={handleClaimRequest}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {/* VIEW 7: BOOKINGS (Screen 7 in Mockup) */}
        {activeTab === 'bookings' && (
          <BookingsView
            onOpenChat={(bookingId) => handleOpenChatWithBooking(bookingId)}
          />
        )}

        {/* VIEW 9: PROFILE VIEW (Screen 9 in Mockup) */}
        {activeTab === 'profile' && (
          <ProfileView
            onOpenDropGear={() => setIsDropGearOpen(true)}
            onOpenDropWish={() => setIsDropWishOpen(true)}
            onOpenChatWithBooking={handleOpenChatWithBooking}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {/* VIEW 10: ADMIN DASHBOARD (Screen 10 in Mockup) */}
        {activeTab === 'hustle' && (
          <HustleHub />
        )}

      </main>

      {/* Screen 3: Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onBookingSuccess={() => loadFeed()}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenChatWithBooking={handleOpenChatWithBooking}
          onOpenAiWithItem={(item) => {
            setAiContextItem(item);
            setIsAiOpen(true);
          }}
        />
      )}

      {/* Screen 5: List an Item Modal */}
      <DropGearModal
        isOpen={isDropGearOpen}
        onClose={() => setIsDropGearOpen(false)}
        onSuccess={() => loadFeed()}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Screen 4: Post a Request Modal */}
      <DropWishModal
        isOpen={isDropWishOpen}
        onClose={() => setIsDropWishOpen(false)}
        onSuccess={() => loadFeed()}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Screen 8: Messages Split-Pane Modal */}
      <ChatModal
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setChatBookingId(null);
        }}
        initialBookingId={chatBookingId}
        onNavigateToExplore={() => {
          setIsChatOpen(false);
          setChatBookingId(null);
          setActiveTab('explore');
        }}
      />

      {/* Screen 11: How It Works Modal */}
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
        onOpenDropGear={() => setIsDropGearOpen(true)}
        onOpenDropWish={() => setIsDropWishOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => loadFeed()}
        onOpenLocationSetup={() => setIsSetLocationOpen(true)}
      />

      {/* Set Location Modal with 1-Click GPS Detection */}
      <SetLocationModal
        isOpen={isSetLocationOpen}
        onClose={() => setIsSetLocationOpen(false)}
        onSuccess={(loc) => {
          setSelectedLocality(extractCity(loc.locality));
          loadFeed();
        }}
      />

      {/* Rentu AI Assistant Modal */}
      <RentuAiModal
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        contextItem={aiContextItem}
        onClearContextItem={() => setAiContextItem(null)}
        onSelectItem={(item) => setSelectedItem(item)}
        onOpenBookingModal={(item) => {
          setSelectedItem(item);
          setIsAiOpen(false);
        }}
      />

      {/* Floating Rentu Bot Assistant Button in Bottom-Right Corner */}
      {!isAiOpen && (
        <aside
          aria-label="Rentu Bot Assistant Launcher"
          className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 print:hidden animate-in fade-in slide-in-from-bottom-3 duration-300"
        >
          <button
            id="rentu-ai-floating-btn"
            type="button"
            onClick={() => setIsAiOpen(true)}
            className="group relative flex items-center justify-center w-14 h-14 bg-white dark:bg-[#181922] hover:bg-pink-50/70 dark:hover:bg-pink-950/40 text-ink border-2 border-pink-300 dark:border-pink-700/60 rounded-full shadow-lg hover:shadow-2xl hover:shadow-pink-500/25 hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-hidden focus:ring-4 focus:ring-pink-300 cursor-pointer"
            aria-label="Open Rentu AI Assistant"
            title="Open Assistant 🌸"
          >
            <div className="relative flex items-center justify-center">
              <CuteBotAvatar size={34} className="group-hover:-rotate-12 group-hover:scale-105 transition-transform duration-300" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E11D74]"></span>
              </span>
            </div>
          </button>
        </aside>
      )}

    </div>
  );
};
