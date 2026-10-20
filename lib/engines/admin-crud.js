/**
 * Engine 16: Master Catalogue, Freshness, & Inventory CRUD Engine
 * Traceability: PondFish Core Business Engines Spec (Section 16) & Admin Spec (ADMIN-05, ADMIN-06)
 * Authoritative business engine for admin catalog, category, and availability management.
 */

const fishRepository = require('../db/repositories/fishRepository');
const categoryRepository = require('../db/repositories/categoryRepository');
const auditEngine = require('./audit');

const VALID_FRESHNESS_STATES = ['GREEN', 'GREY', 'YELLOW', 'RED'];

/**
 * List all fish catalogue items with inventory and category details for Admin
 * @param {object} filters
 * @returns {Promise<Array>}
 */
async function listFish(filters = {}) {
  return await fishRepository.listAdminFish(filters);
}

/**
 * Find a single fish item by ID
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getFish(id) {
  return await fishRepository.findFishById(id);
}

/**
 * Create a new fish record with validation, inventory initialization, and audit logging
 * @param {object} data
 * @param {object} [context] - { actorId, ip }
 * @returns {Promise<object>}
 */
async function createFish(data, { actorId = 'system', ip = 'unknown' } = {}) {
  if (!data.name || data.name.trim().length < 2) {
    const err = new Error('Fish name is required and must be at least 2 characters.');
    err.code = 'INVALID_FISH_NAME';
    err.status = 400;
    throw err;
  }

  if (!data.category_id) {
    const err = new Error('Category is required.');
    err.code = 'MISSING_CATEGORY';
    err.status = 400;
    throw err;
  }

  const category = await categoryRepository.findCategoryById(data.category_id);
  if (!category) {
    const err = new Error('Selected category does not exist.');
    err.code = 'CATEGORY_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const price = parseFloat(data.unit_price);
  if (isNaN(price) || price <= 0) {
    const err = new Error('Unit price must be a positive number greater than 0.');
    err.code = 'INVALID_PRICE';
    err.status = 400;
    throw err;
  }

  if (data.freshness_state && !VALID_FRESHNESS_STATES.includes(data.freshness_state)) {
    const err = new Error(`Invalid freshness state. Allowed values: ${VALID_FRESHNESS_STATES.join(', ')}`);
    err.code = 'INVALID_FRESHNESS';
    err.status = 400;
    throw err;
  }

  const newFish = await fishRepository.createFish(data);

  // Record audit log
  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'FISH_CREATED',
    entityType: 'FISH',
    entityId: newFish.id,
    payload: {
      name: newFish.name,
      category_id: newFish.category_id,
      unit_price: newFish.unit_price,
      online_bookable: newFish.online_bookable,
      physical_available: newFish.physical_available,
      freshness_state: newFish.freshness_state,
      ip,
    },
  });

  return newFish;
}

/**
 * Update an existing fish record with validation and audit logging
 * @param {string} id
 * @param {object} updates
 * @param {object} [context]
 * @returns {Promise<object>}
 */
async function updateFish(id, updates, { actorId = 'system', ip = 'unknown' } = {}) {
  const existing = await fishRepository.findFishById(id);
  if (!existing) {
    const err = new Error('Fish record not found.');
    err.code = 'FISH_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (updates.name !== undefined && updates.name.trim().length < 2) {
    const err = new Error('Fish name must be at least 2 characters.');
    err.code = 'INVALID_FISH_NAME';
    err.status = 400;
    throw err;
  }

  if (updates.category_id !== undefined) {
    const category = await categoryRepository.findCategoryById(updates.category_id);
    if (!category) {
      const err = new Error('Selected category does not exist.');
      err.code = 'CATEGORY_NOT_FOUND';
      err.status = 404;
      throw err;
    }
  }

  if (updates.unit_price !== undefined) {
    const price = parseFloat(updates.unit_price);
    if (isNaN(price) || price <= 0) {
      const err = new Error('Unit price must be a positive number greater than 0.');
      err.code = 'INVALID_PRICE';
      err.status = 400;
      throw err;
    }
  }

  if (updates.freshness_state !== undefined && !VALID_FRESHNESS_STATES.includes(updates.freshness_state)) {
    const err = new Error(`Invalid freshness state. Allowed values: ${VALID_FRESHNESS_STATES.join(', ')}`);
    err.code = 'INVALID_FRESHNESS';
    err.status = 400;
    throw err;
  }

  const updatedFish = await fishRepository.updateFish(id, updates);

  // Record audit log
  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'FISH_UPDATED',
    entityType: 'FISH',
    entityId: id,
    payload: {
      previous: {
        name: existing.name,
        unit_price: existing.unit_price,
        online_bookable: existing.online_bookable,
        physical_available: existing.physical_available,
        freshness_state: existing.freshness_state,
      },
      updated: updates,
      ip,
    },
  });

  return updatedFish;
}

/**
 * Delete a fish record with audit logging
 * @param {string} id
 * @param {object} [context]
 * @returns {Promise<boolean>}
 */
async function deleteFish(id, { actorId = 'system', ip = 'unknown' } = {}) {
  const existing = await fishRepository.findFishById(id);
  if (!existing) {
    const err = new Error('Fish record not found.');
    err.code = 'FISH_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  let deleted;
  try {
    deleted = await fishRepository.deleteFish(id);
  } catch (dbErr) {
    if (dbErr.code === '23503') {
      const err = new Error('Cannot delete this fish because historical bookings, orders, or transactions reference it.');
      err.code = 'FISH_HAS_DEPENDENCIES';
      err.status = 409;
      throw err;
    }
    throw dbErr;
  }

  if (deleted) {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId,
      action: 'FISH_DELETED',
      entityType: 'FISH',
      entityId: id,
      payload: { name: existing.name, ip },
    });
  }

  return deleted;
}

/**
 * List all categories with fish count for Admin
 * @returns {Promise<Array>}
 */
async function listCategories() {
  return await categoryRepository.listAllCategories();
}

/**
 * Create a new category with validation and audit logging
 * @param {object} data
 * @param {object} [context]
 * @returns {Promise<object>}
 */
async function createCategory(data, { actorId = 'system', ip = 'unknown' } = {}) {
  if (!data.name || data.name.trim().length < 2) {
    const err = new Error('Category name is required and must be at least 2 characters.');
    err.code = 'INVALID_CATEGORY_NAME';
    err.status = 400;
    throw err;
  }

  const newCategory = await categoryRepository.createCategory(data);

  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'CATEGORY_CREATED',
    entityType: 'CATEGORY',
    entityId: newCategory.id,
    payload: { name: newCategory.name, slug: newCategory.slug, ip },
  });

  return newCategory;
}

/**
 * Update an existing category with audit logging
 * @param {string} id
 * @param {object} updates
 * @param {object} [context]
 * @returns {Promise<object>}
 */
async function updateCategory(id, updates, { actorId = 'system', ip = 'unknown' } = {}) {
  const existing = await categoryRepository.findCategoryById(id);
  if (!existing) {
    const err = new Error('Category not found.');
    err.code = 'CATEGORY_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const updatedCategory = await categoryRepository.updateCategory(id, updates);

  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'CATEGORY_UPDATED',
    entityType: 'CATEGORY',
    entityId: id,
    payload: { updates, ip },
  });

  return updatedCategory;
}

/**
 * Delete a category with audit logging
 * @param {string} id
 * @param {object} [context]
 * @returns {Promise<boolean>}
 */
async function deleteCategory(id, { actorId = 'system', ip = 'unknown' } = {}) {
  const existing = await categoryRepository.findCategoryById(id);
  if (!existing) {
    const err = new Error('Category not found.');
    err.code = 'CATEGORY_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const deleted = await categoryRepository.deleteCategory(id);

  if (deleted) {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId,
      action: 'CATEGORY_DELETED',
      entityType: 'CATEGORY',
      entityId: id,
      payload: { name: existing.name, ip },
    });
  }

  return deleted;
}

module.exports = {
  name: 'AdminCRUDEngine',
  listFish,
  getFish,
  createFish,
  updateFish,
  deleteFish,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
