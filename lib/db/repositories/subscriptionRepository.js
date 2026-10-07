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

/**
 * Restore all booking monetary benefits to customer subscription credit:
 * - subscription credit originally deducted
 * - applicable Razorpay-paid booking value -> added to subscription credit
 * If active subscription exists: increments credit_balance and logs CREDIT_REFUND.
 * If no active subscription exists: reactivates most recent subscription or creates a new customer_subscriptions
 * record with the refunded credit, and logs CREDIT_REFUND.
 * 
 * @param {object} client - Active pg transaction client
 * @param {object} params - { customerId, bookingId, subCreditUsed, razorpayPaid }
 * @returns {Promise<{ amountRestored: number, resultingBalance: number, subscriptionId: string }|null>}
 */
async function restoreCustomerBookingCredits(client, { customerId, bookingId, subCreditUsed = 0, razorpayPaid = 0 }) {
  if (!client) throw new Error('Transaction client required for credit restore.');

  const subCredit = Math.max(0, parseFloat(subCreditUsed || 0));
  const rzpPaid = Math.max(0, parseFloat(razorpayPaid || 0));
  const totalToRestore = parseFloat((subCredit + rzpPaid).toFixed(2));

  if (isNaN(totalToRestore) || totalToRestore <= 0) return null;

  // 1. Try active subscription
  let subRes = await client.query(
    `SELECT id, credit_balance 
     FROM customer_subscriptions 
     WHERE customer_id = $1 AND status = 'ACTIVE' AND expires_at > NOW() 
     FOR UPDATE;`,
    [customerId]
  );

  let targetSubId;
  let newBalance;

  if (subRes.rows.length > 0) {
    const activeSub = subRes.rows[0];
    targetSubId = activeSub.id;
    const currentBalance = parseFloat(activeSub.credit_balance || 0);
    newBalance = parseFloat((currentBalance + totalToRestore).toFixed(2));

    await client.query(
      'UPDATE customer_subscriptions SET credit_balance = $1 WHERE id = $2;',
      [newBalance, targetSubId]
    );
  } else {
    // 2. Try any existing subscription record for this customer
    subRes = await client.query(
      `SELECT id, credit_balance 
       FROM customer_subscriptions 
       WHERE customer_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1 
       FOR UPDATE;`,
      [customerId]
    );

    if (subRes.rows.length > 0) {
      const pastSub = subRes.rows[0];
      targetSubId = pastSub.id;
      const currentBalance = parseFloat(pastSub.credit_balance || 0);
      newBalance = parseFloat((currentBalance + totalToRestore).toFixed(2));

      await client.query(
        `UPDATE customer_subscriptions 
         SET credit_balance = $1, status = 'ACTIVE', expires_at = GREATEST(expires_at, NOW()) + interval '30 days' 
         WHERE id = $2;`,
        [newBalance, targetSubId]
      );
    } else {
      // 3. Customer never had a subscription: initialize default subscription with this credit
      const planRes = await client.query(
        'SELECT id FROM subscription_plans WHERE active = true ORDER BY price ASC LIMIT 1;'
      );
      const planId = planRes.rows[0]?.id;
      newBalance = totalToRestore;

      const newSubRes = await client.query(
        `INSERT INTO customer_subscriptions (
          id, customer_id, plan_id, credit_balance, weekly_qty_used, starts_at, expires_at, status, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 0, NOW(), NOW() + interval '30 days', 'ACTIVE', NOW()
        ) RETURNING id;`,
        [customerId, planId, newBalance]
      );
      targetSubId = newSubRes.rows[0].id;
    }
  }

  // 4. Record audit ledger entry
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
  await client.query(ledgerSql, [targetSubId, bookingId, totalToRestore, newBalance]);

  return {
    amountRestored: totalToRestore,
    resultingBalance: newBalance,
    subscriptionId: targetSubId,
  };
}

/**
 * Retrieve weekly usage debits recorded for a specific booking
 * @param {object} client
 * @param {string} bookingId
 * @returns {Promise<Array<object>>}
 */
async function getBookingUsageLedgerEntries(client, bookingId) {
  if (!bookingId) return [];
  const runner = client || { query };
  const res = await runner.query(
    `SELECT subscription_id, fish_id, quantity_kg
     FROM subscription_usage_ledger
     WHERE booking_id = $1 AND usage_type = 'BOOKING_USAGE';`,
    [bookingId]
  );
  return res.rows;
}

/**
 * Record weekly quantity usage for a physical bill in subscription_usage_ledger
 * and update customer_subscriptions.weekly_qty_used within a transaction.
 */
async function recordBillWeeklyUsage(client, { subscriptionId, fishId, quantityKg }) {
  if (!client) throw new Error('Transaction client required for recording bill weekly usage.');

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
      NULL,
      $2,
      $3,
      'BILL_USAGE',
      NOW()
    );
  `;
  await client.query(ledgerSql, [subscriptionId, fishId, parsedQty]);

  const updateSql = `
    UPDATE customer_subscriptions
    SET weekly_qty_used = weekly_qty_used + $1
    WHERE id = $2;
  `;
  await client.query(updateSql, [parsedQty, subscriptionId]);
}

/**
 * Record monetary credit deduction in subscription_credit_ledger for a physical bill.
 */
async function recordBillCreditDeduction(client, { subscriptionId, transactionId, amount }) {
  if (!client) throw new Error('Transaction client required for bill credit deduction.');

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
      $2,
      NULL,
      'DEBIT_BILL',
      $3,
      $4,
      NOW()
    );
  `;
  await client.query(ledgerSql, [subscriptionId, transactionId || null, parsedAmount, newBalance]);
}

/**
 * List all subscription plans with active subscriber count for Admin Portal (ADMIN-08)
 * @param {object} [client]
 * @returns {Promise<Array<object>>}
 */
async function listPlansForAdmin(client = null) {
  const sql = `
    SELECT 
      sp.id,
      sp.title,
      sp.price,
      sp.credit_amount,
      sp.weekly_qty_limit_kg,
      sp.validity_days,
      sp.active,
      sp.created_at,
      COALESCE(sub_counts.active_subscribers, 0)::int AS active_subscribers
    FROM subscription_plans sp
    LEFT JOIN (
      SELECT plan_id, COUNT(DISTINCT customer_id) AS active_subscribers
      FROM customer_subscriptions
      WHERE status = 'ACTIVE' AND expires_at > NOW()
      GROUP BY plan_id
    ) sub_counts ON sp.id = sub_counts.plan_id
    ORDER BY sp.price ASC;
  `;
  const runner = client || { query };
  const res = await runner.query(sql);
  return res.rows;
}

/**
 * Create a new subscription plan (ADMIN-08)
 * @param {object} params
 * @param {string} params.title
 * @param {number} params.price
 * @param {number} params.creditAmount
 * @param {number} params.weeklyQtyLimitKg
 * @param {number} params.validityDays
 * @param {boolean} [params.active=true]
 * @param {object} [client]
 * @returns {Promise<object>}
 */
async function createPlan({
  title,
  price,
  creditAmount,
  weeklyQtyLimitKg,
  validityDays,
  active = true,
}, client = null) {
  const runner = client || { query };
  const sql = `
    INSERT INTO subscription_plans (
      id,
      title,
      price,
      credit_amount,
      weekly_qty_limit_kg,
      validity_days,
      active,
      created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      NOW()
    )
    RETURNING *;
  `;
  const res = await runner.query(sql, [
    title,
    parseFloat(price),
    parseFloat(creditAmount),
    parseFloat(weeklyQtyLimitKg || 0),
    parseInt(validityDays, 10),
    Boolean(active),
  ]);
  return res.rows[0];
}

/**
 * Update an existing subscription plan without altering historical subscriptions (ADMIN-08)
 * @param {string} planId
 * @param {object} params
 * @param {string} [params.title]
 * @param {number} [params.price]
 * @param {number} [params.creditAmount]
 * @param {number} [params.weeklyQtyLimitKg]
 * @param {number} [params.validityDays]
 * @param {boolean} [params.active]
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function updatePlan(planId, {
  title,
  price,
  creditAmount,
  weeklyQtyLimitKg,
  validityDays,
  active,
}, client = null) {
  const runner = client || { query };

  const existing = await findPlanById(planId, runner);
  if (!existing) return null;

  const newTitle = title !== undefined ? title : existing.title;
  const newPrice = price !== undefined ? parseFloat(price) : existing.price;
  const newCredit = creditAmount !== undefined ? parseFloat(creditAmount) : existing.credit_amount;
  const newWeeklyLimit = weeklyQtyLimitKg !== undefined ? parseFloat(weeklyQtyLimitKg) : existing.weekly_qty_limit_kg;
  const newValidityDays = validityDays !== undefined ? parseInt(validityDays, 10) : existing.validity_days;
  const newActive = active !== undefined ? Boolean(active) : existing.active;

  const sql = `
    UPDATE subscription_plans
    SET 
      title = $1,
      price = $2,
      credit_amount = $3,
      weekly_qty_limit_kg = $4,
      validity_days = $5,
      active = $6
    WHERE id = $7
    RETURNING *;
  `;
  const res = await runner.query(sql, [
    newTitle,
    newPrice,
    newCredit,
    newWeeklyLimit,
    newValidityDays,
    newActive,
    planId,
  ]);
  return res.rows[0];
}

/**
 * Toggle plan active status (ADMIN-08)
 * @param {string} planId
 * @param {boolean} active
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function togglePlanActive(planId, active, client = null) {
  const runner = client || { query };
  const sql = `
    UPDATE subscription_plans
    SET active = $1
    WHERE id = $2
    RETURNING *;
  `;
  const res = await runner.query(sql, [Boolean(active), planId]);
  return res.rows[0] || null;
}

/**
 * Atomically execute admin-assisted customer subscription purchase (ADMIN-09)
 * Supports CASH and RAZORPAY.
 * Ensures:
 * - Authoritative plan verification
 * - Additive credit accumulation (Existing + Plan Credit = Total Credit)
 * - Expiry extension from current expiry (or from now if no active sub)
 * - Atomic insertion into customer_subscriptions, subscription_credit_ledger, and payments
 * - Complete rollback if any step fails
 * 
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.planId
 * @param {string} params.paymentMethod - 'CASH' | 'RAZORPAY'
 * @param {string} [params.razorpayOrderId]
 * @param {string} [params.razorpayPaymentId]
 * @param {string} [params.razorpaySignature]
 * @returns {Promise<{ subscription: object, ledgerEntry: object, payment: object, plan: object, previousCredit: number }>}
 */
async function adminPurchaseSubscriptionAtomic({
  customerId,
  planId,
  paymentMethod,
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
      err.status = 404;
      throw err;
    }

    const plan = planRes.rows[0];
    if (!plan.active) {
      const err = new Error('PLAN_INACTIVE');
      err.code = 'PLAN_INACTIVE';
      err.status = 400;
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
    let previousCredit = 0;
    let resultingBalance;

    if (existingSubRes.rows.length > 0) {
      // Additive recharge on active subscription
      const existingSub = existingSubRes.rows[0];
      previousCredit = parseFloat(existingSub.credit_balance || 0);
      resultingBalance = parseFloat((previousCredit + planCredit).toFixed(2));

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
      previousCredit = 0;
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
    // For CASH, razorpay_order_id stores authoritative CASH_ADMIN identifier (satisfying NOT NULL)
    const effectiveOrderId = paymentMethod === 'CASH'
      ? `CASH_ADMIN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      : razorpayOrderId;

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
        $5,
        'SUCCESS',
        NOW()
      )
      RETURNING *;
    `;
    const paymentRes = await client.query(paymentSql, [
      effectiveOrderId,
      paymentMethod === 'CASH' ? null : razorpayPaymentId,
      paymentMethod === 'CASH' ? null : razorpaySignature,
      planPrice,
      paymentMethod,
    ]);
    const payment = paymentRes.rows[0];

    return {
      subscription,
      ledgerEntry,
      payment,
      plan,
      previousCredit,
    };
  });
}

/**
 * Atomically execute manual subscription credit adjustment (ADMIN-09)
 * Rules:
 * - reason is mandatory
 * - cannot produce negative credit
 * - row locked FOR UPDATE
 * - creates 'ADJUSTMENT' ledger entry
 * - returns previousBalance, adjustmentAmount, direction, resultingBalance
 * 
 * @param {object} params
 * @param {string} params.customerId
 * @param {number} params.amount
 * @param {'ADD'|'DEDUCT'} params.direction
 * @param {string} params.reason
 * @returns {Promise<object>}
 */
async function adjustCustomerCreditAtomic({
  customerId,
  amount,
  direction,
  reason,
}) {
  if (!reason || !reason.trim()) {
    const err = new Error('Reason is mandatory for manual credit adjustment.');
    err.code = 'REASON_REQUIRED';
    err.status = 400;
    throw err;
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    const err = new Error('Adjustment amount must be a positive number greater than 0.');
    err.code = 'INVALID_ADJUSTMENT_AMOUNT';
    err.status = 400;
    throw err;
  }

  if (direction !== 'ADD' && direction !== 'DEDUCT') {
    const err = new Error("Adjustment direction must be either 'ADD' or 'DEDUCT'.");
    err.code = 'INVALID_DIRECTION';
    err.status = 400;
    throw err;
  }

  return await withTransaction(async (client) => {
    // 1. Find and lock active subscription for this customer
    let subRes = await client.query(
      `SELECT id, customer_id, plan_id, credit_balance, weekly_qty_used, starts_at, expires_at, status 
       FROM customer_subscriptions 
       WHERE customer_id = $1 AND status = 'ACTIVE' AND expires_at > NOW() 
       FOR UPDATE;`,
      [customerId]
    );

    let targetSub;
    let previousBalance = 0;

    if (subRes.rows.length > 0) {
      targetSub = subRes.rows[0];
      previousBalance = parseFloat(targetSub.credit_balance || 0);
    } else {
      // Check most recent subscription
      subRes = await client.query(
        `SELECT id, customer_id, plan_id, credit_balance, weekly_qty_used, starts_at, expires_at, status 
         FROM customer_subscriptions 
         WHERE customer_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1 
         FOR UPDATE;`,
        [customerId]
      );

      if (subRes.rows.length > 0) {
        targetSub = subRes.rows[0];
        previousBalance = parseFloat(targetSub.credit_balance || 0);
      } else {
        // Customer never had a subscription
        if (direction === 'DEDUCT') {
          const err = new Error('Customer has no subscription credit to deduct.');
          err.code = 'INSUFFICIENT_SUBSCRIPTION_CREDIT';
          err.status = 400;
          throw err;
        }

        // Initialize default subscription for positive adjustment
        const planRes = await client.query(
          `SELECT id FROM subscription_plans WHERE active = true ORDER BY price ASC LIMIT 1;`
        );
        const planId = planRes.rows[0]?.id;

        const newSubRes = await client.query(
          `INSERT INTO customer_subscriptions (
            id, customer_id, plan_id, credit_balance, weekly_qty_used, starts_at, expires_at, status, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, 0, 0, NOW(), NOW() + interval '30 days', 'ACTIVE', NOW()
          ) RETURNING *;`,
          [customerId, planId]
        );
        targetSub = newSubRes.rows[0];
        previousBalance = 0;
      }
    }

    // 2. Authoritative calculation
    let resultingBalance;
    if (direction === 'DEDUCT') {
      resultingBalance = parseFloat((previousBalance - parsedAmount).toFixed(2));
      if (resultingBalance < 0) {
        const err = new Error(
          `Cannot produce negative credit balance. Current balance is ₹${previousBalance.toFixed(2)}, adjustment requested is -₹${parsedAmount.toFixed(2)}.`
        );
        err.code = 'INSUFFICIENT_SUBSCRIPTION_CREDIT';
        err.status = 400;
        throw err;
      }
    } else {
      resultingBalance = parseFloat((previousBalance + parsedAmount).toFixed(2));
    }

    // 3. Update customer_subscriptions credit_balance
    const updateRes = await client.query(
      `UPDATE customer_subscriptions
       SET credit_balance = $1
       WHERE id = $2
       RETURNING *;`,
      [resultingBalance, targetSub.id]
    );
    const updatedSub = updateRes.rows[0];

    // 4. Insert into subscription_credit_ledger with type 'ADJUSTMENT'
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
        'ADJUSTMENT',
        $2,
        $3,
        NOW()
      )
      RETURNING *;
    `;
    const ledgerRes = await client.query(ledgerSql, [
      targetSub.id,
      parsedAmount,
      resultingBalance,
    ]);
    const ledgerEntry = ledgerRes.rows[0];

    return {
      subscriptionId: targetSub.id,
      customerId,
      previousBalance,
      adjustmentAmount: parsedAmount,
      direction,
      resultingBalance,
      reason: reason.trim(),
      subscription: updatedSub,
      ledgerEntry,
    };
  });
}

/**
 * Search customers with their subscription state for admin selection (ADMIN-09)
 * @param {object} params
 * @param {string} [params.search]
 * @param {number} [params.limit=20]
 * @param {number} [params.offset=0]
 * @param {object} [client]
 * @returns {Promise<Array<object>>}
 */
async function searchCustomersForSubscription({ search = '', limit = 20, offset = 0 } = {}, client = null) {
  const runner = client || { query };
  const queryParams = [];
  let whereClauses = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    queryParams.push(term);
    whereClauses.push(`(c.name ILIKE $${queryParams.length} OR c.mobile_number ILIKE $${queryParams.length})`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  queryParams.push(parseInt(limit, 10));
  const limitIdx = queryParams.length;
  queryParams.push(parseInt(offset, 10));
  const offsetIdx = queryParams.length;

  const sql = `
    SELECT 
      c.id AS customer_id,
      c.name,
      c.mobile_number,
      c.area,
      cs.id AS subscription_id,
      cs.credit_balance,
      cs.weekly_qty_used,
      cs.starts_at,
      cs.expires_at,
      cs.status AS subscription_status,
      sp.id AS plan_id,
      sp.title AS plan_title,
      sp.price AS plan_price,
      sp.credit_amount AS plan_credit_amount,
      sp.weekly_qty_limit_kg,
      sp.validity_days,
      CASE 
        WHEN cs.id IS NOT NULL AND cs.status = 'ACTIVE' AND cs.expires_at > NOW() THEN 'ACTIVE'
        WHEN cs.id IS NOT NULL AND cs.expires_at <= NOW() THEN 'EXPIRED'
        ELSE 'NONE'
      END AS computed_status
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT *
      FROM customer_subscriptions
      WHERE customer_id = c.id
      ORDER BY (status = 'ACTIVE' AND expires_at > NOW()) DESC, created_at DESC
      LIMIT 1
    ) cs ON true
    LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
    ${whereSql}
    ORDER BY c.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const res = await runner.query(sql, queryParams);
  return res.rows.map((row) => ({
    customerId: row.customer_id,
    name: row.name || 'Anonymous Customer',
    mobileNumber: row.mobile_number,
    area: row.area,
    hasSubscription: row.subscription_id !== null,
    subscriptionId: row.subscription_id,
    creditBalance: parseFloat(row.credit_balance || 0),
    weeklyQtyUsed: parseFloat(row.weekly_qty_used || 0),
    weeklyQtyLimitKg: parseFloat(row.weekly_qty_limit_kg || 0),
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    status: row.computed_status,
    planId: row.plan_id,
    planTitle: row.plan_title,
    planPrice: parseFloat(row.plan_price || 0),
    planCreditAmount: parseFloat(row.plan_credit_amount || 0),
  }));
}

/**
 * Retrieve comprehensive subscription details and metrics for a single customer (ADMIN-09)
 * @param {string} customerId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function getCustomerSubscriptionSummary(customerId, client = null) {
  const runner = client || { query };

  const custRes = await runner.query(
    `SELECT id, name, mobile_number, area, created_at FROM customers WHERE id = $1 LIMIT 1;`,
    [customerId]
  );
  if (custRes.rows.length === 0) return null;
  const customer = custRes.rows[0];

  const activeSub = await getActiveSubscription(customerId, runner);

  // All subscriptions for this customer
  const subsRes = await runner.query(
    `SELECT 
       cs.id, cs.plan_id, cs.credit_balance, cs.weekly_qty_used, cs.starts_at, cs.expires_at, cs.status, cs.created_at,
       sp.title AS plan_title, sp.price AS plan_price, sp.credit_amount AS plan_credit_amount, sp.weekly_qty_limit_kg, sp.validity_days
     FROM customer_subscriptions cs
     LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
     WHERE cs.customer_id = $1
     ORDER BY cs.created_at DESC;`,
    [customerId]
  );

  // Credit movement metrics
  const metricsRes = await runner.query(
    `SELECT 
       COALESCE(SUM(CASE WHEN scl.type = 'PURCHASE' THEN scl.amount ELSE 0 END), 0)::float AS total_purchased_credit,
       COALESCE(SUM(CASE WHEN scl.type IN ('DEBIT_BOOKING', 'DEBIT_BILL') THEN scl.amount ELSE 0 END), 0)::float AS total_used_credit,
       COALESCE(SUM(CASE WHEN scl.type = 'CREDIT_REFUND' THEN scl.amount ELSE 0 END), 0)::float AS total_restored_credit,
       COALESCE(SUM(CASE WHEN scl.type = 'ADJUSTMENT' THEN scl.amount ELSE 0 END), 0)::float AS total_adjusted_credit,
       COUNT(*)::int AS total_ledger_entries
     FROM subscription_credit_ledger scl
     JOIN customer_subscriptions cs ON scl.subscription_id = cs.id
     WHERE cs.customer_id = $1;`,
    [customerId]
  );
  const metrics = metricsRes.rows[0] || {};

  // Recent payments
  const paymentsRes = await runner.query(
    `SELECT p.id, p.amount, p.method, p.status, p.razorpay_order_id, p.razorpay_payment_id, p.created_at
     FROM payments p
     WHERE p.booking_id IS NULL AND p.transaction_id IS NULL AND p.status = 'SUCCESS'
       AND (p.razorpay_order_id LIKE 'CASH_ADMIN_%' OR p.razorpay_order_id LIKE 'sub_%' OR p.razorpay_payment_id IS NOT NULL)
     ORDER BY p.created_at DESC
     LIMIT 20;`
  );

  return {
    customer: {
      id: customer.id,
      name: customer.name || 'Anonymous Customer',
      mobileNumber: customer.mobile_number,
      area: customer.area,
      createdAt: customer.created_at,
    },
    activeSubscription: activeSub ? {
      subscriptionId: activeSub.subscription_id,
      planId: activeSub.plan_id,
      planTitle: activeSub.plan_title,
      planPrice: parseFloat(activeSub.plan_price || 0),
      planCreditAmount: parseFloat(activeSub.plan_credit_amount || 0),
      creditBalance: parseFloat((activeSub.credit_balance || 0).toFixed(2)),
      weeklyQtyUsed: parseFloat(activeSub.weekly_qty_used || 0),
      weeklyQtyLimitKg: parseFloat(activeSub.weekly_qty_limit_kg || 0),
      startsAt: activeSub.starts_at,
      expiresAt: activeSub.expires_at,
      status: activeSub.status,
    } : null,
    subscriptions: subsRes.rows,
    metrics: {
      totalPurchasedCredit: parseFloat(metrics.total_purchased_credit || 0),
      totalUsedCredit: parseFloat(metrics.total_used_credit || 0),
      totalRestoredCredit: parseFloat(metrics.total_restored_credit || 0),
      totalAdjustedCredit: parseFloat(metrics.total_adjusted_credit || 0),
      totalLedgerEntries: parseInt(metrics.total_ledger_entries || 0, 10),
    },
    recentPayments: paymentsRes.rows,
  };
}

/**
 * Retrieve traceable credit movement ledger entries with opening/closing balances for Admin Portal (ADMIN-09)
 * @param {string} customerId
 * @param {object} [params]
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 * @param {object} [client]
 * @returns {Promise<{ entries: Array<object>, total: number }>}
 */
async function getAdminSubscriptionCreditLedger(customerId, { limit = 50, offset = 0 } = {}, client = null) {
  const runner = client || { query };

  const countRes = await runner.query(
    `SELECT COUNT(*)::int AS total
     FROM subscription_credit_ledger scl
     JOIN customer_subscriptions cs ON scl.subscription_id = cs.id
     WHERE cs.customer_id = $1;`,
    [customerId]
  );
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
      cs.plan_id,
      sp.title AS plan_title,
      t.transaction_number,
      b.booking_code
    FROM subscription_credit_ledger scl
    JOIN customer_subscriptions cs ON scl.subscription_id = cs.id
    LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
    LEFT JOIN transactions t ON scl.transaction_id = t.id
    LEFT JOIN bookings b ON scl.booking_id = b.id
    WHERE cs.customer_id = $1
    ORDER BY scl.created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const res = await runner.query(dataSql, [customerId, parseInt(limit, 10), parseInt(offset, 10)]);

  const entries = res.rows.map((row) => {
    const amount = parseFloat(row.amount || 0);
    const closingBalance = parseFloat(row.resulting_balance || 0);

    // Opening balance derivation based on type
    let openingBalance;
    if (row.type === 'PURCHASE' || row.type === 'CREDIT_REFUND') {
      openingBalance = parseFloat((closingBalance - amount).toFixed(2));
    } else if (row.type === 'DEBIT_BOOKING' || row.type === 'DEBIT_BILL') {
      openingBalance = parseFloat((closingBalance + amount).toFixed(2));
    } else {
      // ADJUSTMENT or other
      // Note: can be positive or negative movement, resultingBalance is authoritative closing balance
      openingBalance = null;
    }

    return {
      id: row.id,
      subscriptionId: row.subscription_id,
      planTitle: row.plan_title,
      type: row.type,
      amount,
      openingBalance,
      closingBalance,
      reference: row.booking_code || row.transaction_number || row.booking_id || row.transaction_id || 'System Ledger',
      bookingId: row.booking_id,
      transactionId: row.transaction_id,
      createdAt: row.created_at,
    };
  });

  return {
    entries,
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
  restoreCustomerBookingCredits,
  getBookingUsageLedgerEntries,
  listActivePlans,
  findPlanById,
  activateOrRenewSubscription,
  getCustomerCreditLedger,
  recordBillWeeklyUsage,
  recordBillCreditDeduction,
  // Slice 15 Admin Methods
  listPlansForAdmin,
  createPlan,
  updatePlan,
  togglePlanActive,
  adminPurchaseSubscriptionAtomic,
  adjustCustomerCreditAtomic,
  searchCustomersForSubscription,
  getCustomerSubscriptionSummary,
  getAdminSubscriptionCreditLedger,
};




