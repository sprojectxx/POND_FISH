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
      if (resDetails.status !== 403) {
        console.log('[DEBUG 1.5] status:', resDetails.status, 'body:', bodyDetails);
      }
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
      if (sql.includes('SELECT 1 FROM workers WHERE store_id = $1')) {
        return { rows: [{ '?column?': 1 }] };
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
      if (sql.includes('SELECT value FROM settings WHERE key = $1') && params?.[0] === 'store_info') {
        return {
          rows: [{
            value: { storeId: 'store_authority_main' },
          }],
        };
      }
      if (sql.includes('FROM fish')) {
        return { rows: [{ id: params[0], name: 'Catla', physical_available: true, online_bookable: true, price_per_kg: 300 }] };
      }
      if (sql.includes('SELECT 1 FROM workers WHERE store_id = $1') || sql.includes('SELECT 1 FROM bills WHERE store_id = $1')) {
        return { rows: [] }; // No worker or bill matches requested store
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
});
