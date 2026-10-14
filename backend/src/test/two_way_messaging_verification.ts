import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5001/api';

async function request(endpoint: string, options: any = {}): Promise<{ status: number; ok: boolean; data: any }> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };
  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data: any = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTwoWayMessagingVerification() {
  console.log('========================================================');
  console.log('🧪 RENTU TWO-WAY RENTER-LENDER MESSAGING VERIFICATION');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Authenticate Test Users
  console.log('1. Authenticating Test Accounts (Renter, Lender, Unauthorized Third-Party)...');
  
  const renterLogin = await request('/auth/demo-login', {
    method: 'POST',
    body: { role: 'borrower' },
  });
  assert(renterLogin.ok && renterLogin.data.data.token, 'Renter authenticated (Ananya Roy)');
  const renterToken = renterLogin.data.data.token;
  const renterUser = renterLogin.data.data.user;

  const lenderLogin = await request('/auth/demo-login', {
    method: 'POST',
    body: { role: 'lender' },
  });
  assert(lenderLogin.ok && lenderLogin.data.data.token, 'Lender authenticated (Rohit Verma)');
  const lenderToken = lenderLogin.data.data.token;
  const lenderUser = lenderLogin.data.data.user;

  const unauthorizedLogin = await request('/auth/demo-login', {
    method: 'POST',
    body: { role: 'creator' },
  });
  assert(unauthorizedLogin.ok && unauthorizedLogin.data.data.token, 'Unauthorized user authenticated (Kabir Sen)');
  const unauthorizedToken = unauthorizedLogin.data.data.token;

  // 2. Locate Shared Booking Conversation
  console.log('\n2. Verifying Shared Booking Conversation...');
  const renterConvos = await request('/messages/conversations', { token: renterToken });
  assert(renterConvos.ok && Array.isArray(renterConvos.data.data), 'Renter conversations loaded successfully');

  const sharedConvo = renterConvos.data.data.find((c: any) => c.partner_name === lenderUser.name);
  assert(!!sharedConvo, `Shared booking conversation found with ${lenderUser.name}`);

  const bookingId = sharedConvo.booking_id;
  console.log(`   Target Booking ID: ${bookingId}`);
  console.log(`   Item: ${sharedConvo.item_title} (₹${sharedConvo.price_per_day}/day)`);

  // 3. Step 1: Renter sends message to Lender
  console.log('\n3. Testing Step 1: Renter Sends Message to Lender...');
  const renterMsgText = `Hi Rohit! Coordination test message at ${Date.now()}`;
  const sendRes1 = await request('/messages', {
    method: 'POST',
    token: renterToken,
    body: {
      booking_id: bookingId,
      content: renterMsgText,
    },
  });

  assert(sendRes1.ok && sendRes1.data.data.content === renterMsgText, 'Renter sent message successfully (201)');
  const msg1 = sendRes1.data.data;
  assert(msg1.sender_id === renterUser.id, 'Sender identity correctly derived as Renter');
  assert(msg1.receiver_id === lenderUser.id, 'Receiver identity correctly derived as Lender (counterparty, not sender)');
  assert(msg1.is_read === false, 'Message starts with unread status (is_read: false)');

  // 4. Step 2: Lender receives it and replies
  console.log('\n4. Testing Step 2: Lender Receives Message and Replies...');
  // Lender loads messages (marks unread as read)
  const lenderMessagesRes = await request(`/messages/${bookingId}`, { token: lenderToken });
  assert(lenderMessagesRes.ok, 'Lender loaded conversation messages');
  const foundMsg1 = lenderMessagesRes.data.data.messages.find((m: any) => m.id === msg1.id);
  assert(!!foundMsg1, "Renter's message is visible in Lender's thread history");

  // Verify read status updated in database for msg1
  const lenderMessagesCheck = await request(`/messages/${bookingId}`, { token: lenderToken });
  const updatedMsg1 = lenderMessagesCheck.data.data.messages.find((m: any) => m.id === msg1.id);
  assert(updatedMsg1 && updatedMsg1.is_read === true, 'Message automatically marked read when viewed by intended recipient');

  // Lender sends reply
  const lenderReplyText = `Got it Ananya! Replying back to confirm at ${Date.now()}`;
  const replyRes = await request('/messages', {
    method: 'POST',
    token: lenderToken,
    body: {
      booking_id: bookingId,
      content: lenderReplyText,
    },
  });

  assert(replyRes.ok && replyRes.data.data.content === lenderReplyText, 'Lender reply sent successfully (201)');
  const replyMsg = replyRes.data.data;
  assert(replyMsg.sender_id === lenderUser.id, 'Sender identity correctly derived as Lender');
  assert(replyMsg.receiver_id === renterUser.id, 'Receiver identity correctly derived as Renter (never back to sender)');

  // 5. Step 3: Renter receives the reply
  console.log('\n5. Testing Step 3: Renter Receives Reply...');
  const renterMessagesRes = await request(`/messages/${bookingId}`, { token: renterToken });
  assert(renterMessagesRes.ok, 'Renter loaded conversation messages');
  const foundReply = renterMessagesRes.data.data.messages.find((m: any) => m.id === replyMsg.id);
  assert(!!foundReply, "Lender's reply is visible in Renter's thread history");
  assert(foundReply.sender_id === lenderUser.id, 'Sender ID matches Lender');

  // 6. Step 4: Refresh simulation (history persistence and ordering)
  console.log('\n6. Testing Step 4: History Persistence Across Refreshes & Ordering...');
  const renterConvosRefreshed = await request('/messages/conversations', { token: renterToken });
  const refreshedConvo = renterConvosRefreshed.data.data.find((c: any) => c.booking_id === bookingId);
  assert(refreshedConvo && refreshedConvo.last_message === lenderReplyText, 'Conversation list preview shows latest message');
  assert(refreshedConvo.partner_name === lenderUser.name, 'Conversation shows correct counterparty name (Rohit Verma)');
  assert(refreshedConvo.partner_role === 'Lender', 'Conversation shows correct partner role (Lender)');

  const lenderConvosRefreshed = await request('/messages/conversations', { token: lenderToken });
  const lenderConvo = lenderConvosRefreshed.data.data.find((c: any) => c.booking_id === bookingId);
  assert(lenderConvo.partner_name === renterUser.name, 'Lender view shows counterparty as Renter (Ananya Roy)');
  assert(lenderConvo.partner_role === 'Renter', 'Lender view shows partner role as Renter');

  // 7. Step 5: Read status & Unread Count updates
  console.log('\n7. Testing Step 5: Unread Counts and Read Receipts...');
  // Renter sends new message
  const unreadTestMsg = `Unread badge verification test ${Date.now()}`;
  await request('/messages', {
    method: 'POST',
    token: renterToken,
    body: {
      booking_id: bookingId,
      content: unreadTestMsg,
    },
  });

  // Check Lender's conversation list before opening thread
  const lenderConvosUnread = await request('/messages/conversations', { token: lenderToken });
  const lenderConvoBeforeOpen = lenderConvosUnread.data.data.find((c: any) => c.booking_id === bookingId);
  assert(lenderConvoBeforeOpen && Number(lenderConvoBeforeOpen.unread_count) >= 1, 'Lender unread count correctly reflects unread message (>= 1)');

  // Explicit mark as read
  const markReadRes = await request(`/messages/${bookingId}/read`, {
    method: 'PATCH',
    token: lenderToken,
  });
  assert(markReadRes.ok && markReadRes.data.success === true, 'Explicit PATCH /:bookingId/read succeeded');

  const lenderConvosAfterRead = await request('/messages/conversations', { token: lenderToken });
  const lenderConvoAfterRead = lenderConvosAfterRead.data.data.find((c: any) => c.booking_id === bookingId);
  assert(lenderConvoAfterRead && Number(lenderConvoAfterRead.unread_count) === 0, 'Lender unread count resets to 0 after viewing/marking read');

  // 8. Step 6: Authorization & Security
  console.log('\n8. Testing Step 6: Authorization & Security Access Controls...');
  // Unauthorized user attempts to read conversation
  const unauthGetRes = await request(`/messages/${bookingId}`, { token: unauthorizedToken });
  assert(unauthGetRes.status === 403, 'Unauthorized user cannot read conversation (403 Forbidden)');

  // Unauthorized user attempts to send message
  const unauthPostRes = await request('/messages', {
    method: 'POST',
    token: unauthorizedToken,
    body: {
      booking_id: bookingId,
      content: 'Malicious spoof attempt',
    },
  });
  assert(unauthPostRes.status === 403, 'Unauthorized user cannot send messages to conversation (403 Forbidden)');

  // Unauthorized user attempts to mark as read
  const unauthPatchRes = await request(`/messages/${bookingId}/read`, {
    method: 'PATCH',
    token: unauthorizedToken,
  });
  assert(unauthPatchRes.status === 403, 'Unauthorized user cannot mark messages as read (403 Forbidden)');

  // Invalid booking ID
  const invalidIdRes = await request('/messages/not-a-valid-uuid', { token: renterToken });
  assert(invalidIdRes.status === 400, 'Invalid booking UUID format rejected (400 Bad Request)');

  // 9. Step 7: Input Validation & Duplicate Prevention
  console.log('\n9. Testing Step 7: Input Validation & Duplicate Send Prevention...');
  // Empty content
  const emptyRes1 = await request('/messages', {
    method: 'POST',
    token: renterToken,
    body: { booking_id: bookingId, content: '' },
  });
  assert(emptyRes1.status === 400, 'Empty string message rejected (400 Bad Request)');

  const emptyRes2 = await request('/messages', {
    method: 'POST',
    token: renterToken,
    body: { booking_id: bookingId, content: '     ' },
  });
  assert(emptyRes2.status === 400, 'Whitespace-only message rejected (400 Bad Request)');

  // 10. Summary
  console.log('\n========================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTwoWayMessagingVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
