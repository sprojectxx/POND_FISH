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
const broadcastRepository = require('../db/repositories/broadcastRepository');
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
/**
 * Execute delivery of an existing broadcast (transitions to SENDING -> SENT / PARTIALLY_FAILED / FAILED)
 * Traceability: Admin Portal Specification Sections 131–137
 * Provider failure isolation: FCM errors never throw or roll back in-app records.
 * 
 * @param {string} broadcastId
 * @param {object} context
 * @param {string} context.actorId
 * @param {string} [context.ip]
 * @returns {Promise<object>}
 */
async function executeBroadcastDispatch(broadcastId, { actorId = 'system', ip = '127.0.0.1' } = {}) {
  const broadcast = await broadcastRepository.getBroadcastById(broadcastId);
  if (!broadcast) {
    const err = new Error(`Broadcast ${broadcastId} not found.`);
    err.code = 'BROADCAST_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Ensure state is claimed as SENDING
  if (broadcast.status !== 'SENDING') {
    await broadcastRepository.updateBroadcast(broadcastId, { status: 'SENDING' });
  }

  const audienceType = (broadcast.audience_type || 'ALL').toUpperCase();
  const audiencePayload = typeof broadcast.audience_payload === 'string'
    ? JSON.parse(broadcast.audience_payload || '{}')
    : (broadcast.audience_payload || {});

  const channels = Array.isArray(broadcast.channels) && broadcast.channels.length > 0
    ? broadcast.channels
    : ['IN_APP'];

  // Resolve recipients authoritatively from PostgreSQL
  const targetCustomers = await notificationRepository.resolveAudienceCustomers({
    audienceType,
    planId: audiencePayload.planId || null,
    customerId: audiencePayload.customerId || null,
  });

  if (targetCustomers.length === 0) {
    const outcome = await broadcastRepository.recordBroadcastOutcome(broadcastId, {
      status: 'FAILED',
      sentAt: new Date(),
      recipientCount: 0,
      pushAttemptCount: 0,
      pushSuccessCount: 0,
      pushFailCount: 0,
    });

    try {
      await auditEngine.recordAuditLog({
        actorType: 'ADMIN',
        actorId,
        action: 'ADMIN_BROADCAST_DISPATCH_FAILED',
        entityType: 'NOTIFICATION',
        entityId: broadcastId,
        payload: { reason: 'NO_RECIPIENTS_FOUND', audienceType, ip },
      });
    } catch {}

    return {
      success: false,
      status: 'FAILED',
      broadcast: outcome,
      error: 'NO_RECIPIENTS_FOUND',
      recipientCount: 0,
    };
  }

  let inAppCount = 0;
  let pushAttemptCount = 0;
  let pushSuccessCount = 0;
  let pushFailCount = 0;

  for (const customer of targetCustomers) {
    let notif = null;

    // 1. IN_APP delivery
    if (channels.includes('IN_APP')) {
      try {
        notif = await notificationRepository.createNotification(null, {
          customerId: customer.id,
          title: broadcast.title,
          message: broadcast.message,
          type: broadcast.category || 'SYSTEM',
        });
        inAppCount += 1;
      } catch (err) {
        console.warn(`[BROADCAST DISPATCH] In-app creation failed for customer ${customer.id}:`, err.message);
      }
    }

    // 2. PUSH delivery via FCM
    if (channels.includes('PUSH')) {
      let tokens = [];
      try {
        tokens = await notificationRepository.getCustomerDeviceTokens(customer.id);
      } catch (tokErr) {
        console.warn(`[BROADCAST DISPATCH] Token retrieval failed for customer ${customer.id}:`, tokErr.message);
      }

      if (tokens && tokens.length > 0) {
        for (const token of tokens) {
          pushAttemptCount += 1;
          let deliveryRecord = null;
          try {
            deliveryRecord = await notificationRepository.createDeliveryRecord(null, {
              notificationId: notif ? notif.id : null,
              channel: 'PUSH',
              status: 'PENDING',
            });
          } catch (delErr) {
            console.warn('[BROADCAST DISPATCH] Delivery record creation failed:', delErr.message);
          }

          const pushResult = await firebaseAdapter.sendPushNotification({
            token,
            title: broadcast.title,
            body: broadcast.message,
            data: {
              broadcastId: broadcast.id,
              notificationId: notif ? notif.id : '',
              type: broadcast.category || 'SYSTEM',
              deepLink: broadcast.deep_link || '',
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
              console.warn('[BROADCAST DISPATCH] Update delivery status failed:', updErr.message);
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

  // Determine final status
  let finalStatus = 'SENT';
  if (pushAttemptCount > 0 && pushFailCount > 0) {
    if (pushSuccessCount > 0 || inAppCount > 0) {
      finalStatus = 'PARTIALLY_FAILED';
    } else {
      finalStatus = 'FAILED';
    }
  } else if (inAppCount === 0 && pushAttemptCount === 0) {
    finalStatus = 'FAILED';
  }

  const updatedBroadcast = await broadcastRepository.recordBroadcastOutcome(broadcastId, {
    status: finalStatus,
    sentAt: new Date(),
    recipientCount: targetCustomers.length,
    pushAttemptCount,
    pushSuccessCount,
    pushFailCount,
  });

  // Record audit log
  try {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId,
      action: 'ADMIN_BROADCAST_DISPATCH',
      entityType: 'NOTIFICATION',
      entityId: broadcastId,
      payload: {
        title: broadcast.title,
        status: finalStatus,
        recipientCount: targetCustomers.length,
        inAppCount,
        pushAttemptCount,
        pushSuccessCount,
        pushFailCount,
        channels,
        ip,
      },
    });
  } catch (auditErr) {
    console.warn('[BROADCAST AUDIT WARNING]', auditErr.message);
  }

  return {
    success: finalStatus !== 'FAILED',
    status: finalStatus,
    broadcast: updatedBroadcast,
    recipientCount: targetCustomers.length,
    inAppCount,
    pushAttemptCount,
    pushSuccessCount,
    pushFailCount,
  };
}

/**
 * Save a notification broadcast as DRAFT
 * @param {object} params
 * @param {object} context
 * @returns {Promise<object>}
 */
async function saveBroadcastDraft(
  {
    title,
    message,
    category = 'SYSTEM',
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

  const broadcast = await broadcastRepository.createBroadcast({
    title: title.trim(),
    message: message.trim(),
    category: (category || 'SYSTEM').toUpperCase(),
    audienceType: (audienceType || 'ALL').toUpperCase(),
    audiencePayload: { planId: planId || null, customerId: customerId || null },
    channels: Array.isArray(channels) && channels.length > 0 ? channels : ['IN_APP'],
    deepLink: deepLink || null,
    status: 'DRAFT',
    scheduledAt: null,
    createdBy: actorId !== 'admin-system' && actorId ? actorId : null,
  });

  try {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId,
      action: 'ADMIN_BROADCAST_CREATE_DRAFT',
      entityType: 'NOTIFICATION',
      entityId: broadcast.id,
      payload: { title: broadcast.title, audienceType: broadcast.audience_type, ip },
    });
  } catch {}

  return broadcast;
}

/**
 * Schedule a notification broadcast for future dispatch
 * @param {object} params
 * @param {object} context
 * @returns {Promise<object>}
 */
async function scheduleBroadcast(
  {
    title,
    message,
    category = 'SYSTEM',
    audienceType = 'ALL',
    planId = null,
    customerId = null,
    channels = ['IN_APP', 'PUSH'],
    deepLink = null,
    scheduledAt,
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

  if (!scheduledAt) {
    const err = new Error('Scheduled date and time is required.');
    err.code = 'MISSING_SCHEDULED_AT';
    err.status = 400;
    throw err;
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    const err = new Error('Scheduled time must be a valid future date and time.');
    err.code = 'INVALID_SCHEDULED_TIME';
    err.status = 400;
    throw err;
  }

  const broadcast = await broadcastRepository.createBroadcast({
    title: title.trim(),
    message: message.trim(),
    category: (category || 'SYSTEM').toUpperCase(),
    audienceType: (audienceType || 'ALL').toUpperCase(),
    audiencePayload: { planId: planId || null, customerId: customerId || null },
    channels: Array.isArray(channels) && channels.length > 0 ? channels : ['IN_APP'],
    deepLink: deepLink || null,
    status: 'SCHEDULED',
    scheduledAt: scheduledDate,
    createdBy: actorId !== 'admin-system' && actorId ? actorId : null,
  });

  try {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId,
      action: 'ADMIN_BROADCAST_SCHEDULE',
      entityType: 'NOTIFICATION',
      entityId: broadcast.id,
      payload: {
        title: broadcast.title,
        scheduledAt: scheduledDate.toISOString(),
        audienceType: broadcast.audience_type,
        ip,
      },
    });
  } catch {}

  return broadcast;
}

/**
 * Edit an existing broadcast (allowed only while in DRAFT or SCHEDULED state)
 * Dispatched broadcasts are strictly immutable.
 * @param {string} broadcastId
 * @param {object} updates
 * @param {object} context
 * @returns {Promise<object>}
 */
async function editBroadcast(broadcastId, updates = {}, { actorId = 'admin-system', ip = '127.0.0.1' } = {}) {
  const broadcast = await broadcastRepository.getBroadcastById(broadcastId);
  if (!broadcast) {
    const err = new Error(`Broadcast ${broadcastId} not found.`);
    err.code = 'BROADCAST_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!['DRAFT', 'SCHEDULED'].includes(broadcast.status)) {
    const err = new Error(
      `Broadcast cannot be edited because it is in '${broadcast.status}' state. Dispatched notifications are strictly immutable.`
    );
    err.code = 'BROADCAST_IMMUTABLE';
    err.status = 400;
    throw err;
  }

  const sanitized = {};
  if (updates.title !== undefined) sanitized.title = updates.title.trim();
  if (updates.message !== undefined) sanitized.message = updates.message.trim();
  if (updates.category !== undefined) sanitized.category = updates.category.toUpperCase();
  if (updates.audienceType !== undefined) sanitized.audience_type = updates.audienceType.toUpperCase();
  if (updates.audiencePayload !== undefined) sanitized.audience_payload = updates.audiencePayload;
  if (updates.channels !== undefined) sanitized.channels = updates.channels;
  if (updates.deepLink !== undefined) sanitized.deep_link = updates.deepLink;

  if (updates.scheduledAt !== undefined) {
    if (updates.scheduledAt) {
      const scheduledDate = new Date(updates.scheduledAt);
      if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        const err = new Error('Scheduled time must be a valid future date and time.');
        err.code = 'INVALID_SCHEDULED_TIME';
        err.status = 400;
        throw err;
      }
      sanitized.scheduled_at = scheduledDate;
      sanitized.status = 'SCHEDULED';
    } else {
      sanitized.scheduled_at = null;
      sanitized.status = 'DRAFT';
    }
  }

  const updated = await broadcastRepository.updateBroadcast(broadcastId, sanitized);

  try {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId,
      action: 'ADMIN_BROADCAST_EDIT',
      entityType: 'NOTIFICATION',
      entityId: broadcastId,
      payload: { previousStatus: broadcast.status, updates: sanitized, ip },
    });
  } catch {}

  return updated;
}

/**
 * Cancel an unsent broadcast (allowed only while in DRAFT or SCHEDULED state)
 * @param {string} broadcastId
 * @param {object} context
 * @returns {Promise<object>}
 */
async function cancelBroadcast(broadcastId, { actorId = 'admin-system', ip = '127.0.0.1' } = {}) {
  const broadcast = await broadcastRepository.getBroadcastById(broadcastId);
  if (!broadcast) {
    const err = new Error(`Broadcast ${broadcastId} not found.`);
    err.code = 'BROADCAST_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!['DRAFT', 'SCHEDULED'].includes(broadcast.status)) {
    const err = new Error(
      `Broadcast cannot be cancelled because it is already in '${broadcast.status}' state.`
    );
    err.code = 'BROADCAST_CANNOT_BE_CANCELLED';
    err.status = 400;
    throw err;
  }

  const cancelled = await broadcastRepository.cancelBroadcast(broadcastId);

  try {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId,
      action: 'ADMIN_BROADCAST_CANCEL',
      entityType: 'NOTIFICATION',
      entityId: broadcastId,
      payload: { previousStatus: broadcast.status, ip },
    });
  } catch {}

  return cancelled;
}

/**
 * Process due scheduled broadcasts (called by protected internal cron runner)
 * Atomically locks rows (FOR UPDATE SKIP LOCKED) to prevent double-dispatch.
 * @param {object} context
 * @returns {Promise<{ processedCount: number, results: object[] }>}
 */
async function processDueScheduledBroadcasts({ actorId = 'system-cron', ip = '127.0.0.1' } = {}) {
  const claimedBroadcasts = await broadcastRepository.claimDueScheduledBroadcasts(10);
  const results = [];

  for (const broadcast of claimedBroadcasts) {
    try {
      const outcome = await executeBroadcastDispatch(broadcast.id, { actorId, ip });
      results.push({ broadcastId: broadcast.id, success: outcome.success, status: outcome.status });
    } catch (err) {
      console.error(`[SCHEDULED BROADCAST ERROR] Failed to dispatch ${broadcast.id}:`, err);
      await broadcastRepository.recordBroadcastOutcome(broadcast.id, {
        status: 'FAILED',
        sentAt: new Date(),
      });
      results.push({ broadcastId: broadcast.id, success: false, error: err.message });
    }
  }

  return {
    processedCount: claimedBroadcasts.length,
    results,
  };
}

/**
 * Dispatch an administrative notification (immediate Send-Now workflow)
 * Traceability: ADMIN-15 Sections 131–137
 * Automatically records broadcast entity and executes multi-channel delivery.
 * 
 * @param {object} params
 * @param {object} context
 * @returns {Promise<object>}
 */
async function dispatchAdminNotification(
  {
    title,
    message,
    type = 'SYSTEM',
    category = null,
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

  // 1. Create broadcast in SENDING state
  const broadcast = await broadcastRepository.createBroadcast({
    title: title.trim(),
    message: message.trim(),
    category: (category || type || 'SYSTEM').toUpperCase(),
    audienceType: (audienceType || 'ALL').toUpperCase(),
    audiencePayload: { planId: planId || null, customerId: customerId || null },
    channels: Array.isArray(channels) && channels.length > 0 ? channels : ['IN_APP'],
    deepLink: deepLink || null,
    status: 'SENDING',
    scheduledAt: null,
    createdBy: actorId !== 'admin-system' && actorId ? actorId : null,
  });

  // 2. Execute dispatch
  const result = await executeBroadcastDispatch(broadcast.id, { actorId, ip });

  return {
    success: result.success,
    broadcast: result.broadcast,
    recipientCount: result.recipientCount,
    inAppCount: result.inAppCount,
    pushAttemptCount: result.pushAttemptCount,
    pushSuccessCount: result.pushSuccessCount,
    pushFailCount: result.pushFailCount,
    channels: broadcast.channels,
    audienceType: broadcast.audience_type,
  };
}

/**
 * List broadcasts with filter and pagination
 * @param {object} options
 * @returns {Promise<object>}
 */
async function listBroadcasts(options = {}) {
  return broadcastRepository.listBroadcasts(options);
}

/**
 * Retrieve broadcast detail by ID
 * @param {string} id
 * @returns {Promise<object>}
 */
async function getBroadcastDetail(id) {
  if (!id) {
    const err = new Error('Broadcast ID is required.');
    err.code = 'INVALID_PARAMETERS';
    err.status = 400;
    throw err;
  }

  const broadcast = await broadcastRepository.getBroadcastById(id);
  if (!broadcast) {
    const err = new Error(`Broadcast ${id} not found.`);
    err.code = 'BROADCAST_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Fetch associated audit records
  const auditRes = await notificationRepository.getAdminNotificationDetail(id).catch(() => null);

  return {
    broadcast,
    auditLogs: auditRes?.auditLogs || [],
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
  saveBroadcastDraft,
  scheduleBroadcast,
  editBroadcast,
  cancelBroadcast,
  executeBroadcastDispatch,
  processDueScheduledBroadcasts,
  listBroadcasts,
  getBroadcastDetail,
};
