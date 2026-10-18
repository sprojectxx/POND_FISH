/**
 * Engine 12: Payment Recovery & Webhook Ingestion Engine
 * Traceability: PondFish Core Business Engines Spec (Section 19), API Spec (Section 31),
 * and Master PRD v2 (Section 12, 17)
 * Authoritative, idempotent reconciliation of asynchronous Razorpay payment webhooks.
 * Prevents double-charging, double-booking, and double-credit deduction under concurrent deliveries.
 */

const crypto = require('crypto');
const { getPool, query } = require('../db/pool');
const paymentEngine = require('./payment');
const bookingEngine = require('./booking');
const cartEngine = require('./cart');
const customerSubscriptionEngine = require('./customer-subscription');
const bookingRepository = require('../db/repositories/bookingRepository');
const checkoutIntentRepository = require('../db/repositories/checkoutIntentRepository');
const domainEventsEngine = require('./domain-events');
const auditEngine = require('./audit');

/**
 * Reconciles an asynchronously captured Razorpay payment with customer checkout
 * @param {object} params
 * @param {string} params.eventId - Unique Razorpay webhook event ID
 * @param {string} params.orderId - Razorpay order ID (e.g. order_xxx)
 * @param {string} params.paymentId - Razorpay payment ID (e.g. pay_xxx)
 * @param {number} params.amountPaise - Amount in paise from Razorpay
 * @param {string} [params.customerId] - Customer UUID from notes or intent
 * @param {object} [params.notes={}] - Additional notes from Razorpay entity
 * @param {object} [params.client] - Optional database client for transaction
 * @returns {Promise<object>} Reconciliation outcome
 */
async function reconcileCapturedPayment({
  eventId,
  orderId,
  paymentId,
  amountPaise,
  customerId,
  notes = {},
  client = null,
}) {
  if (!orderId || !paymentId || typeof amountPaise !== 'number') {
    const err = new Error('orderId, paymentId, and amountPaise are required for payment recovery.');
    err.code = 'INVALID_RECOVERY_PARAMS';
    err.status = 400;
    throw err;
  }

  const pool = client ? null : getPool();
  const dbClient = client || (await pool.connect());
  const shouldManageTransaction = !client;

  try {
    if (shouldManageTransaction) {
      await dbClient.query('BEGIN');
    }

    // 1. Idempotency Check: Verify if webhook event was already completed successfully
    if (eventId) {
      const eventCheck = await dbClient.query(
        'SELECT id FROM webhook_events WHERE event_id = $1 LIMIT 1;',
        [eventId]
      );
      if (eventCheck.rows.length > 0) {
        if (shouldManageTransaction) await dbClient.query('COMMIT');
        return {
          success: true,
          duplicate: true,
          status: 'EVENT_ALREADY_PROCESSED',
          eventId,
        };
      }
    }

    // 2. Concurrency Check: Verify if booking/payment was already confirmed by client app
    const paymentCheck = await dbClient.query(
      `SELECT id, booking_id, status FROM payments 
       WHERE razorpay_payment_id = $1 OR razorpay_order_id = $2 
       LIMIT 1 FOR UPDATE;`,
      [paymentId, orderId]
    );

    if (paymentCheck.rows.length > 0 && paymentCheck.rows[0].booking_id) {
      // Booking is already confirmed
      if (eventId) {
        await dbClient.query(
          `INSERT INTO webhook_events (id, event_id, event_type, processed_at)
           VALUES (gen_random_uuid(), $1, 'payment.captured', NOW())
           ON CONFLICT (event_id) DO NOTHING;`,
          [eventId]
        ).catch(() => {});
      }
      if (shouldManageTransaction) await dbClient.query('COMMIT');
      return {
        success: true,
        status: 'ALREADY_CONFIRMED',
        bookingId: paymentCheck.rows[0].booking_id,
        paymentId,
        orderId,
      };
    }

    // 3. Resolve Customer Association
    const resolvedCustomerId = customerId || notes.customerId || notes.customer_id;
    if (!resolvedCustomerId) {
      // Payment captured on Razorpay but cannot be safely attributed to a customer
      await dbClient.query(
        `INSERT INTO payments (
          id, booking_id, transaction_id, razorpay_order_id, razorpay_payment_id,
          amount, method, status, created_at
        ) VALUES (
          gen_random_uuid(), NULL, NULL, $1, $2, $3, 'RAZORPAY', 'REQUIRES_RECONCILIATION', NOW()
        ) ON CONFLICT (razorpay_order_id) DO UPDATE SET 
          razorpay_payment_id = EXCLUDED.razorpay_payment_id,
          status = 'REQUIRES_RECONCILIATION';`,
        [orderId, paymentId, amountPaise / 100]
      );

      if (shouldManageTransaction) await dbClient.query('COMMIT');

      try {
        await auditEngine.recordAuditLog({
          actorType: 'SYSTEM',
          actorId: 'webhook-engine',
          action: 'PAYMENT_ORPHANED_MISSING_CUSTOMER',
          entityType: 'PAYMENT',
          entityId: orderId,
          payload: { orderId, paymentId, amountPaise },
        });
      } catch (e) {}

      return {
        success: false,
        code: 'MISSING_CUSTOMER_ID',
        status: 'REQUIRES_RECONCILIATION',
        message: 'Payment captured on gateway but missing customerId in metadata notes.',
      };
    }

    // 4. Immutable Checkout Intent Verification (Phase 2J-K)
    // Never reconstruct checkout from a mutable cart when an immutable snapshot is required
    let checkoutIntent = await checkoutIntentRepository.getIntentByOrderId(dbClient, orderId, true);

    if (!checkoutIntent) {
      // Immutable checkout intent is not available.
      // Reconstructing from mutable cart is unsafe and prohibited.
      // Safely record payment in payments table with status 'REQUIRES_RECONCILIATION'
      await dbClient.query(
        `INSERT INTO payments (
          id, booking_id, transaction_id, razorpay_order_id, razorpay_payment_id,
          amount, method, status, created_at
        ) VALUES (
          gen_random_uuid(), NULL, NULL, $1, $2, $3, 'RAZORPAY', 'REQUIRES_RECONCILIATION', NOW()
        ) ON CONFLICT (razorpay_order_id) DO UPDATE SET 
          razorpay_payment_id = EXCLUDED.razorpay_payment_id,
          status = 'REQUIRES_RECONCILIATION';`,
        [orderId, paymentId, amountPaise / 100]
      );

      if (shouldManageTransaction) await dbClient.query('COMMIT');

      try {
        await auditEngine.recordAuditLog({
          actorType: 'SYSTEM',
          actorId: 'webhook-engine',
          action: 'PAYMENT_PENDING_MANUAL_RECONCILIATION',
          entityType: 'PAYMENT',
          entityId: orderId,
          payload: {
            orderId,
            paymentId,
            amountPaise,
            customerId: resolvedCustomerId,
            reason: 'IMMUTABLE_CHECKOUT_INTENT_NOT_FOUND',
          },
        });
      } catch (e) {}

      return {
        success: true,
        status: 'REQUIRES_RECONCILIATION',
        reason: 'IMMUTABLE_CHECKOUT_INTENT_NOT_FOUND',
        message: 'Payment received safely but requires reconciliation: durable checkout_intents table is pending migration 0018. Mutable cart reconstruction refused to prevent inventory or credit corruption.',
        orderId,
        paymentId,
        customerId: resolvedCustomerId,
      };
    }

    // 5. Immutable Intent Recovery Path (when Migration 0018 is active)
    if (checkoutIntent.status === 'COMPLETED' && checkoutIntent.booking_id) {
      if (shouldManageTransaction) await dbClient.query('COMMIT');
      return {
        success: true,
        status: 'ALREADY_CONFIRMED',
        bookingId: checkoutIntent.booking_id,
        orderId,
        paymentId,
      };
    }

    if (amountPaise !== checkoutIntent.amount_paise) {
      await checkoutIntentRepository.markIntentRequiresReconciliation(dbClient, orderId);
      await dbClient.query(
        `INSERT INTO payments (
          id, booking_id, transaction_id, razorpay_order_id, razorpay_payment_id,
          amount, method, status, created_at
        ) VALUES (
          gen_random_uuid(), NULL, NULL, $1, $2, $3, 'RAZORPAY', 'REQUIRES_RECONCILIATION', NOW()
        ) ON CONFLICT (razorpay_order_id) DO UPDATE SET 
          razorpay_payment_id = EXCLUDED.razorpay_payment_id,
          status = 'REQUIRES_RECONCILIATION';`,
        [orderId, paymentId, amountPaise / 100]
      );

      if (shouldManageTransaction) await dbClient.query('COMMIT');
      return {
        success: true,
        status: 'REQUIRES_RECONCILIATION',
        reason: 'PAYMENT_AMOUNT_MISMATCH',
        expectedPaise: checkoutIntent.amount_paise,
        receivedPaise: amountPaise,
      };
    }

    // Atomically transition intent to PROCESSING
    const claimedIntent = await checkoutIntentRepository.claimIntentForProcessing(dbClient, orderId);
    if (!claimedIntent && checkoutIntent.status === 'PROCESSING') {
      if (shouldManageTransaction) await dbClient.query('COMMIT');
      return {
        success: true,
        status: 'PROCESSING_IN_PROGRESS',
        orderId,
      };
    }

    // Commit intent claim transaction before calling createBooking which manages its own transaction
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const generatedSig = secret
      ? crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
      : 'WEBHOOK_VERIFIED';

    if (shouldManageTransaction) {
      await dbClient.query('COMMIT');
    }

    // Reconstruct booking strictly from the immutable intent snapshot (never mutable cart)
    const booking = await bookingEngine.createBooking({
      customerId: checkoutIntent.customer_id,
      paymentVerification: {
        orderId,
        paymentId,
        signature: generatedSig,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: generatedSig,
        source: 'WEBHOOK',
      },
      checkoutSnapshot: {
        items: typeof checkoutIntent.cart_snapshot === 'string'
          ? JSON.parse(checkoutIntent.cart_snapshot)
          : checkoutIntent.cart_snapshot,
        summary: typeof checkoutIntent.fee_breakdown === 'string'
          ? JSON.parse(checkoutIntent.fee_breakdown)
          : checkoutIntent.fee_breakdown,
        subscriptionCoverage: checkoutIntent.subscription_snapshot
          ? (typeof checkoutIntent.subscription_snapshot === 'string'
              ? JSON.parse(checkoutIntent.subscription_snapshot)
              : checkoutIntent.subscription_snapshot)
          : null,
      },
    });

    // Mark intent completed
    await checkoutIntentRepository.markIntentCompleted(orderId, booking.id).catch(() => {});

    // Now that business processing safely succeeded, record webhook event
    if (eventId) {
      await query(
        `INSERT INTO webhook_events (id, event_id, event_type, processed_at)
         VALUES (gen_random_uuid(), $1, 'payment.captured', NOW())
         ON CONFLICT (event_id) DO NOTHING;`,
        [eventId]
      ).catch(() => {});
    }

    return {
      success: true,
      status: 'RECONCILED',
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      orderId,
      paymentId,
      customerId: checkoutIntent.customer_id,
    };
  } catch (err) {
    if (shouldManageTransaction) {
      await dbClient.query('ROLLBACK').catch(() => {});
    }
    console.error('[WEBHOOK PAYMENT RECOVERY ERROR]', err.message);
    throw err;
  } finally {
    if (shouldManageTransaction) {
      dbClient.release();
    }
  }
}

/**
 * Ingest, verify, and orchestrate raw Razorpay webhook payload
 * @param {object} params
 * @param {string|Buffer} params.rawBody - Raw request body
 * @param {string} params.signature - Value of 'x-razorpay-signature' header
 * @param {string} [params.secret] - Optional secret override for testing
 * @returns {Promise<object>} Processing result
 */
async function processRazorpayWebhook({ rawBody, signature, secret = null }) {
  if (!signature) {
    const err = new Error('Missing x-razorpay-signature header.');
    err.code = 'MISSING_SIGNATURE';
    err.status = 400;
    throw err;
  }

  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    const err = new Error('Razorpay webhook secret is not configured in this server environment.');
    err.code = 'WEBHOOK_SECRET_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }

  // Authoritative timing-safe HMAC signature verification
  const isValid = paymentEngine.verifyWebhookSignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    const err = new Error('Invalid Razorpay webhook signature.');
    err.code = 'INVALID_SIGNATURE';
    err.status = 400;
    throw err;
  }

  let event;
  try {
    event = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
  } catch (parseErr) {
    const err = new Error('Malformed webhook payload JSON.');
    err.code = 'MALFORMED_PAYLOAD';
    err.status = 400;
    throw err;
  }

  const eventId = event.event_id || event.id;
  const eventType = event.event;

  // Documented event filtering
  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;

    const orderId = paymentEntity?.order_id || orderEntity?.id;
    const paymentId = paymentEntity?.id;
    const amountPaise = paymentEntity?.amount || orderEntity?.amount_paid;
    const customerId = paymentEntity?.notes?.customerId || orderEntity?.notes?.customerId;
    const notes = paymentEntity?.notes || orderEntity?.notes || {};

    // Validate that payment is genuinely captured (not merely authorized)
    if (paymentEntity && paymentEntity.status !== 'captured' && eventType !== 'order.paid') {
      return {
        success: true,
        status: 'IGNORED_UNCAPTURED',
        message: `Payment status is "${paymentEntity.status}". Only captured payments are booked.`,
      };
    }

    return await reconcileCapturedPayment({
      eventId,
      orderId,
      paymentId,
      amountPaise,
      customerId,
      notes,
    });
  }

  if (eventType === 'payment.failed') {
    const paymentEntity = event.payload?.payment?.entity;
    if (paymentEntity && paymentEntity.order_id) {
      await query(
        `INSERT INTO payments (
          id, booking_id, transaction_id, razorpay_order_id, razorpay_payment_id,
          amount, method, status, created_at
        ) VALUES (
          gen_random_uuid(), NULL, NULL, $1, $2, $3, 'RAZORPAY', 'FAILED', NOW()
        ) ON CONFLICT (razorpay_order_id) DO UPDATE SET status = 'FAILED';`,
        [paymentEntity.order_id, paymentEntity.id || null, (paymentEntity.amount || 0) / 100]
      ).catch(() => {});
    }

    if (eventId) {
      await query(
        `INSERT INTO webhook_events (id, event_id, event_type, processed_at)
         VALUES (gen_random_uuid(), $1, 'payment.failed', NOW())
         ON CONFLICT (event_id) DO NOTHING;`,
        [eventId]
      ).catch(() => {});
    }

    return {
      success: true,
      event: 'payment.failed',
      acknowledged: true,
    };
  }

  return {
    success: true,
    event: eventType,
    ignored: true,
    message: `Event type "${eventType}" is not relevant to checkout lifecycle.`,
  };
}

module.exports = {
  name: 'PaymentRecoveryEngine',
  reconcileCapturedPayment,
  processRazorpayWebhook,
};
