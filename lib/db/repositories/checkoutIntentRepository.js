/**
 * Checkout Intent Persistence Repository
 * Traceability: PondFish Core Business Engines Spec (Section 19), API Spec (Section 31),
 * Master PRD v2 (Section 12, 17) & Migration 0018
 * Durable checkout intent persistence for offline/dropped Razorpay payment recovery.
 * Provides safe fallback when Migration 0018 is unapplied.
 */

const { query } = require('../pool');

/**
 * Creates an immutable checkout intent record before initiating Razorpay payment
 * @param {object} [client] - Optional active database client for transaction
 * @param {object} intentData
 * @param {string} intentData.razorpayOrderId
 * @param {string} intentData.customerId
 * @param {Array|object} intentData.cartSnapshot
 * @param {object} [intentData.subscriptionSnapshot]
 * @param {object} intentData.feeBreakdown
 * @param {number} intentData.amountPaise
 * @param {string} [intentData.currency='INR']
 * @param {string} [intentData.status='CREATED']
 * @returns {Promise<object|null>} Created intent row, or null if table is unapplied
 */
async function createIntent(clientOrData, maybeData) {
  const client = maybeData ? clientOrData : null;
  const data = maybeData || clientOrData;
  const q = client ? client.query.bind(client) : query;

  try {
    const res = await q(
      `INSERT INTO checkout_intents (
        id, razorpay_order_id, customer_id, cart_snapshot, subscription_snapshot,
        fee_breakdown, amount_paise, currency, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      ) ON CONFLICT (razorpay_order_id) DO UPDATE SET
        updated_at = NOW()
      RETURNING *;`,
      [
        data.razorpayOrderId,
        data.customerId,
        JSON.stringify(data.cartSnapshot),
        data.subscriptionSnapshot ? JSON.stringify(data.subscriptionSnapshot) : null,
        JSON.stringify(data.feeBreakdown),
        data.amountPaise,
        data.currency || 'INR',
        data.status || 'CREATED',
      ]
    );
    return res.rows[0];
  } catch (err) {
    if (err.code === '42P01') {
      // PostgreSQL 42P01: undefined_table (Migration 0018 unapplied)
      return null;
    }
    throw err;
  }
}

/**
 * Retrieve a checkout intent by Razorpay order ID, optionally locking it FOR UPDATE
 * @param {object} [client]
 * @param {string} razorpayOrderId
 * @param {boolean} [forUpdate=false]
 * @returns {Promise<object|null>}
 */
async function getIntentByOrderId(clientOrOrderId, maybeOrderId, maybeForUpdate = false) {
  const client = typeof clientOrOrderId === 'object' && clientOrOrderId !== null ? clientOrOrderId : null;
  const razorpayOrderId = client ? maybeOrderId : clientOrOrderId;
  const forUpdate = client ? maybeForUpdate : maybeOrderId;
  const q = client ? client.query.bind(client) : query;

  try {
    const res = await q(
      `SELECT * FROM checkout_intents WHERE razorpay_order_id = $1 ${forUpdate ? 'FOR UPDATE' : ''} LIMIT 1;`,
      [razorpayOrderId]
    );
    return res.rows[0] || null;
  } catch (err) {
    if (err.code === '42P01') {
      return null;
    }
    throw err;
  }
}

/**
 * Atomically claim a checkout intent for processing (transitions CREATED/REQUIRES_RECONCILIATION -> PROCESSING)
 * @param {object} client - Active database transaction client (required for atomic lock)
 * @param {string} razorpayOrderId
 * @returns {Promise<object|null>} Claimed intent row, or null if already processing or completed
 */
async function claimIntentForProcessing(client, razorpayOrderId) {
  if (!client) throw new Error('Transaction client is required to claim checkout intent.');

  try {
    const res = await client.query(
      `UPDATE checkout_intents
       SET status = 'PROCESSING', updated_at = NOW()
       WHERE razorpay_order_id = $1 AND status IN ('CREATED', 'REQUIRES_RECONCILIATION')
       RETURNING *;`,
      [razorpayOrderId]
    );
    return res.rows[0] || null;
  } catch (err) {
    if (err.code === '42P01') {
      return null;
    }
    throw err;
  }
}

/**
 * Mark a checkout intent as COMPLETED with associated booking ID
 * @param {object} [client]
 * @param {string} razorpayOrderId
 * @param {string} bookingId
 * @returns {Promise<object|null>}
 */
async function markIntentCompleted(clientOrOrderId, maybeOrderId, maybeBookingId) {
  const client = typeof clientOrOrderId === 'object' && clientOrOrderId !== null ? clientOrOrderId : null;
  const razorpayOrderId = client ? maybeOrderId : clientOrOrderId;
  const bookingId = client ? maybeBookingId : maybeOrderId;
  const q = client ? client.query.bind(client) : query;

  try {
    const res = await q(
      `UPDATE checkout_intents
       SET status = 'COMPLETED', booking_id = $2, updated_at = NOW()
       WHERE razorpay_order_id = $1
       RETURNING *;`,
      [razorpayOrderId, bookingId]
    );
    return res.rows[0] || null;
  } catch (err) {
    if (err.code === '42P01') {
      return null;
    }
    throw err;
  }
}

/**
 * Mark a checkout intent as REQUIRES_RECONCILIATION
 * @param {object} [client]
 * @param {string} razorpayOrderId
 * @returns {Promise<object|null>}
 */
async function markIntentRequiresReconciliation(clientOrOrderId, maybeOrderId) {
  const client = typeof clientOrOrderId === 'object' && clientOrOrderId !== null ? clientOrOrderId : null;
  const razorpayOrderId = client ? maybeOrderId : clientOrOrderId;
  const q = client ? client.query.bind(client) : query;

  try {
    const res = await q(
      `UPDATE checkout_intents
       SET status = 'REQUIRES_RECONCILIATION', updated_at = NOW()
       WHERE razorpay_order_id = $1
       RETURNING *;`,
      [razorpayOrderId]
    );
    return res.rows[0] || null;
  } catch (err) {
    if (err.code === '42P01') {
      return null;
    }
    throw err;
  }
}

/**
 * Mark a checkout intent as FAILED
 * @param {object} [client]
 * @param {string} razorpayOrderId
 * @returns {Promise<object|null>}
 */
async function markIntentFailed(clientOrOrderId, maybeOrderId) {
  const client = typeof clientOrOrderId === 'object' && clientOrOrderId !== null ? clientOrOrderId : null;
  const razorpayOrderId = client ? maybeOrderId : clientOrOrderId;
  const q = client ? client.query.bind(client) : query;

  try {
    const res = await q(
      `UPDATE checkout_intents
       SET status = 'FAILED', updated_at = NOW()
       WHERE razorpay_order_id = $1
       RETURNING *;`,
      [razorpayOrderId]
    );
    return res.rows[0] || null;
  } catch (err) {
    if (err.code === '42P01') {
      return null;
    }
    throw err;
  }
}

module.exports = {
  createIntent,
  getIntentByOrderId,
  claimIntentForProcessing,
  markIntentCompleted,
  markIntentRequiresReconciliation,
  markIntentFailed,
};
