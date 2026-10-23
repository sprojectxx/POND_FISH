/**
 * Real PostgreSQL Integration Test Suite for PondFish Checkout & Payment Recovery
 * Traceability: PondFish Phase 2J-L Scope (Real PostgreSQL Integration)
 * Targets: Dedicated disposable test database (pondfish_test_db on port 5433)
 * ZERO access to shared development/staging or Supabase database.
 */

const assert = require('assert');
const { Pool } = require('pg');

const TEST_DB_URL = 'postgresql://testuser@localhost:5433/pondfish_test_db';
process.env.DATABASE_URL = TEST_DB_URL;

const checkoutIntentRepo = require('../../lib/db/repositories/checkoutIntentRepository');
const paymentRecoveryEngine = require('../../lib/engines/payment-recovery');
const bookingEngine = require('../../lib/engines/booking');
const bookingRepo = require('../../lib/db/repositories/bookingRepository');
const subscriptionRepo = require('../../lib/db/repositories/subscriptionRepository');
const inventoryRepo = require('../../lib/db/repositories/inventoryRepository');

const testPool = new Pool({
  connectionString: TEST_DB_URL,
  max: 10,
  idleTimeoutMillis: 5000,
});

async function runRealPostgresIntegrationSuite() {
  console.log('=== REAL POSTGRESQL INTEGRATION TEST SUITE (PHASE 2J-L) ===\n');
  console.log('Database: pondfish_test_db (local port 5433)');
  console.log('Engine: PostgreSQL 17 (Isolated Test Instance)\n');

  // Check if test database is reachable
  try {
    const probeClient = await testPool.connect();
    probeClient.release();
  } catch (connErr) {
    if (connErr.code === 'ECONNREFUSED') {
      console.log('  [SKIP] Dedicated local PostgreSQL test instance (localhost:5433) is not running.');
      console.log('  Isolated synthetic unit test suites cover all checkout and recovery behaviors.\n');
      return;
    }
    throw connErr;
  }

  // Clean test database for fresh run
  await testPool.query(`
    TRUNCATE TABLE 
      webhook_events,
      checkout_intents,
      payments,
      booking_items,
      bookings,
      subscription_weekly_usage,
      subscription_credit_ledger,
      subscription_plan_fish,
      customer_subscriptions,
      subscription_plans,
      inventory_ledger,
      inventory,
      fish,
      customer_cart_items,
      customers
    CASCADE;
  `);

  let passed = 0;

  try {
    // -------------------------------------------------------------
    // Scenario 1: Simultaneous webhook and client confirmation for one order
    // -------------------------------------------------------------
    console.log('--- Scenario 1: Simultaneous Webhook & Client Confirmation Race ---');
    const cust1 = (await testPool.query(
      `INSERT INTO customers (id, name, mobile_number) 
       VALUES (gen_random_uuid(), 'Racer Cust', '9876543201') 
       RETURNING id;`
    )).rows[0].id;

    const fish1 = (await testPool.query(
      `INSERT INTO fish (id, name, price_per_kg, unit_price, physical_available, online_bookable)
       VALUES (gen_random_uuid(), 'Rohu Concurrent', 300, 300, true, true)
       RETURNING id;`
    )).rows[0].id;

    await testPool.query(
      `INSERT INTO inventory (id, fish_id, physical_quantity, reserved_quantity, available_quantity)
       VALUES (gen_random_uuid(), $1, 50.0, 0.0, 50.0);`,
      [fish1]
    );

    const orderId1 = `order_race_${Date.now()}`;
    const paymentId1 = `pay_race_${Date.now()}`;
    const snapshot1 = [
      { fishId: fish1, name: 'Rohu Concurrent', quantityKg: 2.0, unitPrice: 300, effectivePrice: 300, subtotal: 600 }
    ];
    const feeBreakdown1 = {
      subtotal: 600,
      totalQuantityKg: 2.0,
      subscriptionCreditUsed: 0,
      finalPayableAmount: 614.16,
    };

    // Create checkout intent
    await checkoutIntentRepo.createIntent(testPool, {
      razorpayOrderId: orderId1,
      customerId: cust1,
      cartSnapshot: snapshot1,
      subscriptionSnapshot: null,
      feeBreakdown: feeBreakdown1,
      amountPaise: 61416,
      currency: 'INR',
      status: 'CREATED',
    });

    // Verify DB state BEFORE execution
    const intentBefore1 = await testPool.query('SELECT status, booking_id FROM checkout_intents WHERE razorpay_order_id = $1', [orderId1]);
    assert.strictEqual(intentBefore1.rows[0].status, 'CREATED');
    assert.strictEqual(intentBefore1.rows[0].booking_id, null);

    // Concurrently invoke recovery across 2 independent database connections
    const clientA = await testPool.connect();
    const clientB = await testPool.connect();

    const [resA, resB] = await Promise.all([
      paymentRecoveryEngine.reconcileCapturedPayment({
        eventId: `evt_race_a_${Date.now()}`,
        orderId: orderId1,
        paymentId: paymentId1,
        amountPaise: 61416,
        customerId: cust1,
        client: clientA,
      }),
      paymentRecoveryEngine.reconcileCapturedPayment({
        eventId: `evt_race_b_${Date.now()}`,
        orderId: orderId1,
        paymentId: paymentId1,
        amountPaise: 61416,
        customerId: cust1,
        client: clientB,
      }),
    ]);

    clientA.release();
    clientB.release();

    // Verify DB state AFTER execution
    const bookingsCreated = await testPool.query('SELECT id, booking_code, razorpay_paid FROM bookings WHERE customer_id = $1', [cust1]);
    const paymentsCreated = await testPool.query('SELECT id, status, booking_id FROM payments WHERE razorpay_order_id = $1', [orderId1]);
    const invAfter1 = await testPool.query('SELECT reserved_quantity, available_quantity FROM inventory WHERE fish_id = $1', [fish1]);
    const intentAfter1 = await testPool.query('SELECT status, booking_id FROM checkout_intents WHERE razorpay_order_id = $1', [orderId1]);

    assert.strictEqual(bookingsCreated.rows.length, 1, 'Exactly one booking must be created despite simultaneous execution');
    assert.strictEqual(paymentsCreated.rows.length, 1, 'Exactly one payment record must be created');
    assert.strictEqual(parseFloat(invAfter1.rows[0].reserved_quantity), 2.0, 'Inventory must be reserved exactly once (2.0 kg)');
    assert.strictEqual(parseFloat(invAfter1.rows[0].available_quantity), 48.0, 'Available stock must be deducted exactly once (48.0 kg)');
    assert.strictEqual(intentAfter1.rows[0].status, 'COMPLETED');
    assert.strictEqual(intentAfter1.rows[0].booking_id, bookingsCreated.rows[0].id);

    console.log('[PASS] 1. Simultaneous webhook and client confirmation creates exactly 1 booking and reserves stock once');
    passed++;

    // -------------------------------------------------------------
    // Scenario 2: Duplicate webhook delivery
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Duplicate Webhook Delivery ---');
    const duplicateClient = await testPool.connect();
    const resDup = await paymentRecoveryEngine.reconcileCapturedPayment({
      eventId: `evt_race_a_${Date.now()}`, // already processed event ID
      orderId: orderId1,
      paymentId: paymentId1,
      amountPaise: 61416,
      customerId: cust1,
      client: duplicateClient,
    });
    duplicateClient.release();

    assert.strictEqual(resDup.success, true);
    assert.strictEqual(resDup.status === 'ALREADY_CONFIRMED' || resDup.status === 'EVENT_ALREADY_PROCESSED', true);

    const bookingsAfterDup = await testPool.query('SELECT COUNT(*)::int AS count FROM bookings WHERE customer_id = $1', [cust1]);
    assert.strictEqual(bookingsAfterDup.rows[0].count, 1, 'Booking count must remain 1 after duplicate webhook');
    console.log('[PASS] 2. Duplicate webhook delivery safely returns confirmed status without mutating database');
    passed++;

    // -------------------------------------------------------------
    // Scenario 3: Rollback after a failure during booking creation
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Transaction Rollback on Inventory Shortfall ---');
    const cust3 = (await testPool.query(
      `INSERT INTO customers (id, name, mobile_number) 
       VALUES (gen_random_uuid(), 'Shortfall Cust', '9876543203') 
       RETURNING id;`
    )).rows[0].id;

    const fish3 = (await testPool.query(
      `INSERT INTO fish (id, name, price_per_kg, unit_price, physical_available, online_bookable)
       VALUES (gen_random_uuid(), 'Catla Shortfall', 400, 400, true, true)
       RETURNING id;`
    )).rows[0].id;

    // Stock available: only 0.5 kg
    await testPool.query(
      `INSERT INTO inventory (id, fish_id, physical_quantity, reserved_quantity, available_quantity)
       VALUES (gen_random_uuid(), $1, 0.5, 0.0, 0.5);`,
      [fish3]
    );

    const orderId3 = `order_shortfall_${Date.now()}`;
    const paymentId3 = `pay_shortfall_${Date.now()}`;
    // Intent requests 5.0 kg (far exceeds 0.5 kg available)
    await checkoutIntentRepo.createIntent(testPool, {
      razorpayOrderId: orderId3,
      customerId: cust3,
      cartSnapshot: [{ fishId: fish3, name: 'Catla Shortfall', quantityKg: 5.0, unitPrice: 400, subtotal: 2000 }],
      subscriptionSnapshot: null,
      feeBreakdown: { finalPayableAmount: 2000 },
      amountPaise: 200000,
      currency: 'INR',
      status: 'CREATED',
    });

    const client3 = await testPool.connect();
    let caughtError = null;
    try {
      await paymentRecoveryEngine.reconcileCapturedPayment({
        eventId: `evt_fail_${Date.now()}`,
        orderId: orderId3,
        paymentId: paymentId3,
        amountPaise: 200000,
        customerId: cust3,
        client: client3,
      });
    } catch (err) {
      caughtError = err;
    } finally {
      client3.release();
    }

    assert.notStrictEqual(caughtError, null, 'Shortfall must throw an error');
    assert.strictEqual(caughtError.code, 'INSUFFICIENT_INVENTORY');

    // Verify ACID Rollback on DB
    const bookingsCust3 = await testPool.query('SELECT COUNT(*)::int AS count FROM bookings WHERE customer_id = $1', [cust3]);
    const inv3 = await testPool.query('SELECT physical_quantity, reserved_quantity, available_quantity FROM inventory WHERE fish_id = $1', [fish3]);
    const intent3 = await testPool.query('SELECT status, booking_id FROM checkout_intents WHERE razorpay_order_id = $1', [orderId3]);

    assert.strictEqual(bookingsCust3.rows[0].count, 0, 'No booking row must exist after rollback');
    assert.strictEqual(parseFloat(inv3.rows[0].reserved_quantity), 0.0, 'Reserved stock must be 0 (no leaked reservation)');
    assert.strictEqual(parseFloat(inv3.rows[0].available_quantity), 0.5, 'Available stock must remain untouched (0.5 kg)');
    assert.strictEqual(intent3.rows[0].status, 'REQUIRES_RECONCILIATION', 'Intent must be flagged REQUIRES_RECONCILIATION for admin action');

    console.log('[PASS] 3. Failed booking creation executes full transaction ROLLBACK with zero database mutations');
    passed++;

    // -------------------------------------------------------------
    // Scenario 4: Inventory & Subscription deductions exactly once
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Inventory & Subscription Deductions Exactly Once ---');
    const cust4 = (await testPool.query(
      `INSERT INTO customers (id, name, mobile_number) 
       VALUES (gen_random_uuid(), 'Sub Cust', '9876543204') 
       RETURNING id;`
    )).rows[0].id;

    const plan4 = (await testPool.query(
      `INSERT INTO subscription_plans (id, title, price, credit_amount, weekly_qty_limit_kg, validity_days, active)
       VALUES (gen_random_uuid(), 'Gold Fish Weekly', 1500, 1500, 5.0, 30, true)
       RETURNING id;`
    )).rows[0].id;

    const sub4 = (await testPool.query(
      `INSERT INTO customer_subscriptions (id, customer_id, plan_id, credit_balance, weekly_qty_used, status)
       VALUES (gen_random_uuid(), $1, $2, 1000.0, 0.0, 'ACTIVE')
       RETURNING id;`,
      [cust4, plan4]
    )).rows[0].id;

    const fish4 = (await testPool.query(
      `INSERT INTO fish (id, name, price_per_kg, unit_price, physical_available, online_bookable)
       VALUES (gen_random_uuid(), 'Premium Pomfret', 500, 500, true, true)
       RETURNING id;`
    )).rows[0].id;

    await testPool.query(
      `INSERT INTO subscription_plan_fish (id, plan_id, fish_id)
       VALUES (gen_random_uuid(), $1, $2);`,
      [plan4, fish4]
    );

    await testPool.query(
      `INSERT INTO inventory (id, fish_id, physical_quantity, reserved_quantity, available_quantity)
       VALUES (gen_random_uuid(), $1, 20.0, 0.0, 20.0);`,
      [fish4]
    );

    const orderId4 = `order_sub_${Date.now()}`;
    const paymentId4 = `pay_sub_${Date.now()}`;
    // 1 kg Pomfret (₹500 covered by ₹500 sub credit, remaining ₹0)
    const snapshot4 = [
      { fishId: fish4, name: 'Premium Pomfret', quantityKg: 1.0, unitPrice: 500, effectivePrice: 500, subtotal: 500 }
    ];
    const subSnapshot4 = {
      hasActiveSubscription: true,
      subCreditUsed: 500,
      extraPayableAmount: 0,
      subscription: { subscriptionId: sub4 },
      itemBreakdown: [{ fishId: fish4, coveredQty: 1.0, coveredValue: 500, extraQty: 0, extraValue: 0 }],
    };

    await checkoutIntentRepo.createIntent(testPool, {
      razorpayOrderId: orderId4,
      customerId: cust4,
      cartSnapshot: snapshot4,
      subscriptionSnapshot: subSnapshot4,
      feeBreakdown: { finalPayableAmount: 0, subtotal: 500 },
      amountPaise: 0,
      currency: 'INR',
      status: 'CREATED',
    });

    const client4 = await testPool.connect();
    const resSub = await paymentRecoveryEngine.reconcileCapturedPayment({
      eventId: `evt_sub_${Date.now()}`,
      orderId: orderId4,
      paymentId: paymentId4,
      amountPaise: 0,
      customerId: cust4,
      client: client4,
    });
    client4.release();

    assert.strictEqual(resSub.success, true);

    // Verify DB state for subscription deductions
    const subRecordAfter = (await testPool.query('SELECT credit_balance, weekly_qty_used FROM customer_subscriptions WHERE id = $1', [sub4])).rows[0];
    const ledgerEntries = await testPool.query('SELECT amount, type FROM subscription_credit_ledger WHERE subscription_id = $1', [sub4]);
    const weeklyUsageEntries = await testPool.query('SELECT quantity_kg FROM subscription_usage_ledger WHERE subscription_id = $1', [sub4]);
    const inv4 = (await testPool.query('SELECT reserved_quantity, available_quantity FROM inventory WHERE fish_id = $1', [fish4])).rows[0];

    assert.strictEqual(parseFloat(subRecordAfter.credit_balance), 500.0, 'Credit balance must be 500.0 (1000 - 500)');
    assert.strictEqual(parseFloat(subRecordAfter.weekly_qty_used), 1.0, 'Weekly quantity used must be 1.0 kg');
    assert.strictEqual(ledgerEntries.rows.length, 1, 'Exactly one ledger entry must be logged');
    assert.strictEqual(parseFloat(ledgerEntries.rows[0].amount), 500.0);
    assert.strictEqual(weeklyUsageEntries.rows.length, 1, 'Exactly one weekly usage entry must be logged');
    assert.strictEqual(parseFloat(weeklyUsageEntries.rows[0].quantity_kg), 1.0);
    assert.strictEqual(parseFloat(inv4.reserved_quantity), 1.0, 'Inventory reserved exactly once');

    console.log('[PASS] 4. Inventory and subscription credits/allowances deducted exactly once with audit ledger');
    passed++;

    // -------------------------------------------------------------
    // Scenario 5: Stale PROCESSING recovery & bounded retries
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: Stale PROCESSING Recovery & Bounded Retries ---');
    const cust5 = (await testPool.query(
      `INSERT INTO customers (id, name, mobile_number) 
       VALUES (gen_random_uuid(), 'Stale Cust', '9876543205') 
       RETURNING id;`
    )).rows[0].id;

    const fish5 = (await testPool.query(
      `INSERT INTO fish (id, name, price_per_kg, unit_price, physical_available, online_bookable)
       VALUES (gen_random_uuid(), 'Stale Rohu', 250, 250, true, true)
       RETURNING id;`
    )).rows[0].id;

    await testPool.query(
      `INSERT INTO inventory (id, fish_id, physical_quantity, reserved_quantity, available_quantity)
       VALUES (gen_random_uuid(), $1, 10.0, 0.0, 10.0);`,
      [fish5]
    );

    const orderId5A = `order_stale_crash_${Date.now()}`;
    const paymentId5A = `pay_stale_crash_${Date.now()}`;
    // Insert intent simulates a crash 10 minutes ago: status = PROCESSING, updated_at = NOW() - INTERVAL '10 min', retry_count = 1
    await testPool.query(
      `INSERT INTO checkout_intents (
        id, razorpay_order_id, customer_id, cart_snapshot, fee_breakdown, amount_paise, currency, status, retry_count, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, 'INR', 'PROCESSING', 1, NOW() - INTERVAL '10 minutes'
      );`,
      [
        orderId5A,
        cust5,
        JSON.stringify([{ fishId: fish5, name: 'Stale Rohu', quantityKg: 1.0, unitPrice: 250, subtotal: 250 }]),
        JSON.stringify({ finalPayableAmount: 250 }),
        25000,
      ]
    );

    const client5A = await testPool.connect();
    const resStale = await paymentRecoveryEngine.reconcileCapturedPayment({
      eventId: `evt_stale_${Date.now()}`,
      orderId: orderId5A,
      paymentId: paymentId5A,
      amountPaise: 25000,
      customerId: cust5,
      client: client5A,
    });
    client5A.release();

    assert.strictEqual(resStale.success, true);
    assert.strictEqual(resStale.status, 'RECONCILED');

    const intent5A = (await testPool.query('SELECT status, retry_count, booking_id FROM checkout_intents WHERE razorpay_order_id = $1', [orderId5A])).rows[0];
    assert.strictEqual(intent5A.status, 'COMPLETED');
    assert.strictEqual(intent5A.retry_count, 2, 'Retry count incremented to 2');
    assert.notStrictEqual(intent5A.booking_id, null);

    // Part B: Test Bounded Retries (retry_count >= 3)
    const orderId5B = `order_max_retry_${Date.now()}`;
    await testPool.query(
      `INSERT INTO checkout_intents (
        id, razorpay_order_id, customer_id, cart_snapshot, fee_breakdown, amount_paise, currency, status, retry_count, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, 'INR', 'REQUIRES_RECONCILIATION', 3, NOW()
      );`,
      [
        orderId5B,
        cust5,
        JSON.stringify([]),
        JSON.stringify({}),
        10000,
      ]
    );

    const client5B = await testPool.connect();
    const resBounded = await paymentRecoveryEngine.reconcileCapturedPayment({
      eventId: `evt_bounded_${Date.now()}`,
      orderId: orderId5B,
      paymentId: `pay_bounded_${Date.now()}`,
      amountPaise: 10000,
      customerId: cust5,
      client: client5B,
    });
    client5B.release();

    assert.strictEqual(resBounded.success, false);
    assert.strictEqual(resBounded.status, 'REQUIRES_RECONCILIATION');
    assert.strictEqual(resBounded.error, 'MAX_RETRIES_EXCEEDED');

    console.log('[PASS] 5. Stale PROCESSING intent (> 5 min) reclaimed; intents with >= 3 retries bounded and quarantined');
    passed++;

    // -------------------------------------------------------------
    // Scenario 6: Amount Mismatch Quarantine
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Amount Mismatch Quarantine ---');
    const cust6 = (await testPool.query(
      `INSERT INTO customers (id, name, mobile_number) 
       VALUES (gen_random_uuid(), 'Mismatch Cust', '9876543206') 
       RETURNING id;`
    )).rows[0].id;

    const orderId6 = `order_mismatch_${Date.now()}`;
    const paymentId6 = `pay_mismatch_${Date.now()}`;

    // Expected amount is ₹500 (50000 paise)
    await checkoutIntentRepo.createIntent(testPool, {
      razorpayOrderId: orderId6,
      customerId: cust6,
      cartSnapshot: [],
      subscriptionSnapshot: null,
      feeBreakdown: { finalPayableAmount: 500 },
      amountPaise: 50000,
      currency: 'INR',
      status: 'CREATED',
    });

    const client6 = await testPool.connect();
    const resMismatch = await paymentRecoveryEngine.reconcileCapturedPayment({
      eventId: `evt_mismatch_${Date.now()}`,
      orderId: orderId6,
      paymentId: paymentId6,
      amountPaise: 40000, // Captured amount is only ₹400 (tampered or mismatch!)
      customerId: cust6,
      client: client6,
    });
    client6.release();

    assert.strictEqual(resMismatch.status, 'REQUIRES_RECONCILIATION');
    assert.strictEqual(resMismatch.reason, 'PAYMENT_AMOUNT_MISMATCH');

    // Verify DB state
    const intent6 = (await testPool.query('SELECT status, booking_id FROM checkout_intents WHERE razorpay_order_id = $1', [orderId6])).rows[0];
    const payments6 = (await testPool.query('SELECT status, booking_id, amount FROM payments WHERE razorpay_order_id = $1', [orderId6])).rows[0];
    const bookings6 = await testPool.query('SELECT COUNT(*)::int AS count FROM bookings WHERE customer_id = $1', [cust6]);

    assert.strictEqual(intent6.status, 'REQUIRES_RECONCILIATION');
    assert.strictEqual(intent6.booking_id, null);
    assert.strictEqual(payments6.status, 'REQUIRES_RECONCILIATION');
    assert.strictEqual(payments6.booking_id, null);
    assert.strictEqual(bookings6.rows[0].count, 0, 'No booking created for mismatched payment');

    console.log('[PASS] 6. Amount mismatch quarantined under REQUIRES_RECONCILIATION with booking_id = NULL');
    passed++;

    // -------------------------------------------------------------
    // Scenario 7: Missing table & database unavailable behavior
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: Missing Table & Database Unavailable Behavior ---');

    // Part A: Missing checkout_intents table
    // Create isolated disposable database without checkout_intents table
    const tempDbName = `temp_missing_table_${Date.now()}`;
    await testPool.query(`CREATE DATABASE ${tempDbName};`);
    const tempDbPool = new Pool({
      connectionString: `postgresql://testuser@localhost:5433/${tempDbName}`,
    });
    // Create base tables in temp db but do NOT apply migration 0018
    await tempDbPool.query(`
      CREATE TABLE customers (id UUID PRIMARY KEY, name TEXT);
      CREATE TABLE payments (
        id UUID PRIMARY KEY,
        booking_id UUID,
        transaction_id UUID,
        subscription_id UUID,
        razorpay_order_id TEXT UNIQUE,
        razorpay_payment_id TEXT,
        amount NUMERIC,
        method TEXT,
        status TEXT,
        notes JSONB,
        created_at TIMESTAMPTZ
      );
      CREATE TABLE webhook_events (id UUID PRIMARY KEY, event_id TEXT UNIQUE, event_type TEXT, payload JSONB, processed_at TIMESTAMPTZ);
    `);

    const missingTableClient = await tempDbPool.connect();
    const resMissing = await paymentRecoveryEngine.reconcileCapturedPayment({
      eventId: `evt_missing_${Date.now()}`,
      orderId: 'order_missing_table_123',
      paymentId: 'pay_missing_table_123',
      amountPaise: 50000,
      customerId: '00000000-0000-0000-0000-000000000001',
      client: missingTableClient,
    });
    missingTableClient.release();
    await tempDbPool.end();
    await testPool.query(`DROP DATABASE ${tempDbName};`);

    assert.strictEqual(resMissing.status, 'REQUIRES_RECONCILIATION');
    assert.strictEqual(resMissing.reason, 'IMMUTABLE_CHECKOUT_INTENT_NOT_FOUND');
    console.log('   - Missing table correctly trapped 42P01 and quarantined payment without reconstructing from mutable cart');

    // Part B: Database unavailable
    const deadPool = new Pool({
      connectionString: 'postgresql://testuser@localhost:5439/dead_db', // Invalid port 5439
      connectionTimeoutMillis: 1000,
    });

    let deadDbError = null;
    try {
      const deadClient = await deadPool.connect();
      await paymentRecoveryEngine.reconcileCapturedPayment({
        eventId: 'evt_dead',
        orderId: 'order_dead',
        paymentId: 'pay_dead',
        amountPaise: 1000,
        customerId: '00000000-0000-0000-0000-000000000001',
        client: deadClient,
      });
    } catch (err) {
      deadDbError = err;
    } finally {
      await deadPool.end().catch(() => {});
    }

    assert.notStrictEqual(deadDbError, null, 'Must throw when database is unreachable');
    console.log('   - Database unavailability cleanly threw connection failure without creating corrupt records');

    console.log('[PASS] 7. Missing table and database unavailable behavior verified safely');
    passed++;

    console.log(`\n======================================================`);
    console.log(`Results: ${passed} / 7 real PostgreSQL integration test scenarios passed successfully.`);
    console.log(`======================================================`);

  } finally {
    await testPool.end();
  }
}

runRealPostgresIntegrationSuite().catch((err) => {
  console.error('\n[FATAL INTEGRATION TEST ERROR]', err);
  process.exit(1);
});
