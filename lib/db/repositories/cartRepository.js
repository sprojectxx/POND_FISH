/**
 * Customer Cart Persistence Repository
 * Traceability: PondFish Customer Portal PRD (CP-05) & Core Business Engines Spec (Section 13)
 * Persistent database repository for customer cart items using native pg pool.
 */

const { query } = require('../pool');

/**
 * Retrieve all cart items for a given customer
 * @param {string} customerId
 * @returns {Promise<Array>}
 */
async function getCartItems(customerId) {
  const sql = `
    SELECT 
      id,
      customer_id,
      fish_id,
      quantity_kg,
      created_at,
      updated_at
    FROM customer_cart_items
    WHERE customer_id = $1
    ORDER BY created_at ASC;
  `;
  const res = await query(sql, [customerId]);
  return res.rows;
}

/**
 * Find a specific cart item for a customer
 * @param {string} customerId
 * @param {string} fishId
 * @returns {Promise<object|null>}
 */
async function getCartItem(customerId, fishId) {
  const sql = `
    SELECT 
      id,
      customer_id,
      fish_id,
      quantity_kg,
      created_at,
      updated_at
    FROM customer_cart_items
    WHERE customer_id = $1 AND fish_id = $2;
  `;
  const res = await query(sql, [customerId, fishId]);
  return res.rows[0] || null;
}

/**
 * Add an item or increment its quantity if it already exists in the cart
 * @param {string} customerId
 * @param {string} fishId
 * @param {number} quantityKg
 * @returns {Promise<object>}
 */
async function addOrIncrementItem(customerId, fishId, quantityKg) {
  const sql = `
    INSERT INTO customer_cart_items (
      customer_id,
      fish_id,
      quantity_kg,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (customer_id, fish_id)
    DO UPDATE SET
      quantity_kg = customer_cart_items.quantity_kg + EXCLUDED.quantity_kg,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const res = await query(sql, [customerId, fishId, quantityKg]);
  return res.rows[0];
}

/**
 * Set the exact quantity of a cart item
 * @param {string} customerId
 * @param {string} fishId
 * @param {number} quantityKg
 * @returns {Promise<object|null>}
 */
async function updateItemQuantity(customerId, fishId, quantityKg) {
  const sql = `
    UPDATE customer_cart_items
    SET quantity_kg = $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE customer_id = $1 AND fish_id = $2
    RETURNING *;
  `;
  const res = await query(sql, [customerId, fishId, quantityKg]);
  return res.rows[0] || null;
}

/**
 * Remove a specific item from customer's cart
 * @param {string} customerId
 * @param {string} fishId
 * @returns {Promise<boolean>}
 */
async function removeCartItem(customerId, fishId) {
  const sql = `
    DELETE FROM customer_cart_items
    WHERE customer_id = $1 AND fish_id = $2
    RETURNING id;
  `;
  const res = await query(sql, [customerId, fishId]);
  return res.rowCount > 0;
}

/**
 * Clear all items from a customer's cart
 * @param {string} customerId
 * @returns {Promise<number>} Number of deleted items
 */
async function clearCart(customerId) {
  const sql = `
    DELETE FROM customer_cart_items
    WHERE customer_id = $1;
  `;
  const res = await query(sql, [customerId]);
  return res.rowCount;
}

module.exports = {
  getCartItems,
  getCartItem,
  addOrIncrementItem,
  updateItemQuantity,
  removeCartItem,
  clearCart,
};
