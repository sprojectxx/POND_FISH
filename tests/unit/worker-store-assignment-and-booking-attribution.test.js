/**
 * Authoritative Unit Test Suite:
 * Phase 4 Security Remediation — Worker Store Assignment & Booking Attribution
 *
 * Traceability:
 * - BLOCKER 1: Stale worker token can restore a removed store assignment.
 * - BLOCKER 2: New bookings do not persist store attribution.
 * - PondFish Phase 4 Independent Review Requirements
 */

const assert = require('assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const workerEngine = require('../../lib/engines/worker');
const bookingEngine = require('../../lib/engines/booking');
const bookingRepository = require('../../lib/db/repositories/bookingRepository');
const qrVerificationEngine = require('../../lib/engines/qr-verification');
const { getJwtSecret } = require('../../lib/auth/admin-auth');
const pg = require('pg');

const TEST_JWT_SECRET = 'pondfish-phase4-test-secure-jwt-secret-key-2026';
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.ALLOW_TEST_SESSION_FALLBACK = 'true';

let testSessionsRegistry = {};

function registerTestWorkerSession(worker, sessionId) {
  testSessionsRegistry[sessionId] = {
    workerId: worker.id,
    name: worker.name,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };
  return workerEngine.generateWorkerSessionToken(worker, sessionId);
}

// Helper to mock PostgreSQL pool.query
async function withMockPgClient(queryHandler, callback) {
  const origDbUrl = process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock_db';
  }

  const origQuery = pg.Pool.prototype.query;
  const origClientQuery = pg.Client.prototype.query;
  const origPoolConnect = pg.Pool.prototype.connect;

  const mockQuery = async (sql, params) => {
    const sqlStr = typeof sql === 'string' ? sql : sql?.text || '';
    if (sqlStr.includes('FROM settings') && (params?.[0] === 'worker_sessions' || params?.[0] === 'worker_session_registry' || params?.[0] === 'worker_active_sessions')) {
      return { rows: [{ value: JSON.stringify(testSessionsRegistry) }] };
    }
    if (sqlStr.includes('UPDATE settings') && (params?.[1] === 'worker_sessions' || params?.[1] === 'worker_session_registry' || params?.[1] === 'worker_active_sessions')) {
      return { rows: [{ value: JSON.stringify(testSessionsRegistry) }] };
    }
    return queryHandler(sqlStr, params);
  };

  const mockClient = {
    query: mockQuery,
    release: () => {},
  };

  pg.Pool.prototype.query = mockQuery;
  pg.Client.prototype.query = mockQuery;
  pg.Pool.prototype.connect = async function () {
    return mockClient;
  };

  try {
    return await callback();
  } finally {
    pg.Pool.prototype.query = origQuery;
    pg.Client.prototype.query = origClientQuery;
    pg.Pool.prototype.connect = origPoolConnect;
    if (origDbUrl !== undefined) process.env.DATABASE_URL = origDbUrl;
    else delete process.env.DATABASE_URL;
  }
}

// Dynamic route loader adhering to repository conventions
function loadRoute(relPath) {
  const fullPath = path.resolve(__dirname, relPath);
  let code = fs.readFileSync(fullPath, 'utf8');

  code = code.replace(/import\s*\{\s*NextResponse\s*\}\s*from\s*['"]next\/server(\.js)?['"];?/g, 'const { NextResponse } = require("next/server");');
  code = code.replace(/import\s*\{\s*([a-zA-Z0-9_,\s]+)\s*\}\s*from\s*['"]([^'"]+)['"];?/g, 'const { $1 } = require("$2");');
  code = code.replace(/export\s+const\s+dynamic\s*=\s*['"][^'"]+['"];?/g, '');
  code = code.replace(/export\s+async\s+function\s+([a-zA-Z0-9_]+)/g, 'exports.$1 = async function $1');

  const m = { exports: {} };
  const customRequire = (specifier) => {
    if (specifier === 'next/server') {
      return {
        NextResponse: {
          json: (body, init = {}) => ({
            status: init.status || 200,
            json: async () => body,
            body,
            headers: init.headers || {},
          }),
        },
      };
    }
    const resolved = path.resolve(path.dirname(fullPath), specifier);
    return require(resolved);
  };

  const fn = new Function('require', 'module', 'exports', '__dirname', '__filename', code);
  fn(customRequire, m, m.exports, path.dirname(fullPath), fullPath);
  return m.exports;
}

test('Phase 4 Blocker 1 & 2 Security Remediation Suite', async (t) => {

  // ==========================================================================
  // BLOCKER 1: Stale Worker Token Store Assignment
  // ==========================================================================

  await t.test('1.1 Worker with valid token and persisted Store A assignment can access Store A resources', async () => {
    const workerId = 'a0000000-0000-4000-8000-000000000001';
    const sessionId = 'session-uuid-1';
    const token = registerTestWorkerSession({ id: workerId, name: 'Worker One', store_id: 'store_a' }, sessionId);

    // Mock DB returning worker with store_id: 'store_a'
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM workers')) {
        return {
          rows: [{
            id: workerId,
            name: 'Worker One',
            mobile_number: '9876543210',
            store_id: 'store_a',
            active: true,
            is_active: true,
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const session = await workerEngine.verifyWorkerSessionAsync(token);
      assert.strictEqual(session.storeId, 'store_a');
      assert.strictEqual(session.worker.store_id, 'store_a');
      assert.strictEqual(session.worker.storeId, 'store_a');
    });
  });

  await t.test('1.2 Removing database store_id causes session to fail closed with null store, even if JWT contains Store A', async () => {
    const workerId = 'a0000000-0000-4000-8000-000000000002';
    const sessionId = 'session-uuid-2';
    const token = registerTestWorkerSession({ id: workerId, name: 'Worker Two', store_id: 'store_a' }, sessionId);

    // Mock DB returning worker with store_id: NULL (assignment removed)
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM workers')) {
        return {
          rows: [{
            id: workerId,
            name: 'Worker Two',
            mobile_number: '9876543211',
            store_id: null, // Removed store assignment!
            active: true,
            is_active: true,
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const session = await workerEngine.verifyWorkerSessionAsync(token);
      // Authoritative database record MUST override JWT claim
      assert.strictEqual(session.storeId, null, 'Must NOT fall back to decoded.storeId');
      assert.strictEqual(session.worker.store_id, null);
      assert.strictEqual(session.worker.storeId, null);

      // Now verify that any store-scoped operation fails closed
      await assert.rejects(
        async () => {
          await workerEngine.completeBookingOrder({
            bookingId: 'b0000000-0000-4000-8000-000000000001',
            workerId,
            workerStoreId: session.storeId, // null!
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'STORE_MISMATCH');
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });
  });

  await t.test('1.3 Reassigning worker from Store A to Store B prevents old token from authorizing Store A', async () => {
    const workerId = 'a0000000-0000-4000-8000-000000000003';
    const sessionId = 'session-uuid-3';
    // Old JWT contains Store A
    const oldToken = registerTestWorkerSession({ id: workerId, name: 'Worker Three', store_id: 'store_a' }, sessionId);

    // Database now has worker assigned to Store B
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM workers')) {
        return {
          rows: [{
            id: workerId,
            name: 'Worker Three',
            mobile_number: '9876543212',
            store_id: 'store_b', // Reassigned to Store B!
            active: true,
            is_active: true,
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const session = await workerEngine.verifyWorkerSessionAsync(oldToken);
      // Resolved store is Store B, not Store A
      assert.strictEqual(session.storeId, 'store_b');
      assert.strictEqual(session.worker.store_id, 'store_b');

      // Attempting to complete a Store A booking MUST fail closed
      await withMockPgClient(async (sql, params) => {
        if (sql.includes('FROM bookings')) {
          return {
            rows: [{
              id: 'b0000000-0000-4000-8000-00000000000a',
              booking_code: 'BK-STORE-A',
              customer_id: 'cust-1',
              customer_name: 'Customer One',
              customer_phone: '9876543210',
              store_id: 'store_a',
              status: 'CONFIRMED',
            }],
          };
        }
        return { rows: [] };
      }, async () => {
        await assert.rejects(
          async () => {
            await workerEngine.completeBookingOrder({
              bookingId: 'b0000000-0000-4000-8000-00000000000a',
              workerId,
              workerStoreId: session.storeId, // store_b
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'STORE_MISMATCH');
            assert.strictEqual(err.status, 403);
            return true;
          }
        );
      });
    });
  });

  await t.test('1.4 Missing or blank store assignments never fall back to process.env.PONDFISH_STORE_ID or main_store', async () => {
    const workerId = 'a0000000-0000-4000-8000-000000000004';
    const sessionId = 'session-uuid-4';
    process.env.PONDFISH_STORE_ID = 'environment_store_override';

    const token = registerTestWorkerSession({ id: workerId, name: 'Worker Four' }, sessionId);

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM workers')) {
        return {
          rows: [{
            id: workerId,
            name: 'Worker Four',
            mobile_number: '9876543213',
            store_id: '   ', // Blank store ID!
            active: true,
            is_active: true,
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const session = await workerEngine.verifyWorkerSessionAsync(token);
      assert.strictEqual(session.storeId, null, 'Must sanitize blank store to null');
      assert.notStrictEqual(session.storeId, 'environment_store_override');
      assert.notStrictEqual(session.storeId, 'main_store');
    });

    delete process.env.PONDFISH_STORE_ID;
  });

  await t.test('1.5 Worker routes reject requests when worker has no authoritative store assignment (fail closed 403)', async () => {
    const workerDetailsRoute = loadRoute('../../app/api/v1/worker/bookings/[id]/route.js');
    const workerStatusRoute = loadRoute('../../app/api/v1/worker/bookings/[id]/status/route.js');
    const workerTxRoute = loadRoute('../../app/api/v1/worker/transactions/[id]/route.js');
    const workerTodayRoute = loadRoute('../../app/api/v1/worker/bookings/today/route.js');
    const workerSearchRoute = loadRoute('../../app/api/v1/worker/bookings/search/route.js');
    const workerCompleteRoute = loadRoute('../../app/api/v1/worker/bookings/[id]/complete/route.js');
    const workerCustomersRoute = loadRoute('../../app/api/v1/worker/customers/route.js');

    const workerId = 'a0000000-0000-4000-8000-000000000005';
    const sessionId = 'session-no-store';
    const token = registerTestWorkerSession({ id: workerId, name: 'Worker Unassigned' }, sessionId);

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM workers')) {
        return {
          rows: [{
            id: workerId,
            name: 'Worker Unassigned',
            mobile_number: '9876543214',
            store_id: null,
            active: true,
            is_active: true,
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const req = {
        headers: {
          get: (h) => (h === 'authorization' ? `Bearer ${token}` : null),
        },
        url: 'http://localhost/api/v1/worker/bookings/b0000000-0000-4000-8000-000000000001',
      };

      // 1. GET /api/v1/worker/bookings/[id]
      const resDetails = await workerDetailsRoute.GET(req, { params: { id: 'b0000000-0000-4000-8000-000000000001' } });
      const bodyDetails = await resDetails.json();
      assert.strictEqual(resDetails.status, 403);
      assert.strictEqual(bodyDetails.error.code, 'STORE_MISMATCH');

      // 2. PATCH /api/v1/worker/bookings/[id]/status
      const reqPatch = {
        ...req,
        json: async () => ({ status: 'PENDING_COLLECTION' }),
      };
      const resStatus = await workerStatusRoute.PATCH(reqPatch, { params: { id: 'b0000000-0000-4000-8000-000000000001' } });
      assert.strictEqual(resStatus.status, 403);
      const bodyStatus = await resStatus.json();
      assert.strictEqual(bodyStatus.error.code, 'STORE_MISMATCH');

      // 3. GET /api/v1/worker/transactions/[id]
      const resTx = await workerTxRoute.GET(req, { params: { id: 'tx000000-0000-4000-8000-000000000001' } });
      assert.strictEqual(resTx.status, 403);
      const bodyTx = await resTx.json();
      assert.strictEqual(bodyTx.error.code, 'STORE_MISMATCH');

      // 4. GET /api/v1/worker/bookings/today (Booking Queue)
      const resToday = await workerTodayRoute.GET({ ...req, url: 'http://localhost/api/v1/worker/bookings/today' });
      assert.strictEqual(resToday.status, 403);
      const bodyToday = await resToday.json();
      assert.strictEqual(bodyToday.error.code, 'STORE_MISMATCH');

      // 5. GET /api/v1/worker/bookings/search (Booking Search)
      const resSearch = await workerSearchRoute.GET({ ...req, url: 'http://localhost/api/v1/worker/bookings/search?q=test' });
      assert.strictEqual(resSearch.status, 403);
      const bodySearch = await resSearch.json();
      assert.strictEqual(bodySearch.error.code, 'STORE_MISMATCH');

      // 6. POST /api/v1/worker/bookings/[id]/complete
      const resComplete = await workerCompleteRoute.POST(req, { params: { id: 'b0000000-0000-4000-8000-000000000001' } });
      assert.strictEqual(resComplete.status, 403);
      const bodyComplete = await resComplete.json();
      assert.strictEqual(bodyComplete.error.code, 'STORE_MISMATCH');

      // 7. GET /api/v1/worker/customers
      const resCust = await workerCustomersRoute.GET({ ...req, url: 'http://localhost/api/v1/worker/customers?q=John' });
      assert.strictEqual(resCust.status, 403);
      const bodyCust = await resCust.json();
      assert.strictEqual(bodyCust.error.code, 'STORE_MISMATCH');
    });
  });

  await t.test('1.6 Repository store-scoped methods fail closed when store scope is absent and prevent cross-store access', async () => {
    // 1. Missing or blank storeId in listWorkerBookingsToday fails closed
    await assert.rejects(
      async () => {
        await bookingRepository.listWorkerBookingsToday({ storeId: null });
      },
      (err) => {
        assert.strictEqual(err.code, 'STORE_MISMATCH');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await bookingRepository.listWorkerBookingsToday({ storeId: '   ' });
      },
      (err) => {
        assert.strictEqual(err.code, 'STORE_MISMATCH');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );

    // 2. Missing or blank storeId in searchWorkerBookings fails closed
    await assert.rejects(
      async () => {
        await bookingRepository.searchWorkerBookings('test', { storeId: null });
      },
      (err) => {
        assert.strictEqual(err.code, 'STORE_MISMATCH');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await bookingRepository.searchWorkerBookings('test', { storeId: '' });
      },
      (err) => {
        assert.strictEqual(err.code, 'STORE_MISMATCH');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );

    // 3. Worker engine queue and search helpers fail closed when storeId is absent
    await assert.rejects(
      async () => {
        await workerEngine.getTodayBookingsQueue({ storeId: null });
      },
      (err) => {
        assert.strictEqual(err.code, 'STORE_MISMATCH');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await workerEngine.searchBookings({ query: 'test', storeId: null });
      },
      (err) => {
        assert.strictEqual(err.code, 'STORE_MISMATCH');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );

    // 4. Verifying cross-store scoping in repository: Store A query strictly filters by Store A
    let capturedCountsParams = null;
    let capturedListParams = null;
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('COUNT(*) FILTER') && sql.includes('WHERE store_id = $1')) {
        capturedCountsParams = params;
        return {
          rows: [{
            confirmed_count: 5,
            pending_collection_count: 2,
            completed_today_count: 3,
            expired_count: 0,
            total_count: 10,
          }],
        };
      }
      if (sql.includes('FROM bookings b') && sql.includes('WHERE b.store_id = $1')) {
        capturedListParams = params;
        return {
          rows: [{
            id: 'b-store-a-1',
            store_id: 'store_a',
            booking_code: 'BK-A-01',
            status: 'CONFIRMED',
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const res = await bookingRepository.listWorkerBookingsToday({ storeId: 'store_a' });
      assert.strictEqual(capturedCountsParams[0], 'store_a', 'Counts must be strictly scoped to store_a');
      assert.strictEqual(capturedListParams[0], 'store_a', 'List query must be strictly scoped to store_a');
      assert.strictEqual(res.counts.total, 10);
      assert.strictEqual(res.bookings.length, 1);
      assert.strictEqual(res.bookings[0].store_id, 'store_a');
    });
  });

  // ==========================================================================
  // BLOCKER 2: Booking Store Attribution Persistence
  // ==========================================================================

  await t.test('2.1 Newly created booking derives authoritative store from settings and persists in bookings.store_id', async () => {
    let insertedStoreId = null;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM settings') && (sql.includes('store_info') || params?.[0] === 'store_info')) {
        return {
          rows: [{
            key: 'store_info',
            value: { storeId: 'store_authority_main', name: 'Main Hub' },
          }],
        };
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 250 }] };
      }
      if (sql.includes('FROM inventory')) {
        return { rows: [{ id: 'inv-1', fish_id: params[0], available_quantity: 100, reserved_quantity: 0, physical_quantity: 100 }] };
      }
      if (sql.includes('UPDATE inventory')) {
        return { rows: [{ id: 'inv-1', fish_id: params[1], available_quantity: 98, reserved_quantity: 2 }] };
      }
      if (sql.includes('INSERT INTO inventory_ledger')) {
        return { rows: [] };
      }
      if (sql.includes('SELECT is_active FROM subscription_plans')) {
        return { rows: [{ is_active: true }] };
      }
      if (sql.includes('INSERT INTO bookings')) {
        // Parameter 10 is store_id
        insertedStoreId = params[9];
        return {
          rows: [{
            id: 'b0000000-0000-4000-8000-000000000001',
            customer_id: params[0],
            booking_code: params[1],
            store_id: insertedStoreId,
            status: 'CONFIRMED',
            total_amount: 500,
            sub_credit_used: 500,
            pickup_date: '2026-10-26',
            created_at: new Date().toISOString(),
          }],
        };
      }
      if (sql.includes('INSERT INTO booking_items')) {
        return { rows: [] };
      }
      if (sql.includes('FROM bookings') || (sql.includes('SELECT') && sql.includes('bookings'))) {
        return {
          rows: [{
            id: 'b0000000-0000-4000-8000-000000000001',
            customer_id: 'c0000000-0000-4000-8000-000000000001',
            booking_code: 'BK-001',
            store_id: insertedStoreId || 'store_authority_main',
            status: 'CONFIRMED',
            total_amount: 500,
            sub_credit_used: 500,
            pickup_date: '2026-10-26',
            created_at: new Date().toISOString(),
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const booking = await bookingEngine.createBooking({
        customerId: 'c0000000-0000-4000-8000-000000000001',
        pickupDate: '2026-10-26',
        checkoutSnapshot: {
          items: [{ fishId: 'f0000000-0000-4000-8000-000000000001', name: 'Catla', quantityKg: 2.0, pricePerKg: 250, subtotal: 500 }],
          summary: { totalAmount: 500, totalQuantity: 2 },
          subscriptionCoverage: { subCreditUsed: 500, extraPayableAmount: 0 },
          feeCalc: { paymentFees: 0, platformFee: 0, gstOnFees: 0, finalPayable: 0 },
        },
      });

      assert.ok(booking);
      assert.strictEqual(booking.store_id, 'store_authority_main', 'Booking returned must contain persisted store_id');
      assert.strictEqual(insertedStoreId, 'store_authority_main', 'INSERT query must persist clean authoritative store_id');
    });
  });

  await t.test('2.2 Explicit client storeId is validated against authorized stores and persisted', async () => {
    let insertedStoreId = null;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM settings')) {
        return {
          rows: [
            { key: 'active_store_id', value: JSON.stringify('store_hub_north') },
            { key: 'authorized_stores', value: ['store_hub_north', 'store_hub_south'] },
          ],
        };
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM inventory')) {
        return { rows: [{ id: 'inv-1', fish_id: params[0], available_quantity: 100, reserved_quantity: 0, physical_quantity: 100 }] };
      }
      if (sql.includes('UPDATE inventory')) {
        return { rows: [{ id: 'inv-1', fish_id: params[1], available_quantity: 98, reserved_quantity: 2 }] };
      }
      if (sql.includes('INSERT INTO inventory_ledger')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO bookings')) {
        insertedStoreId = params[9];
        return {
          rows: [{
            id: 'b0000000-0000-4000-8000-000000000002',
            customer_id: params[0],
            booking_code: params[1],
            store_id: insertedStoreId,
            status: 'CONFIRMED',
            total_amount: 300,
            sub_credit_used: 300,
            pickup_date: '2026-10-26',
            created_at: new Date().toISOString(),
          }],
        };
      }
      if (sql.includes('INSERT INTO booking_items')) {
        return { rows: [] };
      }
      if (sql.includes('FROM bookings') || (sql.includes('SELECT') && sql.includes('bookings'))) {
        return {
          rows: [{
            id: 'b0000000-0000-4000-8000-000000000002',
            customer_id: 'c0000000-0000-4000-8000-000000000002',
            booking_code: 'BK-002',
            store_id: insertedStoreId || 'store_hub_north',
            status: 'CONFIRMED',
            total_amount: 300,
            sub_credit_used: 300,
            pickup_date: '2026-10-26',
            created_at: new Date().toISOString(),
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const booking = await bookingEngine.createBooking({
        customerId: 'c0000000-0000-4000-8000-000000000002',
        pickupDate: '2026-10-26',
        storeId: 'store_hub_north',
        checkoutSnapshot: {
          items: [{ fishId: 'f0000000-0000-4000-8000-000000000001', name: 'Catla', quantityKg: 1.0, pricePerKg: 300, subtotal: 300 }],
          summary: { totalAmount: 300, totalQuantity: 1 },
          subscriptionCoverage: { subCreditUsed: 300, extraPayableAmount: 0 },
          feeCalc: { paymentFees: 0, platformFee: 0, gstOnFees: 0, finalPayable: 0 },
        },
      });

      assert.strictEqual(insertedStoreId, 'store_hub_north');
      assert.strictEqual(booking.store_id, 'store_hub_north');
    });
  });

  await t.test('2.3 Invalid or fabricated client storeId is rejected with 400 INVALID_STORE_ID', async () => {
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM settings')) {
        return {
          rows: [{
            key: 'store_info',
            value: { storeId: 'store_authority_main' },
          }],
        };
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000003',
            pickupDate: '2026-10-26',
            storeId: 'fake_non_existent_store',
            checkoutSnapshot: {
              items: [{ fishId: 'f0000000-0000-4000-8000-000000000001', name: 'Catla', quantityKg: 1.0, pricePerKg: 300, subtotal: 300 }],
              summary: { totalAmount: 300, totalQuantity: 1 },
              subscriptionCoverage: { subCreditUsed: 300, extraPayableAmount: 0 },
              feeCalc: { paymentFees: 0, platformFee: 0, gstOnFees: 0, finalPayable: 0 },
            },
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });
  });

  await t.test('2.4 Booking QR verification and completion succeed at assigned store, fail closed at another store', async () => {
    const bookingId = 'b0000000-0000-4000-8000-000000000011';
    const signedQrData = qrVerificationEngine.generateBookingQrData({
      id: bookingId,
      booking_code: 'BK-QR-ALPHA',
      customer_id: 'cust-1',
      store_id: 'store_alpha',
    });

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM bookings')) {
        return {
          rows: [{
            id: bookingId,
            booking_code: 'BK-QR-ALPHA',
            customer_id: 'cust-1',
            customer_name: 'John Doe',
            customer_phone: '9876543210',
            store_id: 'store_alpha',
            status: 'PENDING_COLLECTION',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          }],
        };
      }
      if (sql.includes('FROM booking_items')) {
        return { rows: [] };
      }
      return { rows: [] };
    }, async () => {
      // 1. Worker at Store Alpha succeeds
      const result = await workerEngine.verifyBookingQr(signedQrData, { workerStoreId: 'store_alpha' });
      assert.strictEqual(result.id, bookingId);
      assert.strictEqual(result.store_id, 'store_alpha');

      // 2. Worker at Store Beta is rejected with 403 STORE_MISMATCH
      await assert.rejects(
        async () => {
          await workerEngine.verifyBookingQr(signedQrData, { workerStoreId: 'store_beta' });
        },
        (err) => {
          assert.strictEqual(err.code, 'STORE_MISMATCH');
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });
  });

  await t.test('2.5 Untrusted QR payload store ID is ignored in favor of database booking.store_id', async () => {
    const bookingId = 'b0000000-0000-4000-8000-000000000022';
    // Attacker crafts QR payload claiming storeId is 'store_claimed'
    const tamperedQrData = qrVerificationEngine.generateBookingQrData({
      id: bookingId,
      booking_code: 'BK-TAMPER',
      customer_id: 'cust-1',
      store_id: 'store_claimed',
    });

    // But authoritative database record has store_id: 'store_real'
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM bookings')) {
        return {
          rows: [{
            id: bookingId,
            booking_code: 'BK-TAMPER',
            customer_id: 'cust-1',
            customer_name: 'John Doe',
            customer_phone: '9876543210',
            store_id: 'store_real',
            status: 'PENDING_COLLECTION',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      // Worker at 'store_claimed' MUST be rejected because DB has 'store_real'
      await assert.rejects(
        async () => {
          await workerEngine.verifyBookingQr(tamperedQrData, { workerStoreId: 'store_claimed' });
        },
        (err) => {
          assert.strictEqual(err.code, 'STORE_MISMATCH');
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });
  });

  await t.test('2.6 Unassigned / historical booking with null store_id fails closed on verification and completion', async () => {
    const bookingId = 'b0000000-0000-4000-8000-000000000033';
    const signedQrData = qrVerificationEngine.generateBookingQrData({
      id: bookingId,
      booking_code: 'BK-HISTORICAL',
      customer_id: 'cust-hist',
    });

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM bookings')) {
        return {
          rows: [{
            id: bookingId,
            booking_code: 'BK-HISTORICAL',
            customer_id: 'cust-hist',
            customer_name: 'Historical Cust',
            customer_phone: '9876543210',
            store_id: null, // Historical booking with unassigned store!
            status: 'CONFIRMED',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      // Verification fails closed
      await assert.rejects(
        async () => {
          await workerEngine.verifyBookingQr(signedQrData, { workerStoreId: 'store_main' });
        },
        (err) => {
          assert.strictEqual(err.code, 'STORE_MISMATCH');
          assert.strictEqual(err.status, 403);
          return true;
        }
      );

      // Completion fails closed
      await assert.rejects(
        async () => {
          await workerEngine.completeBookingOrder({
            bookingId,
            workerId: 'worker-1',
            workerStoreId: 'store_main',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'STORE_MISMATCH');
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });
  });

  await t.test('2.7 Repeated completion attempt on already completed booking is rejected with 409 Conflict', async () => {
    const bookingId = 'b0000000-0000-4000-8000-000000000044';

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM bookings')) {
        return {
          rows: [{
            id: bookingId,
            booking_code: 'BK-COMPLETED',
            customer_id: 'cust-1',
            customer_name: 'Cust Name',
            customer_phone: '9876543210',
            store_id: 'store_alpha',
            status: 'COMPLETED', // Already completed!
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await workerEngine.completeBookingOrder({
            bookingId,
            workerId: 'worker-1',
            workerStoreId: 'store_alpha',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'BOOKING_ALREADY_COMPLETED');
          assert.strictEqual(err.status, 409);
          return true;
        }
      );
    });
  });

  await t.test('2.8 Client cannot choose an unauthorized store merely because it appears in workers or historical bills', async () => {
    let queriedWorkers = false;
    let queriedBills = false;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM settings')) {
        return {
          rows: [{
            key: 'active_store_id',
            value: 'authorized_active_store',
          }],
        };
      }
      if (sql.includes('FROM workers')) {
        queriedWorkers = true;
        return { rows: [{ id: 'worker-rogue', store_id: 'rogue_store' }] };
      }
      if (sql.includes('FROM bills')) {
        queriedBills = true;
        return { rows: [{ id: 'bill-rogue', store_id: 'rogue_store' }] };
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000004',
            pickupDate: '2026-10-26',
            storeId: 'rogue_store',
            checkoutSnapshot: {
              items: [{ fishId: 'f0000000-0000-4000-8000-000000000001', name: 'Catla', quantityKg: 1.0, pricePerKg: 300, subtotal: 300 }],
              summary: { totalAmount: 300, totalQuantity: 1 },
              subscriptionCoverage: { subCreditUsed: 300, extraPayableAmount: 0 },
              feeCalc: { paymentFees: 0, platformFee: 0, gstOnFees: 0, finalPayable: 0 },
            },
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
      assert.strictEqual(queriedWorkers, false, 'Must not query workers table to validate store');
      assert.strictEqual(queriedBills, false, 'Must not query bills table to validate store');
    });
  });

  // ==========================================================================
  // BLOCKER 3: Authoritative Store Resolution & Fail-Closed Scoping Suite
  // ==========================================================================

  const testSnapshot = {
    items: [{ fishId: 'f0000000-0000-4000-8000-000000000001', name: 'Catla', quantityKg: 1.0, pricePerKg: 300, subtotal: 300 }],
    summary: { totalAmount: 300, totalQuantity: 1 },
    subscriptionCoverage: { subCreditUsed: 300, extraPayableAmount: 0 },
    feeCalc: { paymentFees: 0, platformFee: 0, gstOnFees: 0, finalPayable: 0 },
  };

  await t.test('3.1 active_store_id = store_A with store_info = store_B rejects request for store_B', async () => {
    let mutationAttempted = false;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
        mutationAttempted = true;
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM settings')) {
        return {
          rows: [
            { key: 'active_store_id', value: 'store_A' },
            { key: 'store_info', value: JSON.stringify({ storeId: 'store_B', name: 'Conflicting Store B' }) },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      // 1. Direct resolver test: must reject store_B
      await assert.rejects(
        async () => {
          await bookingEngine.resolveAuthoritativeBookingStore(null, 'store_B');
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );

      // 2. Direct resolver test: store_A is authoritative
      const resolved = await bookingEngine.resolveAuthoritativeBookingStore(null, 'store_A');
      assert.strictEqual(resolved, 'store_A');

      // 3. End-to-end createBooking: requesting store_B must be rejected and prevent mutations
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            storeId: 'store_B',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false, 'No downstream mutations when requesting conflicting store_B');
    });
  });

  await t.test('3.2 active_store_id = store_A with store_destination = store_B rejects request for store_B', async () => {
    let mutationAttempted = false;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
        mutationAttempted = true;
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM settings')) {
        return {
          rows: [
            { key: 'active_store_id', value: 'store_A' },
            { key: 'store_destination', value: JSON.stringify({ storeId: 'store_B', name: 'Destination B' }) },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            storeId: 'store_B',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false, 'No downstream mutations when store_destination specifies conflicting store_B');
    });
  });

  await t.test('3.3 A registry entry explicitly marked inactive cannot authorize a store', async () => {
    let mutationAttempted = false;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
        mutationAttempted = true;
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM settings')) {
        return {
          rows: [
            { key: 'active_store_id', value: 'store_A' },
            {
              key: 'authorized_stores',
              value: JSON.stringify([
                { storeId: 'store_inactive_1', is_active: false, status: 'INACTIVE' },
                { storeId: 'store_inactive_2', active: false },
              ]),
            },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            storeId: 'store_inactive_1',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false, 'Inactive registry store must not trigger mutations');
    });
  });

  await t.test('3.4 Plain string registry entry cannot enable multi-store access unless verified project policy permits it', async () => {
    let mutationAttempted = false;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
        mutationAttempted = true;
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM settings')) {
        return {
          rows: [
            { key: 'active_store_id', value: 'store_A' },
            { key: 'authorized_stores', value: JSON.stringify(['store_A', 'store_plain_secondary']) },
            { key: 'store_registry', value: JSON.stringify(['store_plain_tertiary']) },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      // 1. store_plain_secondary is rejected
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            storeId: 'store_plain_secondary',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false);

      // 2. store_plain_tertiary is rejected
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            storeId: 'store_plain_tertiary',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false);
    });
  });

  await t.test('3.5 Database error while reading settings causes fail-closed server error (500)', async () => {
    let mutationAttempted = false;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
        mutationAttempted = true;
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('blocked_customer_ids')) {
        return { rows: [] };
      }
      if (sql.includes('FROM settings')) {
        throw new Error('Connection lost: could not connect to PostgreSQL server');
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            storeId: 'store_A',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'STORE_CONFIG_UNAVAILABLE');
          assert.strictEqual(err.status, 500);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false, 'No mutations when database query fails');
    });
  });

  await t.test('3.6 Malformed JSON or contradictory authoritative settings cannot trigger fallback authorization', async () => {
    let mutationAttempted = false;

    // Sub-case A: Malformed JSON in active_store_id
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
        mutationAttempted = true;
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM settings')) {
        return {
          rows: [{ key: 'active_store_id', value: '{"storeId": broken json' }],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'STORE_CONFIG_INVALID');
          assert.strictEqual(err.status, 500);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false);
    });

    // Sub-case B: Contradictory settings without primary active_store_id
    mutationAttempted = false;
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
        mutationAttempted = true;
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM settings')) {
        return {
          rows: [
            { key: 'store_info', value: JSON.stringify({ storeId: 'store_alpha' }) },
            { key: 'store_destination', value: JSON.stringify({ storeId: 'store_beta' }) },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'STORE_CONFIG_AMBIGUOUS');
          assert.strictEqual(err.status, 500);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false, 'Contradictory settings must not allow booking mutations');
    });

    // Sub-case C: Blank active_store_id setting fails closed
    mutationAttempted = false;
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
        mutationAttempted = true;
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM settings')) {
        return {
          rows: [{ key: 'active_store_id', value: '    ' }],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'STORE_CONFIG_INVALID');
          assert.strictEqual(err.status, 500);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false);
    });
  });

  await t.test('3.7 Valid configured Single-Store request continues to work', async () => {
    let persistedStoreId = null;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM settings')) {
        return {
          rows: [{ key: 'active_store_id', value: JSON.stringify('store_single_mvp') }],
        };
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM inventory')) {
        return { rows: [{ id: 'inv-1', fish_id: params[0], available_quantity: 100, reserved_quantity: 0, physical_quantity: 100 }] };
      }
      if (sql.includes('UPDATE inventory')) {
        return { rows: [{ id: 'inv-1', fish_id: params[1], available_quantity: 99, reserved_quantity: 1 }] };
      }
      if (sql.includes('INSERT INTO inventory_ledger')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO bookings')) {
        persistedStoreId = params[9];
        return {
          rows: [{
            id: 'b-single-store-valid',
            customer_id: params[0],
            booking_code: params[1],
            store_id: persistedStoreId,
            status: 'CONFIRMED',
            total_amount: 300,
            sub_credit_used: 300,
            pickup_date: '2026-10-26',
            created_at: new Date().toISOString(),
          }],
        };
      }
      if (sql.includes('INSERT INTO booking_items')) {
        return { rows: [] };
      }
      if (sql.includes('FROM bookings') || (sql.includes('SELECT') && sql.includes('bookings'))) {
        return {
          rows: [{
            id: 'b-single-store-valid',
            customer_id: 'c0000000-0000-4000-8000-000000000001',
            booking_code: 'BK-VALID-1',
            store_id: persistedStoreId || 'store_single_mvp',
            status: 'CONFIRMED',
            total_amount: 300,
            sub_credit_used: 300,
            pickup_date: '2026-10-26',
            created_at: new Date().toISOString(),
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const booking = await bookingEngine.createBooking({
        customerId: 'c0000000-0000-4000-8000-000000000001',
        pickupDate: '2026-10-26',
        storeId: 'store_single_mvp',
        checkoutSnapshot: testSnapshot,
      });

      assert.ok(booking);
      assert.strictEqual(persistedStoreId, 'store_single_mvp');
      assert.strictEqual(booking.store_id, 'store_single_mvp');
    });
  });

  await t.test('3.8 Omitted optional store ID resolves to configured store only when authoritative configuration is valid', async () => {
    // Sub-case A: Valid configuration with omitted storeId resolves to configured store
    let persistedStoreId = null;
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM settings')) {
        return {
          rows: [{ key: 'active_store_id', value: JSON.stringify('store_configured_default') }],
        };
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM inventory')) {
        return { rows: [{ id: 'inv-1', fish_id: params[0], available_quantity: 100, reserved_quantity: 0, physical_quantity: 100 }] };
      }
      if (sql.includes('UPDATE inventory')) {
        return { rows: [{ id: 'inv-1', fish_id: params[1], available_quantity: 99, reserved_quantity: 1 }] };
      }
      if (sql.includes('INSERT INTO inventory_ledger')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO bookings')) {
        persistedStoreId = params[9];
        return {
          rows: [{
            id: 'b-omitted-valid',
            customer_id: params[0],
            booking_code: params[1],
            store_id: persistedStoreId,
            status: 'CONFIRMED',
            total_amount: 300,
            sub_credit_used: 300,
            pickup_date: '2026-10-26',
            created_at: new Date().toISOString(),
          }],
        };
      }
      if (sql.includes('INSERT INTO booking_items')) {
        return { rows: [] };
      }
      if (sql.includes('FROM bookings') || (sql.includes('SELECT') && sql.includes('bookings'))) {
        return {
          rows: [{
            id: 'b-omitted-valid',
            customer_id: 'c0000000-0000-4000-8000-000000000001',
            booking_code: 'BK-OMITTED-1',
            store_id: persistedStoreId || 'store_configured_default',
            status: 'CONFIRMED',
            total_amount: 300,
            sub_credit_used: 300,
            pickup_date: '2026-10-26',
            created_at: new Date().toISOString(),
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const booking = await bookingEngine.createBooking({
        customerId: 'c0000000-0000-4000-8000-000000000001',
        pickupDate: '2026-10-26',
        // storeId omitted
        checkoutSnapshot: testSnapshot,
      });

      assert.ok(booking);
      assert.strictEqual(persistedStoreId, 'store_configured_default');
      assert.strictEqual(booking.store_id, 'store_configured_default');
    });

    // Sub-case B: Omitted storeId when settings has NO store configured fails closed with STORE_NOT_CONFIGURED (500)
    let mutationAttempted = false;
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
        mutationAttempted = true;
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM settings')) {
        return { rows: [] }; // No store configured
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            // storeId omitted
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'STORE_NOT_CONFIGURED');
          assert.strictEqual(err.status, 500);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false, 'No mutations when store is not configured in settings');
    });
  });

  await t.test('3.9 Explicitly unauthorized or blank store ID is rejected', async () => {
    let mutationAttempted = false;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
        mutationAttempted = true;
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM settings')) {
        return {
          rows: [{ key: 'active_store_id', value: 'store_authority_main' }],
        };
      }
      return { rows: [] };
    }, async () => {
      // 1. Blank string rejected
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            storeId: '   ',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          assert.ok(err.message.includes('blank'));
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false);

      // 2. Non-string type rejected
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            storeId: 12345,
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          assert.ok(err.message.includes('non-empty string'));
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false);

      // 3. Unauthorized store ID rejected
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            storeId: 'unauthorized_hacker_store',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false);
    });
  });

  await t.test('3.10 Multi-store limitation policy: Non-configured multi-store requests fail closed while active store succeeds', async () => {
    let mutationAttempted = false;

    // Project documentation (PRD v2 and Admin UI spec) establishes Single-Store MVP.
    // Multi-store is out of scope / future scope, and no multi-store enablement policy exists.
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
        mutationAttempted = true;
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('FROM settings')) {
        return {
          rows: [
            { key: 'active_store_id', value: 'store_primary' },
            // Setting contains speculative multi-store registry
            { key: 'stores', value: JSON.stringify([{ id: 'store_branch_2', status: 'ACTIVE' }]) },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      // Attempting to route to speculative branch store fails closed under Single-Store policy
      await assert.rejects(
        async () => {
          await bookingEngine.createBooking({
            customerId: 'c0000000-0000-4000-8000-000000000001',
            pickupDate: '2026-10-26',
            storeId: 'store_branch_2',
            checkoutSnapshot: testSnapshot,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STORE_ID');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
      assert.strictEqual(mutationAttempted, false, 'Branch store request must not mutate state under single-store MVP');

      // Primary store succeeds
      const resolvedPrimary = await bookingEngine.resolveAuthoritativeBookingStore(null, 'store_primary');
      assert.strictEqual(resolvedPrimary, 'store_primary');
    });
  });
});
