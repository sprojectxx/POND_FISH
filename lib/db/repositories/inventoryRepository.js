/**
 * Inventory Persistence Repository
 * Traceability: PondFish Database ERD (Section 7.1, 7.2) & Core Engines Spec (Section 8)
 * Manages operational inventory summary and immutable movement ledger using native pg.
 */

const { query } = require('../pool');

/**
 * Fetch operational inventory summary for a specific fish
 * @param {string} fishId
 * @param {object} [client] - Optional active transaction client
 * @returns {Promise<object|null>}
 */
async function getInventoryForFish(fishId, client = null) {
  const sql = `
    SELECT 
      id,
      fish_id,
      physical_quantity,
      reserved_quantity,
      available_quantity,
      updated_at
    FROM inventory
    WHERE fish_id = $1;
  `;
  const runner = client || { query };
  const res = await runner.query(sql, [fishId]);
  return res.rows[0] || null;
}

/**
 * Fetch operational inventory for multiple fish IDs in bulk
 * @param {string[]} fishIds
 * @param {object} [client]
 * @returns {Promise<Map<string, object>>}
 */
async function getInventoryForFishList(fishIds, client = null) {
  if (!fishIds || fishIds.length === 0) {
    return new Map();
  }

  const sql = `
    SELECT 
      id,
      fish_id,
      physical_quantity,
      reserved_quantity,
      available_quantity,
      updated_at
    FROM inventory
    WHERE fish_id = ANY($1::uuid[]);
  `;
  const runner = client || { query };
  const res = await runner.query(sql, [fishIds]);

  const map = new Map();
  for (const row of res.rows) {
    map.set(row.fish_id, row);
  }
  return map;
}

/**
 * Concurrency-safe atomic reservation of inventory for a fish.
 * Locks the row using SELECT ... FOR UPDATE within the transaction client.
 * Enforces available_quantity >= requested quantity, updates inventory, and logs to inventory_ledger.
 * @param {object} client - Active pg transaction client
 * @param {object} params - { fishId, quantityKg, bookingId, bookingCode }
 * @returns {Promise<object>} Updated inventory record
 */
async function reserveInventoryAtomic(client, { fishId, quantityKg, bookingId, bookingCode }) {
  if (!client) {
    throw new Error('A transaction client is required for atomic reservation.');
  }

  const parsedQty = parseFloat(quantityKg);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    const err = new Error('INVALID_RESERVATION_QUANTITY');
    err.code = 'INVALID_RESERVATION_QUANTITY';
    throw err;
  }

  // Row lock on operational inventory
  const lockSql = `
    SELECT 
      id,
      fish_id,
      physical_quantity,
      reserved_quantity,
      available_quantity
    FROM inventory
    WHERE fish_id = $1
    FOR UPDATE;
  `;
  const lockRes = await client.query(lockSql, [fishId]);

  if (lockRes.rows.length === 0) {
    const err = new Error(`Inventory record not found for fish ${fishId}`);
    err.code = 'INVENTORY_NOT_FOUND';
    err.fishId = fishId;
    throw err;
  }

  const current = lockRes.rows[0];
  const available = parseFloat(current.available_quantity);

  if (available < parsedQty) {
    const err = new Error(`Insufficient available stock for fish ${fishId}. Available: ${available} kg, Requested: ${parsedQty} kg.`);
    err.code = 'INSUFFICIENT_INVENTORY';
    err.fishId = fishId;
    err.available = available;
    err.requested = parsedQty;
    throw err;
  }

  // Perform atomic deduction on available and increment on reserved
  const updateSql = `
    UPDATE inventory
    SET 
      reserved_quantity = reserved_quantity + $1,
      available_quantity = available_quantity - $1,
      updated_at = NOW()
    WHERE fish_id = $2
    RETURNING *;
  `;
  const updateRes = await client.query(updateSql, [parsedQty, fishId]);
  const updated = updateRes.rows[0];

  // Record immutable reservation in inventory_ledger
  const ledgerSql = `
    INSERT INTO inventory_ledger (
      id,
      fish_id,
      batch_id,
      change_type,
      quantity_change,
      resulting_qty,
      reference_id,
      created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      NULL,
      'BOOKING_RESERVATION',
      $2,
      $3,
      $4,
      NOW()
    );
  `;
  await client.query(ledgerSql, [
    fishId,
    parsedQty,
    updated.available_quantity,
    bookingCode || bookingId || 'BOOKING_RESERVATION',
  ]);

  return updated;
}

/**
 * Release reserved inventory back to available stock upon cancellation or expiry.
 * @param {object} client - Active pg transaction client
 * @param {object} params - { fishId, quantityKg, bookingId, bookingCode, reason }
 * @returns {Promise<object>} Updated inventory record
 */
async function releaseInventoryAtomic(client, { fishId, quantityKg, bookingId, bookingCode, reason = 'BOOKING_RELEASE' }) {
  if (!client) {
    throw new Error('A transaction client is required for atomic release.');
  }

  const parsedQty = parseFloat(quantityKg);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    return null;
  }

  // Row lock
  const lockSql = `
    SELECT 
      id,
      fish_id,
      physical_quantity,
      reserved_quantity,
      available_quantity
    FROM inventory
    WHERE fish_id = $1
    FOR UPDATE;
  `;
  const lockRes = await client.query(lockSql, [fishId]);
  if (lockRes.rows.length === 0) {
    return null;
  }

  const current = lockRes.rows[0];
  const currentReserved = parseFloat(current.reserved_quantity);
  const releaseAmount = Math.min(currentReserved, parsedQty);

  const updateSql = `
    UPDATE inventory
    SET 
      reserved_quantity = GREATEST(0, reserved_quantity - $1),
      available_quantity = physical_quantity - GREATEST(0, reserved_quantity - $1),
      updated_at = NOW()
    WHERE fish_id = $2
    RETURNING *;
  `;
  const updateRes = await client.query(updateSql, [releaseAmount, fishId]);
  const updated = updateRes.rows[0];

  // Record in inventory_ledger
  const ledgerSql = `
    INSERT INTO inventory_ledger (
      id,
      fish_id,
      batch_id,
      change_type,
      quantity_change,
      resulting_qty,
      reference_id,
      created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      NULL,
      'BOOKING_RELEASE',
      $2,
      $3,
      $4,
      NOW()
    );
  `;
  await client.query(ledgerSql, [
    fishId,
    releaseAmount,
    updated.available_quantity,
    bookingCode || bookingId || reason,
  ]);

  return updated;
}

/**
 * Atomically consume reserved inventory upon worker order completion/fulfillment.
 * Decrements both physical_quantity and reserved_quantity.
 * Invariant: available_quantity = physical_quantity - reserved_quantity (remains unchanged!).
 * Creates an immutable inventory_ledger entry with change_type: 'SALE'.
 * @param {object} client - Active pg transaction client
 * @param {object} params - { fishId, quantityKg, bookingId, bookingCode }
 * @returns {Promise<object>} Updated inventory record
 */
async function consumeReservedInventoryAtomic(client, { fishId, quantityKg, bookingId, bookingCode }) {
  if (!client) {
    throw new Error('A transaction client is required for atomic inventory consumption.');
  }

  const parsedQty = parseFloat(quantityKg);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    const err = new Error('INVALID_CONSUMPTION_QUANTITY');
    err.code = 'INVALID_CONSUMPTION_QUANTITY';
    throw err;
  }

  // Row lock on operational inventory
  const lockSql = `
    SELECT 
      id,
      fish_id,
      physical_quantity,
      reserved_quantity,
      available_quantity
    FROM inventory
    WHERE fish_id = $1
    FOR UPDATE;
  `;
  const lockRes = await client.query(lockSql, [fishId]);

  if (lockRes.rows.length === 0) {
    const err = new Error(`Inventory record not found for fish ${fishId}`);
    err.code = 'INVENTORY_NOT_FOUND';
    err.fishId = fishId;
    throw err;
  }

  const current = lockRes.rows[0];
  const physical = parseFloat(current.physical_quantity);
  const reserved = parseFloat(current.reserved_quantity);

  if (physical < parsedQty) {
    const err = new Error(`Physical inventory insufficient to fulfill booking for fish ${fishId}. Physical: ${physical} kg, Requested: ${parsedQty} kg.`);
    err.code = 'INSUFFICIENT_PHYSICAL_STOCK';
    err.fishId = fishId;
    err.physical = physical;
    err.requested = parsedQty;
    throw err;
  }

  // Atomically decrement physical and reserved quantities
  // available_quantity = (physical - parsedQty) - (reserved - parsedQty) = physical - reserved (preserved!)
  const newPhysical = Math.max(0, physical - parsedQty);
  const newReserved = Math.max(0, reserved - parsedQty);
  const newAvailable = Math.max(0, newPhysical - newReserved);

  const updateSql = `
    UPDATE inventory
    SET 
      physical_quantity = $1,
      reserved_quantity = $2,
      available_quantity = $3,
      updated_at = NOW()
    WHERE fish_id = $4
    RETURNING *;
  `;
  const updateRes = await client.query(updateSql, [newPhysical, newReserved, newAvailable, fishId]);
  const updated = updateRes.rows[0];

  // Record immutable SALE entry in inventory_ledger
  const ledgerSql = `
    INSERT INTO inventory_ledger (
      id,
      fish_id,
      batch_id,
      change_type,
      quantity_change,
      resulting_qty,
      reference_id,
      created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      NULL,
      'SALE',
      $2,
      $3,
      $4,
      NOW()
    );
  `;
  await client.query(ledgerSql, [
    fishId,
    -parsedQty,
    updated.physical_quantity,
    bookingCode || bookingId || 'BOOKING_FULFILLMENT',
  ]);

  return updated;
}

/**
 * Atomically deduct physical store counter inventory (unreserved counter sale).
 * Decrements both physical_quantity and available_quantity.
 * Invariant: available_quantity = physical_quantity - reserved_quantity (preserved).
 * Creates an immutable inventory_ledger entry with change_type: 'SALE'.
 * @param {object} client - Active pg transaction client
 * @param {object} params - { fishId, quantityKg, billNumber, transactionNumber }
 * @returns {Promise<object>} Updated inventory record
 */
async function deductPhysicalInventoryAtomic(client, { fishId, quantityKg, billNumber, transactionNumber }) {
  if (!client) {
    throw new Error('A transaction client is required for atomic physical inventory deduction.');
  }

  const parsedQty = parseFloat(quantityKg);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    const err = new Error('INVALID_SALE_QUANTITY');
    err.code = 'INVALID_SALE_QUANTITY';
    throw err;
  }

  // Row lock on operational inventory
  const lockSql = `
    SELECT 
      id,
      fish_id,
      physical_quantity,
      reserved_quantity,
      available_quantity
    FROM inventory
    WHERE fish_id = $1
    FOR UPDATE;
  `;
  const lockRes = await client.query(lockSql, [fishId]);

  if (lockRes.rows.length === 0) {
    const err = new Error(`Inventory record not found for fish ${fishId}`);
    err.code = 'INVENTORY_NOT_FOUND';
    err.fishId = fishId;
    throw err;
  }

  const current = lockRes.rows[0];
  const available = parseFloat(current.available_quantity);
  const physical = parseFloat(current.physical_quantity);

  if (available < parsedQty || physical < parsedQty) {
    const err = new Error(`Available stock insufficient for counter purchase of fish ${fishId}. Available: ${available} kg, Requested: ${parsedQty} kg.`);
    err.code = 'INSUFFICIENT_INVENTORY';
    err.fishId = fishId;
    err.available = available;
    err.requested = parsedQty;
    throw err;
  }

  const newPhysical = Math.max(0, parseFloat((physical - parsedQty).toFixed(2)));
  const newAvailable = Math.max(0, parseFloat((available - parsedQty).toFixed(2)));

  const updateSql = `
    UPDATE inventory
    SET 
      physical_quantity = $1,
      available_quantity = $2,
      updated_at = NOW()
    WHERE fish_id = $3
    RETURNING *;
  `;
  const updateRes = await client.query(updateSql, [newPhysical, newAvailable, fishId]);
  const updated = updateRes.rows[0];

  // Record immutable SALE entry in inventory_ledger
  const ledgerSql = `
    INSERT INTO inventory_ledger (
      id,
      fish_id,
      batch_id,
      change_type,
      quantity_change,
      resulting_qty,
      reference_id,
      created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      NULL,
      'SALE',
      $2,
      $3,
      $4,
      NOW()
    );
  `;
  await client.query(ledgerSql, [
    fishId,
    -parsedQty,
    updated.available_quantity,
    transactionNumber || billNumber || 'PHYSICAL_SALE',
  ]);

  return updated;
}

module.exports = {
  getInventoryForFish,
  getInventoryForFishList,
  reserveInventoryAtomic,
  releaseInventoryAtomic,
  consumeReservedInventoryAtomic,
  deductPhysicalInventoryAtomic,
};

