/**
 * Subscription Persistence Repository
 * Traceability: PondFish Database ERD (Sections 9, 10, 11, 12) & Core Engines Spec (Section 12)
 * Handles customer subscription lookups, plan fish eligibility, weekly quantity tracking,
 * and monetary credit balance ledger operations using native pg.
 */

const { query, withTransaction } = require('../pool');

/**
 * Retrieve active subscription for a customer, including plan rules.
 * @param {string} customerId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function getActiveSubscription(customerId, client = null) {
  const sql = `
    SELECT 
      cs.id AS subscription_id,
      cs.customer_id,
      cs.plan_id,
      cs.credit_balance,
      cs.weekly_qty_used,
      cs.starts_at,
      cs.expires_at,
      cs.status,
      sp.title AS plan_title,
      sp.price AS plan_price,
      sp.credit_amount AS plan_credit_amount,
      sp.weekly_qty_limit_kg,
      sp.validity_days,
      sp.active AS plan_active
    FROM customer_subscriptions cs
    LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
    WHERE cs.customer_id = $1 
      AND cs.status = 'ACTIVE' 
      AND cs.expires_at > NOW()
    ORDER BY cs.created_at DESC
    LIMIT 1;
  `;
  const runner = client || { query };
  const res = await runner.query(sql, [customerId]);
  return res.rows[0] || null;
}

/**
 * Check whether a fish is eligible under a specific subscription plan.
 * Returns boolean explicitly checked against the authoritative subscription_plan_fish table.
 * @param {string} planId
 * @param {string} fishId
 * @param {object} [client]
 * @returns {Promise<boolean>}
 */
async function isFishEligibleForPlan(planId, fishId, client = null) {
  if (!planId || !fishId) return false;

  const sql = `
    SELECT enabled
    FROM subscription_plan_fish
    WHERE plan_id = $1 AND fish_id = $2 AND enabled = true;
  `;
  const runner = client || { query };
  const res = await runner.query(sql, [planId, fishId]);
  return res.rows.length > 0 && res.rows[0].enabled === true;
}

/**
 * Get all eligible fish IDs for a specific subscription plan.
 * @param {string} planId
 * @param {object} [client]
 * @returns {Promise<string[]>}
 */
async function getEligibleFishIdsForPlan(planId, client = null) {
  if (!planId) return [];

  const sql = `
    SELECT fish_id
    FROM subscription_plan_fish
    WHERE plan_id = $1 AND enabled = true;
  `;
  const runner = client || { query };
  const res = await runner.query(sql, [planId]);
  return res.rows.map(r => r.fish_id);
}

/**
 * Record weekly quantity usage for a booking in subscription_usage_ledger
 * and update customer_subscriptions.weekly_qty_used within a transaction.
 */
async function recordWeeklyUsage(client, { subscriptionId, bookingId, fishId, quantityKg }) {
  if (!client) throw new Error('Transaction client required for recording weekly usage.');

  const parsedQty = parseFloat(quantityKg);
  if (isNaN(parsedQty) || parsedQty <= 0) return;

  // Insert into usage ledger
  const ledgerSql = `
    INSERT INTO subscription_usage_ledger (
      id,
      subscription_id,
      booking_id,
      fish_id,
      quantity_kg,
      usage_type,
      created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      'BOOKING_USAGE',
      NOW()
    );
  `;
  await client.query(ledgerSql, [subscriptionId, bookingId, fishId, parsedQty]);

  // Update subscription convenient summary
  const updateSql = `
    UPDATE customer_subscriptions
    SET weekly_qty_used = weekly_qty_used + $1
    WHERE id = $2;
  `;
  await client.query(updateSql, [parsedQty, subscriptionId]);
}

/**
 * Restore weekly quantity usage upon cancellation or expiry.
 */
async function restoreWeeklyUsage(client, { subscriptionId, bookingId, fishId, quantityKg }) {
  if (!client) throw new Error('Transaction client required for restoring weekly usage.');

  const parsedQty = parseFloat(quantityKg);
  if (isNaN(parsedQty) || parsedQty <= 0) return;

  const ledgerSql = `
    INSERT INTO subscription_usage_ledger (
      id,
      subscription_id,
      booking_id,
      fish_id,
      quantity_kg,
      usage_type,
      created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      'BOOKING_RESTORE',
      NOW()
    );
  `;
  await client.query(ledgerSql, [subscriptionId, bookingId, fishId, parsedQty]);

  const updateSql = `
    UPDATE customer_subscriptions
    SET weekly_qty_used = GREATEST(0, weekly_qty_used - $1)
    WHERE id = $2;
  `;
  await client.query(updateSql, [parsedQty, subscriptionId]);
}

/**
 * Record monetary credit deduction in subscription_credit_ledger and update balance.
 */
async function recordCreditDeduction(client, { subscriptionId, bookingId, amount }) {
  if (!client) throw new Error('Transaction client required for credit deduction.');

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) return;

  // Row lock on subscription
  const subRes = await client.query(
    'SELECT credit_balance FROM customer_subscriptions WHERE id = $1 FOR UPDATE;',
    [subscriptionId]
  );
  if (subRes.rows.length === 0) throw new Error('Subscription not found for credit deduction.');

  const currentBalance = parseFloat(subRes.rows[0].credit_balance);
  const newBalance = parseFloat((currentBalance - parsedAmount).toFixed(2));
  if (newBalance < 0) {
    const err = new Error('INSUFFICIENT_SUBSCRIPTION_CREDIT');
    err.code = 'INSUFFICIENT_SUBSCRIPTION_CREDIT';
    throw err;
  }

  // Update balance
  await client.query(
    'UPDATE customer_subscriptions SET credit_balance = $1 WHERE id = $2;',
    [newBalance, subscriptionId]
  );

  // Record in subscription_credit_ledger
  const ledgerSql = `
    INSERT INTO subscription_credit_ledger (
      id,
      subscription_id,
      transaction_id,
      booking_id,
      type,
      amount,
      resulting_balance,
      created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      NULL,
      $2,
      'DEBIT_BOOKING',
      $3,
      $4,
      NOW()
    );
  `;
  await client.query(ledgerSql, [subscriptionId, bookingId, parsedAmount, newBalance]);
}

/**
 * Restore monetary credit upon cancellation or expiry.
 */
async function restoreCredit(client, { subscriptionId, bookingId, amount }) {
  if (!client) throw new Error('Transaction client required for credit restore.');

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) return;

  const subRes = await client.query(
    'SELECT credit_balance FROM customer_subscriptions WHERE id = $1 FOR UPDATE;',
    [subscriptionId]
  );
  if (subRes.rows.length === 0) return;

  const currentBalance = parseFloat(subRes.rows[0].credit_balance);
  const newBalance = parseFloat((currentBalance + parsedAmount).toFixed(2));

  await client.query(
    'UPDATE customer_subscriptions SET credit_balance = $1 WHERE id = $2;',
    [newBalance, subscriptionId]
  );

  const ledgerSql = `
    INSERT INTO subscription_credit_ledger (
      id,
      subscription_id,
      transaction_id,
      booking_id,
      type,
      amount,
      resulting_balance,
      created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      NULL,
      $2,
      'CREDIT_REFUND',
      $3,
      $4,
      NOW()
    );
  `;
  await client.query(ledgerSql, [subscriptionId, bookingId, parsedAmount, newBalance]);
}

/**
 * List all active subscription plans ordered by price ascending
 * @param {object} [client]
 * @returns {Promise<Array<object>>}
 */
async function listActivePlans(client = null) {
  const sql = `
    SELECT 
      id,
      title,
      price,
      credit_amount,
      weekly_qty_limit_kg,
      validity_days,
      active,
      created_at
    FROM subscription_plans
    WHERE active = true
    ORDER BY price ASC;
  `;
  const runner = client || { query };
  const res = await runner.query(sql);
  return res.rows;
}

/**
 * Find plan by ID
 * @param {string} planId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function findPlanById(planId, client = null) {
  if (!planId) return null;
  const sql = `
    SELECT 
      id,
      title,
      price,
      credit_amount,
      weekly_qty_limit_kg,
      validity_days,
      active,
      created_at
    FROM subscription_plans
    WHERE id = $1;
  `;
  const runner = client || { query };
  const res = await runner.query(sql, [planId]);
  return res.rows[0] || null;
}

/**
 * Atomically activate or recharge/renew a customer subscription inside a PostgreSQL transaction.
 * Enforces:
 * - If no active subscription: creates new customer_subscriptions row
 * - If active subscription exists: adds new credit balance additively to existing credit_balance
 *   and extends expires_at by plan.validity_days, preserving weekly usage
 * - Inserts a PURCHASE entry in subscription_credit_ledger
 * - Inserts a SUCCESS record in payments table
 * - Rolls back completely if any query fails
 * 
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.planId
 * @param {string} params.razorpayOrderId
 * @param {string} params.razorpayPaymentId
 * @param {string} params.razorpaySignature
 * @returns {Promise<{ subscription: object, ledgerEntry: object, payment: object }>}
 */
async function activateOrRenewSubscription({
  customerId,
  planId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  return await withTransaction(async (client) => {
    // 1. Authoritative plan lookup
    const planRes = await client.query(
      `SELECT id, title, price, credit_amount, weekly_qty_limit_kg, validity_days, active 
       FROM subscription_plans 
       WHERE id = $1;`,
      [planId]
    );

    if (planRes.rows.length === 0) {
      const err = new Error('PLAN_NOT_FOUND');
      err.code = 'PLAN_NOT_FOUND';
      throw err;
    }

    const plan = planRes.rows[0];
    if (!plan.active) {
      const err = new Error('PLAN_INACTIVE');
      err.code = 'PLAN_INACTIVE';
      throw err;
    }

    const planCredit = parseFloat(plan.credit_amount);
    const planPrice = parseFloat(plan.price);
    const validityDays = parseInt(plan.validity_days, 10) || 30;

    // 2. Lock active subscription for customer if present
    const existingSubRes = await client.query(
      `SELECT id, customer_id, plan_id, credit_balance, weekly_qty_used, starts_at, expires_at, status 
       FROM customer_subscriptions 
       WHERE customer_id = $1 AND status = 'ACTIVE' AND expires_at > NOW() 
       FOR UPDATE;`,
      [customerId]
    );

    let subscription;
    let resultingBalance;

    if (existingSubRes.rows.length > 0) {
      // Additive recharge on active subscription
      const existingSub = existingSubRes.rows[0];
      const existingBalance = parseFloat(existingSub.credit_balance || 0);
      resultingBalance = parseFloat((existingBalance + planCredit).toFixed(2));

      const updateSql = `
        UPDATE customer_subscriptions
        SET 
          plan_id = $1,
          credit_balance = $2,
          expires_at = expires_at + ($3 || ' days')::interval
        WHERE id = $4
        RETURNING *;
      `;
      const updateRes = await client.query(updateSql, [
        plan.id,
        resultingBalance,
        validityDays,
        existingSub.id,
      ]);
      subscription = updateRes.rows[0];
    } else {
      // First-time or new subscription activation
      resultingBalance = parseFloat(planCredit.toFixed(2));

      const insertSql = `
        INSERT INTO customer_subscriptions (
          id,
          customer_id,
          plan_id,
          credit_balance,
          weekly_qty_used,
          starts_at,
          expires_at,
          status,
          created_at
        ) VALUES (
          gen_random_uuid(),
          $1,
          $2,
          $3,
          0,
          NOW(),
          NOW() + ($4 || ' days')::interval,
          'ACTIVE',
          NOW()
        )
        RETURNING *;
      `;
      const insertRes = await client.query(insertSql, [
        customerId,
        plan.id,
        resultingBalance,
        validityDays,
      ]);
      subscription = insertRes.rows[0];
    }

    // 3. Record credit ledger PURCHASE entry
    const ledgerSql = `
      INSERT INTO subscription_credit_ledger (
        id,
        subscription_id,
        transaction_id,
        booking_id,
        type,
        amount,
        resulting_balance,
        created_at
      ) VALUES (
        gen_random_uuid(),
        $1,
        NULL,
        NULL,
        'PURCHASE',
        $2,
        $3,
        NOW()
      )
      RETURNING *;
    `;
    const ledgerRes = await client.query(ledgerSql, [
      subscription.id,
      planCredit,
      resultingBalance,
    ]);
    const ledgerEntry = ledgerRes.rows[0];

    // 4. Record payment in payments table
    const paymentSql = `
      INSERT INTO payments (
        id,
        transaction_id,
        booking_id,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount,
        method,
        status,
        created_at
      ) VALUES (
        gen_random_uuid(),
        NULL,
        NULL,
        $1,
        $2,
        $3,
        $4,
        'RAZORPAY',
        'SUCCESS',
        NOW()
      )
      RETURNING *;
    `;
    const paymentRes = await client.query(paymentSql, [
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      planPrice,
    ]);
    const payment = paymentRes.rows[0];

    return {
      subscription,
      ledgerEntry,
      payment,
      plan,
    };
  });
}

/**
 * Fetch credit movement ledger for authenticated customer
 * @param {string} customerId
 * @param {object} params
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 * @param {object} [client]
 * @returns {Promise<{ entries: Array<object>, total: number }>}
 */
async function getCustomerCreditLedger(customerId, { limit = 50, offset = 0 } = {}, client = null) {
  const runner = client || { query };

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM subscription_credit_ledger scl
    JOIN customer_subscriptions cs ON scl.subscription_id = cs.id
    WHERE cs.customer_id = $1;
  `;
  const countRes = await runner.query(countSql, [customerId]);
  const total = countRes.rows[0]?.total || 0;

  const dataSql = `
    SELECT 
      scl.id,
      scl.subscription_id,
      scl.transaction_id,
      scl.booking_id,
      scl.type,
      scl.amount,
      scl.resulting_balance,
      scl.created_at,
      cs.plan_id
    FROM subscription_credit_ledger scl
    JOIN customer_subscriptions cs ON scl.subscription_id = cs.id
    WHERE cs.customer_id = $1
    ORDER BY scl.created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const dataRes = await runner.query(dataSql, [customerId, limit, offset]);

  return {
    entries: dataRes.rows,
    total,
  };
}

module.exports = {
  getActiveSubscription,
  isFishEligibleForPlan,
  getEligibleFishIdsForPlan,
  recordWeeklyUsage,
  restoreWeeklyUsage,
  recordCreditDeduction,
  restoreCredit,
  listActivePlans,
  findPlanById,
  activateOrRenewSubscription,
  getCustomerCreditLedger,
};

