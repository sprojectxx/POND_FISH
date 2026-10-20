/**
 * Broadcast Repository
 * Traceability: Admin Portal Specification Sections 131–137 (ADMIN-15 Notification Management)
 * Data access layer for administrative broadcasts, draft state, scheduling, and lifecycle.
 */

const { query } = require('../pool');

/**
 * Create a new broadcast record (in DRAFT, SCHEDULED, or immediate SENDING state)
 * @param {object} params
 * @returns {Promise<object>}
 */
async function createBroadcast({
  title,
  message,
  category = 'SYSTEM',
  audienceType = 'ALL',
  audiencePayload = {},
  channels = ['IN_APP', 'PUSH'],
  deepLink = null,
  status = 'DRAFT',
  scheduledAt = null,
  createdBy = null,
}) {
  const sql = `
    INSERT INTO admin_broadcasts (
      title,
      message,
      category,
      audience_type,
      audience_payload,
      channels,
      deep_link,
      status,
      scheduled_at,
      created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;

  const values = [
    title,
    message,
    (category || 'SYSTEM').toUpperCase(),
    (audienceType || 'ALL').toUpperCase(),
    JSON.stringify(audiencePayload || {}),
    channels,
    deepLink || null,
    status.toUpperCase(),
    scheduledAt ? new Date(scheduledAt) : null,
    createdBy || null,
  ];

  const res = await query(sql, values);
  return res.rows[0];
}

/**
 * Fetch a single broadcast by ID with created admin details
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getBroadcastById(id) {
  if (!id) return null;

  const sql = `
    SELECT 
      b.*,
      a.name AS created_by_name,
      a.email AS created_by_email
    FROM admin_broadcasts b
    LEFT JOIN admins a ON b.created_by = a.id
    WHERE b.id = $1;
  `;

  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

/**
 * Update an existing broadcast (allowed only while in DRAFT or SCHEDULED state)
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
async function updateBroadcast(id, updates = {}) {
  const allowedFields = [
    'title',
    'message',
    'category',
    'audience_type',
    'audience_payload',
    'channels',
    'deep_link',
    'status',
    'scheduled_at',
  ];

  const setClauses = [];
  const values = [id];

  for (const [key, val] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      values.push(
        key === 'audience_payload' && typeof val === 'object'
          ? JSON.stringify(val)
          : key === 'scheduled_at' && val
          ? new Date(val)
          : val
      );
      setClauses.push(`${key} = $${values.length}`);
    }
  }

  if (setClauses.length === 0) {
    return getBroadcastById(id);
  }

  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

  const sql = `
    UPDATE admin_broadcasts
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING *;
  `;

  const res = await query(sql, values);
  return res.rows[0] || null;
}

/**
 * Cancel an unsent broadcast
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function cancelBroadcast(id) {
  const sql = `
    UPDATE admin_broadcasts
    SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND status IN ('DRAFT', 'SCHEDULED')
    RETURNING *;
  `;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

/**
 * Atomically claim due scheduled broadcasts using row-level locking (FOR UPDATE SKIP LOCKED)
 * Prevents multiple concurrent scheduler runners from double-dispatching.
 * @param {number} batchLimit
 * @returns {Promise<object[]>}
 */
async function claimDueScheduledBroadcasts(batchLimit = 10) {
  const sql = `
    WITH due AS (
      SELECT id
      FROM admin_broadcasts
      WHERE status = 'SCHEDULED'
        AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE admin_broadcasts
    SET status = 'SENDING', updated_at = NOW()
    FROM due
    WHERE admin_broadcasts.id = due.id
    RETURNING admin_broadcasts.*;
  `;

  const res = await query(sql, [batchLimit]);
  return res.rows;
}

/**
 * Record final execution outcome and counters on a broadcast
 * @param {string} id
 * @param {object} outcome
 * @returns {Promise<object>}
 */
async function recordBroadcastOutcome(id, {
  status,
  sentAt = new Date(),
  recipientCount = 0,
  pushAttemptCount = 0,
  pushSuccessCount = 0,
  pushFailCount = 0,
}) {
  const sql = `
    UPDATE admin_broadcasts
    SET 
      status = $2,
      sent_at = $3,
      recipient_count = $4,
      push_attempt_count = $5,
      push_success_count = $6,
      push_fail_count = $7,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `;

  const res = await query(sql, [
    id,
    status.toUpperCase(),
    sentAt,
    recipientCount,
    pushAttemptCount,
    pushSuccessCount,
    pushFailCount,
  ]);
  return res.rows[0] || null;
}

/**
 * List broadcasts with filtering, search, counts, and pagination
 * @param {object} options
 * @returns {Promise<{ broadcasts: object[], total: number, counts: object }>}
 */
async function listBroadcasts({
  status = 'ALL',
  search = null,
  limit = 20,
  offset = 0,
} = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  // Status breakdown counts
  const countsSql = `
    SELECT 
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS draft_count,
      COUNT(*) FILTER (WHERE status = 'SCHEDULED')::int AS scheduled_count,
      COUNT(*) FILTER (WHERE status = 'SENDING')::int AS sending_count,
      COUNT(*) FILTER (WHERE status = 'SENT')::int AS sent_count,
      COUNT(*) FILTER (WHERE status = 'PARTIALLY_FAILED')::int AS partially_failed_count,
      COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed_count,
      COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_count
    FROM admin_broadcasts;
  `;
  const countsRes = await query(countsSql);
  const counts = countsRes.rows[0] || {
    total_count: 0,
    draft_count: 0,
    scheduled_count: 0,
    sending_count: 0,
    sent_count: 0,
    partially_failed_count: 0,
    failed_count: 0,
    cancelled_count: 0,
  };

  const conditions = [];
  const params = [];

  if (status && status !== 'ALL') {
    params.push(status.toUpperCase());
    conditions.push(`b.status = $${params.length}`);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    params.push(term);
    const idx = params.length;
    conditions.push(`(b.title ILIKE $${idx} OR b.message ILIKE $${idx} OR b.id::text ILIKE $${idx})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*)::int AS total FROM admin_broadcasts b ${whereClause};`;
  const countRes = await query(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  const dataParams = [...params, safeLimit, safeOffset];
  const listSql = `
    SELECT 
      b.*,
      a.name AS created_by_name,
      a.email AS created_by_email
    FROM admin_broadcasts b
    LEFT JOIN admins a ON b.created_by = a.id
    ${whereClause}
    ORDER BY b.created_at DESC
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
  `;
  const listRes = await query(listSql, dataParams);

  return {
    broadcasts: listRes.rows,
    total,
    counts,
  };
}

module.exports = {
  createBroadcast,
  getBroadcastById,
  updateBroadcast,
  cancelBroadcast,
  claimDueScheduledBroadcasts,
  recordBroadcastOutcome,
  listBroadcasts,
};
