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
    WHERE c.id = $1
    GROUP BY c.id, c.name, c.slug, c.display_order, c.active;
  `;

  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * List all categories including inactive ones with fish counts for Admin management
 * @returns {Promise<Array>}
 */
async function listAllCategories() {
  const sql = `
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.display_order,
      c.active,
      c.created_at,
      c.updated_at,
      COUNT(f.id)::int AS fish_count
    FROM categories c
    LEFT JOIN fish f ON c.id = f.category_id
    GROUP BY c.id, c.name, c.slug, c.display_order, c.active, c.created_at, c.updated_at
    ORDER BY c.display_order ASC, c.name ASC;
  `;

  const result = await query(sql);
  return result.rows;
}

/**
 * Create a new category
 * @param {object} data
 * @returns {Promise<object>}
 */
async function createCategory({ name, slug, display_order = 0, active = true }) {
  const crypto = require('crypto');
  const id = crypto.randomUUID();
  const generatedSlug = slug ? slug.trim().toLowerCase() : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const sql = `
    INSERT INTO categories (
      id,
      name,
      slug,
      display_order,
      active,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING *;
  `;

  const result = await query(sql, [id, name.trim(), generatedSlug, parseInt(display_order, 10) || 0, Boolean(active)]);
  return result.rows[0];
}

/**
 * Update an existing category
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
async function updateCategory(id, updates) {
  const fields = [];
  const params = [id];

  if (updates.name !== undefined) {
    params.push(updates.name.trim());
    fields.push(`name = $${params.length}`);
  }
  if (updates.slug !== undefined) {
    params.push(updates.slug.trim().toLowerCase());
    fields.push(`slug = $${params.length}`);
  }
  if (updates.display_order !== undefined) {
    params.push(parseInt(updates.display_order, 10) || 0);
    fields.push(`display_order = $${params.length}`);
  }
  if (updates.active !== undefined) {
    params.push(Boolean(updates.active));
    fields.push(`active = $${params.length}`);
  }

  if (fields.length === 0) {
    return findCategoryById(id);
  }

  fields.push('updated_at = NOW()');

  const sql = `
    UPDATE categories
    SET ${fields.join(', ')}
    WHERE id = $1
    RETURNING *;
  `;

  const result = await query(sql, params);
  return result.rows[0] || null;
}

/**
 * Delete a category (only if no fish are attached)
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function deleteCategory(id) {
  const countRes = await query('SELECT COUNT(*)::int AS count FROM fish WHERE category_id = $1;', [id]);
  if (countRes.rows[0].count > 0) {
    const err = new Error('Cannot delete category with associated fish. Please reassign or remove the fish first.');
    err.code = 'CATEGORY_HAS_FISH';
    err.status = 400;
    throw err;
  }

  const res = await query('DELETE FROM categories WHERE id = $1 RETURNING id;', [id]);
  return res.rows.length > 0;
}

module.exports = {
  listActiveCategories,
  findCategoryById,
  listAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
