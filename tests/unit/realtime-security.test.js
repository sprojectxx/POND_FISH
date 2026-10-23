/**
 * Phase 3 Realtime & Transaction-Display Security Test Suite
 * Traceability: PondFish Phase 3 Independent Review Corrections & Requirements
 * 
 * Verifies real WebSocket client/server interactions:
 * 1. Real HTTP server + initWebSocketServer real WebSocket client execution.
 * 2. Anonymous connections cannot subscribe to private customer, worker, or GPS channels.
 * 3. Customer A cannot access or subscribe to Customer B's channel.
 * 4. Worker from Store A cannot access Store B's channel; authorized worker receives only their store events.
 * 5. GPS telemetry never reaches unauthorized clients (Admin-only).
 * 6. Client event injection is strictly rejected by the real server message handler.
 * 7. Session revocation terminates the actual associated socket with 4401.
 * 8. TV feed access and payload fields comply with privacy and configurable TV authentication policy.
 * 9. Credential hygiene: Admin API secrets are rejected in URL query strings and accepted only via HTTP headers.
 */

const assert = require('assert');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const http = require('http');
const { WebSocket } = require('ws');

// Configure test secrets
const TEST_ADMIN_SECRET = 'pondfish-test-admin-secret-key-fixture-32chars';
process.env.ADMIN_SECRET = TEST_ADMIN_SECRET;

const {
  initWebSocketServer,
  closeWebSocketServer,
  broadcast,
  broadcastToCustomer,
  broadcastToWorkers,
  revokeRealtimeSession,
  authenticateToken,
  isChannelAuthorized,
} = require('../../lib/realtime/ws-server');
const realtimeBroadcastEngine = require('../../lib/engines/realtime-broadcast');
const { getJwtSecret, getAdminSecret } = require('../../lib/auth/admin-auth');
const tvFeedEngine = require('../../lib/engines/tv-feed');

// Robust helper to connect a real WebSocket client to the local test server with queue-based message consumption
function connectClient(baseUrl, pathAndQuery = '/api/v1/realtime', options = {}) {
  return new Promise((resolve, reject) => {
    const wsUrl = `${baseUrl}${pathAndQuery}`;
    const ws = new WebSocket(wsUrl, options);
    const unhandledMessages = [];
    const waiters = [];

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const waiterIdx = waiters.findIndex((w) => !w.filterFn || w.filterFn(msg));
        if (waiterIdx !== -1) {
          const waiter = waiters.splice(waiterIdx, 1)[0];
          clearTimeout(waiter.timer);
          waiter.resolve(msg);
        } else {
          unhandledMessages.push(msg);
        }
      } catch (err) {
        console.error('Error parsing client message:', err);
      }
    });

    ws.waitForMessage = (filterFn, timeoutMs = 2500) => {
      const idx = unhandledMessages.findIndex(filterFn || (() => true));
      if (idx !== -1) {
        return Promise.resolve(unhandledMessages.splice(idx, 1)[0]);
      }
      return new Promise((res, rej) => {
        const waiter = {
          filterFn,
          resolve: res,
          timer: setTimeout(() => {
            const i = waiters.indexOf(waiter);
            if (i !== -1) waiters.splice(i, 1);
            rej(new Error(`Timeout (${timeoutMs}ms) waiting for message. Unhandled: ${JSON.stringify(unhandledMessages)}`));
          }, timeoutMs),
        };
        waiters.push(waiter);
      });
    };

    ws.getReceivedMessages = () => [...unhandledMessages];

    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('Phase 3 Realtime & Transaction-Display Security Suite (Real WebSocket Integration)', async (t) => {
  const secret = getJwtSecret();

  // Tokens for testing
  const adminToken = jwt.sign(
    { adminId: 'admin_test_1', name: 'Super Admin', role: 'ADMIN', sessionId: 'sess_admin_1' },
    secret,
    { expiresIn: '1h' }
  );

  const workerStoreAToken = jwt.sign(
    { workerId: 'worker_a', name: 'Staff A', role: 'WORKER', storeId: 'store_a', sessionId: 'sess_worker_a' },
    secret,
    { expiresIn: '1h' }
  );

  const workerStoreBToken = jwt.sign(
    { workerId: 'worker_b', name: 'Staff B', role: 'WORKER', storeId: 'store_b', sessionId: 'sess_worker_b' },
    secret,
    { expiresIn: '1h' }
  );

  const customer1Token = jwt.sign(
    { customerId: 'cust_1111', mobileNumber: '9999911111', role: 'CUSTOMER', sessionId: 'sess_cust_1' },
    secret,
    { expiresIn: '1h' }
  );

  const customer2Token = jwt.sign(
    { customerId: 'cust_2222', mobileNumber: '9999922222', role: 'CUSTOMER', sessionId: 'sess_cust_2' },
    secret,
    { expiresIn: '1h' }
  );

  // Setup real local test HTTP server on ephemeral port (0)
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('OK');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `ws://127.0.0.1:${port}`;

  // Initialize actual production WebSocket server attached to test HTTP server
  initWebSocketServer(server, { force: true });

  t.after(async () => {
    await closeWebSocketServer();
    await new Promise((resolve) => server.close(resolve));
  });

  // ---------------------------------------------------------------------------
  // 1. Anonymous Connection Attempting to Subscribe to Private Channels
  // ---------------------------------------------------------------------------
  await t.test('1. Anonymous connection cannot subscribe to private customer, worker, or GPS channels', async () => {
    const ws = await connectClient(baseUrl);
    const initMsg = await ws.waitForMessage((m) => m.type === 'connection_established');
    assert.strictEqual(initMsg.authenticated, false);
    assert.strictEqual(initMsg.role, 'ANONYMOUS');

    // Attempt to subscribe to Customer channel
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'customer:cust_1111' }));
    const errCust = await ws.waitForMessage((m) => m.code === 'UNAUTHORIZED_CHANNEL' && m.channel === 'customer:cust_1111');
    assert.strictEqual(errCust.channel, 'customer:cust_1111');

    // Attempt to subscribe to Worker channel
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'worker:store:store_a' }));
    const errWorker = await ws.waitForMessage((m) => m.code === 'UNAUTHORIZED_CHANNEL' && m.channel === 'worker:store:store_a');
    assert.strictEqual(errWorker.channel, 'worker:store:store_a');

    // Attempt to subscribe to GPS telemetry channel
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'gps:live' }));
    const errGps = await ws.waitForMessage((m) => m.code === 'UNAUTHORIZED_CHANNEL' && m.channel === 'gps:live');
    assert.strictEqual(errGps.channel, 'gps:live');

    ws.close();
  });

  // ---------------------------------------------------------------------------
  // 2. Customer A Cannot Subscribe to or Access Customer B's Channel
  // ---------------------------------------------------------------------------
  await t.test('2. Customer A attempting to access Customer B channel is rejected and isolated', async () => {
    // Connect Customer A with valid JWT in upgrade header
    const wsA = await connectClient(baseUrl, '/api/v1/realtime', {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const initA = await wsA.waitForMessage((m) => m.type === 'connection_established');
    assert.strictEqual(initA.authenticated, true);
    assert.strictEqual(initA.role, 'CUSTOMER');

    // Customer A attempts to subscribe to Customer B's private channel
    wsA.send(JSON.stringify({ type: 'subscribe', channel: 'customer:cust_2222' }));
    const subReject = await wsA.waitForMessage((m) => m.code === 'UNAUTHORIZED_CHANNEL');
    assert.strictEqual(subReject.channel, 'customer:cust_2222');

    // Deliver event to Customer B
    broadcastToCustomer('cust_2222', 'booking_status', { bookingId: 'bk_999', status: 'CONFIRMED' });
    await sleep(50);

    // Verify Customer A received zero messages from Customer B
    const received = wsA.getReceivedMessages();
    assert.strictEqual(
      received.some((m) => m.event === 'booking_status' && m.data?.bookingId === 'bk_999'),
      false,
      'Customer A must NEVER receive Customer B events'
    );

    wsA.close();
  });

  // ---------------------------------------------------------------------------
  // 3. Worker Store Authorization: Store A Worker Cannot Access Store B
  // ---------------------------------------------------------------------------
  await t.test('3. Worker store authorization: Store A worker cannot access Store B events', async () => {
    const wsWorkerA = await connectClient(baseUrl, '/api/v1/realtime', {
      headers: { Authorization: `Bearer ${workerStoreAToken}` },
    });
    const initWorkerA = await wsWorkerA.waitForMessage((m) => m.type === 'connection_established');
    assert.strictEqual(initWorkerA.role, 'WORKER');

    // Worker A attempts to subscribe to Store B's channel
    wsWorkerA.send(JSON.stringify({ type: 'subscribe', channel: 'worker:store:store_b' }));
    const rejectStoreB = await wsWorkerA.waitForMessage((m) => m.code === 'UNAUTHORIZED_CHANNEL');
    assert.strictEqual(rejectStoreB.channel, 'worker:store:store_b');

    // Deliver an event to Store B
    broadcastToWorkers('new_counter_sale', { billId: 'bill_b_1', amount: 800 }, { storeId: 'store_b' });
    await sleep(50);

    // Worker A must not have received Store B's counter sale
    const messagesA = wsWorkerA.getReceivedMessages();
    assert.strictEqual(
      messagesA.some((m) => m.event === 'new_counter_sale' && m.data?.billId === 'bill_b_1'),
      false,
      'Worker A must NEVER receive Store B events'
    );

    wsWorkerA.close();
  });

  // ---------------------------------------------------------------------------
  // 4. Authorized Worker Receives ONLY Events for Assigned Store
  // ---------------------------------------------------------------------------
  await t.test('4. Authorized worker receives only events for their assigned store', async () => {
    const wsWorkerA = await connectClient(baseUrl, '/api/v1/realtime', {
      headers: { Authorization: `Bearer ${workerStoreAToken}` },
    });
    const wsWorkerB = await connectClient(baseUrl, '/api/v1/realtime', {
      headers: { Authorization: `Bearer ${workerStoreBToken}` },
    });

    await wsWorkerA.waitForMessage((m) => m.type === 'connection_established');
    await wsWorkerB.waitForMessage((m) => m.type === 'connection_established');

    // Broadcast an event specifically to Store A
    broadcastToWorkers('queue_updated', { storeId: 'store_a', count: 5 }, { storeId: 'store_a' });
    const eventA = await wsWorkerA.waitForMessage((m) => m.event === 'queue_updated');
    assert.strictEqual(eventA.data.storeId, 'store_a');

    // Ensure Worker B did not receive Store A's event
    await sleep(50);
    const msgsB = wsWorkerB.getReceivedMessages();
    assert.strictEqual(
      msgsB.some((m) => m.event === 'queue_updated' && m.data?.storeId === 'store_a'),
      false,
      'Worker B must not receive Store A queue update'
    );

    // Broadcast an event specifically to Store B
    broadcastToWorkers('queue_updated', { storeId: 'store_b', count: 12 }, { storeId: 'store_b' });
    const eventB = await wsWorkerB.waitForMessage((m) => m.event === 'queue_updated');
    assert.strictEqual(eventB.data.storeId, 'store_b');

    // Ensure Worker A did not receive Store B's event
    const msgsA = wsWorkerA.getReceivedMessages();
    assert.strictEqual(
      msgsA.some((m) => m.event === 'queue_updated' && m.data?.storeId === 'store_b'),
      false,
      'Worker A must not receive Store B queue update'
    );

    wsWorkerA.close();
    wsWorkerB.close();
  });

  // ---------------------------------------------------------------------------
  // 5. GPS Telemetry Never Reaches Unauthorized Clients
  // ---------------------------------------------------------------------------
  await t.test('5. GPS events never reach unauthorized clients (Admin-only)', async () => {
    const wsAdmin = await connectClient(baseUrl, '/api/v1/realtime', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const wsWorker = await connectClient(baseUrl, '/api/v1/realtime', {
      headers: { Authorization: `Bearer ${workerStoreAToken}` },
    });
    const wsCustomer = await connectClient(baseUrl, '/api/v1/realtime', {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const wsAnon = await connectClient(baseUrl);

    await wsAdmin.waitForMessage((m) => m.type === 'connection_established');
    await wsWorker.waitForMessage((m) => m.type === 'connection_established');
    await wsCustomer.waitForMessage((m) => m.type === 'connection_established');
    await wsAnon.waitForMessage((m) => m.type === 'connection_established');

    // Broadcast GPS telemetry via production engine
    const gpsData = { journeyId: 'j_1001', latitude: 16.5062, longitude: 80.648, speed: 38 };
    realtimeBroadcastEngine.broadcastGPS(gpsData);

    // Admin MUST receive GPS telemetry
    const adminGpsMsg = await wsAdmin.waitForMessage((m) => m.event === 'gps:live');
    assert.strictEqual(adminGpsMsg.data.journeyId, 'j_1001');

    await sleep(50);

    // Worker, Customer, and Anonymous must have received ZERO GPS telemetry
    assert.strictEqual(wsWorker.getReceivedMessages().some((m) => m.event === 'gps:live'), false);
    assert.strictEqual(wsCustomer.getReceivedMessages().some((m) => m.event === 'gps:live'), false);
    assert.strictEqual(wsAnon.getReceivedMessages().some((m) => m.event === 'gps:live'), false);

    wsAdmin.close();
    wsWorker.close();
    wsCustomer.close();
    wsAnon.close();
  });

  // ---------------------------------------------------------------------------
  // 6. Client Event Injection Rejection
  // ---------------------------------------------------------------------------
  await t.test('6. Client event injection being rejected by the real message handler', async () => {
    const ws = await connectClient(baseUrl);
    await ws.waitForMessage((m) => m.type === 'connection_established');

    // Attempt 1: type: 'publish'
    ws.send(JSON.stringify({ type: 'publish', event: 'successful_transaction', data: { amount: 50000 } }));
    const errPub = await ws.waitForMessage((m) => m.code === 'FORBIDDEN_CLIENT_PUBLISH');
    assert.ok(errPub);

    // Attempt 2: type: 'event'
    ws.send(JSON.stringify({ type: 'event', event: 'BOOKING_COMPLETED', data: { id: 'fake_booking' } }));
    const errEvt = await ws.waitForMessage((m) => m.code === 'FORBIDDEN_CLIENT_PUBLISH');
    assert.ok(errEvt);

    // Attempt 3: root event field
    ws.send(JSON.stringify({ event: 'gps:live', data: { latitude: 0, longitude: 0 } }));
    const errRoot = await ws.waitForMessage((m) => m.code === 'FORBIDDEN_CLIENT_PUBLISH');
    assert.ok(errRoot);

    ws.close();
  });

  // ---------------------------------------------------------------------------
  // 7. Logout / Session Revocation Closes Associated Socket
  // ---------------------------------------------------------------------------
  await t.test('7. Logout/session revocation closing actual associated socket and preventing event delivery', async () => {
    const revokeSessionId = 'sess_revoke_lifecycle_test';
    const revokableToken = jwt.sign(
      { workerId: 'worker_revokable', role: 'WORKER', sessionId: revokeSessionId, storeId: 'main_store' },
      secret
    );

    const ws = await connectClient(baseUrl, '/api/v1/realtime', {
      headers: { Authorization: `Bearer ${revokableToken}` },
    });
    const init = await ws.waitForMessage((m) => m.type === 'connection_established');
    assert.strictEqual(init.authenticated, true);

    // Create a promise for close event
    const closePromise = new Promise((resolve) => {
      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    // Revoke the session via ws-server API (called on worker logout)
    const revokedCount = revokeRealtimeSession(revokeSessionId);
    assert.strictEqual(revokedCount, 1);

    // Verify socket received session_revoked message and closed with code 4401
    const closeEvent = await closePromise;
    assert.strictEqual(closeEvent.code, 4401);
    assert.strictEqual(closeEvent.reason, 'Session revoked');
  });

  // ---------------------------------------------------------------------------
  // 8. TV Feed Access & Payload Field Privacy Validation
  // ---------------------------------------------------------------------------
  await t.test('8. TV feed access and payload fields match explicitly chosen public/private policy', async () => {
    // 8.1 Test public policy payload fields (data minimization)
    const rawTx = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      transactionNumber: 'TXN-20261024-001',
      bookingCode: 'BK789',
      customerName: '9876543210', // Phone number as name -> Must be masked!
      finalPaidAmount: 520.5,
      createdAt: new Date().toISOString(),
      items: [{ fishName: 'Rohu', quantityKg: 2.5 }],
      // Fields that MUST NOT leak:
      mobileNumber: '9876543210',
      customerEmail: 'customer@test.com',
      razorpayPaymentId: 'pay_secret123',
      razorpayOrderId: 'order_secret456',
      workerId: 'worker_private_id',
    };

    const normalized = tvFeedEngine.normalizeTVPayload(rawTx);

    // Verify allowed fields
    assert.strictEqual(normalized.transactionNumber, 'TXN-20261024-001');
    assert.strictEqual(normalized.billNumber, '#BK789');
    assert.strictEqual(normalized.customerName, 'Valued Customer', 'Phone number must be masked to Valued Customer');
    assert.strictEqual(normalized.paidAmount, 521);
    assert.strictEqual(normalized.items.length, 1);
    assert.strictEqual(normalized.items[0].fishName, 'Rohu');

    // Verify disallowed fields do not exist in normalized payload
    assert.strictEqual(normalized.mobileNumber, undefined);
    assert.strictEqual(normalized.customerEmail, undefined);
    assert.strictEqual(normalized.razorpayPaymentId, undefined);
    assert.strictEqual(normalized.razorpayOrderId, undefined);
    assert.strictEqual(normalized.workerId, undefined);

    // 8.2 Test TV feed delivery to real WebSocket TV client
    const wsTV = await connectClient(baseUrl);
    await wsTV.waitForMessage((m) => m.type === 'connection_established');

    realtimeBroadcastEngine.broadcastTransaction(normalized);
    const receivedTx = await wsTV.waitForMessage((m) => m.event === 'successful_transaction');
    assert.strictEqual(receivedTx.data.transactionNumber, 'TXN-20261024-001');
    assert.strictEqual(receivedTx.data.customerName, 'Valued Customer');

    wsTV.close();

    // 8.3 Test configurable TV auth policy: When PONDFISH_TV_AUTH_REQUIRED=true, anonymous TV access is blocked
    process.env.PONDFISH_TV_AUTH_REQUIRED = 'true';
    try {
      const wsGatedAnon = await connectClient(baseUrl);
      const initGated = await wsGatedAnon.waitForMessage((m) => m.type === 'connection_established');
      assert.strictEqual(initGated.channels.length, 0, 'Anonymous has no default channels when TV auth required');

      wsGatedAnon.send(JSON.stringify({ type: 'subscribe', channel: 'tv:transactions' }));
      const gatedErr = await wsGatedAnon.waitForMessage((m) => m.code === 'UNAUTHORIZED_CHANNEL');
      assert.strictEqual(gatedErr.channel, 'tv:transactions');
      wsGatedAnon.close();
    } finally {
      delete process.env.PONDFISH_TV_AUTH_REQUIRED;
    }
  });

  // ---------------------------------------------------------------------------
  // 9. Credential Hygiene: Reject Admin API Secret in URL Query Parameters
  // ---------------------------------------------------------------------------
  await t.test('9. Credential hygiene: Admin API secrets rejected in query strings and accepted only via headers', async () => {
    // Attempt connection passing ADMIN_SECRET in query parameter ?token=<ADMIN_SECRET>
    const wsQuery = await connectClient(baseUrl, `/api/v1/realtime?token=${TEST_ADMIN_SECRET}`);
    const initQuery = await wsQuery.waitForMessage((m) => m.type === 'connection_established');
    // Must NOT authenticate as ADMIN! API key is forbidden in query string.
    assert.strictEqual(initQuery.authenticated, false, 'API secret in query string must NOT authenticate');
    assert.strictEqual(initQuery.role, 'ANONYMOUS');
    wsQuery.close();

    // Authenticate passing ADMIN_SECRET via secure HTTP header x-admin-key
    const wsHeader = await connectClient(baseUrl, '/api/v1/realtime', {
      headers: { 'x-admin-key': TEST_ADMIN_SECRET },
    });
    const initHeader = await wsHeader.waitForMessage((m) => m.type === 'connection_established');
    assert.strictEqual(initHeader.authenticated, true);
    assert.strictEqual(initHeader.role, 'ADMIN', 'x-admin-key HTTP upgrade header successfully authenticates as ADMIN');
    wsHeader.close();
  });
});
