/**
 * Production Resilience & Fault Tolerance Diagnostic Suite
 * Verifies:
 * 1. Database Connection Pool bounded sizing & rollback resilience (lib/db/pool.js)
 * 2. RBAC Session Registry failure handling: distinguishing DB outages (503) from missing/expired sessions (401)
 * 3. Session registry corrupted data handling (500)
 * 4. Verification that verifyAdminSession propagates 503 errors without converting to 401
 * 5. Admin profile endpoint (GET /api/v1/admin/auth/me) returns 503 on registry unavailable
 * 6. Admin and Worker client resilience invariants against 500/503 server errors
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const jwt = require('jsonwebtoken');

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock_db';
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-32-chars-long-secure-key-2026';
}

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
          json: (data, opts = {}) => ({
            status: opts.status || 200,
            json: async () => data,
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

const pool = require('../../lib/db/pool');
const adminRepository = require('../../lib/db/repositories/adminRepository');
const rbacEngine = require('../../lib/engines/rbac');
const { GET: getAdminAuthMe } = loadRoute('../../app/api/v1/admin/auth/me/route.js');

test('Production Resilience: DB Pool Sizing & Transaction Rollback Resilience', async (t) => {
  await t.test('Pool configuration enforces bounded serverless limits (max <= 2, idle <= 5000ms)', () => {
    const p = pool.getPool();
    assert.ok(p.options.max <= 2, `Expected pool.max <= 2, got ${p.options.max}`);
    assert.strictEqual(p.options.idleTimeoutMillis, 5000);
    assert.strictEqual(p.options.connectionTimeoutMillis, 5000);
    assert.strictEqual(p.options.statement_timeout, 10000);
  });

  await t.test('withTransaction preserves original error even if client.query("ROLLBACK") fails', async () => {
    const originalConnect = pool.getPool().connect;
    let rollbackAttempted = false;
    let clientReleasedWithTaint = false;

    // Temporarily stub connect to simulate a broken client
    pool.getPool().connect = async () => ({
      query: async (sql) => {
        if (sql === 'BEGIN') return {};
        if (sql === 'ROLLBACK') {
          rollbackAttempted = true;
          throw new Error('Connection closed during rollback');
        }
        return {};
      },
      release: (isTainted) => {
        if (isTainted === true) {
          clientReleasedWithTaint = true;
        }
      },
    });

    try {
      await assert.rejects(
        async () => {
          await pool.withTransaction(async () => {
            const rootErr = new Error('Root application transaction failure');
            rootErr.code = 'APP_FAIL';
            throw rootErr;
          });
        },
        (err) => {
          assert.strictEqual(err.message, 'Root application transaction failure');
          assert.strictEqual(err.code, 'APP_FAIL');
          return true;
        }
      );
      assert.strictEqual(rollbackAttempted, true, 'Rollback should have been attempted');
      assert.strictEqual(clientReleasedWithTaint, true, 'Client should have been released with tainted flag');
    } finally {
      pool.getPool().connect = originalConnect;
    }
  });
});

test('Production Resilience: RBAC Session Registry Failure Isolation', async (t) => {
  const originalQuery = pool.query;
  const originalFindAdminById = adminRepository.findAdminById;

  adminRepository.findAdminById = async (id) => ({
    id,
    name: 'Super Admin',
    email: 'admin@pondfish.in',
    role: 'ADMIN',
    is_super_admin: true,
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  });

  await t.test('loadSessionRegistry throws 503 SESSION_REGISTRY_UNAVAILABLE when database query fails', async () => {
    // Stub pool.query to simulate database connection exhaustion or network loss
    pool.query = async (text) => {
      if (typeof text === 'string' && text.includes('FROM settings WHERE key = $1')) {
        const dbErr = new Error('EMAXCONNSESSION: max clients reached in session mode - max clients are limited to pool_size: 15');
        dbErr.code = '53300';
        throw dbErr;
      }
      return originalQuery.apply(pool, [text]);
    };

    try {
      const TEST_TOKEN = jwt.sign(
        {
          adminId: '4c92d6e3-2516-4425-af29-2accc8abc6a5',
          email: 'admin@pondfish.in',
          role: 'ADMIN',
          sessionId: 'test-session-uuid-1234',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Must throw 503, NOT 401 SESSION_EXPIRED
      await assert.rejects(
        async () => {
          await rbacEngine.verifyAdminSession(TEST_TOKEN);
        },
        (err) => {
          assert.strictEqual(err.code, 'SESSION_REGISTRY_UNAVAILABLE', 'Expected SESSION_REGISTRY_UNAVAILABLE code');
          assert.strictEqual(err.status, 503, 'Expected status 503');
          assert.ok(err.cause?.message.includes('EMAXCONNSESSION'), 'Underlying DB error must be attached to cause');
          return true;
        }
      );
    } finally {
      pool.query = originalQuery;
    }
  });

  await t.test('loadSessionRegistry throws 500 SESSION_REGISTRY_CORRUPTED when JSON is malformed', async () => {
    pool.query = async (text) => {
      if (typeof text === 'string' && text.includes('FROM settings WHERE key = $1')) {
        return {
          rows: [{ value: '{ corrupted json !! not valid }' }],
        };
      }
      return originalQuery.apply(pool, [text]);
    };

    try {
      const TEST_TOKEN = jwt.sign(
        {
          adminId: '4c92d6e3-2516-4425-af29-2accc8abc6a5',
          email: 'admin@pondfish.in',
          role: 'ADMIN',
          sessionId: 'test-session-uuid-1234',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      await assert.rejects(
        async () => {
          await rbacEngine.verifyAdminSession(TEST_TOKEN);
        },
        (err) => {
          assert.strictEqual(err.code, 'SESSION_REGISTRY_CORRUPTED', 'Expected SESSION_REGISTRY_CORRUPTED code');
          assert.strictEqual(err.status, 500, 'Expected status 500');
          return true;
        }
      );
    } finally {
      pool.query = originalQuery;
    }
  });

  await t.test('verifyAdminSession returns 401 SESSION_EXPIRED when registry is loaded cleanly but sessionId is absent', async () => {
    pool.query = async (text) => {
      if (typeof text === 'string' && text.includes('FROM settings WHERE key = $1')) {
        return {
          rows: [{ value: JSON.stringify({ 'other-active-session': { expiresAt: Date.now() + 10000 } }) }],
        };
      }
      return originalQuery.apply(pool, [text]);
    };

    try {
      const TEST_TOKEN = jwt.sign(
        {
          adminId: '4c92d6e3-2516-4425-af29-2accc8abc6a5',
          email: 'admin@pondfish.in',
          role: 'ADMIN',
          sessionId: 'revoked-session-uuid-9999',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      await assert.rejects(
        async () => {
          await rbacEngine.verifyAdminSession(TEST_TOKEN);
        },
        (err) => {
          assert.strictEqual(err.code, 'SESSION_EXPIRED', 'Expected SESSION_EXPIRED code');
          assert.strictEqual(err.status, 401, 'Expected status 401');
          return true;
        }
      );
    } finally {
      pool.query = originalQuery;
      adminRepository.findAdminById = originalFindAdminById;
    }
  });

  await t.test('GET /api/v1/admin/auth/me returns HTTP 503 on SESSION_REGISTRY_UNAVAILABLE', async () => {
    pool.query = async (text) => {
      if (typeof text === 'string' && text.includes('FROM settings WHERE key = $1')) {
        const dbErr = new Error('EMAXCONNSESSION: max clients reached');
        dbErr.code = '53300';
        throw dbErr;
      }
      return originalQuery.apply(pool, [text]);
    };

    try {
      const TEST_TOKEN = jwt.sign(
        {
          adminId: '4c92d6e3-2516-4425-af29-2accc8abc6a5',
          email: 'admin@pondfish.in',
          role: 'ADMIN',
          sessionId: 'test-session-uuid-503',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const mockRequest = {
        headers: {
          get: (header) => (header.toLowerCase() === 'authorization' ? `Bearer ${TEST_TOKEN}` : null),
        },
        cookies: {
          get: () => null,
        },
      };

      const res = await getAdminAuthMe(mockRequest);
      const json = await res.json();

      assert.strictEqual(res.status, 503, 'Endpoint must return status 503 Service Unavailable');
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'SESSION_REGISTRY_UNAVAILABLE');
    } finally {
      pool.query = originalQuery;
    }
  });
});

test('Production Resilience: Additional Regression Tests', async (t) => {
  const originalQuery = pool.query;
  const originalFindAdminById = adminRepository.findAdminById;

  await t.test('loadSessionRegistry returns {} when setting row does not exist in DB', async () => {
    pool.query = async (text) => {
      if (typeof text === 'string' && text.includes('FROM settings WHERE key = $1')) {
        return { rows: [] };
      }
      return originalQuery.apply(pool, [text]);
    };
    try {
      const reg = await rbacEngine.loadSessionRegistry();
      assert.deepStrictEqual(reg, {}, 'Must return empty object {}');
    } finally {
      pool.query = originalQuery;
    }
  });

  await t.test('logoutAdmin throws when database persistence fails', async () => {
    const origWithTx = pool.withTransaction;
    pool.withTransaction = async () => {
      throw new Error('Connection pool exhausted');
    };
    try {
      const token = jwt.sign({ adminId: 'adm-1', sessionId: 's-1' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      await assert.rejects(async () => {
        await rbacEngine.logoutAdmin(token);
      }, /Connection pool exhausted/);
    } finally {
      pool.withTransaction = origWithTx;
    }
  });

  await t.test('Unexpected error in GET /api/v1/admin/auth/me returns 500 without leaking SQL', async () => {
    adminRepository.findAdminById = async () => {
      throw new Error('SELECT * FROM secret_table WHERE error = 1');
    };
    pool.query = async (text) => {
      if (typeof text === 'string' && text.includes('FROM settings WHERE key = $1')) {
        return { rows: [{ value: JSON.stringify({ 's-500': { expiresAt: Date.now() + 60000 } }) }] };
      }
      return originalQuery.apply(pool, [text]);
    };
    try {
      const token = jwt.sign({ adminId: 'adm-1', email: 'adm@pf.in', role: 'ADMIN', sessionId: 's-500' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const req = {
        headers: { get: (h) => h.toLowerCase() === 'authorization' ? `Bearer ${token}` : null },
        cookies: { get: () => null },
      };
      const res = await getAdminAuthMe(req);
      const json = await res.json();
      assert.strictEqual(res.status, 500);
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'INTERNAL_ERROR');
      assert.ok(!JSON.stringify(json).includes('SELECT'), 'Must never leak SQL');
    } finally {
      pool.query = originalQuery;
      adminRepository.findAdminById = originalFindAdminById;
    }
  });

  await t.test('Worker customer search API returns 503 on DB connection error (not 401)', async () => {
    const workerRepo = require('../../lib/db/repositories/workerRepository');
    const origFindWorker = workerRepo.findWorkerById;
    workerRepo.findWorkerById = async () => {
      const dbErr = new Error('EMAXCONNSESSION: max clients reached in session mode');
      dbErr.code = '53300';
      throw dbErr;
    };
    try {
      const { GET: getWorkerCustomers } = loadRoute('../../app/api/v1/worker/customers/route.js');
      const token = jwt.sign({ workerId: 'w-1', role: 'WORKER', sessionId: 'sw-1' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const req = {
        headers: { get: (h) => h.toLowerCase() === 'authorization' ? `Bearer ${token}` : null },
        cookies: { get: () => null },
        url: 'http://localhost:3000/api/v1/worker/customers?search=test',
      };
      const res = await getWorkerCustomers(req);
      assert.strictEqual(res.status, 503, 'Must return 503 on DB failure');
      assert.notStrictEqual(res.status, 401, 'Must NOT be 401');
    } finally {
      workerRepo.findWorkerById = origFindWorker;
    }
  });

  await t.test('Missing JWT secret in production fails closed', () => {
    const origEnv = process.env.NODE_ENV;
    const origSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      const { getJwtSecret } = require('../../lib/auth/admin-auth');
      assert.throws(() => getJwtSecret(), (err) => {
        assert.strictEqual(err.code, 'MISSING_AUTH_CONFIG');
        return true;
      });
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.JWT_SECRET = origSecret;
    }
  });
});

test('Production Resilience: Worker Engine Regression & Cache Isolation', async (t) => {
  const workerEngine = require('../../lib/engines/worker');
  const workerRepo = require('../../lib/db/repositories/workerRepository');
  const bookingRepo = require('../../lib/db/repositories/bookingRepository');
  const inventoryRepo = require('../../lib/db/repositories/inventoryRepository');
  const auditEngine = require('../../lib/engines/audit');
  const origQuery = pool.query;

  await t.test('loadWorkerSessionRegistry enforces 2-second in-process TTL cache', async () => {
    let dbQueryCount = 0;
    pool.query = async (text, params) => {
      if (typeof text === 'string' && text.includes('FROM settings WHERE key = $1')) {
        dbQueryCount++;
        return {
          rows: [{
            value: JSON.stringify({
              'sess-1': { expiresAt: Date.now() + 60000, workerId: 'w-1' }
            })
          }]
        };
      }
      return origQuery.apply(pool, [text, params]);
    };

    try {
      workerEngine.invalidateWorkerSessionRegistryCache();
      
      // First call: hits DB
      const reg1 = await workerEngine.loadWorkerSessionRegistry();
      assert.strictEqual(dbQueryCount, 1, 'First call must query DB');
      assert.ok(reg1['sess-1'], 'Registry must contain sess-1');

      // Second call immediately within TTL: hits cache, does not query DB
      const reg2 = await workerEngine.loadWorkerSessionRegistry();
      assert.strictEqual(dbQueryCount, 1, 'Second call within TTL must hit cache without querying DB');
      assert.deepStrictEqual(reg2, reg1);

      // Invalidate cache: next call must query DB
      workerEngine.invalidateWorkerSessionRegistryCache();
      const reg3 = await workerEngine.loadWorkerSessionRegistry();
      assert.strictEqual(dbQueryCount, 2, 'Call after cache invalidation must query DB');
      assert.ok(reg3['sess-1']);
    } finally {
      pool.query = origQuery;
      workerEngine.invalidateWorkerSessionRegistryCache();
    }
  });

  await t.test('completeBookingOrder executes transactional fulfillment without returning session registry', async () => {
    const origGetPool = pool.getPool;
    let clientReleased = false;
    let queryLog = [];

    const mockClient = {
      query: async (sql, params) => {
        const s = typeof sql === 'string' ? sql.trim() : '';
        queryLog.push(s);
        if (s === 'BEGIN') return {};
        if (s.startsWith('SELECT * FROM bookings')) {
          return {
            rows: [{
              id: 'b-100',
              store_id: 'store-alpha',
              status: 'CONFIRMED',
              customer_id: 'cust-1',
              booking_code: 'BK-100',
              total_amount: 500,
              sub_credit_used: 0,
              razorpay_paid: 500,
              expires_at: new Date(Date.now() + 3600000).toISOString(),
            }],
          };
        }
        if (s.startsWith('SELECT * FROM booking_items')) {
          return {
            rows: [{
              id: 'item-1',
              booking_id: 'b-100',
              fish_id: 'fish-1',
              quantity_kg: 2,
            }],
          };
        }
        if (s === 'COMMIT') return {};
        if (s === 'ROLLBACK') return {};
        return { rows: [] };
      },
      release: () => {
        clientReleased = true;
      },
    };

    const origConnect = pool.getPool().connect;
    pool.getPool().connect = async () => mockClient;

    const origConsume = inventoryRepo.consumeReservedInventoryAtomic;
    const origCreateTx = bookingRepo.createTransactionAtomic;
    const origUpdateStatus = bookingRepo.updateBookingStatus;
    const origFindBooking = bookingRepo.findBookingForWorker;
    const origAuditLog = auditEngine.recordAuditLog;

    let inventoryConsumed = false;
    let transactionCreated = false;
    let statusUpdated = false;
    let auditLogged = false;

    inventoryRepo.consumeReservedInventoryAtomic = async () => {
      inventoryConsumed = true;
    };
    bookingRepo.createTransactionAtomic = async () => {
      transactionCreated = true;
      return { id: 'tx-100', total_amount: 500 };
    };
    bookingRepo.updateBookingStatus = async () => {
      statusUpdated = true;
    };
    bookingRepo.findBookingForWorker = async () => ({
      id: 'b-100',
      status: 'COMPLETED',
      booking_code: 'BK-100',
    });
    auditEngine.recordAuditLog = async () => {
      auditLogged = true;
      return { id: 'audit-1' };
    };

    try {
      const result = await workerEngine.completeBookingOrder({
        bookingId: 'b-100',
        workerId: 'w-1',
        workerStoreId: 'store-alpha',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.booking.id, 'b-100');
      assert.strictEqual(result.transaction.id, 'tx-100');
      assert.strictEqual(inventoryConsumed, true, 'Inventory must be consumed atomically');
      assert.strictEqual(transactionCreated, true, 'Transaction record must be created');
      assert.strictEqual(statusUpdated, true, 'Booking status must be updated');
      assert.strictEqual(auditLogged, true, 'Audit log must be recorded');
      assert.strictEqual(clientReleased, true, 'Client must be released');
      assert.ok(queryLog.includes('BEGIN'), 'Must begin transaction');
      assert.ok(queryLog.includes('COMMIT'), 'Must commit transaction');
      // Verify it did NOT return activeRegistry
      assert.strictEqual(result['sess-1'], undefined, 'Must not return session registry');
    } finally {
      pool.getPool().connect = origConnect;
      inventoryRepo.consumeReservedInventoryAtomic = origConsume;
      bookingRepo.createTransactionAtomic = origCreateTx;
      bookingRepo.updateBookingStatus = origUpdateStatus;
      bookingRepo.findBookingForWorker = origFindBooking;
      auditEngine.recordAuditLog = origAuditLog;
    }
  });

  await t.test('updateWorkerByAdmin returns updated worker object and handles store reassignment', async () => {
    const origFind = workerRepo.findWorkerById;
    const origUpdate = workerRepo.updateWorker;
    const origAuditLog = auditEngine.recordAuditLog;

    workerRepo.findWorkerById = async (id) => ({
      id,
      name: 'Test Worker',
      mobile_number: '9876543210',
      store_id: 'store-alpha',
      active: true,
    });

    let updatedParams = null;
    workerRepo.updateWorker = async (id, updates) => {
      updatedParams = updates;
      return {
        id,
        name: updates.name || 'Test Worker',
        mobile_number: updates.mobile_number || '9876543210',
        store_id: updates.store_id || 'store-alpha',
        active: updates.active !== undefined ? updates.active : true,
      };
    };
    auditEngine.recordAuditLog = async () => ({ id: 'audit-1' });

    try {
      const result = await workerEngine.updateWorkerByAdmin(
        'w-1',
        { store_id: 'store-beta' },
        { actorId: 'admin-1', ip: '127.0.0.1' }
      );

      assert.strictEqual(result.id, 'w-1');
      assert.strictEqual(result.store_id, 'store-beta');
      assert.strictEqual(updatedParams.store_id, 'store-beta');
      // Ensure it returned the worker object, not a session registry
      assert.strictEqual(result['sess-1'], undefined);
    } finally {
      workerRepo.findWorkerById = origFind;
      workerRepo.updateWorker = origUpdate;
      auditEngine.recordAuditLog = origAuditLog;
    }
  });
});
