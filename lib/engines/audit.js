/**
 * Engine 17: System-Wide Financial & State Mutation Audit Logging Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 17 & 27),
 * Page-by-Page UI Specification Admin Portal (AP-19, Sections 164–168),
 * Database ERD Specification (Section 29)
 * 
 * STRICT IMMUTABILITY RULE:
 * Audit logs cannot be modified, deleted, or overwritten. No edit/delete API exists.
 * Secrets, credentials, tokens, and passwords are never persisted or exposed.
 */

const pool = require('../db/pool');

const SENSITIVE_KEYS = ['password', 'password_hash', 'secret', 'token', 'authorization', 'api_key', 'private_key'];

/**
 * Recursively strip sensitive values from an object before audit logging
 */
function stripSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripSecrets);

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(sk => k.toLowerCase().includes(sk))) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = stripSecrets(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Record an immutable audit log entry
 * Supports participating in an active transaction when client is provided
 */
async function recordAuditLog({
  actorType = 'SYSTEM',
  actorId = 'system',
  action,
  entityType = 'UNKNOWN',
  entityId = 'none',
  payload = {},
  client = null,
} = {}, clientParam = null) {
  if (!action) {
    throw new Error('Audit action is required');
  }

  const cleanPayload = stripSecrets(payload);
  const stringifiedPayload = typeof cleanPayload === 'string' ? cleanPayload : JSON.stringify(cleanPayload);
  const runner = clientParam || client || pool;

  const res = await runner.query(`
    INSERT INTO audit_logs (
      id,
      actor_type,
      actor_id,
      action,
      entity_type,
      entity_id,
      payload,
      timestamp
    ) VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      NOW()
    ) RETURNING *;
  `, [
    actorType,
    String(actorId),
    action,
    entityType,
    String(entityId),
    stringifiedPayload,
  ]);

  return res.rows[0];
}

/**
 * Query audit logs with search, actor/entity filters, date bounds, and pagination
 */
async function getAuditLogs({
  actorType = null,
  entityType = null,
  action = null,
  search = null,
  from = null,
  to = null,
  page = 1,
  limit = 50,
} = {}) {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const offset = (pageNum - 1) * safeLimit;

  const conditions = [];
  const params = [];

  if (actorType) {
    params.push(actorType);
    conditions.push(`actor_type = $${params.length}`);
  }

  if (entityType) {
    params.push(entityType);
    conditions.push(`entity_type = $${params.length}`);
  }

  if (action) {
    params.push(action);
    conditions.push(`action = $${params.length}`);
  }

  if (search && search.trim() !== '') {
    params.push(`%${search.trim()}%`);
    conditions.push(`(action ILIKE $${params.length} OR entity_id ILIKE $${params.length} OR actor_id ILIKE $${params.length} OR payload ILIKE $${params.length})`);
  }

  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) {
      params.push(fromDate);
      conditions.push(`timestamp >= $${params.length}`);
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime())) {
      params.push(toDate);
      conditions.push(`timestamp <= $${params.length}`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching records
  const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM audit_logs ${whereClause};`, params);
  const total = countRes.rows[0]?.total || 0;

  // Fetch paginated records
  const dataParams = [...params, safeLimit, offset];
  const dataRes = await pool.query(`
    SELECT 
      id,
      actor_type,
      actor_id,
      action,
      entity_type,
      entity_id,
      payload,
      timestamp
    FROM audit_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `, dataParams);

  const logs = dataRes.rows.map(row => {
    let parsedPayload = null;
    try {
      parsedPayload = row.payload ? JSON.parse(row.payload) : null;
    } catch (e) {
      parsedPayload = row.payload;
    }

    return {
      id: row.id,
      actor_type: row.actor_type,
      actor_id: row.actor_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      payload: parsedPayload,
      timestamp: row.timestamp,
    };
  });

  return {
    logs,
    pagination: {
      page: pageNum,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * Fetch a single audit log entry by ID
 */
async function getAuditLogById(id) {
  const res = await pool.query('SELECT * FROM audit_logs WHERE id = $1;', [id]);
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  let parsedPayload = null;
  try {
    parsedPayload = row.payload ? JSON.parse(row.payload) : null;
  } catch (e) {
    parsedPayload = row.payload;
  }

  return {
    id: row.id,
    actor_type: row.actor_type,
    actor_id: row.actor_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    payload: parsedPayload,
    timestamp: row.timestamp,
  };
}

module.exports = {
  name: 'AuditEngine',
  recordAuditLog,
  getAuditLogs,
  getAuditLogById,
  stripSecrets,
};
