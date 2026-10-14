import { query } from '../../config/db';
import { extractCity } from '../../utils/city';

export interface SearchListingsParams {
  query?: string;
  category?: string;
  maxPricePerDay?: number;
  minPricePerDay?: number;
  locality?: string;
  durationDays?: number;
  limit?: number;
}

export interface AvailabilityParams {
  itemId: string;
  startDate?: string;
  durationDays?: number;
  endDate?: string;
}

export interface CompareListingsParams {
  itemIds?: string[];
  searchQuery?: string;
  durationDays?: number;
  limit?: number;
}

export interface ListingResult {
  id: string;
  title: string;
  description: string;
  category: string;
  price_per_day: number;
  total_price?: number;
  duration_days?: number;
  max_duration_days: number;
  image_urls: string[];
  locality: string;
  status: string;
  owner_id: string;
  owner_name: string;
  owner_avatar: string | null;
  owner_rating: number;
  owner_trust_score: number;
  listing_url: string;
}

/**
 * 1. Search Real Listings in PostgreSQL Database
 */
export async function searchListings(params: SearchListingsParams): Promise<{
  count: number;
  items: ListingResult[];
  appliedFilters: Record<string, any>;
}> {
  const duration = Math.max(1, Math.min(30, Number(params.durationDays) || 1));
  const limit = Math.max(1, Math.min(20, Number(params.limit) || 8));
  const sqlParams: any[] = [];
  let whereClauses = ["i.status = 'AVAILABLE'"];

  if (params.query && params.query.trim()) {
    sqlParams.push(`%${params.query.trim()}%`);
    const idx = sqlParams.length;
    whereClauses.push(`(i.title ILIKE $${idx} OR i.description ILIKE $${idx} OR i.category ILIKE $${idx})`);
  }

  if (params.category && params.category !== 'All' && params.category !== 'all') {
    sqlParams.push(params.category.trim());
    whereClauses.push(`i.category = $${sqlParams.length}`);
  }

  if (params.maxPricePerDay && !isNaN(Number(params.maxPricePerDay))) {
    sqlParams.push(Number(params.maxPricePerDay));
    whereClauses.push(`i.price_per_day <= $${sqlParams.length}`);
  }

  if (params.minPricePerDay && !isNaN(Number(params.minPricePerDay))) {
    sqlParams.push(Number(params.minPricePerDay));
    whereClauses.push(`i.price_per_day >= $${sqlParams.length}`);
  }

  if (params.locality && params.locality !== 'All' && params.locality !== 'all') {
    const city = extractCity(params.locality);
    sqlParams.push(`%${city}%`);
    const idx = sqlParams.length;
    whereClauses.push(`(i.locality ILIKE $${idx} OR u.locality ILIKE $${idx})`);
  }

  sqlParams.push(limit);
  const limitIdx = sqlParams.length;

  const sql = `
    SELECT 
      i.id, i.title, i.description, i.category, i.price_per_day,
      i.max_duration_days, i.image_urls, i.locality, i.status,
      COALESCE(u.id, i.owner_id) AS owner_id,
      COALESCE(u.name, 'Community Member') AS owner_name,
      u.avatar_url AS owner_avatar,
      COALESCE(u.rating, 5.00) AS owner_rating,
      COALESCE(u.trust_score, 98) AS owner_trust_score
    FROM items i
    LEFT JOIN users u ON i.owner_id = u.id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY i.price_per_day ASC, i.created_at DESC
    LIMIT $${limitIdx}
  `;

  const result = await query(sql, sqlParams);

  const items: ListingResult[] = result.rows.map((row) => {
    const rate = Number(row.price_per_day);
    const images = Array.isArray(row.image_urls) ? row.image_urls : [];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      price_per_day: rate,
      total_price: rate * duration,
      duration_days: duration,
      max_duration_days: Number(row.max_duration_days) || 7,
      image_urls: images,
      locality: row.locality || 'Nearby',
      status: row.status,
      owner_id: row.owner_id,
      owner_name: row.owner_name,
      owner_avatar: row.owner_avatar,
      owner_rating: Number(row.owner_rating) || 5.0,
      owner_trust_score: Number(row.owner_trust_score) || 98,
      listing_url: `/items/${row.id}`,
    };
  });

  return {
    count: items.length,
    items,
    appliedFilters: {
      query: params.query || null,
      category: params.category || null,
      maxPricePerDay: params.maxPricePerDay || null,
      durationDays: duration,
      locality: params.locality || null,
    },
  };
}

/**
 * 2. Find Cheapest Listings with Exact Price Calculation
 */
export async function findCheapestListings(params: SearchListingsParams): Promise<{
  cheapestItem: ListingResult | null;
  items: ListingResult[];
  durationDays: number;
  explanation: string;
}> {
  const duration = Math.max(1, Math.min(30, Number(params.durationDays) || 1));
  const searchResult = await searchListings({
    ...params,
    durationDays: duration,
  });

  // Sort strictly by total price for requested duration
  const sorted = [...searchResult.items].sort((a, b) => {
    return (a.total_price || 0) - (b.total_price || 0);
  });

  const cheapest = sorted[0] || null;

  let explanation = '';
  if (!cheapest) {
    explanation = params.query 
      ? `No available gear found matching "${params.query}" within your criteria in the database.`
      : 'No available gear found matching your criteria in the database.';
  } else {
    explanation = `The lowest price option is "${cheapest.title}" at ₹${cheapest.price_per_day}/day (Total: ₹${cheapest.total_price} for ${duration} ${duration === 1 ? 'day' : 'days'}).`;
  }

  return {
    cheapestItem: cheapest,
    items: sorted,
    durationDays: duration,
    explanation,
  };
}

/**
 * 3. Compare Multiple Real Listings
 */
export async function compareRentalPrices(params: CompareListingsParams): Promise<{
  comparison: {
    durationDays: number;
    items: Array<ListingResult & { dailySavingsVsHighest?: number }>;
    cheapestId: string | null;
    highestId: string | null;
    maxDailyDifference: number;
  };
}> {
  const duration = Math.max(1, Math.min(30, Number(params.durationDays) || 1));
  let itemsToCompare: ListingResult[] = [];

  if (params.itemIds && params.itemIds.length > 0) {
    const placeholders = params.itemIds.map((_, i) => `$${i + 1}`).join(',');
    const sql = `
      SELECT 
        i.id, i.title, i.description, i.category, i.price_per_day,
        i.max_duration_days, i.image_urls, i.locality, i.status,
        COALESCE(u.id, i.owner_id) AS owner_id,
        COALESCE(u.name, 'Community Member') AS owner_name,
        u.avatar_url AS owner_avatar,
        COALESCE(u.rating, 5.00) AS owner_rating,
        COALESCE(u.trust_score, 98) AS owner_trust_score
      FROM items i
      LEFT JOIN users u ON i.owner_id = u.id
      WHERE i.id IN (${placeholders})
    `;
    const res = await query(sql, params.itemIds);
    itemsToCompare = res.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      price_per_day: Number(row.price_per_day),
      total_price: Number(row.price_per_day) * duration,
      duration_days: duration,
      max_duration_days: Number(row.max_duration_days) || 7,
      image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
      locality: row.locality || 'Nearby',
      status: row.status,
      owner_id: row.owner_id,
      owner_name: row.owner_name,
      owner_avatar: row.owner_avatar,
      owner_rating: Number(row.owner_rating) || 5.0,
      owner_trust_score: Number(row.owner_trust_score) || 98,
      listing_url: `/items/${row.id}`,
    }));
  } else if (params.searchQuery) {
    const searchRes = await searchListings({
      query: params.searchQuery,
      durationDays: duration,
      limit: params.limit || 4,
    });
    itemsToCompare = searchRes.items;
  }

  // Sort ascending by total price
  itemsToCompare.sort((a, b) => (a.total_price || 0) - (b.total_price || 0));

  const cheapest = itemsToCompare[0] || null;
  const highest = itemsToCompare[itemsToCompare.length - 1] || null;
  const maxDiff = highest && cheapest ? Number(highest.price_per_day) - Number(cheapest.price_per_day) : 0;

  const itemsWithSavings = itemsToCompare.map((item) => {
    return {
      ...item,
      dailySavingsVsHighest: highest ? Math.max(0, Number(highest.price_per_day) - Number(item.price_per_day)) : 0,
    };
  });

  return {
    comparison: {
      durationDays: duration,
      items: itemsWithSavings,
      cheapestId: cheapest ? cheapest.id : null,
      highestId: highest ? highest.id : null,
      maxDailyDifference: maxDiff,
    },
  };
}

/**
 * 4. Real Availability Checking via Database Overlap Detection
 */
export async function checkListingAvailability(params: AvailabilityParams): Promise<{
  itemId: string;
  itemTitle: string;
  isAvailable: boolean;
  reason: string;
  requestedDates?: {
    startDate: string;
    durationDays: number;
    endDate: string;
  };
  pricingBreakdown?: {
    dailyRate: number;
    durationDays: number;
    totalRent: number;
    depositPolicy: string;
  };
  conflictsCount: number;
  item?: ListingResult;
}> {
  // Fetch item record
  const itemRes = await query(
    `SELECT 
       i.id, i.title, i.description, i.category, i.price_per_day,
       i.max_duration_days, i.image_urls, i.locality, i.status,
       COALESCE(u.id, i.owner_id) AS owner_id,
       COALESCE(u.name, 'Community Member') AS owner_name,
       u.avatar_url AS owner_avatar,
       COALESCE(u.rating, 5.00) AS owner_rating,
       COALESCE(u.trust_score, 98) AS owner_trust_score
     FROM items i
     LEFT JOIN users u ON i.owner_id = u.id
     WHERE i.id = $1`,
    [params.itemId]
  );

  if (itemRes.rows.length === 0) {
    return {
      itemId: params.itemId,
      itemTitle: 'Unknown Item',
      isAvailable: false,
      reason: 'Item ID does not exist in the Rentu database.',
      conflictsCount: 0,
    };
  }

  const row = itemRes.rows[0];
  const rate = Number(row.price_per_day);
  const itemResult: ListingResult = {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    price_per_day: rate,
    max_duration_days: Number(row.max_duration_days) || 7,
    image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
    locality: row.locality || 'Nearby',
    status: row.status,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    owner_avatar: row.owner_avatar,
    owner_rating: Number(row.owner_rating) || 5.0,
    owner_trust_score: Number(row.owner_trust_score) || 98,
    listing_url: `/items/${row.id}`,
  };

  // If item is marked UNAVAILABLE or RENTED globally
  if (row.status !== 'AVAILABLE') {
    return {
      itemId: row.id,
      itemTitle: row.title,
      isAvailable: false,
      reason: `This item is currently listed as "${row.status}" by the owner.`,
      conflictsCount: 0,
      item: itemResult,
    };
  }

  // Handle date resolution
  let startDate = params.startDate;
  let duration = params.durationDays ? Number(params.durationDays) : 1;

  if (params.endDate && startDate) {
    const start = new Date(startDate);
    const end = new Date(params.endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      duration = diffDays;
    }
  }

  // If no date was provided, prompt user for date
  if (!startDate) {
    return {
      itemId: row.id,
      itemTitle: row.title,
      isAvailable: true,
      reason: `"${row.title}" is generally active and available. Please provide specific dates (e.g. tomorrow or this weekend) to confirm calendar availability.`,
      conflictsCount: 0,
      item: itemResult,
      pricingBreakdown: {
        dailyRate: rate,
        durationDays: 1,
        totalRent: rate,
        depositPolicy: 'Zero deposit on verified community member ID',
      },
    };
  }

  // Run authoritative overlap query from bookings service
  const overlapRes = await query(
    `SELECT id, status, start_date, duration_days
     FROM bookings
     WHERE item_id = $1
       AND status = 'ACCEPTED'
       AND start_date <= ($2::date + ($3::integer - 1) * INTERVAL '1 day')
       AND ($2::date <= start_date + (duration_days - 1) * INTERVAL '1 day')`,
    [row.id, startDate, duration]
  );

  const startObj = new Date(startDate);
  const endObj = new Date(startObj);
  endObj.setDate(endObj.getDate() + duration - 1);
  const endDateStr = endObj.toISOString().split('T')[0];

  const totalRent = rate * duration;

  if (overlapRes.rows.length > 0) {
    return {
      itemId: row.id,
      itemTitle: row.title,
      isAvailable: false,
      reason: `"${row.title}" is already reserved for an accepted rental during ${startDate} to ${endDateStr}.`,
      requestedDates: {
        startDate,
        durationDays: duration,
        endDate: endDateStr,
      },
      conflictsCount: overlapRes.rows.length,
      item: itemResult,
    };
  }

  return {
    itemId: row.id,
    itemTitle: row.title,
    isAvailable: true,
    reason: `"${row.title}" is confirmed AVAILABLE from ${startDate} to ${endDateStr} (${duration} ${duration === 1 ? 'day' : 'days'}).`,
    requestedDates: {
      startDate,
      durationDays: duration,
      endDate: endDateStr,
    },
    pricingBreakdown: {
      dailyRate: rate,
      durationDays: duration,
      totalRent,
      depositPolicy: 'Zero deposit on verified community member ID',
    },
    conflictsCount: 0,
    item: {
      ...itemResult,
      total_price: totalRent,
      duration_days: duration,
    },
  };
}

/**
 * 5. Get Real User Booking Details (Strictly Authorized)
 */
export async function getRelevantBookingStatus(bookingId: string, currentUserId: string): Promise<{
  authorized: boolean;
  booking?: any;
  error?: string;
}> {
  if (!currentUserId) {
    return { authorized: false, error: 'Authentication required to view private booking status.' };
  }

  const res = await query(
    `SELECT 
       b.id, b.item_id, b.borrower_id, b.lender_id,
       b.start_date, b.start_time, b.duration_days, b.total_price,
       b.status, b.message, b.created_at,
       i.title AS item_title, i.image_urls AS item_images, i.locality AS item_locality,
       borrower.name AS borrower_name, lender.name AS lender_name
     FROM bookings b
     JOIN items i ON b.item_id = i.id
     JOIN users borrower ON b.borrower_id = borrower.id
     JOIN users lender ON b.lender_id = lender.id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (res.rows.length === 0) {
    return { authorized: false, error: 'Booking not found.' };
  }

  const booking = res.rows[0];
  if (booking.borrower_id !== currentUserId && booking.lender_id !== currentUserId) {
    return { authorized: false, error: 'You are not authorized to access this private booking record.' };
  }

  return {
    authorized: true,
    booking: {
      id: booking.id,
      itemTitle: booking.item_title,
      status: booking.status,
      startDate: booking.start_date,
      durationDays: booking.duration_days,
      totalPrice: Number(booking.total_price),
      partnerName: booking.borrower_id === currentUserId ? booking.lender_name : booking.borrower_name,
      partnerRole: booking.borrower_id === currentUserId ? 'Lender' : 'Borrower',
      locality: booking.item_locality,
    },
  };
}

/**
 * 6. Get Single Listing Details Grounded in Database
 */
export async function getListingDetails(itemId: string, durationDays: number = 1): Promise<ListingResult | null> {
  if (!itemId) return null;
  const res = await query(
    `SELECT 
       i.id, i.title, i.description, i.category, i.price_per_day,
       i.max_duration_days, i.image_urls, i.locality, i.status,
       COALESCE(u.id, i.owner_id) AS owner_id,
       COALESCE(u.name, 'Community Member') AS owner_name,
       u.avatar_url AS owner_avatar,
       COALESCE(u.rating, 5.00) AS owner_rating,
       COALESCE(u.trust_score, 98) AS owner_trust_score
     FROM items i
     LEFT JOIN users u ON i.owner_id = u.id
     WHERE i.id = $1`,
    [itemId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  const rate = Number(row.price_per_day);
  const duration = Math.max(1, Math.min(30, Number(durationDays) || 1));
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    price_per_day: rate,
    total_price: rate * duration,
    duration_days: duration,
    max_duration_days: Number(row.max_duration_days) || 7,
    image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
    locality: row.locality || 'Nearby',
    status: row.status,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    owner_avatar: row.owner_avatar,
    owner_rating: Number(row.owner_rating) || 5.0,
    owner_trust_score: Number(row.owner_trust_score) || 98,
    listing_url: `/items/${row.id}`,
  };
}
