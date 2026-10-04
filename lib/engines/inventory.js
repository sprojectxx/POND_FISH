/**
 * Engine 04: Inventory & Ledger Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 8) & PRD (Section 7)
 * Operational inventory validation, concurrency-safe atomic reservation,
 * and reservation release backed by PostgreSQL inventory and inventory_ledger.
 */

const inventoryRepository = require('../db/repositories/inventoryRepository');

/**
 * Validate availability for an array of items without holding a transaction lock.
 * Invariant: available_quantity >= requested_quantity
 * @param {Array<{ fishId: string, quantity: number }>} items
 * @returns {Promise<{ isAvailable: boolean, inventoryMap: Map<string, object>, issues: Array<object> }>}
 */
async function validateAvailability(items) {
  if (!items || items.length === 0) {
    return { isAvailable: true, inventoryMap: new Map(), issues: [] };
  }

  const fishIds = items.map(i => i.fishId || i.fish_id);
  const inventoryMap = await inventoryRepository.getInventoryForFishList(fishIds);
  const issues = [];

  for (const item of items) {
    const fishId = item.fishId || item.fish_id;
    const requested = parseFloat(item.quantity || item.quantity_kg || 0);
    const inv = inventoryMap.get(fishId);

    const available = inv ? parseFloat(inv.available_quantity) : 0;
    if (available < requested) {
      issues.push({
        fishId,
        requested,
        available,
        shortfall: parseFloat((requested - available).toFixed(2)),
        message: `Requested ${requested} kg exceeds available stock (${available} kg).`,
      });
    }
  }

  return {
    isAvailable: issues.length === 0,
    inventoryMap,
    issues,
  };
}

/**
 * Perform atomic concurrency-safe reservation for all booking items within a transaction client.
 * Invariant: available_quantity = physical_quantity - reserved_quantity. Never negative.
 * @param {object} client - Active pg transaction client
 * @param {Array<{ fishId: string, quantity: number }>} items
 * @param {object} context - { bookingId, bookingCode }
 */
async function reserveItemsAtomic(client, items, { bookingId, bookingCode }) {
  if (!client) {
    throw new Error('A PostgreSQL transaction client is required for atomic reservation.');
  }

  const reservedRecords = [];
  for (const item of items) {
    const fishId = item.fishId || item.fish_id;
    const quantityKg = parseFloat(item.quantity || item.quantity_kg || 0);

    const updated = await inventoryRepository.reserveInventoryAtomic(client, {
      fishId,
      quantityKg,
      bookingId,
      bookingCode,
    });
    reservedRecords.push(updated);
  }
  return reservedRecords;
}

/**
 * Release reserved inventory back to available stock within a transaction client.
 * @param {object} client - Active pg transaction client
 * @param {Array<{ fishId: string, quantity: number }>} items
 * @param {object} context - { bookingId, bookingCode, reason }
 */
async function releaseItemsAtomic(client, items, { bookingId, bookingCode, reason = 'BOOKING_RELEASE' }) {
  if (!client) {
    throw new Error('A PostgreSQL transaction client is required for atomic release.');
  }

  const releasedRecords = [];
  for (const item of items) {
    const fishId = item.fishId || item.fish_id;
    const quantityKg = parseFloat(item.quantity || item.quantity_kg || 0);

    const updated = await inventoryRepository.releaseInventoryAtomic(client, {
      fishId,
      quantityKg,
      bookingId,
      bookingCode,
      reason,
    });
    if (updated) releasedRecords.push(updated);
  }
  return releasedRecords;
}

module.exports = {
  name: 'InventoryEngine',
  validateAvailability,
  reserveItemsAtomic,
  releaseItemsAtomic,
};
