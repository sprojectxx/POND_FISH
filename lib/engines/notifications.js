/**
 * Engine 18: Customer & System Event Notification Engine
 * Traceability: PondFish Core Business Engines Spec v1 (Section 18), Integration Spec (Section 7), PRD (Section 27)
 * 
 * Orchestrates:
 * 1. Business event listener bindings on DomainEventsEngine.
 * 2. Immutable persistence of in-app notification records.
 * 3. Asynchronous delivery attempts via Firebase Cloud Messaging (FCM).
 * 4. Audited persistence of delivery outcomes in notification_deliveries.
 * 5. Strict provider failure isolation: FCM delivery failures NEVER roll back business transactions.
 * 6. Customer query isolation and read-state management.
 */

const notificationRepository = require('../db/repositories/notificationRepository');
const firebaseAdapter = require('../adapters/firebase/admin');
const domainEventsEngine = require('./domain-events');
const auditEngine = require('./audit');

/**
 * Dispatch an in-app and push notification to a customer with delivery tracking.
 * Provider failure isolation: wrapped in comprehensive try-catch; never throws to callers.
 * 
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} params.type - 'BOOKING' | 'SUBSCRIPTION' | 'DELIVERY' | 'SYSTEM'
 * @param {object} [params.data] - Deep linking payload
 * @returns {Promise<{ success: boolean, notification?: object, deliveries?: object[], error?: string }>}
 */
async function sendNotificationToCustomer({ customerId, title, message, type = 'SYSTEM', data = {} }) {
  if (!customerId) {
    console.warn('[NOTIFICATIONS ENGINE] Skipped dispatch: No customerId provided.');
    return { success: false, error: 'MISSING_CUSTOMER_ID' };
  }

  try {
    // Step 1: Persist in-app notification record
    const notification = await notificationRepository.createNotification(null, {
      customerId,
      title,
      message,
      type: type.toUpperCase(),
    });

    const deliveries = [];

    // Step 2: Retrieve registered device tokens for FCM delivery
    let deviceTokens = [];
    try {
      deviceTokens = await notificationRepository.getCustomerDeviceTokens(customerId);
    } catch (tokenErr) {
      console.warn('[NOTIFICATIONS ENGINE] Failed to fetch device tokens:', tokenErr.message);
    }

    const payloadData = {
      notificationId: notification.id,
      type: notification.type,
      ...data,
    };

    // Step 3: Attempt direct token delivery for each registered device
    if (deviceTokens && deviceTokens.length > 0) {
      for (const token of deviceTokens) {
        let deliveryRecord = null;
        try {
          deliveryRecord = await notificationRepository.createDeliveryRecord(null, {
            notificationId: notification.id,
            channel: 'PUSH',
            status: 'PENDING',
          });
        } catch (delErr) {
          console.warn('[NOTIFICATIONS ENGINE] Failed to create delivery audit row:', delErr.message);
        }

        const pushResult = await firebaseAdapter.sendPushNotification({
          token,
          title,
          body: message,
          data: payloadData,
        });

        if (deliveryRecord) {
          try {
            const updatedDelivery = await notificationRepository.updateDeliveryStatus(
              null,
              deliveryRecord.id,
              {
                status: pushResult.success ? 'SENT' : 'FAILED',
                providerMessageId: pushResult.messageId || null,
                deliveredAt: pushResult.success ? new Date() : null,
                failedAt: pushResult.success ? null : new Date(),
                errorMessage: pushResult.error || null,
              }
            );
            deliveries.push(updatedDelivery);
          } catch (updErr) {
            console.warn('[NOTIFICATIONS ENGINE] Failed to update delivery status:', updErr.message);
          }
        }

        // Clean up invalid or expired registration tokens
        if (pushResult.invalidToken) {
          try {
            await notificationRepository.removeDeviceToken(customerId, token);
            console.log(`[NOTIFICATIONS ENGINE] Pruned invalid device token for customer ${customerId}`);
          } catch (pruneErr) {
            console.warn('[NOTIFICATIONS ENGINE] Could not prune token:', pruneErr.message);
          }
        }
      }
    }

    return {
      success: true,
      notification,
      deliveries,
    };
  } catch (error) {
    console.error('[NOTIFICATIONS ENGINE ERROR] Unexpected dispatch failure:', error.message);
    // Never bubble up to roll back or crash caller transactions
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Retrieve notifications for authenticated customer
 * @param {object} params
 * @param {string} params.customerId
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 * @param {string} [params.type]
 * @returns {Promise<{ notifications: object[], unreadCount: number, limit: number, offset: number }>}
 */
async function getCustomerNotifications({ customerId, limit = 50, offset = 0, type = null }) {
  if (!customerId) {
    const err = new Error('customerId is required.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const [notifications, unreadCount] = await Promise.all([
    notificationRepository.getNotificationsByCustomer(customerId, {
      limit: parsedLimit,
      offset: parsedOffset,
      type,
    }),
    notificationRepository.getUnreadCount(customerId),
  ]);

  return {
    notifications,
    unreadCount,
    limit: parsedLimit,
    offset: parsedOffset,
  };
}

/**
 * Mark a single notification as read with strict customer isolation
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.notificationId
 * @returns {Promise<object>}
 */
async function markNotificationAsRead({ customerId, notificationId }) {
  if (!customerId || !notificationId) {
    const err = new Error('customerId and notificationId are required.');
    err.code = 'INVALID_PARAMETERS';
    throw err;
  }

  const updated = await notificationRepository.markNotificationRead(customerId, notificationId);
  if (!updated) {
    const err = new Error('Notification not found or access denied.');
    err.code = 'NOTIFICATION_NOT_FOUND';
    throw err;
  }

  return updated;
}

/**
 * Mark all unread notifications as read for a customer
 * @param {object} params
 * @param {string} params.customerId
 * @returns {Promise<{ count: number }>}
 */
async function markAllNotificationsAsRead({ customerId }) {
  if (!customerId) {
    const err = new Error('customerId is required.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const count = await notificationRepository.markAllNotificationsRead(customerId);
  return { count };
}

/**
 * Register a device token for customer push notifications
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.deviceToken
 * @param {string} [params.platform='android']
 * @returns {Promise<object>}
 */
async function registerDevice({ customerId, deviceToken, platform = 'android' }) {
  if (!customerId || !deviceToken || typeof deviceToken !== 'string' || !deviceToken.trim()) {
    const err = new Error('Valid customerId and deviceToken are required.');
    err.code = 'INVALID_PARAMETERS';
    throw err;
  }

  return notificationRepository.registerDeviceToken(customerId, deviceToken.trim(), platform);
}

/**
 * Remove a registered device token (e.g. on customer logout)
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.deviceToken
 * @returns {Promise<{ removed: boolean }>}
 */
async function unregisterDevice({ customerId, deviceToken }) {
  if (!customerId || !deviceToken) {
    return { removed: false };
  }

  const removed = await notificationRepository.removeDeviceToken(customerId, deviceToken.trim());
  return { removed };
}

// ---------------------------------------------------------------------------
// Documented Business Domain Event Listeners
// Connects ONLY the notification-producing events explicitly defined in PRD/UI Specs.
// ---------------------------------------------------------------------------

let listenersRegistered = false;

function registerDomainEventListeners() {
  if (listenersRegistered) {
    return;
  }

  // 1. Booking Confirmed
  domainEventsEngine.on('BOOKING_CREATED', async (payload) => {
    try {
      if (!payload || !payload.customerId) return;
      await sendNotificationToCustomer({
        customerId: payload.customerId,
        title: 'Booking Confirmed!',
        message: `Your booking #${payload.bookingCode} for ₹${payload.totalAmount} has been reserved. Please collect within 48 hours.`,
        type: 'BOOKING',
        data: {
          screen: 'BOOKING_CONFIRMATION',
          bookingId: payload.bookingId,
          bookingCode: payload.bookingCode,
        },
      });
    } catch (e) {
      console.warn('[NOTIFICATIONS EVENT ERROR] BOOKING_CREATED handler:', e.message);
    }
  });

  // 2. Booking Completed (In-Store Handover)
  domainEventsEngine.on('BOOKING_COMPLETED', async (payload) => {
    try {
      if (!payload || !payload.customerId) return;
      await sendNotificationToCustomer({
        customerId: payload.customerId,
        title: 'Order Collected!',
        message: `Your booking #${payload.bookingCode} was successfully collected. Thank you for shopping fresh at PondFish!`,
        type: 'BOOKING',
        data: {
          screen: 'BOOKING_HISTORY',
          bookingId: payload.bookingId,
          bookingCode: payload.bookingCode,
        },
      });
    } catch (e) {
      console.warn('[NOTIFICATIONS EVENT ERROR] BOOKING_COMPLETED handler:', e.message);
    }
  });

  // 3. Booking Cancelled
  domainEventsEngine.on('BOOKING_CANCELLED', async (payload) => {
    try {
      if (!payload || !payload.customerId) return;
      await sendNotificationToCustomer({
        customerId: payload.customerId,
        title: 'Booking Cancelled',
        message: `Booking #${payload.bookingCode} was cancelled. Reserved inventory and applicable credits have been restored.`,
        type: 'BOOKING',
        data: {
          screen: 'BOOKING_HISTORY',
          bookingId: payload.bookingId,
          bookingCode: payload.bookingCode,
        },
      });
    } catch (e) {
      console.warn('[NOTIFICATIONS EVENT ERROR] BOOKING_CANCELLED handler:', e.message);
    }
  });

  // 4. Booking Expired (48-hour lifecycle)
  domainEventsEngine.on('BOOKING_EXPIRED', async (payload) => {
    try {
      if (!payload || !payload.customerId) return;
      await sendNotificationToCustomer({
        customerId: payload.customerId,
        title: 'Booking Expired',
        message: `Booking #${payload.bookingCode} expired after 48 hours. Inventory and applicable credits have been released.`,
        type: 'BOOKING',
        data: {
          screen: 'BOOKING_HISTORY',
          bookingId: payload.bookingId,
          bookingCode: payload.bookingCode,
        },
      });
    } catch (e) {
      console.warn('[NOTIFICATIONS EVENT ERROR] BOOKING_EXPIRED handler:', e.message);
    }
  });

  // 5. Subscription Activated
  domainEventsEngine.on('SUBSCRIPTION_ACTIVATED', async (payload) => {
    try {
      if (!payload || !payload.customerId) return;
      await sendNotificationToCustomer({
        customerId: payload.customerId,
        title: 'Subscription Activated!',
        message: `Your ${payload.planTitle || 'membership'} plan is now active with ₹${payload.creditBalance} credit balance.`,
        type: 'SUBSCRIPTION',
        data: {
          screen: 'SUBSCRIPTION',
          subscriptionId: payload.subscriptionId,
        },
      });
    } catch (e) {
      console.warn('[NOTIFICATIONS EVENT ERROR] SUBSCRIPTION_ACTIVATED handler:', e.message);
    }
  });

  listenersRegistered = true;
  console.log('[NOTIFICATIONS ENGINE] Domain event listeners registered for: BOOKING_CREATED, BOOKING_COMPLETED, BOOKING_CANCELLED, BOOKING_EXPIRED, SUBSCRIPTION_ACTIVATED');
}

// Automatically bind listeners on module load
registerDomainEventListeners();

/**
 * List, search, filter and paginate notifications for admin management console
 * @param {object} options
 * @returns {Promise<object>}
 */
async function listAdminNotifications(options = {}) {
  return notificationRepository.listAdminNotifications(options);
}

/**
 * Retrieve comprehensive details and delivery logs for a single notification
 * @param {string} notificationId
 * @returns {Promise<object>}
 */
async function getAdminNotificationDetail(notificationId) {
  if (!notificationId) {
    const err = new Error('Notification ID is required.');
    err.code = 'INVALID_PARAMETERS';
    err.status = 400;
    throw err;
  }

  const detail = await notificationRepository.getAdminNotificationDetail(notificationId);
  if (!detail) {
    const err = new Error(`Notification ${notificationId} not found.`);
    err.code = 'NOTIFICATION_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  return detail;
}

/**
 * Preview recipient count for a target audience before dispatch
 * Traceability: ADMIN-15 Section 134 (Notification Preview)
 * 
 * @param {object} params
 * @returns {Promise<{ audienceType: string, estimatedRecipients: number, recipientsPreview: Array<object> }>}
 */
async function previewAudienceScope({ audienceType = 'ALL', planId = null, customerId = null } = {}) {
  const targetCustomers = await notificationRepository.resolveAudienceCustomers({
    audienceType,
    planId,
    customerId,
  });

  return {
    audienceType: (audienceType || 'ALL').toUpperCase(),
    estimatedRecipients: targetCustomers.length,
    recipientsPreview: targetCustomers.slice(0, 10).map((c) => ({
      id: c.id,
      name: c.name || 'Valued Customer',
      mobile: c.mobile_number,
    })),
  };
}

/**
 * Dispatch an administrative notification to a selected audience
 * Traceability: ADMIN-15 Sections 131–137
 * Enforces server-authoritative recipient resolution, FCM delivery, and audit logging.
 * 
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.type='SYSTEM'] - 'SYSTEM' | 'PROMO' | 'ANNOUNCEMENT' | 'DELIVERY'
 * @param {string} [params.audienceType='ALL'] - 'ALL' | 'ACTIVE_SUBSCRIBERS' | 'SPECIFIC_PLAN' | 'INDIVIDUAL'
 * @param {string} [params.planId]
 * @param {string} [params.customerId]
 * @param {string[]} [params.channels=['IN_APP', 'PUSH']]
 * @param {string} [params.deepLink]
 * @param {object} context
 * @param {string} context.actorId - Admin ID
 * @param {string} [context.ip] - Admin IP
 * @returns {Promise<object>}
 */
async function dispatchAdminNotification(
  {
    title,
    message,
    type = 'SYSTEM',
    audienceType = 'ALL',
    planId = null,
    customerId = null,
    channels = ['IN_APP', 'PUSH'],
    deepLink = null,
  },
  { actorId = 'admin-system', ip = '127.0.0.1' } = {}
) {
  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    const err = new Error('Notification title is required (minimum 2 characters).');
    err.code = 'INVALID_TITLE';
    err.status = 400;
    throw err;
  }

  if (!message || typeof message !== 'string' || message.trim().length < 2) {
    const err = new Error('Notification message is required (minimum 2 characters).');
    err.code = 'INVALID_MESSAGE';
    err.status = 400;
    throw err;
  }

  const cleanTitle = title.trim();
  const cleanMessage = message.trim();
  const cleanType = (type || 'SYSTEM').toUpperCase();
  const cleanAudience = (audienceType || 'ALL').toUpperCase();
  const requestedChannels = Array.isArray(channels) && channels.length > 0 ? channels : ['IN_APP'];

  // Authoritatively resolve target customer recipients from PostgreSQL
  const targetCustomers = await notificationRepository.resolveAudienceCustomers({
    audienceType: cleanAudience,
    planId,
    customerId,
  });

  if (targetCustomers.length === 0) {
    const err = new Error('No recipients match the specified audience criteria.');
    err.code = 'NO_RECIPIENTS_FOUND';
    err.status = 400;
    throw err;
  }

  const createdNotifications = [];
  let pushAttemptCount = 0;
  let pushSuccessCount = 0;
  let pushFailCount = 0;

  for (const customer of targetCustomers) {
    // 1. Create in-app notification record
    const notif = await notificationRepository.createNotification(null, {
      customerId: customer.id,
      title: cleanTitle,
      message: cleanMessage,
      type: cleanType,
    });
    createdNotifications.push(notif);

    // 2. If PUSH channel is requested, attempt delivery via FCM
    if (requestedChannels.includes('PUSH')) {
      let tokens = [];
      try {
        tokens = await notificationRepository.getCustomerDeviceTokens(customer.id);
      } catch (tokErr) {
        console.warn(`[ADMIN NOTIF] Failed to fetch device tokens for customer ${customer.id}:`, tokErr.message);
      }

      if (tokens && tokens.length > 0) {
        for (const token of tokens) {
          pushAttemptCount += 1;
          let deliveryRecord = null;
          try {
            deliveryRecord = await notificationRepository.createDeliveryRecord(null, {
              notificationId: notif.id,
              channel: 'PUSH',
              status: 'PENDING',
            });
          } catch (delErr) {
            console.warn('[ADMIN NOTIF] Failed to create delivery record:', delErr.message);
          }

          const pushResult = await firebaseAdapter.sendPushNotification({
            token,
            title: cleanTitle,
            body: cleanMessage,
            data: {
              notificationId: notif.id,
              type: cleanType,
              deepLink: deepLink || '',
            },
          });

          if (deliveryRecord) {
            try {
              await notificationRepository.updateDeliveryStatus(null, deliveryRecord.id, {
                status: pushResult.success ? 'SENT' : 'FAILED',
                providerMessageId: pushResult.messageId || null,
                deliveredAt: pushResult.success ? new Date() : null,
                failedAt: pushResult.success ? null : new Date(),
                errorMessage: pushResult.error || null,
              });
            } catch (updErr) {
              console.warn('[ADMIN NOTIF] Failed to update delivery status:', updErr.message);
            }
          }

          if (pushResult.success) {
            pushSuccessCount += 1;
          } else {
            pushFailCount += 1;
          }

          if (pushResult.invalidToken) {
            try {
              await notificationRepository.removeDeviceToken(customer.id, token);
            } catch {}
          }
        }
      }
    }
  }

  // 3. Record immutable administrative audit log
  try {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId,
      action: 'ADMIN_NOTIFICATION_DISPATCH',
      entityType: 'NOTIFICATION',
      entityId: createdNotifications[0]?.id || 'BATCH_DISPATCH',
      payload: {
        title: cleanTitle,
        audienceType: cleanAudience,
        planId: planId || null,
        targetCustomerId: customerId || null,
        recipientCount: targetCustomers.length,
        channels: requestedChannels,
        pushAttemptCount,
        pushSuccessCount,
        pushFailCount,
        deepLink: deepLink || null,
        ip,
      },
    });
  } catch (auditErr) {
    console.warn('[ADMIN NOTIF AUDIT WARNING]', auditErr.message);
  }

  return {
    success: true,
    recipientCount: targetCustomers.length,
    inAppCount: createdNotifications.length,
    pushAttemptCount,
    pushSuccessCount,
    pushFailCount,
    channels: requestedChannels,
    audienceType: cleanAudience,
  };
}

module.exports = {
  name: 'NotificationsEngine',
  sendNotificationToCustomer,
  getCustomerNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  registerDevice,
  unregisterDevice,
  registerDomainEventListeners,
  listAdminNotifications,
  getAdminNotificationDetail,
  previewAudienceScope,
  dispatchAdminNotification,
};
