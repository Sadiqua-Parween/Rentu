/**
 * Known geographic coordinates for Bangalore localities and metro hubs.
 * Used for accurate geocoding when latitude/longitude are not explicitly saved.
 */
export const LOCALITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'beml': { lat: 12.9140, lon: 77.4993 },
  'beml layout': { lat: 12.9140, lon: 77.4993 },
  'beml layout 7th phase': { lat: 12.9140, lon: 77.4993 },
  'mylasandra': { lat: 12.8850, lon: 77.5050 },
  'mailasandra': { lat: 12.8850, lon: 77.5050 },
  'kengeri': { lat: 12.9177, lon: 77.4838 },
  'kengeri satellite town': { lat: 12.9177, lon: 77.4838 },
  'rajarajeshwari nagar': { lat: 12.9275, lon: 77.5150 },
  'rr nagar': { lat: 12.9275, lon: 77.5150 },
  'jayanagar': { lat: 12.9308, lon: 77.5838 },
  'koramangala': { lat: 12.9352, lon: 77.6245 },
  'indiranagar': { lat: 12.9784, lon: 77.6408 },
  'hsr layout': { lat: 12.9121, lon: 77.6446 },
  'hsr': { lat: 12.9121, lon: 77.6446 },
  'whitefield': { lat: 12.9698, lon: 77.7500 },
  'electronic city': { lat: 12.8452, lon: 77.6602 },
  'bellandur': { lat: 12.9304, lon: 77.6784 },
  'marathahalli': { lat: 12.9591, lon: 77.6974 },
  'banashankari': { lat: 12.9255, lon: 77.5468 },
  'jp nagar': { lat: 12.9063, lon: 77.5857 },
  'malleshwaram': { lat: 12.9982, lon: 77.5684 },
  'hebbal': { lat: 13.0358, lon: 77.5970 },
  'saket': { lat: 28.5244, lon: 77.2167 },
  'hauz khas': { lat: 28.5494, lon: 77.2001 },
  'connaught place': { lat: 28.6315, lon: 77.2167 },
};

/**
 * Resolves latitude and longitude from explicit coords or known locality string
 */
export function resolveCoords(
  lat?: number | null,
  lon?: number | null,
  locality?: string | null
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

  if (locality) {
    const locLower = locality.toLowerCase().trim();
    for (const [key, coords] of Object.entries(LOCALITY_COORDINATES)) {
      if (locLower.includes(key)) {
        return coords;
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
 * Checks if an entity (user, profile, item, or request) has genuinely set their location.
 * Returns false if location is null, empty string, or default generic text (e.g. 'Bengaluru', 'Bengaluru, India').
 */
export function hasUserSetLocation(entity?: {
  latitude?: number | null;
  longitude?: number | null;
  locality?: string | null;
  address_text?: string | null;
  saved_locations?: any[];
} | null): boolean {
  if (!entity) return false;

  // 1. Explicit non-zero coordinates
  if (
    typeof entity.latitude === 'number' &&
    typeof entity.longitude === 'number' &&
    !isNaN(entity.latitude) &&
    !isNaN(entity.longitude) &&
    entity.latitude !== 0 &&
    entity.longitude !== 0
  ) {
    return true;
  }

  // 2. Concrete locality (must not be empty or generic city-level)
  const loc = (entity.locality || '').toLowerCase().trim();
  const genericStrings = ['bengaluru', 'bengaluru, india', 'bangalore', 'india', 'local hub', 'nearby', ''];
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
  },
  user?: {
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
    address_text?: string | null;
  } | null
): number | null {
  // 1. Strict validation: If either entity has NOT set their location, do NOT compute or fake distance!
  if (!hasUserSetLocation(item)) {
    return null;
  }

  let userCoords = resolveCoords(user?.latitude, user?.longitude, user?.locality);
  if (!userCoords && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('rentu_user_location');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (hasUserSetLocation(parsed)) {
          userCoords = resolveCoords(parsed.latitude, parsed.longitude, parsed.locality);
        }
      }
    } catch {}
  }

  if (!hasUserSetLocation(user) && !userCoords) {
    return null;
  }

  // 2. If backend provided exact Haversine distance_meters
  if (
    typeof item.distance_meters === 'number' &&
    !isNaN(item.distance_meters) &&
    item.distance_meters >= 0 &&
    item.distance_meters < 5000000
  ) {
    return Math.round(item.distance_meters);
  }

  // 3. Resolve item coordinates
  const itemCoords = resolveCoords(item.latitude, item.longitude, item.locality);

  if (userCoords && itemCoords) {
    const km = haversineDistanceKm(userCoords.lat, userCoords.lon, itemCoords.lat, itemCoords.lon);
    return Math.round(km * 1000);
  }

  // 4. Locality proximity matching fallback (only for specific verified sub-localities)
  const itemLoc = (item.locality || '').toLowerCase().trim();
  const userLoc = (user?.locality || '').toLowerCase().trim();

  if (itemLoc && userLoc && itemLoc !== 'bengaluru' && userLoc !== 'bengaluru') {
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
    id?: string;
  },
  user?: {
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
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
 * Privacy Rule: UNDER NO CIRCUMSTANCES is anyone's physical location/locality shown publicly.
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

  // Strict check: if the item or user hasn't set location, NEVER show fake distance!
  if (!hasUserSetLocation(item) || !hasUserSetLocation(user)) {
    return null;
  }

  const meters = getReachDistanceMeters(item, user);
  if (meters !== null) {
    return formatDistanceString(meters);
  }

  // Do NOT return 'Within ~2 km' if no location is set! Return null!
  return null;
}
