/**
 * Discount Persistence Repository
 * Traceability: PondFish Database ERD (Section 8) & API Spec (Section 10)
 * Queries active public discount campaigns.
 */

const { query } = require('../pool');

/**
 * List active public discounts currently within validity window
 * @returns {Promise<Array>}
 */
async function listActivePublicDiscounts() {
  const sql = `
    SELECT 
      id,
      fish_id,
      discount_code,
      discount_percent,
      flat_discount_amount,
      starts_at,
      expires_at,
      active
    FROM discounts
    WHERE active = true 
      AND starts_at <= NOW() 
      AND expires_at >= NOW()
    ORDER BY created_at DESC;
  `;

  const result = await query(sql);
  return result.rows;
}

/**
 * List all discounts for Admin management with associated fish names
 * @returns {Promise<Array>}
 */
async function listAllDiscounts() {
  const sql = `
    SELECT 
      d.id,
      d.fish_id,
      f.name AS fish_name,
      d.discount_code,
      d.discount_percent,
      d.flat_discount_amount,
      d.starts_at,
      d.expires_at,
      d.active,
      d.created_at,
      CASE 
        WHEN d.active = false THEN 'INACTIVE'
        WHEN d.expires_at < NOW() THEN 'EXPIRED'
        WHEN d.starts_at > NOW() THEN 'SCHEDULED'
        ELSE 'ACTIVE'
      END AS status
    FROM discounts d
    LEFT JOIN fish f ON d.fish_id = f.id
    ORDER BY d.created_at DESC;
  `;

  const result = await query(sql);
  return result.rows;
}

/**
 * Find discount by ID
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findDiscountById(id) {
  const sql = `
    SELECT 
      d.id,
      d.fish_id,
      f.name AS fish_name,
      d.discount_code,
      d.discount_percent,
      d.flat_discount_amount,
      d.starts_at,
      d.expires_at,
      d.active,
      d.created_at,
      CASE 
        WHEN d.active = false THEN 'INACTIVE'
        WHEN d.expires_at < NOW() THEN 'EXPIRED'
        WHEN d.starts_at > NOW() THEN 'SCHEDULED'
        ELSE 'ACTIVE'
      END AS status
    FROM discounts d
    LEFT JOIN fish f ON d.fish_id = f.id
    WHERE d.id = $1;
  `;

  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Create a new discount campaign
 * @param {object} data
 * @returns {Promise<object>}
 */
async function createDiscount({ fish_id = null, discount_code, discount_percent = null, flat_discount_amount = null, starts_at, expires_at, active = true }) {
  const crypto = require('crypto');
  const id = crypto.randomUUID();

  const sql = `
    INSERT INTO discounts (
      id,
      fish_id,
      discount_code,
      discount_percent,
      flat_discount_amount,
      starts_at,
      expires_at,
      active,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING *;
  `;

  const params = [
    id,
    fish_id || null,
    discount_code.trim().toUpperCase(),
    discount_percent !== null && discount_percent !== undefined ? parseFloat(discount_percent) : null,
    flat_discount_amount !== null && flat_discount_amount !== undefined ? parseFloat(flat_discount_amount) : null,
    starts_at,
    expires_at,
    Boolean(active),
  ];

  const result = await query(sql, params);
  return result.rows[0];
}

/**
 * Update an existing discount
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
async function updateDiscount(id, updates) {
  const fields = [];
  const params = [id];

  if (updates.fish_id !== undefined) {
    params.push(updates.fish_id || null);
    fields.push(`fish_id = $${params.length}`);
  }
  if (updates.discount_code !== undefined) {
    params.push(updates.discount_code.trim().toUpperCase());
    fields.push(`discount_code = $${params.length}`);
  }
  if (updates.discount_percent !== undefined) {
    params.push(updates.discount_percent !== null ? parseFloat(updates.discount_percent) : null);
    fields.push(`discount_percent = $${params.length}`);
  }
  if (updates.flat_discount_amount !== undefined) {
    params.push(updates.flat_discount_amount !== null ? parseFloat(updates.flat_discount_amount) : null);
    fields.push(`flat_discount_amount = $${params.length}`);
  }
  if (updates.starts_at !== undefined) {
    params.push(updates.starts_at);
    fields.push(`starts_at = $${params.length}`);
  }
  if (updates.expires_at !== undefined) {
    params.push(updates.expires_at);
    fields.push(`expires_at = $${params.length}`);
  }
  if (updates.active !== undefined) {
    params.push(Boolean(updates.active));
    fields.push(`active = $${params.length}`);
  }

  if (fields.length === 0) {
    return findDiscountById(id);
  }

  const sql = `
    UPDATE discounts
    SET ${fields.join(', ')}
    WHERE id = $1
    RETURNING *;
  `;

  const result = await query(sql, params);
  return result.rows[0] || null;
}

/**
 * Delete a discount
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function deleteDiscount(id) {
  const res = await query('DELETE FROM discounts WHERE id = $1 RETURNING id;', [id]);
  return res.rows.length > 0;
}

module.exports = {
  listActivePublicDiscounts,
  listAllDiscounts,
  findDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
};
