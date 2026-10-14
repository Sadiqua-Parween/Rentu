"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_1 = require("../app");
const db_1 = require("../config/db");
const env_1 = require("../config/env");
const notification_service_1 = require("../modules/notifications/notification.service");
// Test runner helper
let passedCount = 0;
let failedCount = 0;
async function assert(desc, condition, errorMsg) {
    if (condition) {
        console.log(`  ✓ ${desc}`);
        passedCount++;
    }
    else {
        console.error(`  ✗ FAIL: ${desc} - ${errorMsg || 'Condition failed'}`);
        failedCount++;
    }
}
async function request(serverUrl, method, path, headers = {}, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, serverUrl);
        const reqHeaders = {
            'Content-Type': 'application/json',
            ...headers,
        };
        const payload = body ? JSON.stringify(body) : undefined;
        if (payload) {
            reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
        }
        const req = http_1.default.request(url, {
            method,
            headers: reqHeaders,
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = data ? JSON.parse(data) : {};
                }
                catch {
                    parsed = data;
                }
                resolve({ status: res.statusCode || 0, body: parsed, headers: res.headers });
            });
        });
        req.on('error', reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}
async function runTests() {
    console.log('\n======================================================');
    console.log('  RENTU⁺ SECURITY & NOTIFICATIONS VERIFICATION SUITE');
    console.log('======================================================\n');
    // Start app on ephemeral port
    const app = (0, app_1.createApp)();
    const server = http_1.default.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
        // 1. Prepare test users in DB
        const userAId = `test_user_a_${Date.now()}`;
        const userBId = `test_user_b_${Date.now()}`;
        const userCId = `test_user_c_${Date.now()}`;
        await (0, db_1.query)(`
      INSERT INTO users (id, name, email, role, locality)
      VALUES 
        ($1, 'Alice Tester', $2, 'USER', 'Bangalore'),
        ($3, 'Bob Lender', $4, 'USER', 'Bangalore'),
        ($5, 'Charlie Intruder', $6, 'USER', 'Bangalore')
      ON CONFLICT (id) DO NOTHING;
    `, [
            userAId, `${userAId}@rentu.test`,
            userBId, `${userBId}@rentu.test`,
            userCId, `${userCId}@rentu.test`
        ]);
        // Sign valid local JWTs
        const tokenA = jsonwebtoken_1.default.sign({ id: userAId, email: `${userAId}@rentu.test`, role: 'USER', name: 'Alice' }, env_1.ENV.JWT_SECRET);
        const tokenB = jsonwebtoken_1.default.sign({ id: userBId, email: `${userBId}@rentu.test`, role: 'USER', name: 'Bob' }, env_1.ENV.JWT_SECRET);
        const tokenC = jsonwebtoken_1.default.sign({ id: userCId, email: `${userCId}@rentu.test`, role: 'USER', name: 'Charlie' }, env_1.ENV.JWT_SECRET);
        console.log('[SECTION 1: AUTHENTICATION & ACCESS CONTROL]');
        // 1.1 Unauthenticated requests rejected
        const unauthRes = await request(baseUrl, 'GET', '/api/notifications');
        await assert('Unauthenticated request to /api/notifications returns 401', unauthRes.status === 401, `Received ${unauthRes.status}`);
        // 1.2 Fake fb_ bypass token rejected
        const fbBypassRes = await request(baseUrl, 'GET', '/api/notifications', {
            Authorization: `Bearer fb_${userAId}`,
        });
        await assert('Legacy fb_<uid> token bypass is rejected with 401', fbBypassRes.status === 401, `Received ${fbBypassRes.status}`);
        // 1.3 Forged/tampered JWT rejected
        const forgedToken = jsonwebtoken_1.default.sign({ id: userAId }, 'wrong-secret-key');
        const forgedRes = await request(baseUrl, 'GET', '/api/notifications', {
            Authorization: `Bearer ${forgedToken}`,
        });
        await assert('Forged JWT with invalid signature is rejected with 401', forgedRes.status === 401, `Received ${forgedRes.status}`);
        // 1.4 Valid token allowed
        const validAuthRes = await request(baseUrl, 'GET', '/api/notifications', {
            Authorization: `Bearer ${tokenA}`,
        });
        await assert('Cryptographically verified token is accepted with 200', validAuthRes.status === 200, `Received ${validAuthRes.status}`);
        console.log('\n[SECTION 2: NOTIFICATION ISOLATION & OWNERSHIP]');
        // 2.1 Create notification for User A
        const notifA = await notification_service_1.NotificationService.create({
            userId: userAId,
            type: 'BOOKING_REQUEST',
            title: 'Rental Request for Sony A7',
            body: 'Someone wants to rent your camera for 2 days',
            data: { test_key: 'test_value_123' },
        });
        await assert('Notification created successfully with non-null ID', Boolean(notifA && notifA.id), 'Failed to create notification');
        if (!notifA)
            throw new Error('notifA was not created');
        // 2.2 User A sees their notification
        const userAListRes = await request(baseUrl, 'GET', '/api/notifications', {
            Authorization: `Bearer ${tokenA}`,
        });
        const foundInA = userAListRes.body?.data?.notifications?.some((n) => n.id === notifA.id);
        await assert('User A can see their own notification', foundInA === true, 'Notification not found in User A list');
        // 2.3 User B cannot see User A's notification
        const userBListRes = await request(baseUrl, 'GET', '/api/notifications', {
            Authorization: `Bearer ${tokenB}`,
        });
        const foundInB = userBListRes.body?.data?.notifications?.some((n) => n.id === notifA.id);
        await assert('User B cannot see User A notifications (strict isolation)', foundInB === false, 'User A notification leaked to User B');
        // 2.4 User B attempts to mark User A's notification as read
        const crossMarkRes = await request(baseUrl, 'PATCH', `/api/notifications/${notifA.id}/read`, {
            Authorization: `Bearer ${tokenB}`,
        });
        await assert('User B cannot mark User A notification as read (returns 403 forbidden)', crossMarkRes.status === 403 || crossMarkRes.status === 404, `Received ${crossMarkRes.status}`);
        // Verify it is still unread in database
        const checkUnread = await (0, db_1.query)('SELECT read_at FROM notifications WHERE id = $1', [notifA.id]);
        await assert('Notification remains unread after unauthorized tamper attempt', checkUnread.rows[0]?.read_at === null, 'Notification read_at was modified');
        // 2.5 User A marks their own notification as read
        const markSelfRes = await request(baseUrl, 'PATCH', `/api/notifications/${notifA.id}/read`, {
            Authorization: `Bearer ${tokenA}`,
        });
        await assert('User A successfully marks their own notification as read', markSelfRes.status === 200 && markSelfRes.body?.data?.read_at !== null, `Status ${markSelfRes.status}`);
        // 2.6 Mark all as read
        await notification_service_1.NotificationService.create({
            userId: userAId,
            type: 'NEW_MESSAGE',
            title: 'Message 2',
            body: 'Second unread message',
        });
        const markAllRes = await request(baseUrl, 'PATCH', '/api/notifications/read-all', {
            Authorization: `Bearer ${tokenA}`,
        });
        await assert('Mark all as read succeeds and returns count', markAllRes.status === 200 && markAllRes.body?.data?.count >= 1, `Status ${markAllRes.status}`);
        const countRes = await request(baseUrl, 'GET', '/api/notifications/unread-count', {
            Authorization: `Bearer ${tokenA}`,
        });
        await assert('Unread count is 0 after mark-all-read', countRes.body?.data?.unread_count === 0, `Count is ${countRes.body?.data?.unread_count}`);
        console.log('\n[SECTION 3: MESSAGING AUTHORIZATION & DERIVED RECIPIENT]');
        // Seed an item owned by Bob (User B)
        const itemRes = await (0, db_1.query)(`
      INSERT INTO items (owner_id, title, description, category, price_per_day, status)
      VALUES ($1, 'DJI Mavic 3 Pro', '4K drone', 'Electronics & Tech', 600.00, 'AVAILABLE')
      RETURNING id
    `, [userBId]);
        const itemId = itemRes.rows[0].id;
        // Seed a booking between Alice (User A, borrower) and Bob (User B, lender)
        const bookingRes = await (0, db_1.query)(`
      INSERT INTO bookings (item_id, borrower_id, lender_id, start_date, duration_days, total_price, status)
      VALUES ($1, $2, $3, CURRENT_DATE + INTERVAL '5 day', 2, 1200.00, 'PENDING')
      RETURNING id
    `, [itemId, userAId, userBId]);
        const bookingId = bookingRes.rows[0].id;
        // 3.1 Unauthorized User C attempts to message booking
        const intruderMsgRes = await request(baseUrl, 'POST', '/api/messages', {
            Authorization: `Bearer ${tokenC}`,
        }, {
            booking_id: bookingId,
            content: 'I am not part of this booking',
        });
        await assert('Unauthorized user cannot send message to foreign booking (returns 403)', intruderMsgRes.status === 403, `Received ${intruderMsgRes.status}`);
        // 3.2 User A sends message with spoofed receiver_id
        // Client tries to spoof receiver as User C
        const spoofedMsgRes = await request(baseUrl, 'POST', '/api/messages', {
            Authorization: `Bearer ${tokenA}`,
        }, {
            booking_id: bookingId,
            receiver_id: userCId, // Client tries to spoof receiver!
            content: 'Hey Bob, is the drone battery charged?',
        });
        await assert('Valid participant message succeeds with 200/201', spoofedMsgRes.status === 200, `Status ${spoofedMsgRes.status}`);
        // Verify derived receiver in database is Bob (User B), NOT Charlie (User C)
        const msgInDb = await (0, db_1.query)('SELECT receiver_id FROM messages WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1', [bookingId]);
        await assert('Message receiver is strictly derived from DB record (User B, not spoofed User C)', msgInDb.rows[0]?.receiver_id === userBId, `Receiver in DB was ${msgInDb.rows[0]?.receiver_id}`);
        // Verify in-app notification was triggered for User B
        const bNotifs = await (0, db_1.query)('SELECT id, type, user_id FROM notifications WHERE user_id = $1 AND type = $2', [userBId, 'NEW_MESSAGE']);
        await assert('Notification was automatically generated for legitimate message recipient (User B)', bNotifs.rows.length > 0, 'No message notification found for User B');
        console.log('\n[SECTION 4: BOOKING CONSISTENCY & STATE MACHINE]');
        // 4.1 Self-booking rejected
        const selfBookRes = await request(baseUrl, 'POST', '/api/bookings', {
            Authorization: `Bearer ${tokenB}`, // Bob owns this item
        }, {
            item_id: itemId,
            start_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
            duration_days: 2,
        });
        await assert('Self-booking proposal is rejected with 400', selfBookRes.status === 400, `Status ${selfBookRes.status}`);
        // 4.2 Past date booking rejected
        const pastBookRes = await request(baseUrl, 'POST', '/api/bookings', {
            Authorization: `Bearer ${tokenA}`,
        }, {
            item_id: itemId,
            start_date: '2020-01-01',
            duration_days: 2,
        });
        await assert('Booking with past start date is rejected with 400', pastBookRes.status === 400, `Status ${pastBookRes.status}`);
        // 4.3 Unauthorized user cannot accept proposal
        const intruderAcceptRes = await request(baseUrl, 'PATCH', `/api/bookings/${bookingId}/status`, {
            Authorization: `Bearer ${tokenC}`,
        }, {
            status: 'ACCEPTED',
        });
        await assert('Intruder cannot accept or modify booking status (returns 403)', intruderAcceptRes.status === 403, `Status ${intruderAcceptRes.status}`);
        // 4.4 Borrower cannot accept proposal (only lender can accept)
        const borrowerAcceptRes = await request(baseUrl, 'PATCH', `/api/bookings/${bookingId}/status`, {
            Authorization: `Bearer ${tokenA}`,
        }, {
            status: 'ACCEPTED',
        });
        await assert('Borrower cannot accept their own proposal (only lender can, returns 403)', borrowerAcceptRes.status === 403, `Status ${borrowerAcceptRes.status}`);
        // 4.5 Bob accepts the proposal
        const lenderAcceptRes = await request(baseUrl, 'PATCH', `/api/bookings/${bookingId}/status`, {
            Authorization: `Bearer ${tokenB}`,
        }, {
            status: 'ACCEPTED',
        });
        await assert('Lender can accept proposal (returns 200)', lenderAcceptRes.status === 200 && lenderAcceptRes.body?.data?.status === 'ACCEPTED', `Status ${lenderAcceptRes.status}`);
        // Verify BOOKING_ACCEPTED notification triggered for Alice (User A)
        const aAcceptedNotifs = await (0, db_1.query)('SELECT id FROM notifications WHERE user_id = $1 AND type = $2', [userAId, 'BOOKING_ACCEPTED']);
        await assert('Accepting booking generated BOOKING_ACCEPTED notification for borrower (User A)', aAcceptedNotifs.rows.length > 0, 'No BOOKING_ACCEPTED notification found for User A');
        // 4.6 Double booking prevention: Attempting to accept overlapping reservation fails with 409
        // Create second booking proposal for same dates
        const book2Res = await (0, db_1.query)(`
      INSERT INTO bookings (item_id, borrower_id, lender_id, start_date, duration_days, total_price, status)
      VALUES ($1, $2, $3, CURRENT_DATE + INTERVAL '5 day', 2, 1200.00, 'PENDING')
      RETURNING id
    `, [itemId, userCId, userBId]);
        const booking2Id = book2Res.rows[0].id;
        const overlapAcceptRes = await request(baseUrl, 'PATCH', `/api/bookings/${booking2Id}/status`, {
            Authorization: `Bearer ${tokenB}`,
        }, {
            status: 'ACCEPTED',
        });
        await assert('Accepting overlapping reservation is prevented with 409 CONFLICT (no double-booking)', overlapAcceptRes.status === 409, `Status ${overlapAcceptRes.status}`);
        // 4.7 Terminal state enforcement: Complete booking, then cannot change to REJECTED or PENDING
        const completeRes = await request(baseUrl, 'PATCH', `/api/bookings/${bookingId}/status`, {
            Authorization: `Bearer ${tokenB}`,
        }, {
            status: 'COMPLETED',
        });
        await assert('Lender marks booking as COMPLETED (returns 200)', completeRes.status === 200 && completeRes.body?.data?.status === 'COMPLETED', `Status ${completeRes.status}`);
        const reRejectRes = await request(baseUrl, 'PATCH', `/api/bookings/${bookingId}/status`, {
            Authorization: `Bearer ${tokenB}`,
        }, {
            status: 'REJECTED',
        });
        await assert('Attempt to transition from terminal state COMPLETED to REJECTED is rejected with 400', reRejectRes.status === 400, `Status ${reRejectRes.status}`);
        console.log('\n[SECTION 5: REAL-TIME SSE STREAM & DISPATCH]');
        // 5.1 Unauthenticated SSE stream rejected
        const unauthSseRes = await request(baseUrl, 'GET', '/api/realtime/stream');
        await assert('Unauthenticated request to /api/realtime/stream returns 401', unauthSseRes.status === 401, `Status was ${unauthSseRes.status}`);
        // 5.2 Authenticated SSE connection connects with text/event-stream
        const sseHeadersPromise = new Promise((resolve, reject) => {
            const sseReq = http_1.default.request(`${baseUrl}/api/realtime/stream?token=${tokenA}`, { method: 'GET' }, (res) => {
                resolve({
                    status: res.statusCode || 0,
                    contentType: res.headers['content-type'] || '',
                });
                res.destroy(); // Close stream after verifying connection
            });
            sseReq.on('error', reject);
            sseReq.end();
        });
        const sseConn = await sseHeadersPromise;
        await assert('Authenticated SSE connection succeeds with 200 and text/event-stream', sseConn.status === 200 && sseConn.contentType.includes('text/event-stream'), `Status ${sseConn.status}, contentType ${sseConn.contentType}`);
        console.log('\n[SECTION 6: WEB PUSH API & SUBSCRIPTION LIFECYCLE]');
        // 6.1 VAPID public key endpoint
        const vapidRes = await request(baseUrl, 'GET', '/api/push/vapid-public-key');
        await assert('GET /api/push/vapid-public-key returns 200 with non-empty public key', vapidRes.status === 200 && typeof vapidRes.body?.data?.publicKey === 'string' && vapidRes.body?.data?.publicKey.length > 20, `Status ${vapidRes.status}, key: ${vapidRes.body?.data?.publicKey}`);
        // 6.2 Unauthenticated subscription rejected
        const unauthSubRes = await request(baseUrl, 'POST', '/api/push/subscribe', {}, {
            subscription: {
                endpoint: 'https://fcm.googleapis.com/fcm/send/fake-endpoint-123',
                keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
            }
        });
        await assert('Unauthenticated subscription attempt returns 401', unauthSubRes.status === 401, `Status was ${unauthSubRes.status}`);
        // 6.3 Valid user subscribes to push
        const testEndpoint = `https://fcm.googleapis.com/fcm/send/test-device-${Date.now()}`;
        const subRes = await request(baseUrl, 'POST', '/api/push/subscribe', {
            Authorization: `Bearer ${tokenA}`,
        }, {
            subscription: {
                endpoint: testEndpoint,
                keys: {
                    p256dh: 'BC_fake_p256dh_key_for_testing_purposes_only_1234567890',
                    auth: 'fake_auth_secret_123'
                }
            }
        });
        await assert('Authenticated user successfully registers push subscription', subRes.status === 200 && (subRes.body?.data?.subscribed === true || subRes.body?.success === true), `Status ${subRes.status}`);
        // Verify stored in DB
        const subInDb = await (0, db_1.query)('SELECT user_id, endpoint FROM push_subscriptions WHERE endpoint = $1', [testEndpoint]);
        await assert('Push subscription is saved in database under User A', subInDb.rows[0]?.user_id === userAId, `user_id in DB: ${subInDb.rows[0]?.user_id}`);
        // 6.4 Unsubscribe
        const unsubRes = await request(baseUrl, 'POST', '/api/push/unsubscribe', {
            Authorization: `Bearer ${tokenA}`,
        }, {
            endpoint: testEndpoint,
        });
        await assert('User can unsubscribe and remove device endpoint', unsubRes.status === 200 && (unsubRes.body?.data?.subscribed === false || unsubRes.body?.success === true), `Status ${unsubRes.status}`);
        const subAfterDel = await (0, db_1.query)('SELECT id FROM push_subscriptions WHERE endpoint = $1', [testEndpoint]);
        await assert('Push subscription successfully removed from database', subAfterDel.rows.length === 0, 'Subscription was not removed');
        console.log('\n[SECTION 7: MESSAGING CONVERSATIONS & HISTORY]');
        // 7.1 Fetch conversations for User A
        const convoResA = await request(baseUrl, 'GET', '/api/messages/conversations', {
            Authorization: `Bearer ${tokenA}`,
        });
        await assert('GET /api/messages/conversations returns 200 and list of active bookings', convoResA.status === 200 && Array.isArray(convoResA.body?.data), `Status ${convoResA.status}`);
        const hasBookingA = convoResA.body?.data?.some((c) => c.booking_id === bookingId);
        await assert('User A conversation list contains the active booking with Bob', hasBookingA === true, 'Booking not in conversation list');
        // 7.2 Fetch messages for the booking
        const messagesRes = await request(baseUrl, 'GET', `/api/messages/${bookingId}`, {
            Authorization: `Bearer ${tokenA}`,
        });
        await assert('GET /api/messages/:bookingId returns messages list and partner metadata', messagesRes.status === 200 && Array.isArray(messagesRes.body?.data?.messages), `Status ${messagesRes.status}`);
        await assert('Message history contains the sent message', messagesRes.body?.data?.messages?.some((m) => m.content === 'Hey Bob, is the drone battery charged?'), 'Sent message not found in history');
        // 7.3 Unauthorized User C cannot read messages
        const intruderReadRes = await request(baseUrl, 'GET', `/api/messages/${bookingId}`, {
            Authorization: `Bearer ${tokenC}`,
        });
        await assert('Unauthorized user cannot read conversation messages (returns 403)', intruderReadRes.status === 403, `Status ${intruderReadRes.status}`);
        // 7.4 Invalid booking UUID returns 400
        const invalidIdRes = await request(baseUrl, 'GET', '/api/messages/not-a-uuid', {
            Authorization: `Bearer ${tokenA}`,
        });
        await assert('Invalid booking ID format returns 400 validation error', invalidIdRes.status === 400, `Status ${invalidIdRes.status}`);
        console.log('\n======================================================');
        console.log(`  TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
        console.log('======================================================\n');
        // Clean up test records
        await (0, db_1.query)('DELETE FROM notifications WHERE user_id IN ($1, $2, $3)', [userAId, userBId, userCId]).catch(() => { });
        await (0, db_1.query)('DELETE FROM messages WHERE booking_id IN ($1, $2)', [bookingId, booking2Id]).catch(() => { });
        await (0, db_1.query)('DELETE FROM bookings WHERE id IN ($1, $2)', [bookingId, booking2Id]).catch(() => { });
        await (0, db_1.query)('DELETE FROM items WHERE id = $1', [itemId]).catch(() => { });
        await (0, db_1.query)('DELETE FROM users WHERE id IN ($1, $2, $3)', [userAId, userBId, userCId]).catch(() => { });
        if (failedCount > 0) {
            process.exit(1);
        }
    }
    catch (err) {
        console.error('Fatal test runner error:', err);
        process.exit(1);
    }
    finally {
        server.close();
        process.exit(0);
    }
}
runTests();
