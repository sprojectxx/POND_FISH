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

module.exports = {
  listActivePublicDiscounts,
};
