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

module.exports = {
  sanitizeMobile,
  findCustomerByMobile,
  findCustomerById,
  createCustomer,
  updateCustomerProfile,
};
