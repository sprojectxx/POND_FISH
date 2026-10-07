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
async function findFishById(id, client = null) {
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

  const executor = client || { query };
  const result = await executor.query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Retrieve all fish catalogue items with optional client for transactional queries
 * @param {object} [options]
 * @param {object} [client] - Optional transactional client
 * @returns {Promise<Array>}
 */
async function getAllFish(options = {}, client = null) {
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
    ORDER BY f.name ASC;
  `;
  if (client) {
    const result = await client.query(sql, []);
    return result.rows;
  }
  const result = await query(sql, []);
  return result.rows;
}

/**
 * List all fish for admin management with associated category, inventory, and filters
 * @param {object} filters - { categoryId, search, onlineBookable, available, freshnessState }
 * @returns {Promise<Array>}
 */
async function listAdminFish(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.categoryId) {
    params.push(filters.categoryId);
    conditions.push(`f.category_id = $${params.length}`);
  }

  if (filters.search && filters.search.trim()) {
    params.push(`%${filters.search.trim()}%`);
    conditions.push(`(f.name ILIKE $${params.length} OR f.description ILIKE $${params.length})`);
  }

  if (typeof filters.onlineBookable === 'boolean') {
    params.push(filters.onlineBookable);
    conditions.push(`f.online_bookable = $${params.length}`);
  }

  if (typeof filters.available === 'boolean') {
    params.push(filters.available);
    conditions.push(`f.physical_available = $${params.length}`);
  }

  if (filters.freshnessState) {
    params.push(filters.freshnessState);
    conditions.push(`f.freshness_state = $${params.length}`);
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
      f.updated_at,
      COALESCE(i.physical_quantity, 0) AS physical_quantity,
      COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
      COALESCE(i.available_quantity, 0) AS available_quantity
    FROM fish f
    LEFT JOIN categories c ON f.category_id = c.id
    LEFT JOIN inventory i ON f.id = i.fish_id
    ${whereClause}
    ORDER BY f.created_at DESC, f.name ASC;
  `;

  const result = await query(sql, params);
  return result.rows;
}

/**
 * Create a new fish record and initialize inventory
 * @param {object} data
 * @returns {Promise<object>}
 */
async function createFish(data) {
  const crypto = require('crypto');
  const id = data.id || crypto.randomUUID();
  const sql = `
    INSERT INTO fish (
      id,
      category_id,
      name,
      description,
      image_url,
      unit_price,
      physical_available,
      online_bookable,
      freshness_state,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    RETURNING *;
  `;

  const params = [
    id,
    data.category_id,
    data.name,
    data.description || null,
    data.image_url || null,
    parseFloat(data.unit_price),
    data.physical_available !== undefined ? Boolean(data.physical_available) : true,
    data.online_bookable !== undefined ? Boolean(data.online_bookable) : true,
    data.freshness_state || 'GREEN',
  ];

  const result = await query(sql, params);

  // Initialize corresponding inventory record
  await query(`
    INSERT INTO inventory (id, fish_id, physical_quantity, reserved_quantity, available_quantity, updated_at)
    VALUES (gen_random_uuid(), $1, 0, 0, 0, NOW())
    ON CONFLICT (fish_id) DO NOTHING;
  `, [id]).catch(() => {});

  return result.rows[0];
}

/**
 * Update an existing fish record
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
async function updateFish(id, updates) {
  const fields = [];
  const params = [id];

  if (updates.category_id !== undefined) {
    params.push(updates.category_id);
    fields.push(`category_id = $${params.length}`);
  }
  if (updates.name !== undefined) {
    params.push(updates.name);
    fields.push(`name = $${params.length}`);
  }
  if (updates.description !== undefined) {
    params.push(updates.description);
    fields.push(`description = $${params.length}`);
  }
  if (updates.image_url !== undefined) {
    params.push(updates.image_url);
    fields.push(`image_url = $${params.length}`);
  }
  if (updates.unit_price !== undefined) {
    params.push(parseFloat(updates.unit_price));
    fields.push(`unit_price = $${params.length}`);
  }
  if (updates.physical_available !== undefined) {
    params.push(Boolean(updates.physical_available));
    fields.push(`physical_available = $${params.length}`);
  }
  if (updates.online_bookable !== undefined) {
    params.push(Boolean(updates.online_bookable));
    fields.push(`online_bookable = $${params.length}`);
  }
  if (updates.freshness_state !== undefined) {
    params.push(updates.freshness_state);
    fields.push(`freshness_state = $${params.length}`);
  }

  if (fields.length === 0) {
    return findFishById(id);
  }

  fields.push('updated_at = NOW()');

  const sql = `
    UPDATE fish
    SET ${fields.join(', ')}
    WHERE id = $1
    RETURNING *;
  `;

  const result = await query(sql, params);
  return result.rows[0] || null;
}

/**
 * Delete a fish record
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function deleteFish(id) {
  // Clean up inventory first
  await query('DELETE FROM inventory WHERE fish_id = $1;', [id]).catch(() => {});
  const res = await query('DELETE FROM fish WHERE id = $1 RETURNING id;', [id]);
  return res.rows.length > 0;
}

module.exports = {
  listPublicFish,
  findFishById,
  getFishById: findFishById,
  getAllFish,
  listAdminFish,
  createFish,
  updateFish,
  deleteFish,
};
