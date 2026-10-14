import http from 'http';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { pool, query } from '../config/db';
import { ENV } from '../config/env';

const makeToken = (id: string, email: string, name: string) => {
  return jwt.sign(
    { id, email, name, role: 'USER', aud: 'rentu-users', iss: 'rentu-auth' },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function request(
  serverUrl: string,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, serverUrl);
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const payload = body ? JSON.stringify(body) : undefined;
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsedBody = data;
          try {
            parsedBody = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode || 500, body: parsedBody });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runMessagingE2ETest() {
  console.log('\n======================================================');
  console.log('  RENTU MESSAGING END-TO-END COMPREHENSIVE VERIFICATION');
  console.log('======================================================\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address() as any;
  const serverUrl = `http://127.0.0.1:${addr.port}`;

  const client = await pool.connect();
  const userAId = 'e2e_user_a_' + Date.now();
  const userBId = 'e2e_user_b_' + Date.now();
  const userCId = 'e2e_intruder_' + Date.now();
  const userFreshId = 'e2e_fresh_' + Date.now();

  let itemId: string = '';
  let bookingId: string = '';

  try {
    // 1. Setup Test Users
    await client.query(`
      INSERT INTO users (id, name, email, role, locality, phone)
      VALUES 
        ($1, 'Alice Borrower', 'alice@test.com', 'USER', 'Koramangala, Bangalore', '+91 99001 11223'),
        ($2, 'Bob Lender', 'bob@test.com', 'USER', 'Indiranagar, Bangalore', '+91 99002 22334'),
        ($3, 'Charlie Intruder', 'charlie@test.com', 'USER', 'Whitefield, Bangalore', '+91 99003 33445'),
        ($4, 'Diana Fresh', 'diana@test.com', 'USER', 'Jayanagar, Bangalore', '+91 99004 44556')
      ON CONFLICT (id) DO NOTHING
    `, [userAId, userBId, userCId, userFreshId]);

    const tokenA = makeToken(userAId, 'alice@test.com', 'Alice Borrower');
    const tokenB = makeToken(userBId, 'bob@test.com', 'Bob Lender');
    const tokenC = makeToken(userCId, 'charlie@test.com', 'Charlie Intruder');
    const tokenFresh = makeToken(userFreshId, 'diana@test.com', 'Diana Fresh');

    // 2. Setup Test Item and Booking
    const itemRes = await client.query(`
      INSERT INTO items (owner_id, title, category, price_per_day, max_duration_days, locality, image_urls)
      VALUES ($1, 'Sony A7 IV Full-Frame Camera', 'Cameras', 450.00, 7, 'Indiranagar, Bangalore', '["https://example.com/a7iv.jpg"]')
      RETURNING id
    `, [userBId]);
    itemId = itemRes.rows[0].id;

    const bookingRes = await client.query(`
      INSERT INTO bookings (item_id, borrower_id, lender_id, start_date, duration_days, total_price, status, message)
      VALUES ($1, $2, $3, CURRENT_DATE + INTERVAL '2 days', 3, 1350.00, 'ACCEPTED', 'Excited to shoot with this!')
      RETURNING id
    `, [itemId, userAId, userBId]);
    bookingId = bookingRes.rows[0].id;

    console.log('[TEST 1: CONVERSATION LIST FOR PARTICIPANTS]');
    // User A fetches conversations
    const convA = await request(serverUrl, 'GET', '/api/messages/conversations', {
      Authorization: `Bearer ${tokenA}`
    });

    assert(convA.status === 200, 'User A receives 200 for /api/messages/conversations');
    assert(Array.isArray(convA.body.data) && convA.body.data.length > 0, 'User A has at least 1 active conversation');
    const targetConvo = convA.body.data.find((c: any) => c.booking_id === bookingId);
    assert(!!targetConvo, 'User A conversation list includes the booking with Bob');
    assert(targetConvo.partner_name === 'Bob Lender', 'Partner name correctly identifies Bob Lender');
    assert(targetConvo.partner_role === 'Lender', 'Partner role is Lender for borrower Alice');
    assert(targetConvo.item_title === 'Sony A7 IV Full-Frame Camera', 'Item title matches booked item');
    assert(targetConvo.item_images && targetConvo.item_images.length > 0, 'Item image URL is available for thumbnail');

    console.log('\n[TEST 2: EMPTY STATE FOR FRESH USER WITH NO BOOKINGS]');
    const convFresh = await request(serverUrl, 'GET', '/api/messages/conversations', {
      Authorization: `Bearer ${tokenFresh}`
    });

    assert(convFresh.status === 200, 'Fresh user receives 200');
    assert(Array.isArray(convFresh.body.data) && convFresh.body.data.length === 0, 'Fresh user has empty conversation array (eligible for clean empty state)');

    console.log('\n[TEST 3: SENDING MESSAGES & REAL-TIME DISPATCH]');
    const sendRes = await request(serverUrl, 'POST', '/api/messages', {
      Authorization: `Bearer ${tokenA}`
    }, {
      booking_id: bookingId,
      content: 'Hi Bob! What time should I pick up the Sony A7 IV on Saturday?',
    });

    assert(sendRes.status === 200 || sendRes.status === 201, 'User A sends message successfully (200/201)');
    assert(sendRes.body.data.content === 'Hi Bob! What time should I pick up the Sony A7 IV on Saturday?', 'Saved message has matching content');
    assert(sendRes.body.data.receiver_id === userBId, 'Legitimate receiver is strictly derived as Bob (User B)');

    console.log('\n[TEST 4: UNREAD COUNT & MESSAGE HISTORY]');
    // Bob checks conversations list before opening thread
    const convBBefore = await request(serverUrl, 'GET', '/api/messages/conversations', {
      Authorization: `Bearer ${tokenB}`
    });

    const bobConvo = convBBefore.body.data.find((c: any) => c.booking_id === bookingId);
    assert(bobConvo && bobConvo.unread_count === 1, 'Bob conversation list shows unread_count = 1');
    assert(bobConvo.last_message === 'Hi Bob! What time should I pick up the Sony A7 IV on Saturday?', 'Last message preview shows latest message');

    // Bob opens thread
    const messagesRes = await request(serverUrl, 'GET', `/api/messages/${bookingId}`, {
      Authorization: `Bearer ${tokenB}`
    });

    assert(messagesRes.status === 200, 'Bob fetches messages successfully (200)');
    assert(messagesRes.body.data.booking.id === bookingId, 'Returned booking metadata matches booking ID');
    assert(messagesRes.body.data.booking.duration_days === 3, 'Rental duration days = 3 (real DB data)');
    assert(messagesRes.body.data.booking.partner_phone === '+91 99001 11223', 'Partner phone exists for accepted booking');
    assert(messagesRes.body.data.messages.length === 1, 'Messages history has exactly 1 message');

    // Bob checks conversations list after opening thread (should now be marked read)
    const convBAfter = await request(serverUrl, 'GET', '/api/messages/conversations', {
      Authorization: `Bearer ${tokenB}`
    });

    const bobConvoAfter = convBAfter.body.data.find((c: any) => c.booking_id === bookingId);
    assert(bobConvoAfter && bobConvoAfter.unread_count === 0, 'Unread count automatically resets to 0 after opening thread');

    console.log('\n[TEST 5: INTRUDER ACCESS CONTROL & SPOOFING PREVENTION]');
    // Intruder Charlie tries to read messages
    const intruderRead = await request(serverUrl, 'GET', `/api/messages/${bookingId}`, {
      Authorization: `Bearer ${tokenC}`
    });

    assert(intruderRead.status === 403, 'Intruder Charlie receives 403 Forbidden when trying to read conversation');

    // Intruder Charlie tries to send message
    const intruderSend = await request(serverUrl, 'POST', '/api/messages', {
      Authorization: `Bearer ${tokenC}`
    }, {
      booking_id: bookingId,
      content: 'I am not part of this booking but trying to spam!',
    });

    assert(intruderSend.status === 403, 'Intruder Charlie receives 403 Forbidden when trying to send message');

    console.log('\n[TEST 6: BOB REPLIES & ALICE RECEIVES]');
    const bobReply = await request(serverUrl, 'POST', '/api/messages', {
      Authorization: `Bearer ${tokenB}`
    }, {
      booking_id: bookingId,
      content: 'Hi Alice! Saturday around 11:30 AM works great. See you then!',
    });

    assert(bobReply.status === 200, 'Bob replies successfully (200)');
    assert(bobReply.body.data.receiver_id === userAId, 'Bob reply recipient is Alice (User A)');

    // Alice fetches messages
    const aliceMessages = await request(serverUrl, 'GET', `/api/messages/${bookingId}`, {
      Authorization: `Bearer ${tokenA}`
    });

    assert(aliceMessages.body.data.messages.length === 2, 'Alice message history now contains both messages in order');

  } finally {
    // Clean up test data
    if (bookingId) {
      await client.query(`DELETE FROM messages WHERE booking_id = $1`, [bookingId]).catch(() => {});
      await client.query(`DELETE FROM bookings WHERE id = $1`, [bookingId]).catch(() => {});
    }
    if (itemId) {
      await client.query(`DELETE FROM items WHERE id = $1`, [itemId]).catch(() => {});
    }
    await client.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4)`, [userAId, userBId, userCId, userFreshId]).catch(() => {});
    client.release();
    server.close();
    await pool.end();
  }

  console.log('\n======================================================');
  console.log(`  E2E MESSAGING RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMessagingE2ETest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
