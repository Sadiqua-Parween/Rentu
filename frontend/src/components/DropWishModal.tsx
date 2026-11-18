import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  Loader2,
  Navigation,
  Sparkles,
  MapPin,
  Trash2,
  RefreshCw,
  Megaphone,
  Calendar,
  Clock,
  ArrowRight,
  Truck,
  CheckCircle2,
  Compass,
  Check,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';
import { uploadItemPhoto } from '../lib/upload';
import { detectCurrentLocation, getEffectiveSavedLocations, formatSavedLocationFull, parseAddressText, buildAddressString } from '../lib/location';

interface DropWishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onOpenAuth: () => void;
}

export const DropWishModal: React.FC<DropWishModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenAuth,
}) => {
  const { user, isAuthenticated } = useAuth();
  const savedLocations = getEffectiveSavedLocations(user);

  // Tomorrow for default start date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultStartDate = tomorrow.toISOString().split('T')[0];

  // 3 days later for default return date
  const threeDaysLater = new Date();
  threeDaysLater.setDate(threeDaysLater.getDate() + 4);
  const defaultEndDate = threeDaysLater.toISOString().split('T')[0];

  // Form Fields - Item Details
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics & Tech');
  const [imageUrl, setImageUrl] = useState('');

  // Form Fields - Rental Dates & Return Timeline
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [endTime, setEndTime] = useState('18:00');
  const [durationDays, setDurationDays] = useState<number>(3);
  const [offeredAmount, setOfferedAmount] = useState<number | ''>('');

  // Form Fields - Pickup & Drop-off Toggles & Extra Fee
  const [willPickup, setWillPickup] = useState<boolean>(true);
  const [willDropBack, setWillDropBack] = useState<boolean>(true);
  const [deliveryFee, setDeliveryFee] = useState<number | ''>('');

  // Form Fields - Exact Destination Location (Where user wants the item to be at)
  const [buildingHouseNo, setBuildingHouseNo] = useState('');
  const [streetArea, setStreetArea] = useState('');
  const [locality, setLocality] = useState(user?.locality || '');
  const [pincode, setPincode] = useState(user?.pincode || '');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');

  // States
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
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

  // Automatically calculate duration days based on start and return dates
  useEffect(() => {
    if (startDate && endDate) {
      try {
        const [sY, sM, sD] = startDate.split('-').map(Number);
        const [eY, eM, eD] = endDate.split('-').map(Number);
        if (sY && sM && sD && eY && eM && eD) {
          const sUtc = Date.UTC(sY, sM - 1, sD);
          const eUtc = Date.UTC(eY, eM - 1, eD);
          const calDiff = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24));
          const days = Math.max(1, calDiff);
          setDurationDays(days);
        }
      } catch (err) {
        // Fallback
      }
    }
  }, [startDate, endDate]);

  // Clean stopCamera defined before any early return to prevent TDZ
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const resetForm = () => {
    setItemName('');
    setDescription('');
    setCategory('Electronics & Tech');
    setImageUrl('');
    setStartDate(defaultStartDate);
    setStartTime('10:00');
    setEndDate(defaultEndDate);
    setEndTime('18:00');
    setDurationDays(3);
    setOfferedAmount('');
    setWillPickup(true);
    setWillDropBack(true);
    setDeliveryFee('');
    setBuildingHouseNo('');
    setStreetArea('');
    setLocality(user?.locality || '');
    setPincode(user?.pincode || '');
    setCoords(null);
    setLocationSuccessMsg('');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    stopCamera();
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

  // Prefill default destination location from user profile
  useEffect(() => {
    if (user && isOpen) {
      if (user.address_text && !buildingHouseNo && !streetArea) {
        const addr = parseAddressText(user.address_text);
        setBuildingHouseNo(addr.building);
        setStreetArea(addr.street);
      }
      if (user.locality && !locality) {
        setLocality(user.locality);
      }
      if (user.pincode && !pincode) {
        setPincode(user.pincode);
      }
    }
  }, [user, isOpen]);

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setErrorMsg('');
    setLocationSuccessMsg('');

    try {
      const loc = await detectCurrentLocation();
      // Keep buildingHouseNo intact so user can keep their building/flat
      if (loc.address_text) {
        setStreetArea(loc.address_text);
      }
      if (loc.locality) {
        setLocality(loc.locality);
      }
      if (loc.pincode) {
        setPincode(loc.pincode);
      }
      if (loc.latitude && loc.longitude) {
        setCoords({ latitude: loc.latitude, longitude: loc.longitude });
      }
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
      setLocationSuccessMsg(`Location detected: ${locSummary}. Please enter Building / Flat / House No.`);
      try {
        confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 } });
      } catch { }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not detect GPS location. Please type your address manually.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');

    try {
      const publicUrl = await uploadItemPhoto(file, 'requests');
      setImageUrl(publicUrl);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const startCamera = async () => {
    setErrorMsg('');
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && cameraInputRef.current) {
      cameraInputRef.current.click();
      return;
    }

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
        const file = new File([blob], `request-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const publicUrl = await uploadItemPhoto(file, 'requests');
        setImageUrl(publicUrl);
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

    if (!itemName.trim() || itemName.trim().length < 3) {
      setErrorMsg('Item name must be at least 3 characters.');
      return;
    }

    if (isDescTooShort) {
      setErrorMsg('Minimum 10 characters are compulsory for the description.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('Return date cannot be earlier than needed date.');
      return;
    }

    if (offeredAmount === '' || Number(offeredAmount) < 0) {
      setErrorMsg('Please specify a valid offered budget.');
      return;
    }

    const trimmedBuilding = buildingHouseNo.trim();
    if (!trimmedBuilding) {
      setErrorMsg('Building / Flat / House No. is compulsory. Please enter your building or flat number where you want the item.');
      return;
    }

    if (!locality.trim()) {
      setErrorMsg('Locality / Neighborhood is compulsory. Please enter the locality where you want the item.');
      return;
    }

    if ((!willPickup || !willDropBack) && (deliveryFee === '' || Number(deliveryFee) < 0)) {
      setErrorMsg('Please write down the extra amount you will pay to someone who will pick and drop the item for you.');
      return;
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (startDate < todayStr) {
      setErrorMsg('Start date cannot be in the past. Please select an upcoming date.');
      return;
    }

    if (startDate === todayStr && startTime <= currentHStr) {
      setErrorMsg(`Pickup time (${startTime}) has already passed for today. Please select an upcoming time.`);
      return;
    }

    if (endDate && endDate < startDate) {
      setErrorMsg('Return date cannot be earlier than start date.');
      return;
    }

    if (endDate && endDate === startDate && endTime && endTime <= startTime) {
      setErrorMsg(`Return time (${endTime}) must be after pickup time (${startTime}).`);
      return;
    }

    if (endDate && endDate === todayStr && endTime && endTime <= currentHStr) {
      setErrorMsg(`Return time (${endTime}) has already passed for today. Please select an upcoming time.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const fullDestinationAddress = buildAddressString(trimmedBuilding, streetArea.trim(), pincode.trim(), locality.trim());
      const extraFeeNumber = (!willPickup || !willDropBack) ? Number(deliveryFee || 0) : 0;
      const finalLat = coords?.latitude ?? (user?.latitude ? Number(user.latitude) : undefined);
      const finalLon = coords?.longitude ?? (user?.longitude ? Number(user.longitude) : undefined);

      await api.createRequest({
        item_name: itemName.trim(),
        description: description.trim(),
        category,
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
        duration_days: durationDays,
        offered_amount: Number(offeredAmount || 0),
        locality: locality.trim(),
        address_text: fullDestinationAddress,
        pincode: pincode.trim() || undefined,
        latitude: finalLat,
        longitude: finalLon,
        will_pickup: willPickup,
        will_drop_back: willDropBack,
        delivery_fee: extraFeeNumber,
        pickup_type: willPickup ? 'LENDER_LOCATION' : 'MY_LOCATION',
        pickup_locality: willPickup ? 'Lender Location' : fullDestinationAddress,
        return_type: willDropBack ? 'LENDER_LOCATION' : 'MY_LOCATION',
        return_locality: willDropBack ? 'Lender Location' : fullDestinationAddress,
        image_url: imageUrl || undefined,
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      onSuccess();
      resetForm();
      onClose();
    } catch (err: any) {
      console.error('Failed to post request:', err);
      setErrorMsg(err.message || 'Failed to post request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="relative bg-surface rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-divider text-ink flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider bg-surface shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-ink font-display tracking-tight flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-brand" />
              <span>Post a Request</span>
            </h2>
            <p className="text-xs text-ink-secondary">
              Find gear to rent or borrow from neighbors
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
        <form id="drop-wish-form" onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: Item Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Sony A7 IV or Camping Tent"
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
              </div>

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
                placeholder="What model, accessories, or condition do you need? What will you use it for?"
                rows={3}
                className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-medium text-ink outline-none focus:border-brand resize-none"
                required
              />
            </div>

            {/* Reference Photo (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-ink">Reference Photo (optional)</span>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs font-bold text-red-500 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
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

              {imageUrl ? (
                <div className="flex items-center gap-3 p-2.5 bg-canvas border border-divider rounded-xl max-w-sm">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-14 h-14 object-cover rounded-lg border border-divider shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">Photo Attached</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-brand hover:underline cursor-pointer font-bold"
                    >
                      Change Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="btn-secondary text-xs px-3.5 py-2 inline-flex items-center gap-1.5 cursor-pointer font-bold hover:border-brand hover:text-brand"
                  >
                    {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>Upload Reference Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={isUploading}
                    className="btn-secondary text-xs px-3.5 py-2 inline-flex items-center gap-1.5 cursor-pointer font-bold hover:border-brand hover:text-brand"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Camera</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Rental Schedule & Budget */}
          <div className="space-y-4 pt-3 border-t border-divider">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Rental Dates & Budget</span>
              <span className="text-[11px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                {durationDays} {durationDays === 1 ? 'day' : 'days'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Start Date & Time */}
              <div className="p-3 rounded-xl bg-canvas border border-divider space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand" />
                    <span>Needed From *</span>
                  </span>
                  <span className="text-[10px] text-ink-secondary">{startTime}</span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="col-span-7 bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand cursor-pointer"
                    required
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="col-span-5 bg-surface border border-divider rounded-lg px-2 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand cursor-pointer"
                  />
                </div>
              </div>

              {/* End Date & Time */}
              <div className="p-3 rounded-xl bg-canvas border border-divider space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Return By *</span>
                  </span>
                  <span className="text-[10px] text-ink-secondary">{endTime}</span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="col-span-7 bg-surface border border-divider rounded-lg px-2.5 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand cursor-pointer"
                    required
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="col-span-5 bg-surface border border-divider rounded-lg px-2 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Offered Budget */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">
                Your Total Offered Budget (₹) *
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-secondary">₹</span>
                <input
                  type="number"
                  min="0"
                  placeholder="500"
                  value={offeredAmount}
                  onChange={(e) => setOfferedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-canvas border border-divider rounded-xl pl-8 pr-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                  required
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Transport Preferences */}
          <div className="space-y-3 pt-3 border-t border-divider">
            <span className="text-xs font-bold text-ink block">Handover Preference</span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pickup Toggle */}
              <div className="p-3 rounded-xl bg-canvas border border-divider flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-ink block">
                    {willPickup ? 'I will pick up' : 'Deliver to me'}
                  </span>
                  <span className="text-[11px] text-ink-secondary">
                    {willPickup ? 'Collect from lender' : 'Need door delivery'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={willPickup}
                  onClick={() => setWillPickup(!willPickup)}
                  className={`w-9 h-5 rounded-full transition-colors relative shrink-0 cursor-pointer p-0.5 ${willPickup ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${willPickup ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Dropback Toggle */}
              <div className="p-3 rounded-xl bg-canvas border border-divider flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-ink block">
                    {willDropBack ? 'I will drop back' : 'Collect from me'}
                  </span>
                  <span className="text-[11px] text-ink-secondary">
                    {willDropBack ? 'Return to lender' : 'Need pickup on return'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={willDropBack}
                  onClick={() => setWillDropBack(!willDropBack)}
                  className={`w-9 h-5 rounded-full transition-colors relative shrink-0 cursor-pointer p-0.5 ${willDropBack ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${willDropBack ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {(!willPickup || !willDropBack) && (
              <div className="p-3 rounded-xl bg-brand/5 border border-brand/20 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-ink">Delivery / Transport Tip (₹)</span>
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-secondary">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="50"
                    className="w-full bg-surface border border-divider rounded-lg pl-6 pr-2 py-1 text-xs font-bold text-ink outline-none focus:border-brand"
                    required={!willPickup || !willDropBack}
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: Location */}
          <div className="space-y-3 pt-3 border-t border-divider">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand" />
                <span>Your Location *</span>
              </span>
              {savedLocations.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {savedLocations.slice(0, 3).map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => {
                        setBuildingHouseNo(loc.building_flat_house || '');
                        setStreetArea(loc.street_road_landmark || '');
                        setLocality(loc.locality || '');
                        setPincode(loc.pincode || '');
                        if (loc.latitude && loc.longitude) {
                          setCoords({ latitude: loc.latitude, longitude: loc.longitude });
                        }
                        setLocationSuccessMsg(`Selected: ${loc.label}`);
                      }}
                      className="text-[11px] font-bold text-brand bg-brand/10 hover:bg-brand/20 px-2.5 py-1 rounded-lg cursor-pointer shrink-0 transition-colors"
                    >
                      {loc.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Building / House *</label>
                <input
                  type="text"
                  required
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
                <label className="block text-xs font-bold text-ink mb-1">Locality / Neighborhood *</label>
                <input
                  type="text"
                  required
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
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
                  maxLength={10}
                  className="w-full bg-canvas border border-divider rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Clean Fixed Footer outside scrollable form */}
        <div className="px-6 py-4 border-t border-divider bg-surface shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-ink-muted flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>Wishes are reviewed by admin before appearing on the public board.</span>
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
              form="drop-wish-form"
              disabled={isSubmitting || isUploading}
              className="btn-primary text-xs px-6 py-2.5 shadow-pink cursor-pointer inline-flex items-center gap-2 font-bold disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Request...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  <span>Post Request</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
