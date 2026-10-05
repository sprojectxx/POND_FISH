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
};
