import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, MapPin, Loader2, Trash2, Plus, AlertCircle } from 'lucide-react';
import { Item, SavedLocation } from '../lib/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { uploadItemPhoto } from '../lib/upload';
import { getEffectiveSavedLocations, forwardGeocode } from '../lib/location';
import { resolveCoords } from '../lib/distance';
import { AddLocationModal } from './AddLocationModal';

interface EditItemModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  item,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics & Tech');
  const [condition, setCondition] = useState('Like new');
  const [listingType, setListingType] = useState<'Rent' | 'Borrow'>('Rent');
  const { user } = useAuth();
  const savedLocations = getEffectiveSavedLocations(user);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    return savedLocations.length > 0 ? (savedLocations.find(l => l.is_default)?.id || savedLocations[0].id) : '';
  });
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);
  const [pricePerDay, setPricePerDay] = useState<number | ''>('');
  const [maxDurationDays, setMaxDurationDays] = useState(5);
  const [locality, setLocality] = useState('');
  const [status, setStatus] = useState<'AVAILABLE' | 'RENTED' | 'UNAVAILABLE'>('AVAILABLE');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number | ''>(0);
  const [offersPickup, setOffersPickup] = useState(false);
  const [pickupFee, setPickupFee] = useState<number | ''>(0);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (savedLocations.length > 0 && !selectedLocationId) {
      const defaultLoc = savedLocations.find(l => l.is_default) || savedLocations[0];
      setSelectedLocationId(defaultLoc.id);
      setLocality(defaultLoc.locality || '');
    }
  }, [savedLocations, selectedLocationId]);

  useEffect(() => {
    if (item && isOpen) {
      setTitle(item.title || '');
      setDescription(item.description || '');
      const rawCat = item.category || 'Electronics & Tech';
      setCategory(rawCat === 'Clothing & Accessories' ? 'Clothing & Fits' : rawCat);
      setCondition(item.condition || 'Good');

      const matchingLoc = savedLocations.find(l => 
        (l.locality && item.locality && l.locality.toLowerCase() === item.locality.toLowerCase()) ||
        (l.street_road_landmark && item.address_text && item.address_text.toLowerCase().includes(l.street_road_landmark.toLowerCase()))
      ) || savedLocations.find(l => l.is_default) || savedLocations[0];

      if (matchingLoc) {
        setSelectedLocationId(matchingLoc.id);
        setLocality(matchingLoc.locality || item.locality || '');
      } else {
        setSelectedLocationId('');
        setLocality(item.locality || '');
      }

      const isBorrow = Boolean(item.available_for_borrowing && (Number(item.price_per_day) <= 0 || !item.price_per_day));
      setListingType(isBorrow ? 'Borrow' : 'Rent');
      setPricePerDay(item.price_per_day !== undefined && item.price_per_day !== null ? Number(item.price_per_day) : '');
      setMaxDurationDays(item.max_duration_days || 5);
      setStatus(item.status || 'AVAILABLE');
      setImageUrls(Array.isArray(item.image_urls) ? item.image_urls.filter(Boolean) : []);
      setOffersDelivery(Boolean(item.offers_delivery));
      setDeliveryFee(item.delivery_fee !== undefined ? Number(item.delivery_fee) : 0);
      setOffersPickup(Boolean(item.offers_pickup));
      setPickupFee(item.pickup_fee !== undefined ? Number(item.pickup_fee) : 0);
      setErrorMsg('');
    }
  }, [item, isOpen]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    const remainingSlots = 5 - imageUrls.length;
    if (remainingSlots <= 0) {
      setErrorMsg('You can upload a maximum of 5 pictures.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    setIsUploading(true);
    try {
      const uploadPromises = filesToUpload.map((f) => uploadItemPhoto(f, 'gear'));
      const newUrls = await Promise.all(uploadPromises);
      setImageUrls((prev) => [...prev, ...newUrls].slice(0, 5));
      setErrorMsg('');
    } catch (err: any) {
      console.error('Photo upload error:', err);
      setErrorMsg('Failed to upload image(s). Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetCoverPhoto = (indexToCover: number) => {
    setImageUrls((prev) => {
      if (indexToCover <= 0 || indexToCover >= prev.length) return prev;
      const copy = [...prev];
      const [chosen] = copy.splice(indexToCover, 1);
      return [chosen, ...copy];
    });
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImageUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!title.trim() || title.trim().length < 3) {
      setErrorMsg('Item title must be at least 3 characters.');
      return;
    }
    if (description.trim().length < 10) {
      setErrorMsg('Description must be at least 10 characters.');
      return;
    }
    if (listingType === 'Rent' && (pricePerDay === '' || Number(pricePerDay) <= 0)) {
      setErrorMsg('Please specify a valid daily rate for rental.');
      return;
    }
    if (imageUrls.length === 0) {
      setErrorMsg('Please provide at least one photo of your gear (up to 5 allowed).');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      let finalLocality = item.locality || '';
      let itemAddress = item.address_text || '';
      let pincode = item.pincode;
      let latitude = item.latitude;
      let longitude = item.longitude;

      const chosenLocation = savedLocations.find(l => l.id === selectedLocationId) || savedLocations[0];
      if (chosenLocation) {
        itemAddress = [chosenLocation.building_flat_house, chosenLocation.street_road_landmark].filter(Boolean).join(', ');
        finalLocality = chosenLocation.locality || locality.trim() || user?.locality || '';
        pincode = chosenLocation.pincode || user?.pincode || undefined;
        latitude = chosenLocation.latitude ?? user?.latitude;
        longitude = chosenLocation.longitude ?? user?.longitude;
      }

      if (!latitude || !longitude) {
        const resolved = resolveCoords(undefined, undefined, finalLocality, itemAddress);
        if (resolved) {
          latitude = resolved.lat;
          longitude = resolved.lon;
        } else {
          const geo = await forwardGeocode(`${itemAddress} ${finalLocality}`).catch(() => null);
          if (geo) {
            latitude = geo.latitude;
            longitude = geo.longitude;
          }
        }
      }

      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        category,
        condition,
        price_per_day: listingType === 'Borrow' ? 0 : Number(pricePerDay),
        max_duration_days: Number(maxDurationDays),
        locality: finalLocality,
        address_text: itemAddress || finalLocality,
        status,
        available_for_borrowing: listingType === 'Borrow',
        offers_delivery: offersDelivery,
        delivery_fee: offersDelivery ? Number(deliveryFee || 0) : 0,
        offers_pickup: offersPickup,
        pickup_fee: offersPickup ? Number(pickupFee || 0) : 0,
        image_urls: imageUrls,
      };

      if (pincode) payload.pincode = pincode;
      if (latitude !== undefined && latitude !== null && !isNaN(Number(latitude))) {
        payload.latitude = Number(latitude);
      }
      if (longitude !== undefined && longitude !== null && !isNaN(Number(longitude))) {
        payload.longitude = Number(longitude);
      }

      await api.updateItem(item.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update listing:', err);
      setErrorMsg(err.message || 'Failed to update item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${item.title}"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    setErrorMsg('');
    try {
      await api.deleteItem(item.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      setErrorMsg(err.message || 'Failed to delete listing.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="relative bg-surface rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-divider text-ink flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-ink font-display tracking-tight">
              Edit Item Listing
            </h2>
            <p className="text-xs text-ink-secondary">
              Update details, pricing, delivery options, or status
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-canvas text-ink-secondary hover:text-ink transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="edit-item-form" onSubmit={handleSave} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: Item Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">
                Item Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sony WH-1000XM4 Noise-Cancelling Headphones"
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                required
              />
            </div>

            {/* Category & Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none cursor-pointer"
                >
                  <option value="Electronics & Tech">Electronics & Tech</option>
                  <option value="Camping & Outdoor">Camping & Outdoor</option>
                  <option value="Tools & DIY">Tools & DIY</option>
                  <option value="Clothing & Fits">Clothing & Fits</option>
                  <option value="Home & Appliances">Home & Appliances</option>
                  <option value="Sports & Fitness">Sports & Fitness</option>
                  <option value="Books & Media">Books & Media</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Condition *
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none cursor-pointer"
                >
                  <option value="Like new">Like new</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-ink">
                  Description *
                </label>
                <span className="text-[10px] text-ink-secondary">
                  {description.trim().length} chars (min 10)
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What condition is it in? What accessories are included?"
                rows={3}
                className="w-full bg-canvas border border-divider rounded-xl p-3 text-xs font-medium text-ink outline-none focus:border-brand transition-colors resize-none"
                required
              />
            </div>
          </div>

          {/* SECTION 2: Photos */}
          <div className="space-y-3 pt-3 border-t border-divider">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-ink">Photos *</span>
                <span className="text-[11px] text-ink-secondary ml-1.5">(up to 5 photos)</span>
              </div>
              {imageUrls.length > 0 && (
                <span className="text-[11px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                  {imageUrls.length}/5
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {imageUrls.map((url, idx) => (
                <div 
                  key={idx} 
                  className="relative aspect-square rounded-xl overflow-hidden border border-divider bg-zinc-950 group flex items-center justify-center"
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {idx === 0 ? (
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-brand text-white text-[8px] font-bold shadow-sm">
                      Cover
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetCoverPhoto(idx)}
                      className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/70 hover:bg-brand text-white text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                    >
                      Set Cover
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {imageUrls.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="aspect-square rounded-xl border border-dashed border-divider hover:border-brand/60 bg-canvas flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 text-brand animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-ink-secondary" />
                      <span className="text-[10px] font-bold text-ink-secondary">+ Add</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* SECTION 3: Pricing & Listing Status */}
          <div className="space-y-4 pt-3 border-t border-divider">
            <span className="text-xs font-bold text-ink block">Pricing & Status</span>

            {/* Type Toggle */}
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <button
                type="button"
                onClick={() => {
                  setListingType('Rent');
                  if (pricePerDay === 0) setPricePerDay('');
                }}
                className={`py-2 px-3 rounded-xl border text-center cursor-pointer transition-all ${
                  listingType === 'Rent'
                    ? 'border-brand bg-brand-soft/40 text-ink font-bold ring-1 ring-brand'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink'
                }`}
              >
                <span className="text-xs">Rent for Fee</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setListingType('Borrow');
                  setPricePerDay(0);
                }}
                className={`py-2 px-3 rounded-xl border text-center cursor-pointer transition-all ${
                  listingType === 'Borrow'
                    ? 'border-brand bg-brand-soft/40 text-ink font-bold ring-1 ring-brand'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink'
                }`}
              >
                <span className="text-xs">Free Share (₹0)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Price Input */}
              {listingType === 'Rent' ? (
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    Daily Rental Rate (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-secondary">₹</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="250"
                      value={pricePerDay}
                      onChange={(e) => setPricePerDay(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-canvas border border-divider rounded-xl pl-8 pr-12 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                      required
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-secondary">/ day</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    Pricing Mode
                  </label>
                  <div className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ₹0 Free Borrowing
                  </div>
                </div>
              )}

              {/* Status Select */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Listing Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none cursor-pointer"
                >
                  <option value="AVAILABLE">Available for Rent</option>
                  <option value="RENTED">Currently Rented</option>
                  <option value="UNAVAILABLE">Paused / Unavailable</option>
                </select>
              </div>
            </div>

            {/* Delivery Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-canvas border border-divider space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">I can deliver</span>
                  <button
                    type="button"
                    onClick={() => setOffersDelivery(!offersDelivery)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                      offersDelivery ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        offersDelivery ? 'translate-x-4' : 'translate-x-0.5'
                      } mt-0.5`}
                    />
                  </button>
                </div>
                {offersDelivery && (
                  <div className="flex items-center justify-between pt-1 border-t border-divider/60">
                    <span className="text-[11px] text-ink-secondary">Fee</span>
                    <div className="relative w-24">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-secondary">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={deliveryFee}
                        onChange={(e) => setDeliveryFee(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                        placeholder="0"
                        className="w-full bg-surface border border-divider rounded-lg pl-6 pr-2 py-1 text-xs font-bold text-ink outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-divider space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">I can pick up on return</span>
                  <button
                    type="button"
                    onClick={() => setOffersPickup(!offersPickup)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                      offersPickup ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        offersPickup ? 'translate-x-4' : 'translate-x-0.5'
                      } mt-0.5`}
                    />
                  </button>
                </div>
                {offersPickup && (
                  <div className="flex items-center justify-between pt-1 border-t border-divider/60">
                    <span className="text-[11px] text-ink-secondary">Fee</span>
                    <div className="relative w-24">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-secondary">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={pickupFee}
                        onChange={(e) => setPickupFee(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                        placeholder="0"
                        className="w-full bg-surface border border-divider rounded-lg pl-6 pr-2 py-1 text-xs font-bold text-ink outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: Handoff Location */}
          <div className="space-y-3 pt-3 border-t border-divider">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand" />
                <span>Pickup Location *</span>
              </span>
              <button
                type="button"
                onClick={() => setIsAddLocationOpen(true)}
                className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Location</span>
              </button>
            </div>

            {savedLocations.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 text-xs">
                <span className="text-ink-secondary">No location set yet.</span>
                <button
                  type="button"
                  onClick={() => setIsAddLocationOpen(true)}
                  className="btn-primary text-xs px-3 py-1 font-bold shadow-pink cursor-pointer"
                >
                  Set Location
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {savedLocations.map((loc) => {
                  const isSelected = selectedLocationId === loc.id;
                  return (
                    <div
                      key={loc.id}
                      onClick={() => {
                        setSelectedLocationId(loc.id);
                        setLocality(loc.locality);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'border-brand bg-brand-soft/30 ring-1 ring-brand'
                          : 'border-divider bg-canvas hover:border-ink-secondary/40'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-brand bg-brand' : 'border-divider'
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-ink truncate">{loc.label}</div>
                        <div className="text-[11px] text-ink-secondary truncate">{loc.locality}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </form>

        {/* Clean Non-overlapping Fixed Footer */}
        <div className="px-6 py-4 border-t border-divider bg-surface shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
            className="px-4 py-2 rounded-xl text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Delete</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="btn-secondary text-xs px-4 py-2 cursor-pointer font-bold"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="edit-item-form"
              disabled={isSaving || isDeleting}
              className="btn-primary text-xs px-5 py-2 shadow-pink cursor-pointer inline-flex items-center gap-1.5 font-bold disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Saved Location Modal */}
      <AddLocationModal
        isOpen={isAddLocationOpen}
        locationToEdit={editingLocation}
        onClose={() => {
          setIsAddLocationOpen(false);
          setEditingLocation(null);
        }}
        onSuccess={(newLoc) => {
          setSelectedLocationId(newLoc.id);
          setLocality(newLoc.locality);
          setEditingLocation(null);
        }}
      />
    </div>
  );
};
