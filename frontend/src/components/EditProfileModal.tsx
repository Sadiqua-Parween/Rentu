import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Loader2,
  Check,
  User,
  MapPin,
  Phone,
  FileText,
  Camera,
  ImageIcon,
  Sparkles,
  Navigation,
  Bell,
  Plus,
  Trash2,
  AtSign,
  Pencil,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { uploadItemPhoto } from '../lib/upload';
import { detectCurrentLocation, formatSavedLocationFull, parseAddressText, buildAddressString } from '../lib/location';
import { resolveCoords } from '../lib/distance';
import { AddLocationModal } from './AddLocationModal';
import { SavedLocation } from '../lib/types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESET_BANNERS = [
  {
    name: 'Mountain Peak',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Redwood Forest',
    url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Night Campfire',
    url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Camera Studio',
    url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Neon Cyber',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Minimal Dark',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80',
  },
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, refreshUser } = useAuth();

  const initialAddr = parseAddressText(user?.address_text);
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [buildingHouseNo, setBuildingHouseNo] = useState(initialAddr.building);
  const [streetArea, setStreetArea] = useState(initialAddr.street);
  const isLegacyDefaultLocality = (user?.locality === 'Bengaluru' || user?.locality === 'Bengaluru, India') && !user?.address_text;
  const [locality, setLocality] = useState(isLegacyDefaultLocality ? '' : (user?.locality || ''));
  const [pincode, setPincode] = useState(user?.pincode || '');
  const [latitude, setLatitude] = useState<number | undefined>(user?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(user?.longitude);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [bannerUrl, setBannerUrl] = useState(
    user?.banner_url || 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1600&q=80'
  );

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadStatus, setAvatarUploadStatus] = useState('');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUploadStatus, setBannerUploadStatus] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Sync state when user changes
  React.useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setBio(user.bio || '');
      setPhone(user.phone || '');
      const addr = parseAddressText(user.address_text);
      setBuildingHouseNo(addr.building);
      setStreetArea(addr.street);
      const isLegacy = (user.locality === 'Bengaluru' || user.locality === 'Bengaluru, India') && !user.address_text;
      setLocality(isLegacy ? '' : (user.locality || ''));
      setPincode(user.pincode || '');
      setLatitude(user.latitude);
      setLongitude(user.longitude);
      setAvatarUrl(user.avatar_url || '');
      setBannerUrl(
        user.banner_url || 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1600&q=80'
      );
    }
  }, [user]);

  // Debounced check for username
  React.useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean) {
      setUsernameStatus(null);
      setIsCheckingUsername(false);
      return;
    }
    if (user?.username && clean === user.username.toLowerCase()) {
      setUsernameStatus({ available: true, message: 'This is your current handle' });
      setIsCheckingUsername(false);
      return;
    }

    if (clean.length < 3) {
      setUsernameStatus({ available: false, message: 'Username must be at least 3 characters' });
      setIsCheckingUsername(false);
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
      setUsernameStatus({ available: false, message: 'Only lowercase letters, numbers, and underscores allowed' });
      setIsCheckingUsername(false);
      return;
    }

    setIsCheckingUsername(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api.checkUsername(clean);
        if (!cancelled) {
          setUsernameStatus(res);
        }
      } catch (err: any) {
        if (!cancelled) {
          setUsernameStatus({ available: false, message: err.message || 'Error checking username' });
        }
      } finally {
        if (!cancelled) {
          setIsCheckingUsername(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, user?.username]);

  if (!isOpen) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setAvatarUploadStatus('Uploading avatar...');
    setErrorMsg('');

    try {
      const publicUrl = await uploadItemPhoto(file, 'avatars');
      setAvatarUrl(publicUrl);
      setAvatarUploadStatus('Profile picture uploaded successfully.');
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload profile picture. Please try again.');
      setAvatarUploadStatus('Upload failed. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBanner(true);
    setBannerUploadStatus('Uploading banner...');
    setErrorMsg('');

    try {
      const publicUrl = await uploadItemPhoto(file, 'banners');
      setBannerUrl(publicUrl);
      setBannerUploadStatus('Background banner uploaded successfully.');
    } catch (err: any) {
      console.error('Banner upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload background banner. Please try again.');
      setBannerUploadStatus('Upload failed. Please try again.');
    } finally {
      setIsUploadingBanner(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setErrorMsg('');
    setLocationSuccessMsg('');
    try {
      const loc = await detectCurrentLocation();
      // DO NOT overwrite buildingHouseNo - user must manually type their building/flat/house
      if (loc.address_text) {
        setStreetArea(loc.address_text);
      }
      if (loc.locality) {
        setLocality(loc.locality);
      }
      if (loc.pincode) {
        setPincode(loc.pincode);
      }
      setLatitude(loc.latitude);
      setLongitude(loc.longitude);

      // Clean friendly location summary without repeating identical tokens
      const uniqueTokens: string[] = [];
      const seenTokens = new Set<string>();
      for (const part of [loc.address_text, loc.locality]) {
        if (!part) continue;
        for (const token of part.split(',').map((t) => t.trim()).filter(Boolean)) {
          if (!seenTokens.has(token.toLowerCase())) {
            seenTokens.add(token.toLowerCase());
            uniqueTokens.push(token);
          }
        }
      }
      const locSummary = uniqueTokens.join(', ') || loc.city || 'Neighborhood location detected';
      setLocationSuccessMsg(`Location detected: ${locSummary}. Please enter your Building / Flat / House No.`);
      try {
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
      } catch { }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not detect current location.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (avatarUrl && avatarUrl.startsWith('blob:')) {
      setErrorMsg('Profile photo must be uploaded to storage before saving.');
      return;
    }
    if (bannerUrl && bannerUrl.startsWith('blob:')) {
      setErrorMsg('Banner photo must be uploaded to storage before saving.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername && cleanUsername !== user?.username?.toLowerCase()) {
      if (usernameStatus && !usernameStatus.available) {
        setErrorMsg(usernameStatus.message || 'Username is not available. Please choose another one.');
        return;
      }
    }

    const trimmedBuilding = buildingHouseNo.trim();
    const trimmedStreet = streetArea.trim();

    setIsSaving(true);
    try {
      const fullAddress = (trimmedBuilding || trimmedStreet)
        ? buildAddressString(trimmedBuilding || null, trimmedStreet || null, pincode.trim() || null, locality.trim() || null)
        : null;

      await api.updateProfile({
        name: name.trim(),
        username: cleanUsername || undefined,
        bio: bio.trim(),
        phone: phone.trim() ? phone.trim() : null,
        locality: locality.trim() ? locality.trim() : null,
        address_text: fullAddress ? fullAddress : null,
        pincode: pincode.trim() ? pincode.trim() : null,
        latitude: latitude !== undefined ? latitude : null,
        longitude: longitude !== undefined ? longitude : null,
        avatar_url: avatarUrl ? avatarUrl : null,
        banner_url: bannerUrl ? bannerUrl : null,
      });

      await refreshUser();
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentAvatarDisplay = avatarUrl || (name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0F172A&color=fff&bold=true` : 'https://api.dicebear.com/7.x/shapes/svg?seed=rentu');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-surface rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-4 border border-divider">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface">
          <div>
            <h3 className="text-base font-extrabold text-ink font-display">Edit Profile</h3>
            <p className="text-xs text-ink-secondary">Manage your identity, photos, and handoff address</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-canvas text-ink-secondary hover:text-ink transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Profile Media: Cover Banner & Overlapping Avatar */}
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden border border-divider bg-zinc-800">
              <div className="relative h-28 sm:h-32 w-full group">
                <img
                  src={bannerUrl}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={isUploadingBanner}
                    className="bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 backdrop-blur-sm cursor-pointer transition-all"
                  >
                    {isUploadingBanner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    <span>Change Cover</span>
                  </button>
                </div>
              </div>

              {/* Overlapping Avatar */}
              <div className="px-4 pb-3 pt-2 bg-canvas/80 backdrop-blur-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative -mt-9 w-16 h-16 rounded-full overflow-hidden border-2 border-surface shadow-md bg-surface shrink-0 group">
                    <img
                      src={currentAvatarDisplay}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Upload photo"
                    >
                      {isUploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="text-xs font-bold text-brand hover:underline cursor-pointer block"
                    >
                      {isUploadingAvatar ? 'Uploading...' : 'Change Photo'}
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="text-[11px] text-ink-secondary hover:text-red-500 cursor-pointer block mt-0.5"
                      >
                        Reset to Initials
                      </button>
                    )}
                  </div>
                </div>

                {/* Preset Themes Dropdown / Row */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {PRESET_BANNERS.slice(0, 4).map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setBannerUrl(preset.url)}
                      className={`w-7 h-7 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${bannerUrl === preset.url ? 'border-brand scale-105 ring-1 ring-brand' : 'border-divider opacity-70 hover:opacity-100'}`}
                      title={preset.name}
                    >
                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="w-7 h-7 rounded-lg border border-divider hover:border-brand flex items-center justify-center text-ink-secondary hover:text-brand bg-surface cursor-pointer shrink-0"
                    title="Upload Custom Cover"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerFileChange}
              className="hidden"
            />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileChange}
              className="hidden"
            />
          </div>

          {/* Account Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sadiqua Parween"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
              </div>

              {/* Username */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-ink flex items-center gap-1">
                    <AtSign className="w-3.5 h-3.5 text-brand" />
                    <span>Username *</span>
                  </label>
                  {isCheckingUsername ? (
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking
                    </span>
                  ) : usernameStatus?.available ? (
                    <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Available
                    </span>
                  ) : usernameStatus && !usernameStatus.available ? (
                    <span className="text-[11px] text-red-500 font-bold flex items-center gap-1">
                      <X className="w-3 h-3" /> Taken
                    </span>
                  ) : null}
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-ink-secondary select-none">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    maxLength={30}
                    className="w-full bg-canvas border border-divider rounded-xl pl-8 pr-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Bio */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-ink">Bio</label>
                <span className="text-[10px] text-ink-secondary">{bio.length}/300</span>
              </div>
              <textarea
                value={bio}
                maxLength={300}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short intro about what gear you love or what you lend..."
                rows={2}
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-medium text-ink outline-none focus:border-brand resize-none"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Location & Address */}
          <div className="space-y-4 pt-3 border-t border-divider">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand" />
                  <span>Handoff Address</span>
                </h4>
                <p className="text-[11px] text-ink-secondary">Used for pickup coordination & neighborhood matching</p>
              </div>

              <button
                type="button"
                id="use-my-current-location-btn"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 cursor-pointer font-bold shrink-0 hover:border-brand hover:text-brand"
              >
                {isDetectingLocation ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Locating...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-3.5 h-3.5 text-brand" />
                    <span>Auto-detect GPS</span>
                  </>
                )}
              </button>
            </div>

            {(locationSuccessMsg || (latitude && longitude)) && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                <span>{locationSuccessMsg || 'GPS coordinates verified'}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Building / House / Flat</label>
                <input
                  type="text"
                  value={buildingHouseNo}
                  onChange={(e) => setBuildingHouseNo(e.target.value)}
                  placeholder="e.g. Flat 402, House #12"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Street / Landmark</label>
                <input
                  type="text"
                  value={streetArea}
                  onChange={(e) => setStreetArea(e.target.value)}
                  placeholder="e.g. 5th Main Road"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Locality / Neighborhood</label>
                <input
                  type="text"
                  value={locality}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocality(val);
                    setLocationSuccessMsg('');
                    const resolved = resolveCoords(null, null, val);
                    if (resolved) {
                      setLatitude(resolved.lat);
                      setLongitude(resolved.lon);
                    } else {
                      setLatitude(undefined);
                      setLongitude(undefined);
                    }
                  }}
                  placeholder="e.g. Indiranagar, Bengaluru"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">PIN / Postal Code</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 560038"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Additional Saved Locations */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-ink">Saved Locations</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLocation(null);
                    setIsAddLocationOpen(true);
                  }}
                  className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Location</span>
                </button>
              </div>

              {Array.isArray(user?.saved_locations) && user.saved_locations.length > 0 ? (
                <div className="space-y-2">
                  {user.saved_locations.map((loc) => (
                    <div
                      key={loc.id}
                      className="p-2.5 rounded-xl bg-canvas border border-divider flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-ink">{loc.label}</span>
                        <span className="text-[11px] text-ink-secondary ml-1.5 truncate">({loc.locality})</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLocation(loc);
                            setIsAddLocationOpen(true);
                          }}
                          className="p-1 rounded-lg text-ink-secondary hover:text-brand transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingLocationId === loc.id}
                          onClick={async () => {
                            if (window.confirm(`Remove saved location "${loc.label}"?`)) {
                              setDeletingLocationId(loc.id);
                              setErrorMsg('');
                              try {
                                await api.deleteSavedLocation(loc.id, user);
                                await refreshUser();
                              } catch (err: any) {
                                console.error('Failed to remove saved location:', err);
                                setErrorMsg(err.message || 'Failed to remove saved location. Please try again.');
                              } finally {
                                setDeletingLocationId(null);
                              }
                            }
                          }}
                          className="p-1 rounded-lg text-ink-secondary hover:text-red-500 transition-colors cursor-pointer"
                        >
                          {deletingLocationId === loc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-4 border-t border-divider flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs cursor-pointer px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploadingAvatar || isUploadingBanner}
              className="btn-primary text-xs cursor-pointer shadow-pink px-6 py-2 inline-flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Save All Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Add / Edit Saved Location Modal */}
      <AddLocationModal
        isOpen={isAddLocationOpen}
        locationToEdit={editingLocation}
        onClose={() => {
          setIsAddLocationOpen(false);
          setEditingLocation(null);
        }}
        onSuccess={async () => {
          await refreshUser();
          setEditingLocation(null);
        }}
      />
    </div>
  );
};
