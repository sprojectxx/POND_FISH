/**
 * GPS Journey & Telemetry Repository Foundation
 * Traceability: PondFish Database ERD Data Model v1 (Section 24 & 26), Master PRD v2 (Section 22)
 * Native parameterized PostgreSQL queries. Zero ORM abstraction.
 */

const crypto = require('crypto');
const { query } = require('../pool');

/**
 * Persist a new GPS Journey record
 * @param {object} clientOrPool
 * @param {object} params
 * @returns {Promise<object>}
 */
async function createJourney(clientOrPool, {
  truckNumber,
  driverName,
  origin = null,
  destination = null,
  fishManifest = [],
  status = 'DRAFT',
  publishedToCustomer = false,
  id = null,
}) {
  const runner = clientOrPool || { query };
  const journeyId = id || crypto.randomUUID();

  const sql = `
    INSERT INTO gps_journeys (
      id,
      truck_number,
      driver_name,
      origin,
      destination,
      fish_manifest,
      status,
      published_to_customer,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING *;
  `;

  const res = await runner.query(sql, [
    journeyId,
    truckNumber,
    driverName,
    origin ? JSON.stringify(origin) : null,
    destination ? JSON.stringify(destination) : null,
    JSON.stringify(fishManifest || []),
    status,
    Boolean(publishedToCustomer),
  ]);

  return res.rows[0];
}

/**
 * Retrieve a journey by ID
 * @param {object} clientOrPool
 * @param {string} journeyId
 * @returns {Promise<object|null>}
 */
async function getJourneyById(clientOrPool, journeyId) {
  const runner = clientOrPool || { query };
  const res = await runner.query(
    `SELECT * FROM gps_journeys WHERE id = $1 LIMIT 1;`,
    [journeyId]
  );
  return res.rows[0] || null;
}

/**
 * List journeys with optional status filter and pagination
 * @param {object} clientOrPool
 * @param {object} [options]
 * @returns {Promise<Array>}
 */
async function listJourneys(clientOrPool, { limit = 50, offset = 0, status = null } = {}) {
  const runner = clientOrPool || { query };
  let sql = `SELECT * FROM gps_journeys`;
  const params = [];

  if (status) {
    params.push(status);
    sql += ` WHERE status = $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
  params.push(Math.min(100, Math.max(1, parseInt(limit, 10))));
  params.push(Math.max(0, parseInt(offset, 10)));

  const res = await runner.query(sql, params);
  return res.rows;
}

/**
 * Get active customer-published journey
 * Finds the latest journey where customer publication is true and customer tracking is not closed
 * @param {object} clientOrPool
 * @returns {Promise<object|null>}
 */
async function getActiveCustomerJourney(clientOrPool) {
  const runner = clientOrPool || { query };
  const sql = `
    SELECT *
    FROM gps_journeys
    WHERE published_to_customer = true
      AND customer_tracking_closed_at IS NULL
      AND status IN ('LIVE', 'STOPPED')
    ORDER BY started_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
  `;
  const res = await runner.query(sql);
  return res.rows[0] || null;
}

/**
 * Start a journey (transitions to LIVE and stamps started_at)
 * @param {object} clientOrPool
 * @param {string} journeyId
 * @returns {Promise<object>}
 */
async function startJourney(clientOrPool, journeyId) {
  const runner = clientOrPool || { query };
  const res = await runner.query(
    `UPDATE gps_journeys
     SET status = 'LIVE', started_at = COALESCE(started_at, NOW())
     WHERE id = $1
     RETURNING *;`,
    [journeyId]
  );
  return res.rows[0] || null;
}

/**
 * Update customer publication state
 * @param {object} clientOrPool
 * @param {string} journeyId
 * @param {boolean} publishedToCustomer
 * @returns {Promise<object>}
 */
async function updateCustomerPublication(clientOrPool, journeyId, publishedToCustomer) {
  const runner = clientOrPool || { query };
  const res = await runner.query(
    `UPDATE gps_journeys
     SET published_to_customer = $2
     WHERE id = $1
     RETURNING *;`,
    [journeyId, Boolean(publishedToCustomer)]
  );
  return res.rows[0] || null;
}

/**
 * Mark journey arrived at store geofence (records ended_at / arrival timestamp)
 * @param {object} clientOrPool
 * @param {string} journeyId
 * @param {Date|string} [arrivedAt]
 * @returns {Promise<object>}
 */
async function markJourneyArrived(clientOrPool, journeyId, arrivedAt = new Date()) {
  const runner = clientOrPool || { query };
  const res = await runner.query(
    `UPDATE gps_journeys
     SET ended_at = COALESCE(ended_at, $2)
     WHERE id = $1
     RETURNING *;`,
    [journeyId, arrivedAt]
  );
  return res.rows[0] || null;
}

/**
 * Close customer tracking after post-arrival duration expires
 * @param {object} clientOrPool
 * @param {string} journeyId
 * @param {Date|string} [closedAt]
 * @returns {Promise<object>}
 */
async function closeCustomerTracking(clientOrPool, journeyId, closedAt = new Date()) {
  const runner = clientOrPool || { query };
  const res = await runner.query(
    `UPDATE gps_journeys
     SET customer_tracking_closed_at = $2
     WHERE id = $1
     RETURNING *;`,
    [journeyId, closedAt]
  );
  return res.rows[0] || null;
}

/**
 * Stop a journey
 * @param {object} clientOrPool
 * @param {string} journeyId
 * @param {Date|string} [endedAt]
 * @returns {Promise<object>}
 */
async function stopJourney(clientOrPool, journeyId, endedAt = new Date()) {
  const runner = clientOrPool || { query };
  const res = await runner.query(
    `UPDATE gps_journeys
     SET status = 'STOPPED', ended_at = COALESCE(ended_at, $2)
     WHERE id = $1
     RETURNING *;`,
    [journeyId, endedAt]
  );
  return res.rows[0] || null;
}

/**
 * Ingest a GPS position record
 * @param {object} clientOrPool
 * @param {object} params
 * @returns {Promise<object>}
 */
async function insertPosition(clientOrPool, {
  journeyId,
  latitude,
  longitude,
  speed = null,
  heading = null,
  recordedAt = new Date(),
  id = null,
}) {
  const runner = clientOrPool || { query };
  const positionId = id || crypto.randomUUID();

  const sql = `
    INSERT INTO gps_positions (
      id,
      journey_id,
      latitude,
      longitude,
      speed,
      heading,
      recorded_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const res = await runner.query(sql, [
    positionId,
    journeyId,
    parseFloat(latitude),
    parseFloat(longitude),
    speed !== null && speed !== undefined ? parseFloat(speed) : null,
    heading !== null && heading !== undefined ? parseFloat(heading) : null,
    recordedAt,
  ]);

  return res.rows[0];
}

/**
 * Get latest recorded GPS position for a journey
 * @param {object} clientOrPool
 * @param {string} journeyId
 * @returns {Promise<object|null>}
 */
async function getLatestPosition(clientOrPool, journeyId) {
  const runner = clientOrPool || { query };
  const res = await runner.query(
    `SELECT *
     FROM gps_positions
     WHERE journey_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1;`,
    [journeyId]
  );
  return res.rows[0] || null;
}

/**
 * Get position history for a journey
 * @param {object} clientOrPool
 * @param {string} journeyId
 * @param {number} [limit=100]
 * @returns {Promise<Array>}
 */
async function getPositionHistory(clientOrPool, journeyId, limit = 100) {
  const runner = clientOrPool || { query };
  const res = await runner.query(
    `SELECT *
     FROM gps_positions
     WHERE journey_id = $1
     ORDER BY recorded_at DESC
     LIMIT $2;`,
    [journeyId, Math.min(500, Math.max(1, parseInt(limit, 10)))]
  );
  return res.rows;
}

module.exports = {
  createJourney,
  getJourneyById,
  listJourneys,
  getActiveCustomerJourney,
  startJourney,
  updateCustomerPublication,
  markJourneyArrived,
  closeCustomerTracking,
  stopJourney,
  insertPosition,
  getLatestPosition,
  getPositionHistory,
};
