/**
 * Authoritative PostgreSQL Integration Test Suite for Subscription Lifecycle & Payment Replay
 * Traceability: PondFish Phase 2 Schema & Replay Integrity Gate
 * Runs against real PostgreSQL database with Migration 0019 (payments.subscription_id) applied.
 * ZERO mocked database queries — exercises real SQL queries, foreign keys, constraints, and transactions.
 */

const assert = require('assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 1. Resolve connection string from environment or .env without exposing credentials
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

test('PostgreSQL Subscription Lifecycle & Payment Replay Suite (Migration 0019)', async (t) => {
  if (!connectionString) {
    t.diagnostic('DATABASE_URL not configured. Skipping real PostgreSQL integration test.');
    return;
  }

  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  // Ensure process.env.DATABASE_URL is set so lib/db/pool.js uses the same connection
  process.env.DATABASE_URL = connectionString;
  const subscriptionRepository = require('../../lib/db/repositories/subscriptionRepository');

  // Verify connection
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    t.diagnostic(`Cannot connect to PostgreSQL: ${err.message}. Skipping live test.`);
    await pool.end();
    return;
  }

  // Track created entities for rigorous cleanup
  const createdCustomerIds = [];
  const createdPlanIds = [];
  const createdPaymentIds = [];
  const createdSubscriptionIds = [];

  try {
    // -------------------------------------------------------------------------
    // Pre-flight Schema Verification (Migration 0019)
    // -------------------------------------------------------------------------
    await t.test('Pre-flight: Verify Migration 0019 is applied to target PostgreSQL database', async () => {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'subscription_id';
      `);
      assert.strictEqual(colRes.rows.length, 1, 'Column payments.subscription_id must exist in PostgreSQL');
      assert.strictEqual(colRes.rows[0].data_type, 'uuid');

      const indexRes = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'payments' AND indexname = 'idx_payments_subscription_id';
      `);
      assert.strictEqual(indexRes.rows.length, 1, 'Index idx_payments_subscription_id must exist in PostgreSQL');

      const fkRes = await client.query(`
        SELECT conname, pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'payments' AND c.conname LIKE '%subscription_id%';
      `);
      assert.strictEqual(fkRes.rows.length, 1, 'Foreign key on payments.subscription_id must exist');
      assert.ok(fkRes.rows[0].def.includes('REFERENCES customer_subscriptions(id)'), 'FK must reference customer_subscriptions');
    });

    // -------------------------------------------------------------------------
    // Setup Isolated Test Fixtures
    // -------------------------------------------------------------------------
    const testSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const custResA = await client.query(`
      INSERT INTO customers (id, mobile_number, name, created_at, updated_at)
      VALUES (gen_random_uuid(), '99999${Math.floor(10000 + Math.random() * 90000)}', 'Test Customer A ${testSuffix}', NOW(), NOW())
      RETURNING id;
    `);
    const customerAId = custResA.rows[0].id;
    createdCustomerIds.push(customerAId);

    const custResB = await client.query(`
      INSERT INTO customers (id, mobile_number, name, created_at, updated_at)
      VALUES (gen_random_uuid(), '99998${Math.floor(10000 + Math.random() * 90000)}', 'Test Customer B (Attacker) ${testSuffix}', NOW(), NOW())
      RETURNING id;
    `);
    const customerBId = custResB.rows[0].id;
    createdCustomerIds.push(customerBId);

    const planResA = await client.query(`
      INSERT INTO subscription_plans (id, title, price, credit_amount, weekly_qty_limit_kg, validity_days, active, created_at)
      VALUES (gen_random_uuid(), 'Integration Gold ${testSuffix}', 500.00, 500.00, 5.0, 30, true, NOW())
      RETURNING id;
    `);
    const planAId = planResA.rows[0].id;
    createdPlanIds.push(planAId);

    const planResB = await client.query(`
      INSERT INTO subscription_plans (id, title, price, credit_amount, weekly_qty_limit_kg, validity_days, active, created_at)
      VALUES (gen_random_uuid(), 'Integration Silver ${testSuffix}', 500.00, 500.00, 3.0, 30, true, NOW())
      RETURNING id;
    `);
    const planBId = planResB.rows[0].id;
    createdPlanIds.push(planBId);

    const orderId1 = `order_int_${testSuffix}`;
    const paymentId1 = `pay_int_${testSuffix}`;
    const signature1 = `sig_int_${testSuffix}`;

    let createdSubId = null;

    // -------------------------------------------------------------------------
    // Test 1: Initial Purchase Persists Deterministic Link
    // -------------------------------------------------------------------------
    await t.test('1. Initial purchase atomically records subscription, purchase ledger, and payment with subscription_id', async () => {
      const result = await subscriptionRepository.activateOrRenewSubscription({
        customerId: customerAId,
        planId: planAId,
        razorpayOrderId: orderId1,
        razorpayPaymentId: paymentId1,
        razorpaySignature: signature1,
      });

      assert.ok(result.subscription?.id, 'Subscription must be created and have an id');
      createdSubId = result.subscription.id;
      createdSubscriptionIds.push(createdSubId);

      assert.strictEqual(result.subscription.customer_id, customerAId);
      assert.strictEqual(parseFloat(result.subscription.credit_balance), 500);
      assert.strictEqual(result.ledgerEntry.type, 'PURCHASE');
      assert.strictEqual(parseFloat(result.ledgerEntry.amount), 500);
      assert.strictEqual(parseFloat(result.ledgerEntry.resulting_balance), 500);

      // Verify payment was recorded with subscription_id
      assert.ok(result.payment?.id, 'Payment must be recorded');
      createdPaymentIds.push(result.payment.id);
      assert.strictEqual(result.payment.subscription_id, createdSubId);
      assert.strictEqual(result.payment.razorpay_order_id, orderId1);
      assert.strictEqual(result.payment.status, 'SUCCESS');

      // Verify directly against PostgreSQL table
      const dbPayment = await client.query('SELECT * FROM payments WHERE id = $1', [result.payment.id]);
      assert.strictEqual(dbPayment.rows.length, 1);
      assert.strictEqual(dbPayment.rows[0].subscription_id, createdSubId, 'PostgreSQL payments.subscription_id must match subscription.id');

      const dbLedger = await client.query('SELECT * FROM subscription_credit_ledger WHERE subscription_id = $1', [createdSubId]);
      assert.strictEqual(dbLedger.rows.length, 1, 'Exactly one ledger entry must be created on initial purchase');
      assert.strictEqual(dbLedger.rows[0].type, 'PURCHASE');
    });

    // -------------------------------------------------------------------------
    // Test 2: Safe Replay with Zero Duplicate Writes
    // -------------------------------------------------------------------------
    await t.test('2. Replaying the verified payment returns the exact subscription with ZERO duplicate credit or ledger writes', async () => {
      // Snapshot state in PostgreSQL before replay
      const subBefore = await client.query('SELECT credit_balance, expires_at FROM customer_subscriptions WHERE id = $1', [createdSubId]);
      const ledgerBefore = await client.query('SELECT COUNT(*)::int AS count FROM subscription_credit_ledger WHERE subscription_id = $1', [createdSubId]);
      const paymentsBefore = await client.query('SELECT COUNT(*)::int AS count FROM payments WHERE subscription_id = $1', [createdSubId]);

      assert.strictEqual(parseFloat(subBefore.rows[0].credit_balance), 500);
      assert.strictEqual(ledgerBefore.rows[0].count, 1);
      assert.strictEqual(paymentsBefore.rows[0].count, 1);

      // Execute replay of identical payment identifiers
      const replayResult = await subscriptionRepository.activateOrRenewSubscription({
        customerId: customerAId,
        planId: planAId,
        razorpayOrderId: orderId1,
        razorpayPaymentId: paymentId1,
        razorpaySignature: signature1,
      });

      assert.strictEqual(replayResult.idempotentReplay, true, 'Replay must be flagged as idempotentReplay: true');
      assert.strictEqual(replayResult.subscription.id, createdSubId, 'Replay must resolve to the exact original subscription');
      assert.strictEqual(replayResult.payment.subscription_id, createdSubId);

      // Inspect PostgreSQL state after replay
      const subAfter = await client.query('SELECT credit_balance, expires_at FROM customer_subscriptions WHERE id = $1', [createdSubId]);
      const ledgerAfter = await client.query('SELECT COUNT(*)::int AS count FROM subscription_credit_ledger WHERE subscription_id = $1', [createdSubId]);
      const paymentsAfter = await client.query('SELECT COUNT(*)::int AS count FROM payments WHERE subscription_id = $1', [createdSubId]);

      // INVARIANTS: Zero credit added, zero ledger entries added, zero payment rows added
      assert.strictEqual(parseFloat(subAfter.rows[0].credit_balance), parseFloat(subBefore.rows[0].credit_balance), 'Credit balance must not change on replay');
      assert.strictEqual(ledgerAfter.rows[0].count, ledgerBefore.rows[0].count, 'Zero duplicate ledger writes on replay');
      assert.strictEqual(paymentsAfter.rows[0].count, paymentsBefore.rows[0].count, 'Zero duplicate payment records on replay');
    });

    // -------------------------------------------------------------------------
    // Test 3: Unlinked Legacy Payment Fails Closed
    // -------------------------------------------------------------------------
    await t.test('3. Unlinked legacy payment (subscription_id is NULL) fails closed with PAYMENT_SUBSCRIPTION_UNPROVABLE', async () => {
      const unlinkedOrderId = `order_legacy_unlinked_${testSuffix}`;
      const unlinkedPaymentId = `pay_legacy_unlinked_${testSuffix}`;

      // Insert legacy payment without subscription_id
      const unlinkedRes = await client.query(`
        INSERT INTO payments (
          id, transaction_id, booking_id, subscription_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, method, status, created_at
        ) VALUES (
          gen_random_uuid(), NULL, NULL, NULL, $1, $2, 'sig_legacy', 500.00, 'RAZORPAY', 'SUCCESS', NOW()
        )
        RETURNING id;
      `, [unlinkedOrderId, unlinkedPaymentId]);
      createdPaymentIds.push(unlinkedRes.rows[0].id);

      // Attempt to replay unlinked payment
      await assert.rejects(
        async () => {
          await subscriptionRepository.activateOrRenewSubscription({
            customerId: customerAId,
            planId: planAId,
            razorpayOrderId: unlinkedOrderId,
            razorpayPaymentId: unlinkedPaymentId,
            razorpaySignature: 'sig_legacy',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_SUBSCRIPTION_UNPROVABLE');
          assert.strictEqual(err.status, 422);
          return true;
        }
      );

      // Verify no changes were made to the customer's subscription
      const subCheck = await client.query('SELECT credit_balance FROM customer_subscriptions WHERE id = $1', [createdSubId]);
      assert.strictEqual(parseFloat(subCheck.rows[0].credit_balance), 500, 'Unprovable payment must never grant credit');
    });

    // -------------------------------------------------------------------------
    // Test 4: Cross-Customer Replay Rejection
    // -------------------------------------------------------------------------
    await t.test('4. Cross-customer payment replay is rejected with PAYMENT_CUSTOMER_MISMATCH', async () => {
      await assert.rejects(
        async () => {
          // Customer B (attacker) attempts to claim customer A's payment
          await subscriptionRepository.activateOrRenewSubscription({
            customerId: customerBId,
            planId: planAId,
            razorpayOrderId: orderId1,
            razorpayPaymentId: paymentId1,
            razorpaySignature: signature1,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_CUSTOMER_MISMATCH');
          assert.strictEqual(err.status, 403);
          return true;
        }
      );

      // Verify customer B received no subscriptions
      const bSubs = await client.query('SELECT * FROM customer_subscriptions WHERE customer_id = $1', [customerBId]);
      assert.strictEqual(bSubs.rows.length, 0, 'Attacker must receive no subscription or credit');
    });

    // -------------------------------------------------------------------------
    // Test 5: Plan Mismatch Replay Rejection
    // -------------------------------------------------------------------------
    await t.test('5. Plan mismatch replay is rejected with PAYMENT_PLAN_MISMATCH', async () => {
      await assert.rejects(
        async () => {
          // Attempt to claim plan A's payment against plan B
          await subscriptionRepository.activateOrRenewSubscription({
            customerId: customerAId,
            planId: planBId,
            razorpayOrderId: orderId1,
            razorpayPaymentId: paymentId1,
            razorpaySignature: signature1,
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_PLAN_MISMATCH');
          assert.strictEqual(err.status, 409);
          return true;
        }
      );
    });

  } finally {
    // -------------------------------------------------------------------------
    // Teardown: Clean up all isolated test data in reverse dependency order
    // -------------------------------------------------------------------------
    try {
      if (createdPaymentIds.length > 0) {
        await client.query('DELETE FROM payments WHERE id = ANY($1::uuid[])', [createdPaymentIds]);
      }
      if (createdSubscriptionIds.length > 0) {
        await client.query('DELETE FROM subscription_credit_ledger WHERE subscription_id = ANY($1::uuid[])', [createdSubscriptionIds]);
        await client.query('DELETE FROM customer_subscriptions WHERE id = ANY($1::uuid[])', [createdSubscriptionIds]);
      }
      if (createdPlanIds.length > 0) {
        await client.query('DELETE FROM subscription_plans WHERE id = ANY($1::uuid[])', [createdPlanIds]);
      }
      if (createdCustomerIds.length > 0) {
        await client.query('DELETE FROM customers WHERE id = ANY($1::uuid[])', [createdCustomerIds]);
      }
    } catch (cleanupErr) {
      console.warn('[CLEANUP WARNING]', cleanupErr.message);
    }

    client.release();
    await pool.end();
  }
});
