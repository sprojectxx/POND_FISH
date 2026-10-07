/**
 * Engine 03: Discount Campaign Engine
 * Traceability: PondFish Core Business Engines Spec (Section 3) & Admin Spec (ADMIN-07)
 * Authoritative business engine for promotional campaigns, server-side validation,
 * discount lifecycle management, and audit tracking.
 */

const discountRepository = require('../db/repositories/discountRepository');
const fishRepository = require('../db/repositories/fishRepository');
const auditEngine = require('./audit');

/**
 * List all discount campaigns for Admin management
 * @returns {Promise<Array>}
 */
async function listDiscounts() {
  return await discountRepository.listAllDiscounts();
}

/**
 * Get discount by ID
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getDiscount(id) {
  return await discountRepository.findDiscountById(id);
}

/**
 * Create a new discount campaign with validation and audit logging
 * @param {object} data
 * @param {object} [context]
 * @returns {Promise<object>}
 */
async function createDiscount(data, { actorId = 'system', ip = 'unknown' } = {}) {
  if (!data.discount_code || !data.discount_code.trim()) {
    const err = new Error('Discount code is required.');
    err.code = 'INVALID_DISCOUNT_CODE';
    err.status = 400;
    throw err;
  }

  const code = data.discount_code.trim().toUpperCase();

  if (!data.starts_at || !data.expires_at) {
    const err = new Error('Start date and end date are both required.');
    err.code = 'MISSING_DATE_RANGE';
    err.status = 400;
    throw err;
  }

  const startDate = new Date(data.starts_at);
  const endDate = new Date(data.expires_at);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    const err = new Error('Invalid date format for discount campaign.');
    err.code = 'INVALID_DATE_FORMAT';
    err.status = 400;
    throw err;
  }

  if (startDate >= endDate) {
    const err = new Error('Start date must be strictly before expiration date.');
    err.code = 'INVALID_DATE_RANGE';
    err.status = 400;
    throw err;
  }

  const hasPercent = data.discount_percent !== undefined && data.discount_percent !== null && data.discount_percent !== '';
  const hasFlat = data.flat_discount_amount !== undefined && data.flat_discount_amount !== null && data.flat_discount_amount !== '';

  if (!hasPercent && !hasFlat) {
    const err = new Error('Discount must specify either a discount percentage or a flat discount amount.');
    err.code = 'MISSING_DISCOUNT_VALUE';
    err.status = 400;
    throw err;
  }

  let percentVal = null;
  let flatVal = null;

  if (hasPercent) {
    percentVal = parseFloat(data.discount_percent);
    if (isNaN(percentVal) || percentVal <= 0 || percentVal > 100) {
      const err = new Error('Discount percentage must be between 1 and 100.');
      err.code = 'INVALID_DISCOUNT_PERCENT';
      err.status = 400;
      throw err;
    }
  }

  if (hasFlat) {
    flatVal = parseFloat(data.flat_discount_amount);
    if (isNaN(flatVal) || flatVal <= 0) {
      const err = new Error('Flat discount amount must be greater than 0.');
      err.code = 'INVALID_FLAT_DISCOUNT';
      err.status = 400;
      throw err;
    }
  }

  if (data.fish_id) {
    const fish = await fishRepository.findFishById(data.fish_id);
    if (!fish) {
      const err = new Error('Selected fish does not exist.');
      err.code = 'FISH_NOT_FOUND';
      err.status = 404;
      throw err;
    }
    if (flatVal && flatVal >= fish.unit_price) {
      const err = new Error(`Flat discount (₹${flatVal}) cannot equal or exceed fish unit price (₹${fish.unit_price}).`);
      err.code = 'DISCOUNT_EXCEEDS_PRICE';
      err.status = 400;
      throw err;
    }
  }

  const newDiscount = await discountRepository.createDiscount({
    fish_id: data.fish_id || null,
    discount_code: code,
    discount_percent: percentVal,
    flat_discount_amount: flatVal,
    starts_at: startDate.toISOString(),
    expires_at: endDate.toISOString(),
    active: data.active !== undefined ? Boolean(data.active) : true,
  });

  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'DISCOUNT_CREATED',
    entityType: 'DISCOUNT',
    entityId: newDiscount.id,
    payload: {
      discount_code: newDiscount.discount_code,
      fish_id: newDiscount.fish_id,
      discount_percent: newDiscount.discount_percent,
      flat_discount_amount: newDiscount.flat_discount_amount,
      starts_at: newDiscount.starts_at,
      expires_at: newDiscount.expires_at,
      active: newDiscount.active,
      ip,
    },
  }).catch(() => {});

  return newDiscount;
}

/**
 * Update discount campaign with validation and audit logging
 * @param {string} id
 * @param {object} updates
 * @param {object} [context]
 * @returns {Promise<object>}
 */
async function updateDiscount(id, updates, { actorId = 'system', ip = 'unknown' } = {}) {
  const existing = await discountRepository.findDiscountById(id);
  if (!existing) {
    const err = new Error('Discount campaign not found.');
    err.code = 'DISCOUNT_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const cleanUpdates = {};

  if (updates.discount_code !== undefined) {
    cleanUpdates.discount_code = updates.discount_code.trim().toUpperCase();
  }

  if (updates.fish_id !== undefined) {
    if (updates.fish_id) {
      const fish = await fishRepository.findFishById(updates.fish_id);
      if (!fish) {
        const err = new Error('Selected fish does not exist.');
        err.code = 'FISH_NOT_FOUND';
        err.status = 404;
        throw err;
      }
    }
    cleanUpdates.fish_id = updates.fish_id || null;
  }

  if (updates.discount_percent !== undefined) {
    if (updates.discount_percent !== null && updates.discount_percent !== '') {
      const p = parseFloat(updates.discount_percent);
      if (isNaN(p) || p <= 0 || p > 100) {
        const err = new Error('Discount percentage must be between 1 and 100.');
        err.code = 'INVALID_DISCOUNT_PERCENT';
        err.status = 400;
        throw err;
      }
      cleanUpdates.discount_percent = p;
    } else {
      cleanUpdates.discount_percent = null;
    }
  }

  if (updates.flat_discount_amount !== undefined) {
    if (updates.flat_discount_amount !== null && updates.flat_discount_amount !== '') {
      const f = parseFloat(updates.flat_discount_amount);
      if (isNaN(f) || f <= 0) {
        const err = new Error('Flat discount amount must be greater than 0.');
        err.code = 'INVALID_FLAT_DISCOUNT';
        err.status = 400;
        throw err;
      }
      cleanUpdates.flat_discount_amount = f;
    } else {
      cleanUpdates.flat_discount_amount = null;
    }
  }

  if (updates.starts_at !== undefined) {
    cleanUpdates.starts_at = new Date(updates.starts_at).toISOString();
  }

  if (updates.expires_at !== undefined) {
    cleanUpdates.expires_at = new Date(updates.expires_at).toISOString();
  }

  if (cleanUpdates.starts_at && cleanUpdates.expires_at) {
    if (new Date(cleanUpdates.starts_at) >= new Date(cleanUpdates.expires_at)) {
      const err = new Error('Start date must be strictly before expiration date.');
      err.code = 'INVALID_DATE_RANGE';
      err.status = 400;
      throw err;
    }
  }

  if (updates.active !== undefined) {
    cleanUpdates.active = Boolean(updates.active);
  }

  const updatedDiscount = await discountRepository.updateDiscount(id, cleanUpdates);

  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'DISCOUNT_UPDATED',
    entityType: 'DISCOUNT',
    entityId: id,
    payload: { updates: cleanUpdates, ip },
  }).catch(() => {});

  return updatedDiscount;
}

/**
 * Delete a discount campaign
 * @param {string} id
 * @param {object} [context]
 * @returns {Promise<boolean>}
 */
async function deleteDiscount(id, { actorId = 'system', ip = 'unknown' } = {}) {
  const existing = await discountRepository.findDiscountById(id);
  if (!existing) {
    const err = new Error('Discount campaign not found.');
    err.code = 'DISCOUNT_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const deleted = await discountRepository.deleteDiscount(id);

  if (deleted) {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId,
      action: 'DISCOUNT_DELETED',
      entityType: 'DISCOUNT',
      entityId: id,
      payload: { code: existing.discount_code, ip },
    }).catch(() => {});
  }

  return deleted;
}

module.exports = {
  name: 'DiscountCampaignEngine',
  listDiscounts,
  listDiscountsForAdmin: listDiscounts,
  getDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
};

