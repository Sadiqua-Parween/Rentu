import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { pool, query } from '../src/config/db';
import { createApp } from '../src/app';
import jwt from 'jsonwebtoken';
import { ENV } from '../src/config/env';

async function runConcurrencyTests() {
  console.log('🧪 Rentu⁺ Booking Concurrency & Authorization Test Suite');
  console.log('===========================================================');

  const app = createApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`📡 Ephemeral test server running at ${baseUrl}`);

  const testSuffix = Date.now();
  let lenderId: string = '';
  let borrower1Id: string = '';
  let borrower2Id: string = '';
  let itemId: string = '';
  let booking1Id: string = '';
  let booking2Id: string = '';
  let msg1Id: string = '';
  let msg2Id: string = '';

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failedCount++;
    }
  }

  try {
    // 1. Create Test Users
    const lenderRes = await query(
      `INSERT INTO users (email, name, role) 
       VALUES ($1, $2, 'USER') RETURNING id`,
      [`lender_${testSuffix}@rentu.test`, `Test Lender ${testSuffix}`]
    );
    lenderId = lenderRes.rows[0].id;

    const b1Res = await query(
      `INSERT INTO users (email, name, role) 
       VALUES ($1, $2, 'USER') RETURNING id`,
      [`borrower1_${testSuffix}@rentu.test`, `Borrower One ${testSuffix}`]
    );
    borrower1Id = b1Res.rows[0].id;

    const b2Res = await query(
      `INSERT INTO users (email, name, role) 
       VALUES ($1, $2, 'USER') RETURNING id`,
      [`borrower2_${testSuffix}@rentu.test`, `Borrower Two ${testSuffix}`]
    );
    borrower2Id = b2Res.rows[0].id;

    const lenderToken = jwt.sign(
      { id: lenderId, email: `lender_${testSuffix}@rentu.test`, role: 'USER', name: 'Lender' },
      ENV.JWT_SECRET
    );
    const borrower1Token = jwt.sign(
      { id: borrower1Id, email: `borrower1_${testSuffix}@rentu.test`, role: 'USER', name: 'Borrower1' },
      ENV.JWT_SECRET
    );
    const borrower2Token = jwt.sign(
      { id: borrower2Id, email: `borrower2_${testSuffix}@rentu.test`, role: 'USER', name: 'Borrower2' },
      ENV.JWT_SECRET
    );

    // 2. Create Test Item
    const itemRes = await query(
      `INSERT INTO items (owner_id, title, description, category, price_per_day, status, available_for_borrowing)
       VALUES ($1, $2, 'Concurrency test item', 'Electronics & Tech', 500, 'AVAILABLE', true)
       RETURNING id`,
      [lenderId, `Sony A7IV Test Camera ${testSuffix}`]
    );
    itemId = itemRes.rows[0].id;

    // 3. Create Two Overlapping Bookings
    const today = new Date();
    const d1 = new Date(today.getTime() + 2 * 86400000).toISOString().split('T')[0];
    const d2 = new Date(today.getTime() + 3 * 86400000).toISOString().split('T')[0];

    // Booking 1: starts d1, 3 days
    const bk1Res = await query(
      `INSERT INTO bookings (item_id, borrower_id, lender_id, start_date, duration_days, total_price, status)
       VALUES ($1, $2, $3, $4, 3, 1500, 'PENDING')
       RETURNING id`,
      [itemId, borrower1Id, lenderId, d1]
    );
    booking1Id = bk1Res.rows[0].id;

    // Booking 2: starts d2, 3 days (OVERLAPS with booking 1!)
    const bk2Res = await query(
      `INSERT INTO bookings (item_id, borrower_id, lender_id, start_date, duration_days, total_price, status)
       VALUES ($1, $2, $3, $4, 3, 1500, 'PENDING')
       RETURNING id`,
      [itemId, borrower2Id, lenderId, d2]
    );
    booking2Id = bk2Res.rows[0].id;

    // Create Proposal Messages
    const msg1Res = await query(
      `INSERT INTO messages (sender_id, receiver_id, booking_id, message_type, content, proposal_data)
       VALUES ($1, $2, $3, 'PROPOSAL', 'Booking request 1', $4)
       RETURNING id`,
      [borrower1Id, lenderId, booking1Id, JSON.stringify({ booking_id: booking1Id, start_date: d1, duration_days: 3 })]
    );
    msg1Id = msg1Res.rows[0].id;

    const msg2Res = await query(
      `INSERT INTO messages (sender_id, receiver_id, booking_id, message_type, content, proposal_data)
       VALUES ($1, $2, $3, 'PROPOSAL', 'Booking request 2', $4)
       RETURNING id`,
      [borrower2Id, lenderId, booking2Id, JSON.stringify({ booking_id: booking2Id, start_date: d2, duration_days: 3 })]
    );
    msg2Id = msg2Res.rows[0].id;

    console.log('\n🔒 Test Suite 1: Security & Authorization Boundaries');

    // Test 1: Self-proposal rejection
    const selfMsgRes = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${borrower1Token}`,
      },
      body: JSON.stringify({
        receiver_id: borrower1Id, // Sending to SELF
        content: 'Malicious self proposal',
        message_type: 'PROPOSAL',
        proposal_data: { booking_id: booking1Id },
      }),
    });
    const selfMsgData = await selfMsgRes.json();
    const selfMsgCode = selfMsgData.error?.code || selfMsgData.code;
    assert(
      selfMsgRes.status === 400 && (selfMsgCode === 'BAD_REQUEST' || selfMsgCode === 'SELF_MESSAGE_DISALLOWED' || selfMsgCode === 'INVALID_RECIPIENT'),
      'Users cannot send proposal messages to themselves',
      `Got status ${selfMsgRes.status}, code: ${selfMsgCode}`
    );

    // Test 2: Borrower cannot accept booking proposals (only lender can)
    const unauthorizedAcceptRes = await fetch(`${baseUrl}/api/messages/proposal/${msg1Id}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${borrower1Token}`,
      },
    });
    const unauthorizedAcceptData = await unauthorizedAcceptRes.json();
    assert(
      unauthorizedAcceptRes.status === 403,
      'Borrower cannot accept booking proposals (Strict Lender Authorization enforced)',
      `Status: ${unauthorizedAcceptRes.status}, Code: ${unauthorizedAcceptData.code}`
    );

    // Test 3: Unrelated user cannot decline proposals
    const unrelatedDeclineRes = await fetch(`${baseUrl}/api/messages/proposal/${msg1Id}/decline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${borrower2Token}`, // Borrower 2 has nothing to do with msg 1
      },
    });
    assert(
      unrelatedDeclineRes.status === 403,
      'Unrelated third-party user cannot decline or cancel booking proposal',
      `Status: ${unrelatedDeclineRes.status}`
    );

    console.log('\n⚡ Test Suite 2: Race Condition & Concurrency Overlap Protection');

    // Test 4: Concurrent Acceptance of Overlapping Bookings
    // Lender accepts Booking 1 via PATCH /bookings/:id/status and Booking 2 via POST /messages/proposal/:id/accept concurrently!
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/bookings/${booking1Id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lenderToken}`,
        },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }),
      fetch(`${baseUrl}/api/messages/proposal/${msg2Id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lenderToken}`,
        },
      }),
    ]);

    const data1 = await res1.json();
    const data2 = await res2.json();

    const statuses = [res1.status, res2.status];
    console.log(`   Path 1 status: ${res1.status} (${data1.message || data1.code})`);
    console.log(`   Path 2 status: ${res2.status} (${data2.message || data2.code})`);

    const hasOneSuccess = statuses.includes(200);
    const hasOneConflict = statuses.includes(409) || statuses.includes(400);

    assert(
      hasOneSuccess && hasOneConflict,
      'Exactly ONE overlapping acceptance succeeds, while the other is rejected with conflict/overlap error',
      `Statuses: ${JSON.stringify(statuses)}`
    );

    // Verify DB State
    const dbBk1 = await query(`SELECT status FROM bookings WHERE id = $1::uuid`, [booking1Id]);
    const dbBk2 = await query(`SELECT status FROM bookings WHERE id = $1::uuid`, [booking2Id]);
    const acceptedCount = [dbBk1.rows[0]?.status, dbBk2.rows[0]?.status].filter((s) => s === 'ACCEPTED').length;

    assert(
      acceptedCount === 1,
      `Database integrity check: exactly 1 booking in ACCEPTED status (found ${acceptedCount})`
    );

    console.log('\n===========================================================');
    console.log(`Results: ${passedCount} PASSED, ${failedCount} FAILED`);
  } catch (err: any) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    // Cleanup fixtures
    if (booking1Id || booking2Id) {
      await query(`DELETE FROM messages WHERE booking_id IN ($1, $2)`, [booking1Id || '00000000-0000-0000-0000-000000000000', booking2Id || '00000000-0000-0000-0000-000000000000']).catch(() => {});
      await query(`DELETE FROM bookings WHERE id IN ($1, $2)`, [booking1Id || '00000000-0000-0000-0000-000000000000', booking2Id || '00000000-0000-0000-0000-000000000000']).catch(() => {});
    }
    if (itemId) {
      await query(`DELETE FROM items WHERE id = $1`, [itemId]).catch(() => {});
    }
    if (lenderId || borrower1Id || borrower2Id) {
      await query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [lenderId || '00000000-0000-0000-0000-000000000000', borrower1Id || '00000000-0000-0000-0000-000000000000', borrower2Id || '00000000-0000-0000-0000-000000000000']).catch(() => {});
    }
    server.close();
    await pool.end();
    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runConcurrencyTests();
