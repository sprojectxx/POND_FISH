/**
 * Fish Catalogue Persistence Repository
 * Traceability: PondFish Database ERD (Section 5.2) & API Spec (Section 10)
 * Uses native pg pool with parameterized SQL. Zero ORM abstraction.
 */

const { query } = require('../pool');

/**
 * List public fish with optional category, search, and availability filters
 * @param {object} filters
 * @param {string} [filters.categoryId]
 * @param {string} [filters.search]
 * @param {boolean} [filters.onlineBookable]
 * @param {boolean} [filters.available]
 * @returns {Promise<Array>}
 */
async function listPublicFish(filters = {}) {
  const conditions = [];
  const params = [];

  // Filter: Category (UUID or Category Name or Slug)
  if (filters.categoryId) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.categoryId);
    params.push(filters.categoryId);
    if (isUuid) {
      conditions.push(`f.category_id = $${params.length}`);
    } else {
      conditions.push(`(c.name ILIKE $${params.length} OR c.slug ILIKE $${params.length})`);
    }
  }

  // Filter: Search (Case-insensitive name or description)
  if (filters.search && filters.search.trim()) {
    params.push(`%${filters.search.trim()}%`);
    conditions.push(`(f.name ILIKE $${params.length} OR f.description ILIKE $${params.length})`);
  }

  // Filter: Online Bookable
  if (typeof filters.onlineBookable === 'boolean') {
    params.push(filters.onlineBookable);
    conditions.push(`f.online_bookable = $${params.length}`);
  }

  // Filter: Physical Availability
  if (typeof filters.available === 'boolean') {
    params.push(filters.available);
    conditions.push(`f.physical_available = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      f.id,
      f.category_id,
      c.name AS category_name,
      f.name,
      f.description,
      f.image_url,
      f.unit_price,
      f.physical_available,
      f.online_bookable,
      f.freshness_state,
      f.created_at,
      f.updated_at
    FROM fish f
    LEFT JOIN categories c ON f.category_id = c.id
    ${whereClause}
    ORDER BY f.name ASC;
  `;

  const result = await query(sql, params);
  return result.rows;
}

/**
 * Find a specific fish by its UUID
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findFishById(id) {
  const sql = `
    SELECT 
      f.id,
      f.category_id,
      c.name AS category_name,
      f.name,
      f.description,
      f.image_url,
      f.unit_price,
      f.physical_available,
      f.online_bookable,
      f.freshness_state,
      f.created_at,
      f.updated_at
    FROM fish f
    LEFT JOIN categories c ON f.category_id = c.id
    WHERE f.id = $1;
  `;

  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

module.exports = {
  listPublicFish,
  findFishById,
};
