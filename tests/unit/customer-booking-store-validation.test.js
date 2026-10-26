/**
 * Regression Test Suite: Customer Booking Store ID Validation
 * Endpoint: POST /api/v1/customer/bookings
 * 
 * Verifies strict validation of client-supplied store identifier:
 * 1. storeId omitted — existing single-store behavior remains functional.
 * 2. storeId: "" — rejected with HTTP 400 INVALID_STORE_ID.
 * 3. storeId: "   " — rejected with HTTP 400 INVALID_STORE_ID.
 * 4. storeId: null explicitly supplied — rejected with HTTP 400 INVALID_STORE_ID.
 * 5. storeId supplied as number, object, or array — rejected with HTTP 400 INVALID_STORE_ID.
 * 6. Valid authorized store ID — existing single-store behavior preserved.
 * 7. Unauthorized store ID — rejected with HTTP 400 without inventory or booking mutations.
 * 8. Conflicting storeId and store_id — rejected with HTTP 400 deterministically.
 * 9. store_id alias supplied alone — behavior remains consistent with documented API contract.
 * 10. store_id: "" or store_id: null — rejected with HTTP 400 INVALID_STORE_ID.
 * 11. Matching storeId and store_id — succeeds with authorized store ID.
 * 12. Fail-closed behavior preserved when store configuration is missing or unavailable.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const pg = require('pg');

// Dynamic Next.js Route Loader adhering to repository conventions
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

// Intercept PostgreSQL pool/client for isolated, reproducible unit testing
async function withMockPgClient(queryHandler, callback) {
  const origQuery = pg.Pool.prototype.query;
  const origClientQuery = pg.Client.prototype.query;
  const origPoolConnect = pg.Pool.prototype.connect;
  const origDbUrl = process.env.DATABASE_URL;

  process.env.DATABASE_URL = 'postgres://mock:mock@localhost:5432/mock_db';

  const mockQuery = async (sql, params) => {
    const sqlStr = typeof sql === 'string' ? sql : sql?.text || '';
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

function generateCustomerToken(customerId) {
  const secret = process.env.JWT_SECRET || 'pondfish-dev-only-secret-do-not-use-in-production';
  return jwt.sign(
    {
      customerId,
      mobileNumber: '9876543210',
      role: 'CUSTOMER',
    },
    secret,
    { expiresIn: '1h' }
  );
}

function createCustomerPostRequest(token, body) {
  return {
    headers: {
      get: (headerName) => {
        if (headerName.toLowerCase() === 'authorization') {
          return `Bearer ${token}`;
        }
        return null;
      },
    },
    url: 'http://localhost/api/v1/customer/bookings',
    json: async () => body,
  };
}

test('Customer Booking API: Store ID Validation and Fail-Closed Security', async (t) => {
  const customerBookingsRoute = loadRoute('../../app/api/v1/customer/bookings/route.js');
  const customerId = 'c0000000-0000-4000-8000-000000000001';
  const token = generateCustomerToken(customerId);

  const paymentVerification = {
    source: 'WEBHOOK',
    orderId: 'order_test_123',
    razorpayOrderId: 'order_test_123',
    paymentId: 'pay_test_123',
    razorpayPaymentId: 'pay_test_123',
    signature: 'WEBHOOK_VERIFIED',
    razorpaySignature: 'WEBHOOK_VERIFIED',
  };

  const testSnapshot = {
    customer_id: customerId,
    cart_snapshot: JSON.stringify([{ fishId: 'f0000000-0000-4000-8000-000000000001', name: 'Catla', quantityKg: 2.0, pricePerKg: 250, subtotal: 500 }]),
    fee_breakdown: JSON.stringify({ totalAmount: 500, totalQuantity: 2 }),
    subscription_snapshot: JSON.stringify({ subCreditUsed: 500, extraPayableAmount: 0 }),
  };

  // Base mock query dispatcher for booking creation
  function createStandardMockDispatcher(options = {}) {
    const {
      configuredStoreId = 'store_authority_main',
      throwOnSettings = false,
      missingSettings = false,
      onMutation = () => {},
    } = options;

    return async (sql, params) => {
      const trimmed = sql.trim().toUpperCase();
      const isMutation = trimmed.startsWith('INSERT INTO') || trimmed.startsWith('UPDATE ') || trimmed.startsWith('DELETE FROM');
      if (isMutation) {
        onMutation(sql, params);
      }

      if (sql.includes('FROM settings') && sql.includes('blocked_customer_ids')) {
        return { rows: [] };
      }

      if (sql.includes('FROM settings')) {
        if (throwOnSettings) {
          throw new Error('Connection to settings table lost');
        }
        if (missingSettings) {
          return { rows: [] };
        }
        return {
          rows: [
            { key: 'active_store_id', value: JSON.stringify(configuredStoreId) },
          ],
        };
      }

      if (sql.includes('FROM checkout_intents')) {
        return { rows: [testSnapshot] };
      }

      if (sql.includes('FROM fish')) {
        return {
          rows: [{
            id: 'f0000000-0000-4000-8000-000000000001',
            name: 'Catla',
            physical_available: true,
            online_bookable: true,
            unit_price: 250,
            price_per_kg: 250,
            stock_quantity_kg: 100,
          }],
        };
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

      if (sql.includes('INSERT INTO booking_items')) {
        return { rows: [] };
      }

      if (sql.includes('DELETE FROM customer_cart_items')) {
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO bookings')) {
        return {
          rows: [{
            id: 'b0000000-0000-4000-8000-000000000001',
            customer_id: customerId,
            booking_code: 'BK-TEST-001',
            store_id: params[8] || configuredStoreId,
            status: 'CONFIRMED',
            total_amount: 500,
            sub_credit_used: 500,
            pickup_date: '2026-10-26',
            created_at: new Date().toISOString(),
          }],
        };
      }

      if (sql.includes('FROM bookings') || (sql.includes('SELECT') && sql.includes('bookings'))) {
        return {
          rows: [{
            id: 'b0000000-0000-4000-8000-000000000001',
            customer_id: customerId,
            booking_code: 'BK-TEST-001',
            store_id: configuredStoreId,
            status: 'CONFIRMED',
            total_amount: 500,
            sub_credit_used: 500,
            pickup_date: '2026-10-26',
            created_at: new Date().toISOString(),
          }],
        };
      }

      return { rows: [] };
    };
  }

  // --------------------------------------------------------------------------
  // TEST 1: storeId omitted — existing single-store behavior remains functional
  // --------------------------------------------------------------------------
  await t.test('1. storeId omitted allows authoritative single-store resolution', async () => {
    let mutations = 0;
    const mockDispatcher = createStandardMockDispatcher({
      configuredStoreId: 'store_authority_main',
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(mockDispatcher, async () => {
      const req = createCustomerPostRequest(token, {
        paymentVerification,
      });

      const res = await customerBookingsRoute.POST(req);
      assert.strictEqual(res.status, 201);
      const resBody = await res.json();
      assert.strictEqual(resBody.success, true);
      assert.strictEqual(resBody.data.store_id, 'store_authority_main');
      assert.ok(mutations > 0, 'Mutations should execute for authorized booking');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 2: storeId: "" — rejected with HTTP 400
  // --------------------------------------------------------------------------
  await t.test('2. storeId: "" rejected with HTTP 400 INVALID_STORE_ID before mutations', async () => {
    let mutations = 0;
    const mockDispatcher = createStandardMockDispatcher({
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(mockDispatcher, async () => {
      const req = createCustomerPostRequest(token, {
        paymentVerification,
        storeId: '',
      });

      const res = await customerBookingsRoute.POST(req);
      assert.strictEqual(res.status, 400);
      const resBody = await res.json();
      assert.strictEqual(resBody.success, false);
      assert.strictEqual(resBody.error.code, 'INVALID_STORE_ID');
      assert.ok(resBody.error.message.includes('blank'));
      assert.strictEqual(mutations, 0, 'Zero mutations on blank storeId');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 3: storeId: "   " (whitespace) — rejected with HTTP 400
  // --------------------------------------------------------------------------
  await t.test('3. storeId: "   " rejected with HTTP 400 INVALID_STORE_ID before mutations', async () => {
    let mutations = 0;
    const mockDispatcher = createStandardMockDispatcher({
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(mockDispatcher, async () => {
      const req = createCustomerPostRequest(token, {
        paymentVerification,
        storeId: '   ',
      });

      const res = await customerBookingsRoute.POST(req);
      assert.strictEqual(res.status, 400);
      const resBody = await res.json();
      assert.strictEqual(resBody.success, false);
      assert.strictEqual(resBody.error.code, 'INVALID_STORE_ID');
      assert.ok(resBody.error.message.includes('blank'));
      assert.strictEqual(mutations, 0, 'Zero mutations on whitespace storeId');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 4: storeId: null explicitly supplied — rejected with HTTP 400
  // --------------------------------------------------------------------------
  await t.test('4. storeId: null explicitly supplied rejected with HTTP 400 INVALID_STORE_ID before mutations', async () => {
    let mutations = 0;
    const mockDispatcher = createStandardMockDispatcher({
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(mockDispatcher, async () => {
      const req = createCustomerPostRequest(token, {
        paymentVerification,
        storeId: null,
      });

      const res = await customerBookingsRoute.POST(req);
      assert.strictEqual(res.status, 400);
      const resBody = await res.json();
      assert.strictEqual(resBody.success, false);
      assert.strictEqual(resBody.error.code, 'INVALID_STORE_ID');
      assert.ok(resBody.error.message.includes('non-empty string'));
      assert.strictEqual(mutations, 0, 'Zero mutations on storeId: null');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 5: storeId supplied as number, object, or array — rejected with HTTP 400
  // --------------------------------------------------------------------------
  await t.test('5. Non-string storeId (number, object, array) rejected with HTTP 400', async () => {
    let mutations = 0;
    const mockDispatcher = createStandardMockDispatcher({
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(mockDispatcher, async () => {
      const invalidPayloads = [
        { storeId: 12345 },
        { storeId: { id: 'store_authority_main' } },
        { storeId: ['store_authority_main'] },
        { storeId: true },
      ];

      for (const payload of invalidPayloads) {
        const req = createCustomerPostRequest(token, {
          paymentVerification,
          ...payload,
        });

        const res = await customerBookingsRoute.POST(req);
        assert.strictEqual(res.status, 400);
        const resBody = await res.json();
        assert.strictEqual(resBody.success, false);
        assert.strictEqual(resBody.error.code, 'INVALID_STORE_ID');
        assert.ok(resBody.error.message.includes('non-empty string'));
      }

      assert.strictEqual(mutations, 0, 'Zero mutations on non-string storeId payloads');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 6: Valid authorized store ID — existing behavior preserved
  // --------------------------------------------------------------------------
  await t.test('6. Valid authorized store ID succeeds and persists authoritative store', async () => {
    let mutations = 0;
    const mockDispatcher = createStandardMockDispatcher({
      configuredStoreId: 'store_authority_main',
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(mockDispatcher, async () => {
      const req = createCustomerPostRequest(token, {
        paymentVerification,
        storeId: 'store_authority_main',
      });

      const res = await customerBookingsRoute.POST(req);
      assert.strictEqual(res.status, 201);
      const resBody = await res.json();
      assert.strictEqual(resBody.success, true);
      assert.strictEqual(resBody.data.store_id, 'store_authority_main');
      assert.ok(mutations > 0, 'Mutations should execute for authorized store');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 7: Unauthorized store ID — rejected without inventory or booking mutations
  // --------------------------------------------------------------------------
  await t.test('7. Unauthorized store ID rejected with HTTP 400 without mutations', async () => {
    let mutations = 0;
    const mockDispatcher = createStandardMockDispatcher({
      configuredStoreId: 'store_authority_main',
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(mockDispatcher, async () => {
      const req = createCustomerPostRequest(token, {
        paymentVerification,
        storeId: 'store_unauthorized_999',
      });

      const res = await customerBookingsRoute.POST(req);
      assert.strictEqual(res.status, 400);
      const resBody = await res.json();
      assert.strictEqual(resBody.success, false);
      assert.strictEqual(resBody.error.code, 'INVALID_STORE_ID');
      assert.ok(resBody.error.message.includes('not an authorized active store'));
      assert.strictEqual(mutations, 0, 'Zero mutations on unauthorized store ID');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 8: Conflicting storeId and store_id — rejected deterministically
  // --------------------------------------------------------------------------
  await t.test('8. Conflicting storeId and store_id rejected with HTTP 400 INVALID_STORE_ID', async () => {
    let mutations = 0;
    const mockDispatcher = createStandardMockDispatcher({
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(mockDispatcher, async () => {
      const req = createCustomerPostRequest(token, {
        paymentVerification,
        storeId: 'store_authority_main',
        store_id: 'store_other_conflict',
      });

      const res = await customerBookingsRoute.POST(req);
      assert.strictEqual(res.status, 400);
      const resBody = await res.json();
      assert.strictEqual(resBody.success, false);
      assert.strictEqual(resBody.error.code, 'INVALID_STORE_ID');
      assert.ok(resBody.error.message.includes('Conflicting'));
      assert.strictEqual(mutations, 0, 'Zero mutations on conflicting storeId and store_id');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 9: store_id alias supplied alone — behavior remains consistent
  // --------------------------------------------------------------------------
  await t.test('9. store_id alias supplied alone succeeds when authorized', async () => {
    let mutations = 0;
    const mockDispatcher = createStandardMockDispatcher({
      configuredStoreId: 'store_authority_main',
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(mockDispatcher, async () => {
      const req = createCustomerPostRequest(token, {
        paymentVerification,
        store_id: 'store_authority_main',
      });

      const res = await customerBookingsRoute.POST(req);
      assert.strictEqual(res.status, 201);
      const resBody = await res.json();
      assert.strictEqual(resBody.success, true);
      assert.strictEqual(resBody.data.store_id, 'store_authority_main');
      assert.ok(mutations > 0, 'Mutations should execute for authorized store_id alias');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 10: store_id alias supplied alone with invalid values rejected
  // --------------------------------------------------------------------------
  await t.test('10. Invalid store_id alias (null, empty, number) rejected with HTTP 400', async () => {
    let mutations = 0;
    const mockDispatcher = createStandardMockDispatcher({
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(mockDispatcher, async () => {
      const invalidAliasCases = [
        { store_id: '' },
        { store_id: '   ' },
        { store_id: null },
        { store_id: 999 },
      ];

      for (const payload of invalidAliasCases) {
        const req = createCustomerPostRequest(token, {
          paymentVerification,
          ...payload,
        });

        const res = await customerBookingsRoute.POST(req);
        assert.strictEqual(res.status, 400);
        const resBody = await res.json();
        assert.strictEqual(resBody.success, false);
        assert.strictEqual(resBody.error.code, 'INVALID_STORE_ID');
      }

      assert.strictEqual(mutations, 0, 'Zero mutations on invalid store_id payloads');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 11: Matching storeId and store_id succeeds with authorized store
  // --------------------------------------------------------------------------
  await t.test('11. Identical storeId and store_id succeed with authorized store', async () => {
    let mutations = 0;
    const mockDispatcher = createStandardMockDispatcher({
      configuredStoreId: 'store_authority_main',
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(mockDispatcher, async () => {
      const req = createCustomerPostRequest(token, {
        paymentVerification,
        storeId: 'store_authority_main',
        store_id: 'store_authority_main',
      });

      const res = await customerBookingsRoute.POST(req);
      assert.strictEqual(res.status, 201);
      const resBody = await res.json();
      assert.strictEqual(resBody.success, true);
      assert.strictEqual(resBody.data.store_id, 'store_authority_main');
      assert.ok(mutations > 0);
    });
  });

  // --------------------------------------------------------------------------
  // TEST 12: System fails closed when store settings are unavailable or missing
  // --------------------------------------------------------------------------
  await t.test('12. Fails closed with 500 when store settings are unavailable or unconfigured', async () => {
    let mutations = 0;

    // Sub-case A: DB error reading settings -> 500 STORE_CONFIG_UNAVAILABLE
    const dbErrDispatcher = createStandardMockDispatcher({
      throwOnSettings: true,
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(dbErrDispatcher, async () => {
      const req = createCustomerPostRequest(token, {
        paymentVerification,
      });

      const res = await customerBookingsRoute.POST(req);
      assert.strictEqual(res.status, 500);
      const resBody = await res.json();
      assert.strictEqual(resBody.success, false);
      assert.strictEqual(resBody.error.code, 'STORE_CONFIG_UNAVAILABLE');
      assert.strictEqual(mutations, 0, 'No mutations on DB error');
    });

    // Sub-case B: No store configured -> 500 STORE_NOT_CONFIGURED
    const missingSettingsDispatcher = createStandardMockDispatcher({
      missingSettings: true,
      onMutation: () => { mutations++; },
    });

    await withMockPgClient(missingSettingsDispatcher, async () => {
      const req = createCustomerPostRequest(token, {
        paymentVerification,
      });

      const res = await customerBookingsRoute.POST(req);
      assert.strictEqual(res.status, 500);
      const resBody = await res.json();
      assert.strictEqual(resBody.success, false);
      assert.strictEqual(resBody.error.code, 'STORE_NOT_CONFIGURED');
      assert.strictEqual(mutations, 0, 'No mutations when store not configured');
    });
  });
});
