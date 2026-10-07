/**
 * Customer Persistence Repository
 * Traceability: PondFish Database ERD (Section 4.1) & Customer Specification
 * Uses native pg pool with parameterized SQL against existing Supabase schema.
 * Zero ORM. Zero schema mutations.
 */

const crypto = require('crypto');
const { query } = require('../pool');

/**
 * Sanitizes mobile number to 10 digits
 * @param {string} mobile
 * @returns {string}
 */
function sanitizeMobile(mobile) {
  if (!mobile) return '';
  return String(mobile).replace(/\D/g, '').slice(-10);
}

/**
 * Find customer by 10-digit mobile number
 * @param {string} mobileNumber
 * @returns {Promise<object|null>}
 */
async function findCustomerByMobile(mobileNumber) {
  const cleaned = sanitizeMobile(mobileNumber);
  const sql = `
    SELECT 
      id,
      mobile_number,
      name,
      age,
      area,
      created_at,
      updated_at
    FROM customers
    WHERE mobile_number = $1
    LIMIT 1;
  `;

  const result = await query(sql, [cleaned]);
  return result.rows[0] || null;
}

/**
 * Find customer by UUID
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findCustomerById(id) {
  const sql = `
    SELECT 
      id,
      mobile_number,
      name,
      age,
      area,
      created_at,
      updated_at
    FROM customers
    WHERE id = $1
    LIMIT 1;
  `;

  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Create a new customer record
 * @param {object} params
 * @param {string} params.mobileNumber
 * @param {string} [params.name]
 * @param {number} [params.age]
 * @param {string} [params.area]
 * @returns {Promise<object>}
 */
async function createCustomer({ mobileNumber, name = null, age = null, area = null }) {
  const id = crypto.randomUUID();
  const cleanedMobile = sanitizeMobile(mobileNumber);

  const sql = `
    INSERT INTO customers (
      id,
      mobile_number,
      name,
      age,
      area,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING 
      id,
      mobile_number,
      name,
      age,
      area,
      created_at,
      updated_at;
  `;

  const result = await query(sql, [id, cleanedMobile, name, age, area]);
  return result.rows[0];
}

/**
 * Update permitted customer profile fields
 * @param {string} id
 * @param {object} updates
 * @param {string} [updates.name]
 * @param {number} [updates.age]
 * @param {string} [updates.area]
 * @returns {Promise<object|null>}
 */
async function updateCustomerProfile(id, { name, age, area }) {
  const sql = `
    UPDATE customers
    SET 
      name = COALESCE($2, name),
      age = COALESCE($3, age),
      area = COALESCE($4, area),
      updated_at = NOW()
    WHERE id = $1
    RETURNING 
      id,
      mobile_number,
      name,
      age,
      area,
      created_at,
      updated_at;
  `;

  const result = await query(sql, [id, name || null, age !== undefined ? age : null, area || null]);
  return result.rows[0] || null;
}

/**
 * List customers for Admin management with search, subscription info, and metrics
 * @param {object} filters - { search, hasSubscription }
 * @returns {Promise<Array>}
 */
async function listAdminCustomers(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.search && filters.search.trim()) {
    params.push(`%${filters.search.trim()}%`);
    conditions.push(`(c.name ILIKE $${params.length} OR c.mobile_number ILIKE $${params.length} OR c.area ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      c.id,
      c.mobile_number,
      c.name,
      c.age,
      c.area,
      c.created_at,
      c.updated_at,
      cs.id AS subscription_id,
      cs.status AS subscription_status,
      COALESCE(cs.credit_balance, 0) AS credit_balance,
      sp.title AS subscription_plan_name,
      COUNT(DISTINCT b.id)::int AS bookings_count,
      COUNT(DISTINCT t.id)::int AS transactions_count,
      MAX(t.created_at) AS last_activity_at
    FROM customers c
    LEFT JOIN customer_subscriptions cs ON c.id = cs.customer_id AND cs.status = 'ACTIVE'
    LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
    LEFT JOIN bookings b ON c.id = b.customer_id
    LEFT JOIN transactions t ON c.id = t.customer_id
    ${whereClause}
    GROUP BY c.id, c.mobile_number, c.name, c.age, c.area, c.created_at, c.updated_at, cs.id, cs.status, cs.credit_balance, sp.title
    ORDER BY c.created_at DESC;
  `;

  const result = await query(sql, params);
  let rows = result.rows;

  if (filters.hasSubscription === true) {
    rows = rows.filter((r) => r.subscription_status === 'ACTIVE');
  } else if (filters.hasSubscription === false) {
    rows = rows.filter((r) => r.subscription_status !== 'ACTIVE');
  }

  return rows;
}

/**
 * Get comprehensive customer profile with subscriptions, bookings, and transactions
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getCustomerDetailedProfile(id) {
  const customer = await findCustomerById(id);
  if (!customer) return null;

  const [subsRes, bookingsRes, transRes] = await Promise.all([
    query(`
      SELECT cs.id, cs.credit_balance, cs.weekly_qty_used, cs.starts_at, cs.expires_at, cs.status, cs.created_at,
             sp.title as plan_name, sp.weekly_qty_limit_kg, sp.price
      FROM customer_subscriptions cs
      LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
      WHERE cs.customer_id = $1
      ORDER BY cs.created_at DESC;
    `, [id]),
    query(`
      SELECT id, booking_code, total_amount, sub_credit_used, razorpay_paid, status, expires_at, created_at
      FROM bookings
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT 25;
    `, [id]),
    query(`
      SELECT id, transaction_number, bill_id, total_bill_amount, sub_credit_used, final_paid_amount, payment_method, status, created_at
      FROM transactions
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT 25;
    `, [id]),
  ]);

  return {
    customer,
    subscriptions: subsRes.rows,
    activeSubscription: subsRes.rows.find((s) => s.status === 'ACTIVE') || null,
    bookings: bookingsRes.rows,
    transactions: transRes.rows,
  };
}

/**
 * Get set of blocked customer IDs from settings table
 * @returns {Promise<Set<string>>}
 */
async function getBlockedCustomerIds() {
  const res = await query("SELECT value FROM settings WHERE key = 'blocked_customer_ids' LIMIT 1;");
  if (res.rows.length === 0 || !res.rows[0].value) return new Set();
  try {
    const list = JSON.parse(res.rows[0].value);
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

/**
 * Set customer blocked state
 * @param {string} customerId
 * @param {boolean} blocked
 */
async function setCustomerBlockedState(customerId, blocked) {
  const blockedSet = await getBlockedCustomerIds();
  if (blocked) {
    blockedSet.add(customerId);
  } else {
    blockedSet.delete(customerId);
  }

  const serialized = JSON.stringify(Array.from(blockedSet));
  await query(`
    INSERT INTO settings (id, key, value, updated_at)
    VALUES (gen_random_uuid(), 'blocked_customer_ids', $1, NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();
  `, [serialized]);

  return Boolean(blocked);
}

module.exports = {
  sanitizeMobile,
  findCustomerByMobile,
  findCustomerById,
  createCustomer,
  updateCustomerProfile,
  listAdminCustomers,
  getCustomerDetailedProfile,
  getBlockedCustomerIds,
  setCustomerBlockedState,
};
