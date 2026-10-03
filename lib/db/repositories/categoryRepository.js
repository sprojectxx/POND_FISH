/**
 * Category Persistence Repository
 * Traceability: PondFish Database ERD (Section 5.1) & API Spec (Section 10)
 * Uses native pg pool with parameterized SQL against existing Supabase schema.
 */

const { query } = require('../pool');

/**
 * List all active categories with associated fish counts
 * @returns {Promise<Array>}
 */
async function listActiveCategories() {
  const sql = `
    SELECT 
      c.id,
      c.name,
      c.slug,
      NULL::text AS description,
      NULL::text AS image_url,
      c.display_order,
      c.active,
      COUNT(f.id)::int AS fish_count
    FROM categories c
    LEFT JOIN fish f ON c.id = f.category_id
    WHERE c.active = true
    GROUP BY c.id, c.name, c.slug, c.display_order, c.active
    ORDER BY c.display_order ASC, c.name ASC;
  `;

  const result = await query(sql);
  return result.rows;
}

/**
 * Find a specific category by UUID
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findCategoryById(id) {
  const sql = `
    SELECT 
      c.id,
      c.name,
      c.slug,
      NULL::text AS description,
      NULL::text AS image_url,
      c.display_order,
      c.active,
      COUNT(f.id)::int AS fish_count
    FROM categories c
    LEFT JOIN fish f ON c.id = f.category_id
    WHERE c.id = $1 AND c.active = true
    GROUP BY c.id, c.name, c.slug, c.display_order, c.active;
  `;

  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

module.exports = {
  listActiveCategories,
  findCategoryById,
};
