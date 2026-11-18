/**
 * Known geographic coordinates for Bangalore localities, student hubs, and metro areas.
 * Used for accurate geocoding and Haversine distance calculations when explicit GPS coords are pending.
 */
export const LOCALITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  // BEML Layout & PGs
  'beml': { lat: 12.9140, lon: 77.4993 },
  'beml layout': { lat: 12.9140, lon: 77.4993 },
  'beml layout 7th phase': { lat: 12.9140, lon: 77.4993 },
  'kimberly': { lat: 12.91388, lon: 77.49931 },
  'kimberly house': { lat: 12.91388, lon: 77.49931 },
  'stanza living kimberly': { lat: 12.91388, lon: 77.49931 },
  // BHEL Layout & PGs
  'bhel': { lat: 12.92404, lon: 77.50201 },
  'bhel layout': { lat: 12.92404, lon: 77.50201 },
  'huelva': { lat: 12.92404, lon: 77.50201 },
  'huelva house': { lat: 12.92404, lon: 77.50201 },
  'pattanagere': { lat: 12.92404, lon: 77.50201 },
  'stanza living huelva': { lat: 12.92404, lon: 77.50201 },
  'stanza living': { lat: 12.91388, lon: 77.49931 },
  'stanza': { lat: 12.91388, lon: 77.49931 },
  // West & South-West Hubs
  'rvce': { lat: 12.9237, lon: 77.4988 },
  'rv college': { lat: 12.9237, lon: 77.4988 },
  'channasandra': { lat: 12.9030, lon: 77.5080 },
  'mylasandra': { lat: 12.8850, lon: 77.5050 },
  'mailasandra': { lat: 12.8850, lon: 77.5050 },
  'kengeri': { lat: 12.9177, lon: 77.4838 },
  'kengeri satellite town': { lat: 12.9177, lon: 77.4838 },
  'rajarajeshwari nagar': { lat: 12.9275, lon: 77.5150 },
  'rajarajeshwari': { lat: 12.9275, lon: 77.5150 },
  'rr nagar': { lat: 12.9275, lon: 77.5150 },
  'mysore road': { lat: 12.9350, lon: 77.5100 },
  'uttarahalli': { lat: 12.9060, lon: 77.5380 },
  'nagarbhavi': { lat: 12.9620, lon: 77.5110 },
  'vijayanagar': { lat: 12.9710, lon: 77.5360 },
  'basavanagudi': { lat: 12.9406, lon: 77.5738 },
  // Central & Tech Corridors
  'jayanagar': { lat: 12.9308, lon: 77.5838 },
  'jp nagar': { lat: 12.9063, lon: 77.5857 },
  'btm': { lat: 12.9165, lon: 77.6101 },
  'btm layout': { lat: 12.9165, lon: 77.6101 },
  'koramangala': { lat: 12.9352, lon: 77.6245 },
  'hsr': { lat: 12.9121, lon: 77.6446 },
  'hsr layout': { lat: 12.9121, lon: 77.6446 },
  'bellandur': { lat: 12.9304, lon: 77.6784 },
  'kadubeesanahalli': { lat: 12.9370, lon: 77.6960 },
  'marathahalli': { lat: 12.9591, lon: 77.6974 },
  'whitefield': { lat: 12.9698, lon: 77.7500 },
  'electronic city': { lat: 12.8452, lon: 77.6602 },
  'indiranagar': { lat: 12.9784, lon: 77.6408 },
  'malleshwaram': { lat: 12.9982, lon: 77.5684 },
  'hebbal': { lat: 13.0358, lon: 77.5970 },
  'yelahanka': { lat: 13.1007, lon: 77.5963 },
  'mg road': { lat: 12.9756, lon: 77.6066 },
  'brigade road': { lat: 12.9720, lon: 77.6070 },
  'church street': { lat: 12.9750, lon: 77.6060 },
  'banashankari': { lat: 12.9255, lon: 77.5468 },
  // Delhi Hubs
  'saket': { lat: 28.5244, lon: 77.2167 },
  'hauz khas': { lat: 28.5494, lon: 77.2001 },
  'connaught place': { lat: 28.6315, lon: 77.2167 },
};

/**
 * Resolves latitude and longitude from explicit coords, locality, or address string
 */
export function resolveCoords(
  lat?: number | null,
  lon?: number | null,
  locality?: string | null,
  address_text?: string | null
): { lat: number; lon: number } | null {
  if (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat !== 0 &&
    lon !== 0
  ) {
    return { lat, lon };
  }

  const combined = `${locality || ''} ${address_text || ''}`.toLowerCase().trim();
  if (combined) {
    // Check longer/more specific keys first
    const sortedKeys = Object.keys(LOCALITY_COORDINATES).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (combined.includes(key)) {
        return LOCALITY_COORDINATES[key];
      }
    }
  }

  return null;
}

/**
 * Computes exact Haversine distance in kilometers between two geo-coordinates
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Retrieves the viewing user's resolved coordinates:
 * Prioritizes auth user coordinates -> profile locality/address -> localStorage cache
 */
export function getUserCoords(user?: {
  latitude?: number | null;
  longitude?: number | null;
  locality?: string | null;
  address_text?: string | null;
} | null): { lat: number; lon: number } | null {
  const fromUser = resolveCoords(user?.latitude, user?.longitude, user?.locality, user?.address_text);
  if (fromUser) return fromUser;

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('rentu_user_location');
      if (stored) {
        const parsed = JSON.parse(stored);
        const fromStored = resolveCoords(parsed.latitude, parsed.longitude, parsed.locality, parsed.address_text);
        if (fromStored) return fromStored;
      }
    } catch {}
  }

  return null;
}

/**
 * Checks if an entity (user, profile, item, or request) has genuinely set their location.
 * Returns false if location is null, empty string, or default generic text.
 */
export function hasUserSetLocation(entity?: {
  latitude?: number | null;
  longitude?: number | null;
  locality?: string | null;
  address_text?: string | null;
  saved_locations?: any[];
} | null): boolean {
  if (!entity) {
    // If entity is null (e.g. unauthenticated guest), check localStorage fallback
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('rentu_user_location');
        if (stored) {
          const parsed = JSON.parse(stored);
          return hasUserSetLocation(parsed);
        }
      } catch {}
    }
    return false;
  }

  // 1. Explicit or resolvable coordinates
  if (resolveCoords(entity.latitude, entity.longitude, entity.locality, entity.address_text)) {
    return true;
  }

  // 2. Concrete locality (must not be empty or generic city-level)
  const genericStrings = ['bengaluru', 'bengaluru, india', 'bangalore', 'india', 'local hub', 'nearby', 'neighborhood', ''];
  const loc = (entity.locality || '').toLowerCase().trim();
  if (loc && !genericStrings.includes(loc)) {
    return true;
  }

  // 3. Concrete address text
  const addr = (entity.address_text || '').toLowerCase().trim();
  if (addr && !genericStrings.includes(addr)) {
    return true;
  }

  // 4. Concrete saved locations
  if (Array.isArray(entity.saved_locations) && entity.saved_locations.length > 0) {
    const hasValidSaved = entity.saved_locations.some((l: any) =>
      l && ((l.building_flat_house && l.building_flat_house.trim()) || (l.street_road_landmark && l.street_road_landmark.trim()))
    );
    if (hasValidSaved) return true;
  }

  return false;
}

/**
 * Computes exact distance in meters between user and item/request.
 */
export function getReachDistanceMeters(
  item: {
    distance_meters?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
    address_text?: string | null;
    id?: string;
    owner_id?: string;
  },
  user?: {
    id?: string;
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
    address_text?: string | null;
  } | null
): number | null {
  // If viewing user is owner
  if (user?.id && item.owner_id && String(user.id) === String(item.owner_id)) {
    return 0;
  }

  const userCoords = getUserCoords(user);
  const itemCoords = resolveCoords(item.latitude, item.longitude, item.locality, item.address_text);

  // If both coordinates are resolvable, compute Haversine distance
  if (userCoords && itemCoords) {
    const km = haversineDistanceKm(userCoords.lat, userCoords.lon, itemCoords.lat, itemCoords.lon);
    return Math.round(km * 1000);
  }

  // If backend provided valid distance_meters (> 0)
  if (
    typeof item.distance_meters === 'number' &&
    !isNaN(item.distance_meters) &&
    item.distance_meters > 0 &&
    item.distance_meters < 5000000
  ) {
    return Math.round(item.distance_meters);
  }

  // Locality proximity matching fallback (only for specific non-generic sub-localities)
  const itemLoc = (item.locality || '').toLowerCase().trim();
  const userLoc = (user?.locality || '').toLowerCase().trim();
  const genericStrings = ['bengaluru', 'bengaluru, india', 'bangalore', 'india', 'local hub', 'nearby', 'neighborhood', ''];

  if (itemLoc && userLoc && !genericStrings.includes(itemLoc) && !genericStrings.includes(userLoc)) {
    if (itemLoc === userLoc || itemLoc.includes(userLoc) || userLoc.includes(itemLoc)) {
      return 500;
    }
  }

  return null;
}

/**
 * Calculates numeric distance in km (for filter ranges)
 */
export function getReachDistanceKm(
  item: {
    distance_meters?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
    address_text?: string | null;
    id?: string;
    owner_id?: string;
  },
  user?: {
    id?: string;
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
    address_text?: string | null;
  } | null
): number {
  const meters = getReachDistanceMeters(item, user);
  if (meters === null) return 999.0;
  return Number((meters / 1000).toFixed(2));
}

/**
 * Formats distance into clean user-facing distance text:
 * - If <= 100m: "Within ~100 m"
 * - If < 1000m: "Within ~350 m", "Within ~500 m"
 * - If >= 1000m: "Within ~1.2 km", "Within ~2 km"
 */
export function formatDistanceString(totalMeters: number): string {
  if (totalMeters <= 100) {
    return 'Within ~100 m';
  }

  const roundedMeters = Math.round(totalMeters / 50) * 50;
  if (roundedMeters < 1000) {
    return `Within ~${roundedMeters} m`;
  }

  const km = roundedMeters / 1000;
  const formattedKm = Number(km.toFixed(1));
  return `Within ~${formattedKm} km`;
}

/**
 * Formats reach distance into clean user-facing string strictly indicating distance:
 * e.g. "Within ~500 m", "Within ~1.2 km", "Within ~2 km".
 * Returns NULL if either user or target has not set their location.
 * Privacy Rule: UNDER NO CIRCUMSTANCES is anyone's physical house/street location shown publicly.
 */
export function getReachDistance(
  item: {
    distance_meters?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
    address_text?: string | null;
    id?: string;
    owner_id?: string;
  },
  user?: {
    id?: string;
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
    address_text?: string | null;
  } | null
): string | null {
  // If the viewing user is the item owner
  if (user?.id && item.owner_id && String(user.id) === String(item.owner_id)) {
    return 'Within ~100 m (Your Gear)';
  }

  const meters = getReachDistanceMeters(item, user);
  if (meters !== null) {
    return formatDistanceString(meters);
  }

  return null;
}
