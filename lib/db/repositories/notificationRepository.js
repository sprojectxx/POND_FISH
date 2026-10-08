/**
 * Notification & Delivery Repository Foundation
 * Traceability: PondFish Database ERD Data Model v1 (Section 28) & Master PRD v2 (Section 27)
 * Handles persistence for in-app notifications, FCM delivery outcome logs, and customer device tokens.
 * Native parameterized PostgreSQL queries. Zero ORM abstraction.
 */

const crypto = require('crypto');
const { query } = require('../pool');

/**
 * Persist an in-app notification record
 * @param {object} clientOrPool - pg client or pool
 * @param {object} params
 * @param {string} params.customerId - Customer UUID
 * @param {string} params.title - Headline
 * @param {string} params.message - Body content
 * @param {string} params.type - Category (e.g. 'BOOKING', 'SUBSCRIPTION', 'DELIVERY', 'SYSTEM')
 * @param {string} [params.id] - Optional UUID override
 * @returns {Promise<object>}
 */
async function createNotification(clientOrPool, { customerId, title, message, type, id = null }) {
  const runner = clientOrPool || { query };
  const notificationId = id || crypto.randomUUID();
  const res = await runner.query(
    `INSERT INTO notifications (id, customer_id, title, message, type, read, created_at)
     VALUES ($1, $2, $3, $4, $5, false, NOW())
     RETURNING *;`,
    [notificationId, customerId, title, message, type]
  );
  return res.rows[0];
}

/**
 * Persist a delivery attempt record (ERD Section 28.2)
 * @param {object} clientOrPool
 * @param {object} params
 * @returns {Promise<object>}
 */
async function createDeliveryRecord(clientOrPool, {
  notificationId,
  channel = 'PUSH',
  status = 'PENDING',
  providerMessageId = null,
  sentAt = null,
  deliveredAt = null,
  failedAt = null,
  errorMessage = null,
}) {
  const runner = clientOrPool || { query };
  const res = await runner.query(
    `INSERT INTO notification_deliveries (
       notification_id, channel, status, provider_message_id, sent_at, delivered_at, failed_at, error_message, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING *;`,
    [notificationId, channel, status, providerMessageId, sentAt, deliveredAt, failedAt, errorMessage]
  );
  return res.rows[0];
}

/**
 * Update delivery record outcome
 * @param {object} clientOrPool
 * @param {string} deliveryId
 * @param {object} params
 * @returns {Promise<object|null>}
 */
async function updateDeliveryStatus(clientOrPool, deliveryId, {
  status,
  providerMessageId = null,
  deliveredAt = null,
  failedAt = null,
  errorMessage = null,
}) {
  const runner = clientOrPool || { query };
  const res = await runner.query(
    `UPDATE notification_deliveries
     SET status = $2,
         provider_message_id = COALESCE($3, provider_message_id),
         delivered_at = COALESCE($4, delivered_at),
         failed_at = COALESCE($5, failed_at),
         error_message = COALESCE($6, error_message)
     WHERE id = $1
     RETURNING *;`,
    [deliveryId, status, providerMessageId, deliveredAt, failedAt, errorMessage]
  );
  return res.rows[0] || null;
}

/**
 * Retrieve notifications for a customer with optional category filtering and pagination
 * @param {string} customerId
 * @param {object} [options]
 * @returns {Promise<object[]>}
 */
async function getNotificationsByCustomer(customerId, { limit = 50, offset = 0, type = null } = {}) {
  const params = [customerId, limit, offset];
  let filterClause = '';

  if (type && typeof type === 'string' && type.trim().toUpperCase() !== 'ALL') {
    params.push(type.trim().toUpperCase());
    filterClause = `AND UPPER(type) = $${params.length}`;
  }

  const res = await query(
    `SELECT id, customer_id, title, message, type, read, created_at
     FROM notifications
     WHERE customer_id = $1 ${filterClause}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3;`,
    params
  );
  return res.rows;
}

/**
 * Get count of unread notifications for a customer
 * @param {string} customerId
 * @returns {Promise<number>}
 */
async function getUnreadCount(customerId) {
  const res = await query(
    `SELECT COUNT(*)::int AS count
     FROM notifications
     WHERE customer_id = $1 AND read = false;`,
    [customerId]
  );
  return res.rows[0]?.count || 0;
}

/**
 * Mark a single customer notification as read (with customer isolation)
 * @param {string} customerId
 * @param {string} notificationId
 * @returns {Promise<object|null>}
 */
async function markNotificationRead(customerId, notificationId) {
  const res = await query(
    `UPDATE notifications
     SET read = true
     WHERE id = $1 AND customer_id = $2
     RETURNING *;`,
    [notificationId, customerId]
  );
  return res.rows[0] || null;
}

/**
 * Mark all unread notifications for a customer as read
 * @param {string} customerId
 * @returns {Promise<number>} Number of updated notifications
 */
async function markAllNotificationsRead(customerId) {
  const res = await query(
    `UPDATE notifications
     SET read = true
     WHERE customer_id = $1 AND read = false
     RETURNING id;`,
    [customerId]
  );
  return res.rowCount || 0;
}

/**
 * Register or update an FCM device token for a customer
 * @param {string} customerId
 * @param {string} deviceToken
 * @param {string} [platform='android']
 * @returns {Promise<object>}
 */
async function registerDeviceToken(customerId, deviceToken, platform = 'android') {
  const res = await query(
    `INSERT INTO customer_devices (customer_id, device_token, platform, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (customer_id, device_token)
     DO UPDATE SET updated_at = NOW(), platform = EXCLUDED.platform
     RETURNING *;`,
    [customerId, deviceToken, platform]
  );
  return res.rows[0];
}

/**
 * Retrieve all registered device tokens for a customer
 * @param {string} customerId
 * @returns {Promise<string[]>}
 */
async function getCustomerDeviceTokens(customerId) {
  const res = await query(
    `SELECT device_token
     FROM customer_devices
     WHERE customer_id = $1
     ORDER BY updated_at DESC;`,
    [customerId]
  );
  return res.rows.map((r) => r.device_token);
}

/**
 * Remove an invalid or logged-out device token
 * @param {string} customerId
 * @param {string} deviceToken
 * @returns {Promise<boolean>}
 */
async function removeDeviceToken(customerId, deviceToken) {
  const res = await query(
    `DELETE FROM customer_devices
     WHERE customer_id = $1 AND device_token = $2;`,
    [customerId, deviceToken]
  );
  return (res.rowCount || 0) > 0;
}

/**
 * List, search, filter and paginate notifications for admin management console
 * Traceability: ADMIN-15 / ADMIN-17 (Customer Communications)
 * 
 * @param {object} [options]
 * @param {string} [options.search]
 * @param {string} [options.type]
 * @param {string} [options.channel]
 * @param {string} [options.dateFrom]
 * @param {string} [options.dateTo]
 * @param {number} [options.limit=20]
 * @param {number} [options.offset=0]
 * @returns {Promise<{ notifications: Array<object>, total: number, counts: object }>}
 */
async function listAdminNotifications({
  search = null,
  type = null,
  channel = null,
  dateFrom = null,
  dateTo = null,
  limit = 20,
  offset = 0,
} = {}) {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

  // Status counts summary across all notifications
  const countsSql = `
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE read = false)::int AS unread_count,
      COUNT(*) FILTER (WHERE type = 'BOOKING')::int AS booking_count,
      COUNT(*) FILTER (WHERE type = 'SUBSCRIPTION')::int AS subscription_count,
      COUNT(*) FILTER (WHERE type IN ('SYSTEM', 'PROMO', 'ANNOUNCEMENT'))::int AS promo_count,
      (SELECT COUNT(*)::int FROM notification_deliveries WHERE channel = 'PUSH' AND status = 'SENT') AS push_sent_count,
      (SELECT COUNT(*)::int FROM notification_deliveries WHERE status = 'FAILED') AS delivery_failed_count
    FROM notifications;
  `;
  const countsRes = await query(countsSql);
  const counts = countsRes.rows[0] || {
    total_count: 0,
    unread_count: 0,
    booking_count: 0,
    subscription_count: 0,
    promo_count: 0,
    push_sent_count: 0,
    delivery_failed_count: 0,
  };

  const conditions = [];
  const params = [];

  // Type / Category filter
  if (type && type !== 'ALL') {
    params.push(type.toUpperCase());
    conditions.push(`UPPER(n.type) = $${params.length}`);
  }

  // Date filters
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    if (!isNaN(fromDate.getTime())) {
      params.push(fromDate);
      conditions.push(`n.created_at >= $${params.length}`);
    }
  }

  if (dateTo) {
    const toDate = new Date(dateTo);
    if (!isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      params.push(toDate);
      conditions.push(`n.created_at <= $${params.length}`);
    }
  }

  // Channel filter
  if (channel && channel !== 'ALL') {
    params.push(channel.toUpperCase());
    conditions.push(`EXISTS (
      SELECT 1 FROM notification_deliveries nd_c 
      WHERE nd_c.notification_id = n.id AND UPPER(nd_c.channel) = $${params.length}
    )`);
  }

  // Search filter
  if (search && search.trim()) {
    const term = search.trim();
    const searchPattern = `%${term}%`;
    params.push(searchPattern);
    const patternIdx = params.length;

    conditions.push(`(
      n.title ILIKE $${patternIdx}
      OR n.message ILIKE $${patternIdx}
      OR n.id::text ILIKE $${patternIdx}
      OR c.name ILIKE $${patternIdx}
      OR c.mobile_number ILIKE $${patternIdx}
    )`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching
  const countSql = `
    SELECT COUNT(DISTINCT n.id)::int AS total
    FROM notifications n
    LEFT JOIN customers c ON n.customer_id = c.id
    ${whereClause};
  `;
  const countRes = await query(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  // Fetch paginated notifications with delivery outcomes
  const dataParams = [...params, safeLimit, safeOffset];
  const listSql = `
    SELECT 
      n.id,
      n.customer_id,
      c.name AS customer_name,
      c.mobile_number AS customer_phone,
      n.title,
      n.message,
      n.type,
      n.read,
      n.created_at,
      COALESCE(
        (
          SELECT json_agg(json_build_object(
            'id', nd.id,
            'channel', nd.channel,
            'status', nd.status,
            'provider_message_id', nd.provider_message_id,
            'sent_at', nd.sent_at,
            'delivered_at', nd.delivered_at,
            'failed_at', nd.failed_at,
            'error_message', nd.error_message
          ))
          FROM notification_deliveries nd
          WHERE nd.notification_id = n.id
        ), '[]'::json
      ) AS deliveries
    FROM notifications n
    LEFT JOIN customers c ON n.customer_id = c.id
    ${whereClause}
    ORDER BY n.created_at DESC
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
  `;

  const listRes = await query(listSql, dataParams);

  return {
    notifications: listRes.rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name || 'Customer',
      customerPhone: row.customer_phone || null,
      title: row.title,
      message: row.message,
      type: row.type,
      read: Boolean(row.read),
      createdAt: row.created_at,
      deliveries: row.deliveries || [],
    })),
    total,
    counts: {
      all: counts.total_count,
      unread: counts.unread_count,
      booking: counts.booking_count,
      subscription: counts.subscription_count,
      promo: counts.promo_count,
      pushSent: counts.push_sent_count,
      deliveryFailed: counts.delivery_failed_count,
    },
  };
}

/**
 * Retrieve complete details of a single notification for admin inspection
 * @param {string} notificationId
 * @returns {Promise<object|null>}
 */
async function getAdminNotificationDetail(notificationId) {
  if (!notificationId) return null;

  const notifSql = `
    SELECT 
      n.id,
      n.customer_id,
      c.name AS customer_name,
      c.mobile_number AS customer_phone,
      c.area AS customer_area,
      n.title,
      n.message,
      n.type,
      n.read,
      n.created_at
    FROM notifications n
    LEFT JOIN customers c ON n.customer_id = c.id
    WHERE n.id = $1;
  `;
  const notifRes = await query(notifSql, [notificationId]);
  if (notifRes.rows.length === 0) return null;
  const notif = notifRes.rows[0];

  // Fetch delivery log records
  const delSql = `
    SELECT 
      id,
      channel,
      status,
      provider_message_id,
      sent_at,
      delivered_at,
      failed_at,
      error_message,
      created_at
    FROM notification_deliveries
    WHERE notification_id = $1
    ORDER BY created_at DESC;
  `;
  const delRes = await query(delSql, [notificationId]);

  // Fetch audit logs
  const auditSql = `
    SELECT id, actor_type, actor_id, action, entity_type, entity_id, payload, timestamp
    FROM audit_logs
    WHERE (entity_type = 'NOTIFICATION' AND entity_id = $1::text)
       OR (payload ILIKE '%' || $1::text || '%')
    ORDER BY timestamp DESC;
  `;
  const auditRes = await query(auditSql, [notificationId]);

  return {
    id: notif.id,
    customerId: notif.customer_id,
    customerName: notif.customer_name || 'Customer',
    customerPhone: notif.customer_phone || null,
    customerArea: notif.customer_area || null,
    title: notif.title,
    message: notif.message,
    type: notif.type,
    read: Boolean(notif.read),
    createdAt: notif.created_at,
    deliveries: delRes.rows.map((d) => ({
      id: d.id,
      channel: d.channel,
      status: d.status,
      providerMessageId: d.provider_message_id,
      sentAt: d.sent_at,
      deliveredAt: d.delivered_at,
      failedAt: d.failed_at,
      errorMessage: d.error_message,
      createdAt: d.created_at,
    })),
    auditLogs: auditRes.rows.map((a) => {
      let payloadParsed = null;
      try { payloadParsed = JSON.parse(a.payload); } catch { payloadParsed = a.payload; }
      return {
        id: a.id,
        actorType: a.actor_type,
        actorId: a.actor_id,
        action: a.action,
        entityType: a.entity_type,
        payload: payloadParsed,
        timestamp: a.timestamp,
      };
    }),
  };
}

/**
 * Resolve target customer recipients based on authoritative audience criteria
 * Traceability: ADMIN-15 Audience Options (Everyone, Subscription Customers, Specific Plan, Individual)
 * 
 * @param {object} params
 * @param {string} params.audienceType - 'ALL' | 'ACTIVE_SUBSCRIBERS' | 'SPECIFIC_PLAN' | 'INDIVIDUAL'
 * @param {string} [params.planId] - Required for 'SPECIFIC_PLAN'
 * @param {string} [params.customerId] - Required for 'INDIVIDUAL'
 * @returns {Promise<Array<{ id: string, name: string, mobile_number: string }>>}
 */
async function resolveAudienceCustomers({ audienceType = 'ALL', planId = null, customerId = null }) {
  const normAudience = (audienceType || 'ALL').toUpperCase();

  if (normAudience === 'INDIVIDUAL') {
    if (!customerId) return [];
    const res = await query(
      `SELECT id, name, mobile_number FROM customers WHERE id = $1;`,
      [customerId]
    );
    return res.rows;
  }

  if (normAudience === 'SPECIFIC_PLAN') {
    if (!planId) return [];
    const res = await query(
      `SELECT DISTINCT c.id, c.name, c.mobile_number
       FROM customers c
       JOIN customer_subscriptions cs ON cs.customer_id = c.id
       WHERE cs.plan_id = $1 
         AND cs.status = 'ACTIVE' 
         AND cs.expires_at > NOW();`,
      [planId]
    );
    return res.rows;
  }

  if (normAudience === 'ACTIVE_SUBSCRIBERS' || normAudience === 'SUBSCRIPTION_CUSTOMERS') {
    const res = await query(
      `SELECT DISTINCT c.id, c.name, c.mobile_number
       FROM customers c
       JOIN customer_subscriptions cs ON cs.customer_id = c.id
       WHERE cs.status = 'ACTIVE' 
         AND cs.expires_at > NOW();`
    );
    return res.rows;
  }

  // Default: 'ALL' / 'EVERYONE'
  const res = await query(
    `SELECT id, name, mobile_number FROM customers ORDER BY created_at DESC;`
  );
  return res.rows;
}

module.exports = {
  createNotification,
  createDeliveryRecord,
  updateDeliveryStatus,
  getNotificationsByCustomer,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  registerDeviceToken,
  getCustomerDeviceTokens,
  removeDeviceToken,
  listAdminNotifications,
  getAdminNotificationDetail,
  resolveAudienceCustomers,
};
