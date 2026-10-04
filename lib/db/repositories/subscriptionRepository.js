/**
 * Subscription Persistence Repository
 * Traceability: PondFish Database ERD (Sections 9, 10, 11, 12) & Core Engines Spec (Section 12)
 * Handles customer subscription lookups, plan fish eligibility, weekly quantity tracking,
 * and monetary credit balance ledger operations using native pg.
 */

const { query } = require('../pool');

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

module.exports = {
  getActiveSubscription,
  isFishEligibleForPlan,
  getEligibleFishIdsForPlan,
  recordWeeklyUsage,
  restoreWeeklyUsage,
  recordCreditDeduction,
  restoreCredit,
};
