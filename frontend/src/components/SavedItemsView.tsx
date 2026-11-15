import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Package, 
  Sparkles, 
  Search, 
  ArrowRight, 
  Loader2,
  BookmarkCheck,
  Compass
} from 'lucide-react';
import { Item, CommunityRequest } from '../lib/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { ItemCard } from './ItemCard';
import { RequestCard } from './RequestCard';
import { getFavoriteItemIds, getFavoriteRequestIds } from '../lib/favorites';

interface SavedItemsViewProps {
  onSelectItem: (item: Item) => void;
  onSelectRequest?: (request: CommunityRequest) => void;
  onClaimRequest?: (request: CommunityRequest) => void;
  onOpenUserProfile?: (userId: string) => void;
  onExploreMarketplace?: () => void;
  onExploreRequests?: () => void;
  onOpenAuth?: () => void;
}

export const SavedItemsView: React.FC<SavedItemsViewProps> = ({
  onSelectItem,
  onSelectRequest,
  onClaimRequest,
  onOpenUserProfile,
  onExploreMarketplace,
  onExploreRequests,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'items' | 'requests'>('all');
  const [savedItems, setSavedItems] = useState<Item[]>([]);
  const [savedRequests, setSavedRequests] = useState<CommunityRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadSavedData = async () => {
    setIsLoading(true);
    try {
      const localItemIds = getFavoriteItemIds();
      const localRequestIds = getFavoriteRequestIds();

      // If user is authenticated, query backend favorites
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.getFavorites();
          if (res) {
            setSavedItems(Array.isArray(res.items) ? res.items : []);
            setSavedRequests(Array.isArray(res.requests) ? res.requests : []);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Could not fetch backend favorites, falling back to local item ids:', e);
        }
      }

      // Fallback: Fetch items & requests matching local IDs
      const fetchedItems: Item[] = [];
      const fetchedRequests: CommunityRequest[] = [];

      if (localItemIds.length > 0) {
        const itemsRes = await api.getItems({ status: 'ALL' }).catch(() => []);
        if (Array.isArray(itemsRes)) {
          const matched = itemsRes.filter((it: Item) => localItemIds.includes(it.id));
          fetchedItems.push(...matched);
        }
      }

      if (localRequestIds.length > 0) {
        const reqsRes = await api.getRequests({ status: 'ALL' }).catch(() => []);
        if (Array.isArray(reqsRes)) {
          const matched = reqsRes.filter((r: CommunityRequest) => localRequestIds.includes(r.id));
          fetchedRequests.push(...matched);
        }
      }

      setSavedItems(fetchedItems);
      setSavedRequests(fetchedRequests);
    } catch (err) {
      console.error('Failed to load saved items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSavedData();

    const handleSync = () => {
      // Re-filter or reload
      const localItemIds = getFavoriteItemIds();
      const localRequestIds = getFavoriteRequestIds();
      setSavedItems(prev => prev.filter(i => localItemIds.includes(i.id)));
      setSavedRequests(prev => prev.filter(r => localRequestIds.includes(r.id)));
    };

    window.addEventListener('rentu_favorites_updated', handleSync);
    return () => window.removeEventListener('rentu_favorites_updated', handleSync);
  }, [user?.id]);

  // Filter by search query
  const filteredItems = savedItems.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      item.locality?.toLowerCase().includes(q)
    );
  });

  const filteredRequests = savedRequests.filter(req => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      req.item_name?.toLowerCase().includes(q) ||
      req.description?.toLowerCase().includes(q) ||
      req.category?.toLowerCase().includes(q) ||
      req.locality?.toLowerCase().includes(q)
    );
  });

  const totalSavedCount = savedItems.length + savedRequests.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-divider">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 fill-brand" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight font-display flex items-center gap-2">
                <span>Saved Items & Wishes</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-soft text-brand font-black">
                  {totalSavedCount} Saved
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
                Gear and community requests you've bookmarked to rent, borrow, or fulfill later.
              </p>
            </div>
          </div>
        </div>

        {/* Search inside saved items */}
        {totalSavedCount > 0 && (
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your saved gear..."
              className="w-full bg-surface border border-divider rounded-2xl pl-9.5 pr-4 py-2 text-xs font-semibold text-ink outline-none focus:border-brand shadow-xs"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mt-6 overflow-x-auto scrollbar-none pb-2 border-b border-divider/60">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-ink text-canvas shadow-xs'
              : 'bg-surface hover:bg-canvas text-ink-secondary hover:text-ink border border-divider'
          }`}
        >
          <BookmarkCheck className="w-4 h-4" />
          <span>All Saved</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'all' ? 'bg-canvas/20 text-canvas' : 'bg-canvas text-ink-muted'
          }`}>
            {totalSavedCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'items'
              ? 'bg-ink text-canvas shadow-xs'
              : 'bg-surface hover:bg-canvas text-ink-secondary hover:text-ink border border-divider'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Gear & Equipment</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'items' ? 'bg-canvas/20 text-canvas' : 'bg-canvas text-ink-muted'
          }`}>
            {savedItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'requests'
              ? 'bg-ink text-canvas shadow-xs'
              : 'bg-surface hover:bg-canvas text-ink-secondary hover:text-ink border border-divider'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Community Wishes</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'requests' ? 'bg-canvas/20 text-canvas' : 'bg-canvas text-ink-muted'
          }`}>
            {savedRequests.length}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="mt-8">
        {isLoading ? (
          <div className="py-24 text-center text-xs text-ink-secondary flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
            <span className="font-bold">Loading your bookmarked gear & requests...</span>
          </div>
        ) : totalSavedCount === 0 ? (
          /* Empty State */
          <div className="py-20 text-center space-y-4 max-w-md mx-auto bg-surface border border-divider rounded-3xl p-8 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
              <Heart className="w-8 h-8 text-brand" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-ink font-display">No Saved Items Yet</h3>
              <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                Whenever you find an item or community wish you like, tap the heart icon to save it here for fast access.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={onExploreMarketplace}
                className="btn-primary text-xs px-5 py-2.5 font-bold cursor-pointer w-full sm:w-auto flex items-center justify-center gap-1.5 shadow-pink"
              >
                <Compass className="w-4 h-4" />
                <span>Explore Marketplace</span>
              </button>
              <button
                type="button"
                onClick={onExploreRequests}
                className="btn-secondary text-xs px-5 py-2.5 font-bold cursor-pointer w-full sm:w-auto flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Browse Wishes</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* 1. Gear Items Section */}
            {(activeTab === 'all' || activeTab === 'items') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-extrabold text-ink font-display flex items-center gap-2">
                    <Package className="w-4 h-4 text-brand" />
                    <span>Saved Gear ({filteredItems.length})</span>
                  </h2>
                </div>

                {filteredItems.length === 0 ? (
                  <div className="p-8 text-center text-xs text-ink-secondary bg-surface rounded-2xl border border-divider">
                    No gear items match your search.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                    {filteredItems.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onClick={() => onSelectItem(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Community Requests Section */}
            {(activeTab === 'all' || activeTab === 'requests') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-extrabold text-ink font-display flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span>Saved Community Wishes ({filteredRequests.length})</span>
                  </h2>
                </div>

                {filteredRequests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-ink-secondary bg-surface rounded-2xl border border-divider">
                    No community wishes match your search.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                    {filteredRequests.map(req => (
                      <RequestCard
                        key={req.id}
                        request={req}
                        onClick={() => {
                          if (onSelectRequest) {
                            onSelectRequest(req);
                          } else if (onClaimRequest) {
                            onClaimRequest(req);
                          }
                        }}
                        onClaim={onClaimRequest}
                        onOpenUserProfile={onOpenUserProfile}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
