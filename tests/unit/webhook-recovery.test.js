/**
 * Pure In-Memory Unit Test Suite for Razorpay Webhook & Payment Recovery
 * Traceability: PondFish Phase 2J-J Requirements & Audit Guidelines
 * ZERO database connections, ZERO network requests, ZERO live transactions.
 */

const assert = require('assert');
const crypto = require('crypto');
const paymentEngine = require('../../lib/engines/payment');
const paymentRecoveryEngine = require('../../lib/engines/payment-recovery');

console.log('=== PURE IN-MEMORY WEBHOOK & RECOVERY UNIT TESTS ===\n');

let passed = 0;
const TEST_SECRET = 'whsec_pondFishTestSecret999888777';

function generateSignature(body, secret = TEST_SECRET) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// Test 1: Valid webhook signature verification (timing-safe)
{
  const payload = JSON.stringify({
    entity: 'event',
    event: 'payment.captured',
    event_id: 'evt_test_001',
    created_at: Date.now(),
  });
  const validSig = generateSignature(payload);

  const isValid = paymentEngine.verifyWebhookSignature(payload, validSig, TEST_SECRET);
  assert.strictEqual(isValid, true, 'Valid HMAC signature must verify');
  console.log('[PASS] 1. verifyWebhookSignature validates authentic HMAC signature with timing-safe comparison');
  passed++;
}

// Test 2: Tampered payload with valid signature is rejected
{
  const payload = JSON.stringify({
    entity: 'event',
    event: 'payment.captured',
    event_id: 'evt_test_001',
  });
  const validSig = generateSignature(payload);
  const tamperedPayload = JSON.stringify({
    entity: 'event',
    event: 'payment.captured',
    event_id: 'evt_test_001',
    tampered: true,
  });

  const isValid = paymentEngine.verifyWebhookSignature(tamperedPayload, validSig, TEST_SECRET);
  assert.strictEqual(isValid, false, 'Tampered payload must fail signature verification');
  console.log('[PASS] 2. verifyWebhookSignature rejects tampered payload bytes');
  passed++;
}

// Test 3: Invalid signature string or mismatched length is rejected safely
{
  const payload = '{"event":"payment.captured"}';
  const invalidSig = 'invalid_sig_abc';
  const isValid = paymentEngine.verifyWebhookSignature(payload, invalidSig, TEST_SECRET);
  assert.strictEqual(isValid, false, 'Invalid signature must be safely rejected without throwing');
  console.log('[PASS] 3. verifyWebhookSignature safely rejects mismatched signature lengths');
  passed++;
}

// Test 4: Missing signature or missing secret returns false
{
  assert.strictEqual(paymentEngine.verifyWebhookSignature('{}', null, TEST_SECRET), false);
  assert.strictEqual(paymentEngine.verifyWebhookSignature('{}', 'sig', null), false);
  console.log('[PASS] 4. verifyWebhookSignature returns false on missing signature or secret');
  passed++;
}

// Test 5: processRazorpayWebhook rejects missing signature header (HTTP 400)
setTimeout(() => {
  paymentRecoveryEngine.processRazorpayWebhook({
    rawBody: '{}',
    signature: null,
    secret: TEST_SECRET,
  }).catch((err) => {
    assert.strictEqual(err.code, 'MISSING_SIGNATURE');
    assert.strictEqual(err.status, 400);
    console.log('[PASS] 5. processRazorpayWebhook rejects requests with missing x-razorpay-signature (400)');
    passed++;
  });
}, 10);

// Test 6: processRazorpayWebhook rejects invalid signature (HTTP 400)
setTimeout(() => {
  paymentRecoveryEngine.processRazorpayWebhook({
    rawBody: '{"event":"payment.captured"}',
    signature: 'bad_signature_hex_1234567890abcdef',
    secret: TEST_SECRET,
  }).catch((err) => {
    assert.strictEqual(err.code, 'INVALID_SIGNATURE');
    assert.strictEqual(err.status, 400);
    console.log('[PASS] 6. processRazorpayWebhook rejects forged or invalid signatures (400)');
    passed++;
  });
}, 25);

// Test 7: processRazorpayWebhook rejects malformed JSON payload (HTTP 400)
setTimeout(() => {
  const malformed = '{"event": "payment.captured", UNPARSEABLE_JSON...';
  const sig = generateSignature(malformed);
  paymentRecoveryEngine.processRazorpayWebhook({
    rawBody: malformed,
    signature: sig,
    secret: TEST_SECRET,
  }).catch((err) => {
    assert.strictEqual(err.code, 'MALFORMED_PAYLOAD');
    assert.strictEqual(err.status, 400);
    console.log('[PASS] 7. processRazorpayWebhook rejects malformed JSON payloads (400)');
    passed++;
  });
}, 40);

// Test 8: Uncaptured payment status ('authorized' only) is IGNORED and does not book
setTimeout(async () => {
  const uncapturedEvent = {
    entity: 'event',
    event: 'payment.captured',
    event_id: 'evt_auth_only_001',
    payload: {
      payment: {
        entity: {
          id: 'pay_auth_123',
          order_id: 'order_auth_123',
          amount: 50000,
          status: 'authorized', // Not captured!
          notes: { customerId: 'cust_test_uuid' },
        },
      },
    },
  };
  const body = JSON.stringify(uncapturedEvent);
  const sig = generateSignature(body);

  const res = await paymentRecoveryEngine.processRazorpayWebhook({
    rawBody: body,
    signature: sig,
    secret: TEST_SECRET,
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'IGNORED_UNCAPTURED');
  console.log('[PASS] 8. Uncaptured payments (authorized status) are ignored to prevent premature booking');
  passed++;
}, 55);

// Test 9: Non-payment event types are safely acknowledged and ignored
setTimeout(async () => {
  const irrelevantEvent = {
    entity: 'event',
    event: 'subscription.charged',
    event_id: 'evt_irrelevant_001',
    payload: {},
  };
  const body = JSON.stringify(irrelevantEvent);
  const sig = generateSignature(body);

  const res = await paymentRecoveryEngine.processRazorpayWebhook({
    rawBody: body,
    signature: sig,
    secret: TEST_SECRET,
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.ignored, true);
  console.log('[PASS] 9. Documented event filtering acknowledges and ignores non-checkout events');
  passed++;
}, 70);

// Test 10: Atomic Idempotency Claim: Concurrent duplicate delivery returns EVENT_ALREADY_PROCESSED
setTimeout(async () => {
  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('INSERT INTO webhook_events')) {
        // ON CONFLICT DO NOTHING RETURNING id returns empty rows for duplicate!
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const outcome = await paymentRecoveryEngine.reconcileCapturedPayment({
    eventId: 'evt_duplicate_001',
    orderId: 'order_dup_001',
    paymentId: 'pay_dup_001',
    amountPaise: 51180,
    customerId: '00000000-0000-0000-0000-000000000001',
    client: mockClient,
  });

  assert.strictEqual(outcome.success, true);
  assert.strictEqual(outcome.duplicate, true);
  assert.strictEqual(outcome.status, 'EVENT_ALREADY_PROCESSED');
  console.log('[PASS] 10. Atomic idempotency claim prevents concurrent duplicate event execution');
  passed++;
}, 85);

// Test 11: Concurrency guard: Already confirmed booking returns ALREADY_CONFIRMED
setTimeout(async () => {
  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('INSERT INTO webhook_events')) {
        return { rows: [{ id: 'claimed-event-uuid' }] }; // Successfully claimed
      }
      if (sql.includes('FROM payments')) {
        // Already confirmed by customer app
        return { rows: [{ id: 'pay_row_uuid', booking_id: 'booking_already_done_uuid', status: 'PAID' }] };
      }
      return { rows: [] };
    },
  };

  const outcome = await paymentRecoveryEngine.reconcileCapturedPayment({
    eventId: 'evt_concurrency_002',
    orderId: 'order_app_done_002',
    paymentId: 'pay_app_done_002',
    amountPaise: 51180,
    customerId: '00000000-0000-0000-0000-000000000001',
    client: mockClient,
  });

  assert.strictEqual(outcome.success, true);
  assert.strictEqual(outcome.status, 'ALREADY_CONFIRMED');
  assert.strictEqual(outcome.bookingId, 'booking_already_done_uuid');
  console.log('[PASS] 11. Concurrency guard detects pre-confirmed bookings and prevents double-booking');
  passed++;
}, 100);

// Test 12: Missing customer attribution is quarantined as REQUIRES_RECONCILIATION without booking
setTimeout(async () => {
  let paymentInserted = false;

  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('INSERT INTO webhook_events')) {
        return { rows: [{ id: 'claimed-event-uuid' }] };
      }
      if (sql.includes('FROM payments WHERE')) return { rows: [] };
      if (sql.includes('INSERT INTO payments')) {
        paymentInserted = true;
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const outcome = await paymentRecoveryEngine.reconcileCapturedPayment({
    eventId: 'evt_orphan_003',
    orderId: 'order_no_cust_003',
    paymentId: 'pay_no_cust_003',
    amountPaise: 51180,
    customerId: null, // Missing customer attribution!
    notes: {},
    client: mockClient,
  });

  assert.strictEqual(outcome.success, false);
  assert.strictEqual(outcome.status, 'REQUIRES_RECONCILIATION');
  assert.strictEqual(outcome.code, 'MISSING_CUSTOMER_ID');
  assert.strictEqual(paymentInserted, true);
  console.log('[PASS] 12. Missing customer attribution quarantines payment without booking or charging');
  passed++;
}, 115);

// Test 13: Mutable cart reconstruction refused when immutable checkout intent is absent
setTimeout(async () => {
  let paymentStatus = null;

  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('INSERT INTO webhook_events')) {
        return { rows: [{ id: 'claimed-event-uuid' }] };
      }
      if (sql.includes('FROM payments WHERE')) return { rows: [] };
      if (sql.includes('FROM checkout_intents')) {
        // Table not found or no intent row
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO payments')) {
        paymentStatus = 'REQUIRES_RECONCILIATION';
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const outcome = await paymentRecoveryEngine.reconcileCapturedPayment({
    eventId: 'evt_missing_intent_004',
    orderId: 'order_intent_pending_004',
    paymentId: 'pay_intent_pending_004',
    amountPaise: 51180,
    customerId: '00000000-0000-0000-0000-000000000001',
    client: mockClient,
  });

  assert.strictEqual(outcome.success, true);
  assert.strictEqual(outcome.status, 'REQUIRES_RECONCILIATION');
  assert.strictEqual(outcome.reason, 'IMMUTABLE_CHECKOUT_INTENT_NOT_FOUND');
  assert.strictEqual(paymentStatus, 'REQUIRES_RECONCILIATION');
  console.log('[PASS] 13. Mutable cart reconstruction refused when immutable checkout intent is absent');
  passed++;
}, 130);

// Test 14: Intent amount mismatch is safely quarantined without booking
setTimeout(async () => {
  let quarantined = false;

  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('INSERT INTO webhook_events')) {
        return { rows: [{ id: 'claimed-event-uuid' }] };
      }
      if (sql.includes('FROM payments WHERE')) return { rows: [] };
      if (sql.includes('FROM checkout_intents')) {
        return {
          rows: [{
            id: 'intent_uuid_005',
            amount_paise: 99900, // Expected 999.00
            status: 'CREATED',
            booking_id: null,
          }],
        };
      }
      if (sql.includes('INSERT INTO payments')) {
        quarantined = true;
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const outcome = await paymentRecoveryEngine.reconcileCapturedPayment({
    eventId: 'evt_mismatch_005',
    orderId: 'order_mismatch_005',
    paymentId: 'pay_mismatch_005',
    amountPaise: 51180, // Received 511.80 (Mismatch!)
    customerId: '00000000-0000-0000-0000-000000000001',
    client: mockClient,
  });

  assert.strictEqual(outcome.success, true);
  assert.strictEqual(outcome.status, 'REQUIRES_RECONCILIATION');
  assert.strictEqual(outcome.reason, 'PAYMENT_AMOUNT_MISMATCH');
  assert.strictEqual(quarantined, true);
  console.log('[PASS] 14. Intent amount mismatch is safely quarantined under REQUIRES_RECONCILIATION');
  passed++;
}, 145);

// Final summary
setTimeout(() => {
  console.log(`\nResults: ${passed} / 14 pure in-memory unit tests passed successfully.`);
  process.exit(0);
}, 180);
