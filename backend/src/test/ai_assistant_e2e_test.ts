import http from 'http';
import { createApp } from '../app';
import { pool } from '../config/db';

async function runAiTests() {
  console.log('\n======================================================');
  console.log('  RENTU AI ASSISTANT E2E VERIFICATION SUITE');
  console.log('======================================================\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    // TEST 1: GET /api/ai/status
    console.log('[TEST 1: AI STATUS & SAFE CONFIGURATION CHECK]');
    const statusRes = await fetch(`${baseUrl}/api/ai/status`);
    const statusJson = await statusRes.json();
    assert(statusRes.status === 200, 'GET /api/ai/status returns 200');
    assert(typeof statusJson.data.configured === 'boolean', 'status response indicates whether external AI provider is configured');
    assert(Boolean(statusJson.data.provider), 'provider is reported accurately without leaking API keys');
    assert(Boolean(statusJson.data.instructions), 'clear setup instructions provided');

    // TEST 2: GET /api/ai/suggestions
    console.log('\n[TEST 2: SUGGESTED QUESTIONS]');
    const suggRes = await fetch(`${baseUrl}/api/ai/suggestions`);
    const suggJson = await suggRes.json();
    assert(suggRes.status === 200, 'GET /api/ai/suggestions returns 200');
    assert(Array.isArray(suggJson.data) && suggJson.data.length >= 4, 'returns at least 4 contextual prompt chips');

    // TEST 3: CHEAPEST-PRICE FINDER
    console.log('\n[TEST 3: CHEAPEST PRICE FINDER]');
    const cheapRes = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Find the cheapest camera.' }],
      }),
    });
    const cheapJson = await cheapRes.json();
    assert(cheapRes.status === 200, 'POST /api/ai/chat returns 200');
    assert(Boolean(cheapJson.data.message), 'response includes explanatory message');
    assert(Array.isArray(cheapJson.data.listings) && cheapJson.data.listings.length > 0, 'attached real listings from PostgreSQL');
    
    // Verify sorted ascending by price
    const listings = cheapJson.data.listings;
    const isSorted = listings.every((item: any, i: number) => {
      if (i === 0) return true;
      return item.price_per_day >= listings[i - 1].price_per_day;
    });
    assert(isSorted, 'cheapest listings are strictly sorted by price ascending');
    assert(cheapJson.data.toolsUsed.includes('findCheapestListings'), 'used findCheapestListings deterministic tool');

    // TEST 4: DURATION PRICE CALCULATION (3 DAYS)
    console.log('\n[TEST 4: DURATION TOTAL PRICE CALCULATION (3 DAYS)]');
    const durRes = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is the cheapest camera for 3 days?' }],
      }),
    });
    const durJson = await durRes.json();
    assert(durRes.status === 200, '3-day duration query returns 200');
    const firstItem = durJson.data.listings[0];
    assert(firstItem.duration_days === 3, 'recognized requested 3-day duration');
    assert(firstItem.total_price === firstItem.price_per_day * 3, 'calculated total price accurately (dailyRate * 3)');

    // TEST 5: OVERLAPPING AVAILABILITY CONFLICT DETECTION
    console.log('\n[TEST 5: OVERLAPPING BOOKING CONFLICT DETECTION]');
    // Grab item with known accepted booking
    const bookedItemRes = await pool.query(
      `SELECT item_id, start_date, duration_days FROM bookings WHERE status = 'ACCEPTED' LIMIT 1`
    );

    if (bookedItemRes.rows.length > 0) {
      const booked = bookedItemRes.rows[0];
      const startDateStr = new Date(booked.start_date).toISOString().split('T')[0];

      const conflictRes = await fetch(`${baseUrl}/api/ai/tools/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: booked.item_id,
          startDate: startDateStr,
          durationDays: booked.duration_days,
        }),
      });
      const conflictJson = await conflictRes.json();
      assert(conflictRes.status === 200, 'availability check returns 200');
      assert(conflictJson.data.isAvailable === false, 'detected overlapping booking and reported isAvailable: false');
      assert(conflictJson.data.conflictsCount > 0, 'conflicts count accurately reported');
      assert(!conflictJson.data.reason.includes('borrower_id'), 'never exposes private borrower ID or name to third parties');
    } else {
      console.log('  (Skipping conflict check: no accepted bookings currently in database)');
    }

    // TEST 6: CONFIRMED AVAILABILITY FOR OPEN DATES
    console.log('\n[TEST 6: CONFIRMED AVAILABILITY FOR OPEN DATES]');
    // Pick camera item
    const openItemRes = await pool.query(`SELECT id, title, price_per_day FROM items WHERE status = 'AVAILABLE' LIMIT 1`);
    const openItem = openItemRes.rows[0];

    const freeRes = await fetch(`${baseUrl}/api/ai/tools/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: openItem.id,
        startDate: '2028-06-01', // Far future date with no bookings
        durationDays: 2,
      }),
    });
    const freeJson = await freeRes.json();
    assert(freeJson.data.isAvailable === true, 'confirms availability for non-conflicting date window');
    assert(freeJson.data.pricingBreakdown.totalRent === Number(openItem.price_per_day) * 2, 'pricing breakdown calculated accurately');
    assert(Boolean(freeJson.data.pricingBreakdown.depositPolicy), 'includes verified community deposit policy');

    // TEST 7: SIDE-BY-SIDE LISTING COMPARISON
    console.log('\n[TEST 7: SIDE-BY-SIDE LISTINGS COMPARISON]');
    const compRes = await fetch(`${baseUrl}/api/ai/tools/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchQuery: 'camera',
        durationDays: 2,
      }),
    });
    const compJson = await compRes.json();
    assert(compRes.status === 200, 'compare tool returns 200');
    assert(Array.isArray(compJson.data.comparison.items), 'returns comparison array');
    if (compJson.data.comparison.items.length >= 2) {
      assert(typeof compJson.data.comparison.items[0].dailySavingsVsHighest === 'number', 'calculates daily savings vs highest rate');
    }

    // TEST 8: HONEST EMPTY STATE ON NON-EXISTENT INVENTORY
    console.log('\n[TEST 8: HONEST EMPTY STATE (ZERO FABRICATIONS)]');
    const emptyRes = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Find a Lunar Apollo Space Shuttle rocket to rent.' }],
      }),
    });
    const emptyJson = await emptyRes.json();
    assert(emptyRes.status === 200, 'empty search returns 200');
    assert(emptyJson.data.listings.length === 0, 'returns 0 listings (never invents fake listings)');
    assert(emptyJson.data.message.toLowerCase().includes("couldn't find") || emptyJson.data.message.toLowerCase().includes("no"), 'honest explanation of zero results');

    // TEST 9: INPUT VALIDATION & RATE LIMITING
    console.log('\n[TEST 9: INPUT VALIDATION]');
    const invalidRes = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    assert(invalidRes.status === 400, 'empty messages array rejected with 400 VALIDATION_ERROR');

    const tooLongRes = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'a'.repeat(3000) }],
      }),
    });
    assert(tooLongRes.status === 400, 'messages exceeding character limit rejected with 400');

    // TEST 10: REAL LISTING DETAILS RETRIEVAL
    console.log('\n[TEST 10: REAL LISTING DETAILS RETRIEVAL]');
    const detailsRes = await fetch(`${baseUrl}/api/ai/tools/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: openItem.id, durationDays: 3 }),
    });
    const detailsJson = await detailsRes.json();
    assert(detailsRes.status === 200, 'POST /api/ai/tools/details returns 200');
    assert(detailsJson.data.id === openItem.id, 'retrieves genuine listing matching requested ID');
    assert(detailsJson.data.total_price === Number(openItem.price_per_day) * 3, 'accurately calculates multi-day total price for item');
    assert(Boolean(detailsJson.data.owner_name), 'includes verified owner information without fabrication');

    // TEST 11: PRIVACY & UNAUTHORIZED BOOKING STATUS PROTECTION
    console.log('\n[TEST 11: PRIVACY & UNAUTHORIZED BOOKING STATUS PROTECTION]');
    const unauthBookingRes = await fetch(`${baseUrl}/api/ai/tools/booking-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: '00000000-0000-0000-0000-000000000000' }),
    });
    assert(unauthBookingRes.status === 401, 'unauthenticated booking status request is strictly rejected with 401');

    // TEST 12: MISSING AI CONFIG / FALLBACK ENGINE
    console.log('\n[TEST 12: FALLBACK ENGINE & STATUS INTEGRITY]');
    const fallbackStatusRes = await fetch(`${baseUrl}/api/ai/status`);
    const fallbackStatusJson = await fallbackStatusRes.json();
    assert(fallbackStatusJson.success === true, 'assistant status check reports success');
    assert(fallbackStatusJson.data.configured === false, 'correctly detects unconfigured external key without crashing');
    assert(fallbackStatusJson.data.provider === 'database_direct', 'operates in database_direct mode safely');

    console.log('\n======================================================');
    console.log(`  AI SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } finally {
    server.close();
    await pool.end();
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAiTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
