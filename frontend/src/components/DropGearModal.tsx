import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Check, 
  Upload, 
  Camera, 
  Loader2, 
  Sparkles,
  MapPin,
  Trash2,
  RefreshCw,
  Plus,
  AlertCircle,
  Pencil,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { uploadItemPhoto } from '../lib/upload';
import { getEffectiveSavedLocations, formatSavedLocationFull } from '../lib/location';
import { Item, SavedLocation } from '../lib/types';
import { AddLocationModal } from './AddLocationModal';
import { SetLocationModal } from './SetLocationModal';

interface DropGearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newItem?: Item) => void;
  onOpenAuth: () => void;
  onOpenProfile?: () => void;
}

export const DropGearModal: React.FC<DropGearModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenAuth,
  onOpenProfile,
}) => {
  const { user, isAuthenticated } = useAuth();

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics & Tech');
  const [listingType, setListingType] = useState<'Rent' | 'Borrow'>('Rent');
  const [pricePerDay, setPricePerDay] = useState<number | ''>('');
  const [maxDurationDays, setMaxDurationDays] = useState(365);
  const [condition, setCondition] = useState('Like new');
  const [locality, setLocality] = useState(user?.locality || '');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const imageUrl = imageUrls[0] || '';
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number | ''>(0);
  const [offersPickup, setOffersPickup] = useState(false);
  const [pickupFee, setPickupFee] = useState<number | ''>(0);

  // Saved Pickup & Drop Locations
  const savedLocations = getEffectiveSavedLocations(user);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    return savedLocations.length > 0 ? savedLocations[0].id : '';
  });
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);
  const [isSetLocationOpen, setIsSetLocationOpen] = useState(false);

  useEffect(() => {
    if (savedLocations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(savedLocations[0].id);
      setLocality(savedLocations[0].locality);
    }
  }, [savedLocations, selectedLocationId]);

  // States
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live Camera Viewfinder States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File & Camera input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('Electronics & Tech');
    setListingType('Rent');
    setPricePerDay('');
    setMaxDurationDays(365);
    setCondition('Like new');
    setLocality(user?.locality || '');
    setImageUrls([]);
    setOffersDelivery(false);
    setDeliveryFee(0);
    setOffersPickup(false);
    setPickupFee(0);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    stopCamera();
    const effectiveLocs = getEffectiveSavedLocations(user);
    if (effectiveLocs.length > 0) {
      setSelectedLocationId(effectiveLocs[0].id);
    } else {
      setSelectedLocationId('');
    }
  };

  // Stop camera and reset form fields when closing modal so next open is completely fresh
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      resetForm();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Update default locality when user loads
  useEffect(() => {
    if (user?.locality && !locality) {
      setLocality(user.locality);
    }
  }, [user]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    const remainingSlots = 5 - imageUrls.length;
    if (remainingSlots <= 0) {
      setErrorMsg('You can upload a maximum of 5 pictures.');
      if (e.target) e.target.value = '';
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setErrorMsg(`Only ${remainingSlots} more photo(s) could be added (max 5 photos total).`);
    } else {
      setErrorMsg('');
    }

    setIsUploading(true);

    try {
      const uploadPromises = filesToUpload.map((f) => uploadItemPhoto(f, 'gear'));
      const uploadedUrls = await Promise.all(uploadPromises);
      setImageUrls((prev) => [...prev, ...uploadedUrls].slice(0, 5));
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload photo(s). Please try again.');
    } finally {
      setIsUploading(false);
      // Reset input value so same photo can be re-selected if desired
      if (e.target) e.target.value = '';
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setImageUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setErrorMsg('');
  };

  const handleSetCoverPhoto = (indexToCover: number) => {
    setImageUrls((prev) => {
      if (indexToCover <= 0 || indexToCover >= prev.length) return prev;
      const copy = [...prev];
      const [chosen] = copy.splice(indexToCover, 1);
      return [chosen, ...copy];
    });
  };

  const startCamera = async () => {
    setErrorMsg('');
    // On touch mobile devices, native camera capture gives best quality & hardware shutter
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && cameraInputRef.current) {
      cameraInputRef.current.click();
      return;
    }

    // On desktop / laptop, open live webcam viewfinder in the form
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        setIsCameraActive(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        }, 100);
      } else {
        cameraInputRef.current?.click();
      }
    } catch (err: any) {
      console.warn('Webcam access error, falling back to camera file input:', err);
      cameraInputRef.current?.click();
    }
  };

  const capturePhotoFromCamera = async () => {
    if (!videoRef.current) return;
    if (imageUrls.length >= 5) {
      setErrorMsg('You have already added the maximum of 5 photos.');
      stopCamera();
      return;
    }
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    stopCamera();
    setIsUploading(true);
    setErrorMsg('');

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsUploading(false);
        return;
      }
      try {
        const file = new File([blob], `gear-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const publicUrl = await uploadItemPhoto(file, 'gear');
        setImageUrls((prev) => [...prev, publicUrl].slice(0, 5));
      } catch (err: any) {
        console.error('Upload error:', err);
        setErrorMsg(err.message || 'Failed to upload captured photo. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }, 'image/jpeg', 0.9);
  };

  const descTrimmed = description.trim();
  const isDescTooShort = descTrimmed.length < 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    if (!title.trim() || title.trim().length < 3) {
      setErrorMsg('Item title must be at least 3 characters.');
      return;
    }

    if (isDescTooShort) {
      setErrorMsg('Minimum 10 characters are compulsory for the description.');
      return;
    }

    if (imageUrls.length === 0) {
      setErrorMsg('Please upload at least 1 photo of your item (up to 5 allowed).');
      return;
    }

    if (imageUrls.length > 5) {
      setErrorMsg('You can upload a maximum of 5 photos.');
      return;
    }

    if (listingType === 'Rent' && (pricePerDay === '' || Number(pricePerDay) <= 0)) {
      setErrorMsg('Please specify a valid daily rental price.');
      return;
    }

    const chosenLocation = savedLocations.find(l => l.id === selectedLocationId) || (savedLocations.length > 0 ? savedLocations[0] : null);
    const finalLocality = chosenLocation?.locality || locality.trim() || user?.locality || '';
    if (!chosenLocation && !finalLocality) {
      setErrorMsg('Please select a pickup and drop location or click "+ Add Another Location".');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const itemAddress = (chosenLocation ? [chosenLocation.building_flat_house, chosenLocation.street_road_landmark].filter(Boolean).join(', ') : '') || finalLocality;
      const itemPincode = chosenLocation?.pincode || user?.pincode || undefined;
      const itemLat = chosenLocation?.latitude ?? (user?.latitude ? Number(user.latitude) : undefined);
      const itemLon = chosenLocation?.longitude ?? (user?.longitude ? Number(user.longitude) : undefined);

      const createdItem = await api.createItem({
        title: title.trim(),
        description: description.trim(),
        category,
        condition,
        price_per_day: listingType === 'Borrow' ? 0 : Number(pricePerDay || 0),
        max_duration_days: Number(maxDurationDays),
        image_urls: imageUrls.length > 0 ? imageUrls : [imageUrl],
        sticker_badge: 'Available',
        locality: finalLocality,
        address_text: itemAddress,
        pincode: itemPincode,
        latitude: itemLat,
        longitude: itemLon,
        available_for_borrowing: listingType === 'Borrow',
        offers_delivery: offersDelivery,
        delivery_fee: offersDelivery ? Number(deliveryFee || 0) : 0,
        offers_pickup: offersPickup,
        pickup_fee: offersPickup ? Number(pickupFee || 0) : 0,
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      onSuccess(createdItem);
      resetForm();
      onClose();
    } catch (err: any) {
      console.error('Failed to list item:', err);
      setErrorMsg(err.message || 'Failed to list item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
              List an Item
            </h2>
            <p className="text-xs text-ink-secondary">
              Turn your unused gear into daily earnings
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

        {/* Single-Page Scrollable Form Body */}
        <form id="drop-gear-form" onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
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
                {isDescTooShort ? (
                  <span className="text-[10px] font-semibold text-amber-500">
                    Min 10 chars ({descTrimmed.length}/10)
                  </span>
                ) : (
                  <span className="text-[10px] text-ink-secondary">
                    {descTrimmed.length} chars
                  </span>
                )}
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
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Live Camera Viewfinder */}
            {isCameraActive && (
              <div className="p-3 bg-canvas rounded-2xl border border-divider space-y-3">
                <div className="relative aspect-video w-full max-w-sm mx-auto bg-black rounded-xl overflow-hidden">
                  <video 
                    ref={videoRef} 
                    playsInline 
                    autoPlay 
                    muted 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={capturePhotoFromCamera}
                    className="btn-primary text-xs px-4 py-1.5 shadow-pink font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Snap Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="btn-secondary text-xs px-3 py-1.5 cursor-pointer font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!isCameraActive && (
              <div>
                {imageUrls.length > 0 ? (
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
                          onClick={() => handleRemovePhoto(idx)}
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
                            <Plus className="w-4 h-4 text-ink-secondary" />
                            <span className="text-[10px] font-bold text-ink-secondary">Add</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-6 border border-dashed border-divider rounded-2xl bg-canvas/40 text-center space-y-3">
                    {isUploading ? (
                      <div className="py-4 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 text-brand animate-spin" />
                        <span className="text-xs font-bold text-ink">Uploading...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
                          <Camera className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-ink-secondary">Add clear photos of your item</p>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="btn-secondary text-xs px-3.5 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1.5 hover:border-brand hover:text-brand"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Photos</span>
                          </button>
                          <button
                            type="button"
                            onClick={startCamera}
                            className="btn-secondary text-xs px-3.5 py-1.5 font-bold cursor-pointer inline-flex items-center gap-1.5 hover:border-brand hover:text-brand"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Camera</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: Pricing & Delivery */}
          <div className="space-y-4 pt-3 border-t border-divider">
            <span className="text-xs font-bold text-ink block">Pricing & Delivery</span>

            {/* Type Toggle */}
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <button
                type="button"
                onClick={() => setListingType('Rent')}
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
                onClick={() => setListingType('Borrow')}
                className={`py-2 px-3 rounded-xl border text-center cursor-pointer transition-all ${
                  listingType === 'Borrow'
                    ? 'border-brand bg-brand-soft/40 text-ink font-bold ring-1 ring-brand'
                    : 'border-divider bg-canvas text-ink-secondary hover:text-ink'
                }`}
              >
                <span className="text-xs">Free Share</span>
              </button>
            </div>

            {/* Price Input */}
            {listingType === 'Rent' ? (
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Daily Rental Rate (₹) *
                </label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-secondary">₹</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="250"
                    value={pricePerDay}
                    onChange={(e) => setPricePerDay(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-canvas border border-divider rounded-xl pl-8 pr-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-secondary">/ day</span>
                </div>
              </div>
            ) : null}

            {/* Delivery Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Deliver */}
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

              {/* Option 2: Collect */}
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

        {/* Clean, Non-overlapping Fixed Footer outside scrollable form */}
        <div className="px-6 py-4 border-t border-divider bg-surface shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-ink-muted flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>Items are reviewed by admin before appearing in public search.</span>
          </p>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary text-xs px-5 py-2.5 cursor-pointer font-bold"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="drop-gear-form"
              disabled={isSubmitting || isUploading}
              className="btn-primary text-xs px-6 py-2.5 shadow-pink cursor-pointer inline-flex items-center gap-2 font-bold disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Gear...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  <span>List Item Now</span>
                </>
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

      {/* Set Profile Location Modal */}
      <SetLocationModal
        isOpen={isSetLocationOpen}
        onClose={() => setIsSetLocationOpen(false)}
        onSuccess={(newLoc) => {
          setIsSetLocationOpen(false);
          setSelectedLocationId('primary');
          setLocality(newLoc.locality);
        }}
        canSkip={false}
      />
    </div>
  );
};
