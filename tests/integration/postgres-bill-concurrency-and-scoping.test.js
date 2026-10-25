/**
 * Authoritative PostgreSQL Integration Test Suite for Phase 4:
 * Bill Store Scoping, Migration 0020 Verification, and Concurrent Duplicate Bill Prevention.
 * 
 * Traceability:
 * - Phase 4 Review Corrections: Fail-closed worker/bill store scoping & atomic concurrency race against PostgreSQL.
 * - Migration 0020: BillStatus CONFIRMED, bills/bookings/workers store_id, and partial unique indexes.
 * - Zero-mock live PostgreSQL database tests against real tables, locks, and constraints.
 */

const assert = require('assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 1. Resolve connection string from environment or .env
function getDbConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        let val = trimmed.substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  }
  return null;
}

const connectionString = getDbConnectionString();

test('PostgreSQL Phase 4: Migration 0020, Store Scoping, and Concurrency Suite', async (t) => {
  const isOptional = process.env.ALLOW_DB_SKIP === 'true' || process.env.OPTIONAL_DB === 'true';

  if (!connectionString) {
    if (isOptional) {
      t.diagnostic('[DB OPTIONAL] DATABASE_URL not configured. Skipping real PostgreSQL integration test.');
      return;
    }
    throw new Error('[DB FATAL] DATABASE_URL is not configured. Real PostgreSQL integration tests are mandatory.');
  }

  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  process.env.DATABASE_URL = connectionString;
  const posFinalizationEngine = require('../../lib/engines/pos-finalization');
  const billRepository = require('../../lib/db/repositories/billRepository');
  const workerEngine = require('../../lib/engines/worker');
  const workerRepository = require('../../lib/db/repositories/workerRepository');
  const bookingRepository = require('../../lib/db/repositories/bookingRepository');

  let client;
  try {
    client = await pool.connect();
    t.diagnostic('[DB CONNECTED] Real PostgreSQL connection established.');
  } catch (err) {
    await pool.end();
    if (isOptional) {
      t.diagnostic(`[DB OPTIONAL] Connection failed: ${err.message}. Skipping.`);
      return;
    }
    throw err;
  }

  // Track created IDs for cleanup
  const cleanupBillIds = [];
  const cleanupTxIds = [];
  const cleanupCustomerIds = [];
  const cleanupWorkerIds = [];
  const cleanupFishIds = [];
  const cleanupBookingIds = [];

  t.after(async () => {
    try {
      if (cleanupTxIds.length > 0) {
        await pool.query('DELETE FROM transaction_items WHERE transaction_id = ANY($1)', [cleanupTxIds]);
        await pool.query('DELETE FROM transactions WHERE id = ANY($1)', [cleanupTxIds]);
      }
      if (cleanupBillIds.length > 0) {
        await pool.query('DELETE FROM bills WHERE id = ANY($1)', [cleanupBillIds]);
      }
      if (cleanupFishIds.length > 0) {
        await pool.query('DELETE FROM inventory_ledger WHERE fish_id = ANY($1)', [cleanupFishIds]);
        await pool.query('DELETE FROM inventory WHERE fish_id = ANY($1)', [cleanupFishIds]);
        await pool.query('DELETE FROM fish WHERE id = ANY($1)', [cleanupFishIds]);
      }
      if (cleanupBookingIds.length > 0) {
        await pool.query('DELETE FROM booking_items WHERE booking_id = ANY($1)', [cleanupBookingIds]);
        await pool.query('DELETE FROM bookings WHERE id = ANY($1)', [cleanupBookingIds]);
      }
      if (cleanupCustomerIds.length > 0) {
        await pool.query('DELETE FROM customers WHERE id = ANY($1)', [cleanupCustomerIds]);
      }
      if (cleanupWorkerIds.length > 0) {
        await pool.query('DELETE FROM workers WHERE id = ANY($1)', [cleanupWorkerIds]);
      }
    } catch (cleanErr) {
      console.warn('[CLEANUP WARNING]', cleanErr.message);
    } finally {
      if (client) client.release();
      await pool.end();
      try {
        const dbPoolModule = require('../../lib/db/pool');
        await dbPoolModule.getPool().end();
      } catch (_) {}
    }
  });

  // --------------------------------------------------------------------------
  // Pre-flight: Verify Migration 0020 applied safely & repeatably
  // --------------------------------------------------------------------------
  await t.test('Pre-flight: Verify Migration 0020 is applied in target database', async () => {
    // 1. BillStatus enum contains CONFIRMED
    const enumRes = await pool.query(`
      SELECT e.enumlabel 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname = 'BillStatus';
    `);
    const enumLabels = enumRes.rows.map(r => r.enumlabel);
    assert.ok(enumLabels.includes('CONFIRMED'), "BillStatus enum must contain 'CONFIRMED'");

    // 2. bills table has worker_id and store_id
    const billsCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bills' AND column_name IN ('worker_id', 'store_id');
    `);
    const billColNames = billsCols.rows.map(r => r.column_name);
    assert.ok(billColNames.includes('worker_id'), "bills table must contain 'worker_id'");
    assert.ok(billColNames.includes('store_id'), "bills table must contain 'store_id'");

    // 3. bookings table has store_id
    const bkCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'store_id';
    `);
    assert.strictEqual(bkCols.rows.length, 1, "bookings table must contain 'store_id'");

    // 4. workers table has store_id
    const workerCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workers' AND column_name = 'store_id';
    `);
    assert.strictEqual(workerCols.rows.length, 1, "workers table must contain 'store_id'");

    // 5. Partial unique indexes exist
    const idxRes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'bills' AND indexname IN ('uq_bills_processed_bill_number', 'uq_bills_processed_manual_bill_id');
    `);
    const idxNames = idxRes.rows.map(r => r.indexname);
    assert.ok(idxNames.includes('uq_bills_processed_bill_number'), 'Partial unique index uq_bills_processed_bill_number must exist');
    assert.ok(idxNames.includes('uq_bills_processed_manual_bill_id'), 'Partial unique index uq_bills_processed_manual_bill_id must exist');
  });

  // Setup sandbox customer, worker, and fish
  const testSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const custRes = await pool.query(`
    INSERT INTO customers (id, name, mobile_number, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Live Integration Tester ${testSuffix}', '998811${Math.floor(1000 + Math.random() * 9000)}', NOW(), NOW())
    RETURNING id;
  `);
  const testCustomerId = custRes.rows[0].id;
  cleanupCustomerIds.push(testCustomerId);

  const workerRes = await pool.query(`
    INSERT INTO workers (id, name, mobile_number, password_hash, store_id, active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Live Store A Worker ${testSuffix}', '998822${Math.floor(1000 + Math.random() * 9000)}', 'salt:hash', 'store_phase4_live_a', true, NOW(), NOW())
    RETURNING id;
  `);
  const testWorkerId = workerRes.rows[0].id;
  cleanupWorkerIds.push(testWorkerId);

  const fishRes = await pool.query(`
    INSERT INTO fish (id, category_id, name, unit_price, physical_available, online_bookable, created_at, updated_at)
    VALUES (gen_random_uuid(), (SELECT id FROM categories LIMIT 1), 'Live Test Rohu ${testSuffix}', 300, true, true, NOW(), NOW())
    RETURNING id;
  `);
  const testFishId = fishRes.rows[0].id;
  cleanupFishIds.push(testFishId);

  await pool.query(`
    INSERT INTO inventory (id, fish_id, physical_quantity, reserved_quantity, available_quantity, updated_at)
    VALUES (gen_random_uuid(), $1, 100.0, 0.0, 100.0, NOW());
  `, [testFishId]);

  // --------------------------------------------------------------------------
  // Scenario 1: Missing Worker Store Identity Fails Closed on Live Database
  // --------------------------------------------------------------------------
  await t.test('1. Missing worker store identity is rejected with STORE_MISMATCH (403)', async () => {
    const billRes = await pool.query(`
      INSERT INTO bills (id, customer_id, bill_number, image_url, status, store_id, created_at)
      VALUES (gen_random_uuid(), $1, 'BILL-STORE-CHECK-1', '/uploads/bills/test.jpg', 'CONFIRMED', 'store_phase4_live_a', NOW())
      RETURNING id;
    `, [testCustomerId]);
    const billId = billRes.rows[0].id;
    cleanupBillIds.push(billId);

    await assert.rejects(
      async () => {
        await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
          billId,
          customerId: testCustomerId,
          workerId: testWorkerId,
          workerStoreId: null, // Missing worker store
          paymentMethod: 'CASH',
          items: [{ fishId: testFishId, quantityKg: 1.0 }],
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'STORE_MISMATCH');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Missing Bill Store Identity Fails Closed on Live Database
  // --------------------------------------------------------------------------
  await t.test('2. Missing bill store identity is rejected with STORE_MISMATCH (403)', async () => {
    const billRes = await pool.query(`
      INSERT INTO bills (id, customer_id, bill_number, image_url, status, store_id, created_at)
      VALUES (gen_random_uuid(), $1, 'BILL-STORE-CHECK-2', '/uploads/bills/test.jpg', 'CONFIRMED', NULL, NOW())
      RETURNING id;
    `, [testCustomerId]);
    const billId = billRes.rows[0].id;
    cleanupBillIds.push(billId);

    await assert.rejects(
      async () => {
        await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
          billId,
          customerId: testCustomerId,
          workerId: testWorkerId,
          workerStoreId: 'store_phase4_live_a',
          paymentMethod: 'CASH',
          items: [{ fishId: testFishId, quantityKg: 1.0 }],
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'STORE_MISMATCH');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Cross-Store Checkout Attempt Fails Closed on Live Database
  // --------------------------------------------------------------------------
  await t.test('3. Cross-store checkout attempt is rejected with STORE_MISMATCH (403)', async () => {
    const billRes = await pool.query(`
      INSERT INTO bills (id, customer_id, bill_number, image_url, status, store_id, created_at)
      VALUES (gen_random_uuid(), $1, 'BILL-STORE-CHECK-3', '/uploads/bills/test.jpg', 'CONFIRMED', 'store_phase4_live_b', NOW())
      RETURNING id;
    `, [testCustomerId]);
    const billId = billRes.rows[0].id;
    cleanupBillIds.push(billId);

    await assert.rejects(
      async () => {
        await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
          billId,
          customerId: testCustomerId,
          workerId: testWorkerId,
          workerStoreId: 'store_phase4_live_a', // Worker at A, bill at B
          paymentMethod: 'CASH',
          items: [{ fishId: testFishId, quantityKg: 1.0 }],
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'STORE_MISMATCH');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Concurrent Checkout Race on Distinct Bills with Same Bill Number
  // --------------------------------------------------------------------------
  await t.test('4. Concurrent checkout race on distinct bills with same bill number serializes and rejects duplicate with 409', async () => {
    const sharedBillNumber = 'RACE-BILL-' + Date.now();

    // Insert two distinct bills with the exact same bill number in CONFIRMED state
    const bill1Res = await pool.query(`
      INSERT INTO bills (id, customer_id, bill_number, image_url, status, store_id, created_at)
      VALUES (gen_random_uuid(), $1, $2, '/uploads/bills/test.jpg', 'CONFIRMED', 'store_phase4_live_a', NOW())
      RETURNING id;
    `, [testCustomerId, sharedBillNumber]);
    const bill1Id = bill1Res.rows[0].id;
    cleanupBillIds.push(bill1Id);

    const bill2Res = await pool.query(`
      INSERT INTO bills (id, customer_id, bill_number, image_url, status, store_id, created_at)
      VALUES (gen_random_uuid(), $1, $2, '/uploads/bills/test.jpg', 'CONFIRMED', 'store_phase4_live_a', NOW())
      RETURNING id;
    `, [testCustomerId, sharedBillNumber]);
    const bill2Id = bill2Res.rows[0].id;
    cleanupBillIds.push(bill2Id);

    // Launch concurrent checkout attempts simultaneously
    const results = await Promise.allSettled([
      posFinalizationEngine.finalizePhysicalPurchaseAtomic({
        billId: bill1Id,
        customerId: testCustomerId,
        workerId: testWorkerId,
        workerStoreId: 'store_phase4_live_a',
        paymentMethod: 'CASH',
        items: [{ fishId: testFishId, quantityKg: 1.0 }],
      }),
      posFinalizationEngine.finalizePhysicalPurchaseAtomic({
        billId: bill2Id,
        customerId: testCustomerId,
        workerId: testWorkerId,
        workerStoreId: 'store_phase4_live_a',
        paymentMethod: 'CASH',
        items: [{ fishId: testFishId, quantityKg: 1.0 }],
      }),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent checkout must succeed');
    assert.strictEqual(rejected.length, 1, 'Exactly one concurrent checkout must be rejected');

    const winningTx = fulfilled[0].value;
    cleanupTxIds.push(winningTx.id);

    const losingError = rejected[0].reason;
    assert.strictEqual(losingError.code, 'BILL_ALREADY_PROCESSED', 'Losing request must be rejected with BILL_ALREADY_PROCESSED');
    assert.strictEqual(losingError.status, 409, 'Losing request must return HTTP 409 Conflict');

    // Verify database state: exactly one transaction committed
    const txCheck = await pool.query(`
      SELECT t.id, t.transaction_number, t.bill_id, t.status 
      FROM transactions t 
      WHERE t.id = $1;
    `, [winningTx.id]);
    assert.strictEqual(txCheck.rows.length, 1);
    assert.strictEqual(txCheck.rows[0].status, 'COMPLETED');

    // Verify bills state: winner is PROCESSED, loser remains unfinalized
    const billsCheck = await pool.query(`
      SELECT id, status 
      FROM bills 
      WHERE id IN ($1, $2)
      ORDER BY id;
    `, [bill1Id, bill2Id]);

    const winnerBill = billsCheck.rows.find(b => b.id === winningTx.bill_id || b.id === bill1Id || b.id === bill2Id);
    const statuses = billsCheck.rows.map(b => b.status).sort();
    assert.deepStrictEqual(statuses, ['CONFIRMED', 'PROCESSED'], 'One bill should be PROCESSED and the other CONFIRMED');
  });

  // --------------------------------------------------------------------------
  // 5. Worker database store reassignment prevents old token from authorizing previous store
  // --------------------------------------------------------------------------
  await t.test('5. Worker database store reassignment prevents old token from authorizing previous store', async () => {
    const rawMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const passwordHash = workerRepository.hashPassword('Worker@1234');

    // Create worker assigned to store_reassign_live_a
    const workerRes = await pool.query(`
      INSERT INTO workers (id, name, mobile_number, password_hash, store_id, active, created_at, updated_at)
      VALUES (gen_random_uuid(), 'Live Reassigned Worker', $1, $2, 'store_reassign_live_a', true, NOW(), NOW())
      RETURNING id, name, mobile_number, store_id, active;
    `, [rawMobile, passwordHash]);
    const liveWorker = workerRes.rows[0];
    cleanupWorkerIds.push(liveWorker.id);

    // Authenticate worker against live DB
    const auth = await workerEngine.authenticateWorker({
      mobileNumber: rawMobile,
      password: 'Worker@1234',
    });
    assert.ok(auth.token);
    assert.strictEqual(auth.worker.id, liveWorker.id);

    // Initial session resolves to store_reassign_live_a
    const session1 = await workerEngine.verifyWorkerSessionAsync(auth.token);
    assert.strictEqual(session1.storeId, 'store_reassign_live_a');
    assert.strictEqual(session1.worker.store_id, 'store_reassign_live_a');

    // Reassign worker in PostgreSQL to store_reassign_live_b
    await pool.query(`
      UPDATE workers
      SET store_id = 'store_reassign_live_b', updated_at = NOW()
      WHERE id = $1;
    `, [liveWorker.id]);

    // Using the SAME JWT token, session verification MUST resolve store_reassign_live_b
    const session2 = await workerEngine.verifyWorkerSessionAsync(auth.token);
    assert.strictEqual(session2.storeId, 'store_reassign_live_b', 'Authoritative DB record must override JWT payload claim');
    assert.strictEqual(session2.worker.store_id, 'store_reassign_live_b');

    // Attempt to finalize physical purchase on Store A bill with old token must be rejected with 403 STORE_MISMATCH
    const billRes = await pool.query(`
      INSERT INTO bills (id, customer_id, bill_number, image_url, status, store_id, created_at)
      VALUES (gen_random_uuid(), $1, $2, '/uploads/bills/reassign_test.jpg', 'CONFIRMED', 'store_reassign_live_a', NOW())
      RETURNING id;
    `, [testCustomerId, `REASSIGN-${Date.now()}`]);
    const billId = billRes.rows[0].id;
    cleanupBillIds.push(billId);

    await assert.rejects(
      async () => {
        await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
          billId,
          customerId: testCustomerId,
          workerId: liveWorker.id,
          workerStoreId: session2.storeId, // 'store_reassign_live_b'
          paymentMethod: 'CASH',
          items: [{ fishId: testFishId, quantityKg: 0.5 }],
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'STORE_MISMATCH');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );

    // When worker's store is cleared to NULL in PostgreSQL
    await pool.query(`
      UPDATE workers
      SET store_id = NULL, updated_at = NOW()
      WHERE id = $1;
    `, [liveWorker.id]);

    const session3 = await workerEngine.verifyWorkerSessionAsync(auth.token);
    assert.strictEqual(session3.storeId, null, 'Unassigned worker in DB must resolve session storeId to null');
  });

  // --------------------------------------------------------------------------
  // 6. Live booking creation persists store_id, and cross-store worker is rejected with 403
  // --------------------------------------------------------------------------
  await t.test('6. Live booking creation persists store_id, and cross-store worker is rejected with 403', async () => {
    const bookingCode = `BK-INT-${Date.now().toString().slice(-6)}`;
    const expiresAt = new Date(Date.now() + 48 * 3600000);

    // Insert booking using bookingRepository with explicit store_id
    const liveBooking = await bookingRepository.createBooking(pool, {
      customerId: testCustomerId,
      bookingCode,
      qrCodeData: 'mock-qr-live-integration',
      totalAmount: 200,
      subCreditUsed: 0,
      razorpayPaid: 200,
      status: 'CONFIRMED',
      expiresAt,
      storeId: 'store_live_booking_alpha',
    });
    cleanupBookingIds.push(liveBooking.id);

    // Verify persisted store_id in PostgreSQL table
    const dbRow = await pool.query(`
      SELECT id, booking_code, store_id, status
      FROM bookings
      WHERE id = $1;
    `, [liveBooking.id]);
    assert.strictEqual(dbRow.rows.length, 1);
    assert.strictEqual(dbRow.rows[0].store_id, 'store_live_booking_alpha', 'bookings.store_id must be persisted in database');

    // Fetch through findBookingById
    const fetched = await bookingRepository.findBookingById(liveBooking.id, testCustomerId, pool);
    assert.strictEqual(fetched.store_id, 'store_live_booking_alpha');

    // Attempt by worker at store_live_booking_beta MUST be rejected with 403 STORE_MISMATCH
    await assert.rejects(
      async () => {
        await workerEngine.completeBookingOrder({
          bookingId: liveBooking.id,
          workerId: testWorkerId,
          workerStoreId: 'store_live_booking_beta',
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'STORE_MISMATCH');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );

    // Worker with no store assignment fails closed with 403 STORE_MISMATCH
    await assert.rejects(
      async () => {
        await workerEngine.completeBookingOrder({
          bookingId: liveBooking.id,
          workerId: testWorkerId,
          workerStoreId: null,
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
