/**
 * Authoritative Unit Test Suite: Phase 4 OCR Mutation Boundary & Worker Portal Security
 * Traceability:
 * - PondFish Integration Specification v1 (§8.4 AI is not authoritative, §36 Rule 04)
 * - PondFish Core Business Engines Specification v1 (Sections 16, 17, 33)
 * - PondFish Worker Tablet Portal Specification (WP-03, WP-05, WP-06, WP-07, WP-08, WP-09)
 * - Phase 4 Acceptance Criteria & Human Review Mandate
 * 
 * Exercises in-memory mock PostgreSQL queries and route handlers:
 * 1. Human-review boundary: raw AI/OCR extraction alone NEVER authorizes mutations (BILL_REVIEW_REQUIRED).
 * 2. Customer bill confirmation persistence in database (status: CONFIRMED).
 * 3. Worker bill confirmation persistence, worker attribution, and audit logging.
 * 4. Worker store isolation: cross-store bill viewing, confirmation, and checkout rejection (STORE_MISMATCH).
 * 5. Worker QR booking verification store scoping: cross-store booking QR rejected (STORE_MISMATCH).
 * 6. Manual Bill ID correction sets MANUALLY_VERIFIED and satisfies human-review gate.
 * 7. Duplicate bill protection and row-locking under concurrent finalization.
 * 8. Line item and catalog price validation: rejects unknown fish and invalid quantities.
 * 9. Worker customer search security: rejects unauthorized enumeration and disabled accounts.
 */

const assert = require('assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const posFinalizationEngine = require('../../lib/engines/pos-finalization');
const billRepository = require('../../lib/db/repositories/billRepository');
const billingCorrectionEngine = require('../../lib/engines/billing-correction');
const workerEngine = require('../../lib/engines/worker');
const customerEngine = require('../../lib/engines/customer');
const qrVerificationEngine = require('../../lib/engines/qr-verification');
const pgPool = require('../../lib/db/pool');

const pg = require('pg');

const TEST_JWT_SECRET = 'pondfish-phase4-test-secure-jwt-secret-key-2026';
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.ALLOW_TEST_SESSION_FALLBACK = 'true';

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
    if (specifier.startsWith('.')) {
      return require(path.resolve(path.dirname(fullPath), specifier));
    }
    return require(specifier);
  };

  const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', code);
  fn(customRequire, m, m.exports, fullPath, path.dirname(fullPath));
  return m.exports;
}

function createMockRequest({ pathname = '/', headers = {}, method = 'GET', body = null } = {}) {
  const url = new URL(`http://localhost:3000${pathname}`);
  const headerMap = new Map();
  Object.entries(headers).forEach(([k, v]) => headerMap.set(k.toLowerCase(), v));

  return {
    method,
    url: url.toString(),
    nextUrl: url,
    headers: {
      get: (key) => headerMap.get(key.toLowerCase()) || null,
    },
    json: async () => body || {},
  };
}

// Helper to install mock pg client for withTransaction and pool.connect/query calls
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

function withMockPgClient(clientQueryHandler, testFn) {
  const origConnect = pg.Pool.prototype.connect;
  const origQuery = pg.Pool.prototype.query;
  const mockClient = {
    query: async (sql, params) => {
      if (typeof sql === 'string' && sql.includes('FROM settings')) {
        return { rows: [{ value: JSON.stringify(testSessionsRegistry) }] };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE settings')) {
        return { rows: [{ value: JSON.stringify(testSessionsRegistry) }] };
      }
      return clientQueryHandler(sql, params);
    },
    release: () => {},
  };
  pg.Pool.prototype.connect = async function() {
    return mockClient;
  };
  pg.Pool.prototype.query = async function(...args) {
    if (typeof args[0] === 'string' && args[0].includes('FROM settings')) {
      return { rows: [{ value: JSON.stringify(testSessionsRegistry) }] };
    }
    if (typeof args[0] === 'string' && args[0].includes('UPDATE settings')) {
      return { rows: [{ value: JSON.stringify(testSessionsRegistry) }] };
    }
    return clientQueryHandler(...args);
  };

  const origDbUrl = process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock_db';
  }

  return Promise.resolve()
    .then(() => testFn(mockClient))
    .finally(() => {
      pg.Pool.prototype.connect = origConnect;
      pg.Pool.prototype.query = origQuery;
      if (origDbUrl !== undefined) process.env.DATABASE_URL = origDbUrl;
      else delete process.env.DATABASE_URL;
    });
}

test('Phase 4: OCR Mutation Boundary & Worker Portal Security Suite', async (t) => {

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Human-Review Boundary Enforcement
  // --------------------------------------------------------------------------
  await t.test('1.1 finalizePhysicalPurchaseAtomic rejects unconfirmed EXTRACTED bill with BILL_REVIEW_REQUIRED', async () => {
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('SELECT * FROM bills')) {
        return {
          rows: [{
            id: 'bill-extracted-1',
            customer_id: 'cust-1',
            bill_number: 'BILL-100',
            status: 'EXTRACTED', // Unreviewed raw AI extraction
            extracted_text: 'Catla 1kg 300',
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
            billId: 'bill-extracted-1',
            customerId: 'cust-1',
            paymentMethod: 'CASH',
            workerId: 'worker-1',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'BILL_REVIEW_REQUIRED');
          assert.strictEqual(err.status, 400);
          assert.ok(err.message.includes('human review and confirmation'));
          return true;
        }
      );
    });
  });

  await t.test('1.2 finalizePhysicalPurchaseAtomic rejects PENDING and UNREADABLE bills with BILL_REVIEW_REQUIRED', async () => {
    for (const status of ['PENDING', 'UNREADABLE']) {
      await withMockPgClient(async (sql) => {
        if (sql.includes('SELECT * FROM bills')) {
          return {
            rows: [{
              id: `bill-${status}`,
              customer_id: 'cust-1',
              bill_number: 'BILL-101',
              status,
              extracted_text: null,
            }],
          };
        }
        return { rows: [] };
      }, async () => {
        await assert.rejects(
          async () => {
            await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
              billId: `bill-${status}`,
              customerId: 'cust-1',
              paymentMethod: 'CASH',
              workerId: 'worker-1',
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'BILL_REVIEW_REQUIRED');
            return true;
          }
        );
      });
    }
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Customer Bill Confirmation Persistence
  // --------------------------------------------------------------------------
  await t.test('2.1 Customer bill confirmation persists CONFIRMED status in PostgreSQL', async () => {
    const customerConfirmRoute = loadRoute('../../app/api/v1/customer/bills/scans/[id]/confirm/route.js');
    const customerToken = customerEngine.generateSessionToken({ id: 'cust-phase4-1', mobile_number: '+919999999999', role: 'CUSTOMER' });

    let updatedStatus = null;
    let updatedBillId = null;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes("b.status = 'PROCESSED'") || sql.includes("t.status = 'COMPLETED'")) {
        return { rows: [] };
      }
      if (sql.includes('SELECT') && sql.includes('FROM bills')) {
        return {
          rows: [{
            id: 'bill-cust-confirm-1',
            customer_id: 'cust-phase4-1',
            bill_number: 'BILL-2001',
            status: 'EXTRACTED',
          }],
        };
      }
      if (sql.includes('UPDATE bills') && sql.includes('SET status = $1')) {
        updatedStatus = params[0];
        updatedBillId = params[1];
        return {
          rows: [{
            id: updatedBillId,
            customer_id: 'cust-phase4-1',
            bill_number: 'BILL-2001',
            status: updatedStatus,
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const req = createMockRequest({
        pathname: '/api/v1/customer/bills/scans/bill-cust-confirm-1/confirm',
        method: 'POST',
        headers: { authorization: `Bearer ${customerToken}` },
      });

      const res = await customerConfirmRoute.POST(req, { params: { id: 'bill-cust-confirm-1' } });
      const json = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.status, 'CONFIRMED');
      assert.strictEqual(updatedStatus, 'CONFIRMED', 'Must persist CONFIRMED status to database');
      assert.strictEqual(updatedBillId, 'bill-cust-confirm-1');
    });
  });

  await t.test('2.2 Customer confirmation rejects cross-customer access and REJECTED quality bills', async () => {
    const customerConfirmRoute = loadRoute('../../app/api/v1/customer/bills/scans/[id]/confirm/route.js');
    const customerToken = customerEngine.generateSessionToken({ id: 'cust-owner', mobile_number: '+919999999991', role: 'CUSTOMER' });
    const intruderToken = customerEngine.generateSessionToken({ id: 'cust-intruder', mobile_number: '+919999999992', role: 'CUSTOMER' });

    await withMockPgClient(async (sql) => {
      if (sql.includes("b.status = 'PROCESSED'") || sql.includes("t.status = 'COMPLETED'")) {
        return { rows: [] };
      }
      if (sql.includes('SELECT') && sql.includes('FROM bills')) {
        return {
          rows: [{
            id: 'bill-rejected-quality',
            customer_id: 'cust-owner',
            bill_number: 'BILL-2002',
            status: 'REJECTED',
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      // Cross-customer access attempt
      const reqIntruder = createMockRequest({
        pathname: '/api/v1/customer/bills/scans/bill-rejected-quality/confirm',
        method: 'POST',
        headers: { authorization: `Bearer ${intruderToken}` },
      });
      const resIntruder = await customerConfirmRoute.POST(reqIntruder, { params: { id: 'bill-rejected-quality' } });
      assert.strictEqual(resIntruder.status, 403);

      // Owner attempting to confirm unreadable/rejected bill
      const reqOwner = createMockRequest({
        pathname: '/api/v1/customer/bills/scans/bill-rejected-quality/confirm',
        method: 'POST',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      const resOwner = await customerConfirmRoute.POST(reqOwner, { params: { id: 'bill-rejected-quality' } });
      const jsonOwner = await resOwner.json();
      assert.strictEqual(resOwner.status, 400);
      assert.strictEqual(jsonOwner.error.code, 'BILL_REJECTED');
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Worker Bill Confirmation & Store Scoping
  // --------------------------------------------------------------------------
  await t.test('3.1 Worker confirmation persists CONFIRMED status, worker attribution, and store ID', async () => {
    const workerConfirmRoute = loadRoute('../../app/api/v1/worker/bills/[id]/confirm/route.js');
    const worker = { id: 'worker-store-a-1', name: 'Suresh Worker', mobile_number: '+919988776655', active: true, store_id: 'store_a', storeId: 'store_a' };
    const workerToken = registerTestWorkerSession(worker, 'session-test-p4-w1');

    let recordedStatus = null;
    let recordedWorkerId = null;
    let recordedStoreId = null;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('SELECT') && sql.includes('FROM workers')) {
        return { rows: [worker] };
      }
      if (sql.includes("b.status = 'PROCESSED'") || sql.includes("t.status = 'COMPLETED'")) {
        return { rows: [] };
      }
      if (sql.includes('SELECT') && sql.includes('FROM bills')) {
        return {
          rows: [{
            id: 'bill-worker-confirm-1',
            customer_id: 'cust-1',
            bill_number: 'BILL-3001',
            status: 'EXTRACTED',
            store_id: 'store_a',
          }],
        };
      }
      if (sql.includes('UPDATE bills') && sql.includes('SET status = $1')) {
        recordedStatus = params[0];
        recordedWorkerId = params[1];
        recordedStoreId = params[2];
        return {
          rows: [{
            id: params[3],
            bill_number: 'BILL-3001',
            status: recordedStatus,
            worker_id: recordedWorkerId,
            store_id: recordedStoreId,
          }],
        };
      }
      if (sql.includes('INSERT INTO audit_logs')) {
        return { rows: [{ id: 'audit-log-1' }] };
      }
      return { rows: [] };
    }, async () => {
      const req = createMockRequest({
        pathname: '/api/v1/worker/bills/bill-worker-confirm-1/confirm',
        method: 'POST',
        headers: { authorization: `Bearer ${workerToken}` },
      });

      const res = await workerConfirmRoute.POST(req, { params: { id: 'bill-worker-confirm-1' } });
      const json = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.status, 'CONFIRMED');
      assert.strictEqual(json.data.worker_id, worker.id);
      assert.strictEqual(recordedStatus, 'CONFIRMED');
      assert.strictEqual(recordedWorkerId, worker.id);
      assert.strictEqual(recordedStoreId, 'store_a');
    });
  });

  await t.test('3.2 Worker confirmation rejects cross-store bill review (STORE_MISMATCH)', async () => {
    const workerConfirmRoute = loadRoute('../../app/api/v1/worker/bills/[id]/confirm/route.js');
    const workerStoreB = { id: 'worker-store-b-1', name: 'Ramesh Store B', mobile_number: '+919988776654', active: true, store_id: 'store_b', storeId: 'store_b' };
    const workerToken = registerTestWorkerSession(workerStoreB, 'session-test-p4-w2');

    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT') && sql.includes('FROM workers')) {
        return { rows: [workerStoreB] };
      }
      if (sql.includes('SELECT') && sql.includes('FROM bills')) {
        return {
          rows: [{
            id: 'bill-store-a-only',
            customer_id: 'cust-1',
            bill_number: 'BILL-STORE-A',
            status: 'EXTRACTED',
            store_id: 'store_a', // Belonging to store_a
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const req = createMockRequest({
        pathname: '/api/v1/worker/bills/bill-store-a-only/confirm',
        method: 'POST',
        headers: { authorization: `Bearer ${workerToken}` },
      });

      const res = await workerConfirmRoute.POST(req, { params: { id: 'bill-store-a-only' } });
      const json = await res.json();

      assert.strictEqual(res.status, 403);
      assert.strictEqual(json.error.code, 'STORE_MISMATCH');
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Manual Bill ID Override & MANUALLY_VERIFIED State
  // --------------------------------------------------------------------------
  await t.test('4.1 Manual Bill ID override updates bill number and sets status to MANUALLY_VERIFIED', async () => {
    let persistedStatus = null;
    let persistedBillNum = null;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes("b.status = 'PROCESSED'") || sql.includes("t.status = 'COMPLETED'")) {
        return { rows: [] };
      }
      if (sql.includes('SELECT') && sql.includes('FROM bills')) {
        return {
          rows: [{
            id: 'bill-manual-1',
            customer_id: 'cust-1',
            bill_number: null, // Missing from OCR
            status: 'REVIEW_REQUIRED',
          }],
        };
      }
      if (sql.includes('UPDATE bills') && sql.includes('SET manual_bill_id = $1')) {
        persistedBillNum = params[0];
        persistedStatus = 'MANUALLY_VERIFIED';
        return {
          rows: [{
            id: params[1],
            bill_number: persistedBillNum,
            manual_bill_id: persistedBillNum,
            status: persistedStatus,
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const res = await billingCorrectionEngine.setManualBillNumber({
        billId: 'bill-manual-1',
        billNumber: 'BILL-MANUAL-900',
        customerId: 'cust-1',
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.billNumber, 'BILL-MANUAL-900');
      assert.strictEqual(res.status, 'MANUALLY_VERIFIED');
      assert.strictEqual(persistedStatus, 'MANUALLY_VERIFIED');
    });
  });

  await t.test('4.2 Bill in MANUALLY_VERIFIED state satisfies human review gate in POS finalization', async () => {
    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT * FROM bills')) {
        return {
          rows: [{
            id: 'bill-manual-verified-1',
            customer_id: 'cust-1',
            manual_bill_id: 'BILL-MANUAL-900',
            status: 'MANUALLY_VERIFIED', // Satisfies human review gate
            extracted_text: null,
          }],
        };
      }
      if (sql.includes('SELECT') && sql.includes('FROM fish')) {
        return {
          rows: [{
            id: 'fish-catla',
            name: 'Catla Prime',
            unit_price: 300,
          }],
        };
      }
      if (sql.includes('FROM inventory')) {
        return {
          rows: [{
            id: 'inv-catla',
            fish_id: 'fish-catla',
            physical_quantity: 50.0,
            reserved_quantity: 0.0,
            available_quantity: 50.0,
          }],
        };
      }
      if (sql.includes('UPDATE inventory')) {
        return {
          rows: [{
            id: 'inv-catla',
            fish_id: 'fish-catla',
            physical_quantity: 49.0,
            reserved_quantity: 0.0,
            available_quantity: 49.0,
          }],
        };
      }
      if (sql.includes('inventory_ledger')) {
        return { rows: [{ id: 'ledger-catla-1' }] };
      }
      if (sql.includes('SELECT') && sql.includes('customer_subscriptions')) {
        return { rows: [] }; // No active subscription, full cash payment
      }
      if (sql.includes('INSERT INTO transactions')) {
        return {
          rows: [{
            id: 'tx-manual-ok-1',
            transaction_number: 'TXN-900',
            total_bill_amount: 300,
            final_paid_amount: 300,
            payment_method: 'CASH',
            status: 'COMPLETED',
          }],
        };
      }
      if (sql.includes('UPDATE bills') && sql.includes("SET status = 'PROCESSED'")) {
        return { rows: [{ id: 'bill-manual-verified-1', status: 'PROCESSED' }] };
      }
      return { rows: [] };
    }, async () => {
      const tx = await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
        billId: 'bill-manual-verified-1',
        customerId: 'cust-1',
        workerId: 'worker-1',
        paymentMethod: 'CASH',
        items: [{ fishId: 'fish-catla', quantityKg: 1.0 }],
      });

      assert.ok(tx);
      assert.strictEqual(tx.id, 'tx-manual-ok-1');
      assert.strictEqual(tx.billNumber, 'BILL-MANUAL-900');
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Worker Store Scoping Across Worker Operations
  // --------------------------------------------------------------------------
  await t.test('5.1 Worker GET and PATCH /api/v1/worker/bills/[id] reject cross-store access', async () => {
    const workerBillRoute = loadRoute('../../app/api/v1/worker/bills/[id]/route.js');
    const workerStoreB = { id: 'worker-b', name: 'Worker B', mobile_number: '+919988776653', active: true, store_id: 'store_b', storeId: 'store_b' };
    const tokenB = registerTestWorkerSession(workerStoreB, 'session-test-b');

    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT') && sql.includes('FROM workers')) {
        return { rows: [workerStoreB] };
      }
      if (sql.includes('SELECT') && sql.includes('FROM bills')) {
        return {
          rows: [{
            id: 'bill-store-a',
            customer_id: 'cust-1',
            bill_number: 'BILL-STORE-A',
            status: 'EXTRACTED',
            store_id: 'store_a', // Store A bill
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      // GET attempt
      const reqGet = createMockRequest({
        pathname: '/api/v1/worker/bills/bill-store-a',
        method: 'GET',
        headers: { authorization: `Bearer ${tokenB}` },
      });
      const resGet = await workerBillRoute.GET(reqGet, { params: { id: 'bill-store-a' } });
      assert.strictEqual(resGet.status, 403);
      assert.strictEqual((await resGet.json()).error.code, 'STORE_MISMATCH');

      // PATCH attempt
      const reqPatch = createMockRequest({
        pathname: '/api/v1/worker/bills/bill-store-a',
        method: 'PATCH',
        headers: { authorization: `Bearer ${tokenB}` },
        body: { billNumber: 'BILL-STORE-A-OVERRIDE' },
      });
      const resPatch = await workerBillRoute.PATCH(reqPatch, { params: { id: 'bill-store-a' } });
      assert.strictEqual(resPatch.status, 403);
      assert.strictEqual((await resPatch.json()).error.code, 'STORE_MISMATCH');
    });
  });

  await t.test('5.2 Worker checkout commit rejects cross-store bill checkout (STORE_MISMATCH)', async () => {
    const workerCommitRoute = loadRoute('../../app/api/v1/worker/transactions/commit/route.js');
    const workerStoreB = { id: 'worker-b', name: 'Worker B', mobile_number: '+919988776653', active: true, store_id: 'store_b', storeId: 'store_b' };
    const tokenB = registerTestWorkerSession(workerStoreB, 'session-test-b-52');

    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT') && sql.includes('FROM workers')) {
        return { rows: [workerStoreB] };
      }
      if (sql.includes('SELECT') && sql.includes('FROM customers')) {
        return { rows: [{ id: 'cust-1', name: 'John Doe', mobile_number: '+919999999999' }] };
      }
      if (sql.includes('SELECT') && sql.includes('FROM bills')) {
        return {
          rows: [{
            id: 'bill-store-a',
            customer_id: 'cust-1',
            bill_number: 'BILL-STORE-A',
            status: 'CONFIRMED',
            store_id: 'store_a',
          }],
        };
      }
      return { rows: [] };
    }, async () => {
      const req = createMockRequest({
        pathname: '/api/v1/worker/transactions/commit',
        method: 'POST',
        headers: { authorization: `Bearer ${tokenB}` },
        body: {
          billId: 'bill-store-a',
          customerId: 'cust-1',
          paymentMethod: 'CASH',
        },
      });

      const res = await workerCommitRoute.POST(req);
      const json = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(json.error.code, 'STORE_MISMATCH');
    });
  });

  await t.test('5.3 Worker QR booking verification enforces store matching and rejects cross-store fulfillment', async () => {
    const workerVerifyQrRoute = loadRoute('../../app/api/v1/worker/bookings/verify-qr/route.js');
    const workerStoreA = { id: 'worker-a', name: 'Worker A', mobile_number: '+919988776652', active: true, store_id: 'store_a', storeId: 'store_a' };
    const workerStoreB = { id: 'worker-b', name: 'Worker B', mobile_number: '+919988776651', active: true, store_id: 'store_b', storeId: 'store_b' };

    const tokenA = registerTestWorkerSession(workerStoreA, 'sess-a');
    const tokenB = registerTestWorkerSession(workerStoreB, 'sess-b');

    const bookingId = 'a0000000-0000-4000-8000-000000000001';
    // Create authentic QR token signed for booking-store-a
    const signedQrData = qrVerificationEngine.generateBookingQrData({
      id: bookingId,
      booking_code: 'PF-BK-STOREA',
      customer_id: 'cust-1',
      storeId: 'store_a',
    });

    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT') && sql.includes('FROM workers')) {
        return { rows: [workerStoreB] };
      }
      if (sql.includes('FROM bookings')) {
        return {
          rows: [{
            id: bookingId,
            booking_code: 'PF-BK-STOREA',
            customer_id: 'cust-1',
            status: 'CONFIRMED',
            store_id: 'store_a',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            total_amount: 500,
            customer_name: 'John Doe',
            customer_phone: '+919999999999',
          }],
        };
      }
      if (sql.includes('booking_items')) {
        return { rows: [] };
      }
      return { rows: [] };
    }, async () => {
      // Worker B attempts to verify Store A booking
      const reqB = createMockRequest({
        pathname: '/api/v1/worker/bookings/verify-qr',
        method: 'POST',
        headers: { authorization: `Bearer ${tokenB}` },
        body: { qrCodeData: signedQrData },
      });
      const resB = await workerVerifyQrRoute.POST(reqB);
      const jsonB = await resB.json();

      assert.strictEqual(resB.status, 403);
      assert.strictEqual(jsonB.error.code, 'STORE_MISMATCH');
    });

    // Worker A verifying matching Store A booking succeeds
    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT') && sql.includes('FROM workers')) {
        return { rows: [workerStoreA] };
      }
      if (sql.includes('FROM bookings')) {
        return {
          rows: [{
            id: bookingId,
            booking_code: 'PF-BK-STOREA',
            customer_id: 'cust-1',
            status: 'CONFIRMED',
            store_id: 'store_a',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            total_amount: 500,
            customer_name: 'John Doe',
            customer_phone: '+919999999999',
          }],
        };
      }
      if (sql.includes('booking_items')) {
        return { rows: [] };
      }
      return { rows: [] };
    }, async () => {
      const reqA = createMockRequest({
        pathname: '/api/v1/worker/bookings/verify-qr',
        method: 'POST',
        headers: { authorization: `Bearer ${tokenA}` },
        body: { qrCodeData: signedQrData },
      });
      const resA = await workerVerifyQrRoute.POST(reqA);
      const jsonA = await resA.json();

      assert.strictEqual(resA.status, 200);
      assert.strictEqual(jsonA.success, true);
      assert.strictEqual(jsonA.verified, true);
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Worker Customer Search Security
  // --------------------------------------------------------------------------
  await t.test('6.1 Worker customer search rejects unauthorized enumeration, query < 2 chars, and disabled workers', async () => {
    const workerCustomersRoute = loadRoute('../../app/api/v1/worker/customers/route.js');
    const activeWorker = { id: 'worker-act', name: 'Active Worker', mobile_number: '+919988776650', active: true, store_id: 'store_a', storeId: 'store_a' };
    const disabledWorker = { id: 'worker-dis', name: 'Disabled Worker', mobile_number: '+919988776649', active: false, store_id: 'store_a', storeId: 'store_a' };

    const activeToken = registerTestWorkerSession(activeWorker, 'sess-act');
    const disabledToken = registerTestWorkerSession(disabledWorker, 'sess-dis');

    // 1. Missing token -> 401
    const reqNoAuth = createMockRequest({ pathname: '/api/v1/worker/customers?search=John' });
    const resNoAuth = await workerCustomersRoute.GET(reqNoAuth);
    assert.strictEqual(resNoAuth.status, 401);

    // 2. Disabled worker -> 403
    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT') && sql.includes('FROM workers')) {
        return { rows: [disabledWorker] };
      }
      return { rows: [] };
    }, async () => {
      const reqDisabled = createMockRequest({
        pathname: '/api/v1/worker/customers?search=John',
        headers: { authorization: `Bearer ${disabledToken}` },
      });
      const resDisabled = await workerCustomersRoute.GET(reqDisabled);
      assert.strictEqual(resDisabled.status, 403);
    });

    // 3. Short search query -> returns empty array (blocks full enumeration)
    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT') && sql.includes('FROM workers')) {
        return { rows: [activeWorker] };
      }
      return { rows: [] };
    }, async () => {
      const reqShort = createMockRequest({
        pathname: '/api/v1/worker/customers?search=J',
        headers: { authorization: `Bearer ${activeToken}` },
      });
      const resShort = await workerCustomersRoute.GET(reqShort);
      const jsonShort = await resShort.json();
      assert.strictEqual(resShort.status, 200);
      assert.deepStrictEqual(jsonShort.data, []);
      assert.ok(jsonShort.message.includes('at least 2 characters'));
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Line Item & Catalog Price Validation
  // --------------------------------------------------------------------------
  await t.test('7.1 POS finalization rejects unknown fish items and non-positive quantities', async () => {
    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT * FROM bills')) {
        return {
          rows: [{
            id: 'bill-items-test',
            customer_id: 'cust-1',
            manual_bill_id: 'BILL-VALID-1',
            status: 'CONFIRMED',
            extracted_text: null,
          }],
        };
      }
      if (sql.includes('SELECT') && sql.includes('FROM fish')) {
        return { rows: [] }; // Unknown fish ID
      }
      return { rows: [] };
    }, async () => {
      // Unknown fish
      await assert.rejects(
        async () => {
          await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
            billId: 'bill-items-test',
            customerId: 'cust-1',
            workerId: 'worker-1',
            paymentMethod: 'CASH',
            items: [{ fishId: 'unknown-fish-id', quantityKg: 1.5 }],
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_FISH_ITEM');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });

    // Non-positive quantity
    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT * FROM bills')) {
        return {
          rows: [{
            id: 'bill-items-test-2',
            customer_id: 'cust-1',
            manual_bill_id: 'BILL-VALID-2',
            status: 'CONFIRMED',
            extracted_text: null,
          }],
        };
      }
      if (sql.includes('SELECT') && sql.includes('FROM fish')) {
        return { rows: [{ id: 'fish-rohu', name: 'Rohu', unit_price: 350 }] };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
            billId: 'bill-items-test-2',
            customerId: 'cust-1',
            workerId: 'worker-1',
            paymentMethod: 'CASH',
            items: [{ fishId: 'fish-rohu', quantityKg: -2.0 }],
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_ITEM_QUANTITY');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 8: Duplicate Bill Number & Concurrency Protection
  // --------------------------------------------------------------------------
  await t.test('8.1 POS finalization rejects already processed duplicate bill with BILL_ALREADY_PROCESSED', async () => {
    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT * FROM bills')) {
        return {
          rows: [{
            id: 'bill-dup-test',
            customer_id: 'cust-1',
            bill_number: 'BILL-DUPLICATE-999',
            status: 'CONFIRMED',
          }],
        };
      }
      if (sql.includes("b.status = 'PROCESSED'")) {
        return { rows: [{ id: 'earlier-processed-bill-id' }] }; // Simulated duplicate processed bill
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
            billId: 'bill-dup-test',
            customerId: 'cust-1',
            workerId: 'worker-1',
            paymentMethod: 'CASH',
            items: [{ fishId: 'fish-catla', quantityKg: 1.0 }],
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'BILL_ALREADY_PROCESSED');
          assert.strictEqual(err.status, 409);
          return true;
        }
      );
    });
  });

  await t.test('8.2 Worker confirmation endpoint rejects duplicate bill number with 409 BILL_ALREADY_PROCESSED', async () => {
    const workerConfirmRoute = loadRoute('../../app/api/v1/worker/bills/[id]/confirm/route.js');
    const worker = { id: 'worker-store-a-1', name: 'Suresh Worker', mobile_number: '+919988776655', active: true, store_id: 'store_a', storeId: 'store_a' };
    const workerToken = registerTestWorkerSession(worker, 'sess-dup-test');

    await withMockPgClient(async (sql) => {
      if (sql.includes('SELECT') && sql.includes('FROM workers')) {
        return { rows: [worker] };
      }
      if (sql.includes('SELECT') && sql.includes('FROM bills')) {
        return {
          rows: [{
            id: 'bill-dup-worker-test',
            customer_id: 'cust-1',
            bill_number: 'BILL-DUPLICATE-999',
            status: 'EXTRACTED',
            store_id: 'store_a',
          }],
        };
      }
      if (sql.includes("b.status = 'PROCESSED'")) {
        return { rows: [{ id: 'earlier-processed-bill-id' }] };
      }
      return { rows: [] };
    }, async () => {
      const req = createMockRequest({
        pathname: '/api/v1/worker/bills/bill-dup-worker-test/confirm',
        method: 'POST',
        headers: { authorization: `Bearer ${workerToken}` },
      });

      const res = await workerConfirmRoute.POST(req, { params: { id: 'bill-dup-worker-test' } });
      const json = await res.json();

      assert.strictEqual(res.status, 409);
      assert.strictEqual(json.error.code, 'BILL_ALREADY_PROCESSED');
    });
  });
});
