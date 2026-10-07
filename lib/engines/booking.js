/**
 * Engine 06: Customer Booking & Checkout Orchestration Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Sections 13, 14) & API Spec (Sections 37, 38, 39)
 * Full vertical orchestration for checkout calculation, atomic inventory reservation,
 * subscription ledger deductions, payment boundary, QR ticket generation, cancellation,
 * and 48-hour lifecycle expiration.
 */

const { getPool } = require('../db/pool');
const cartEngine = require('./cart');
const inventoryEngine = require('./inventory');
const customerSubscriptionEngine = require('./customer-subscription');
const paymentEngine = require('./payment');
const qrVerificationEngine = require('./qr-verification');
const domainEventsEngine = require('./domain-events');
const bookingRepository = require('../db/repositories/bookingRepository');
const subscriptionRepository = require('../db/repositories/subscriptionRepository');
const cartRepository = require('../db/repositories/cartRepository');
const fishRepository = require('../db/repositories/fishRepository');
const inventoryRepository = require('../db/repositories/inventoryRepository');
const customerRepository = require('../db/repositories/customerRepository');
const businessSettingsEngine = require('./business-settings');
const auditEngine = require('./audit');

/**
 * Preview checkout summary from persistent cart with live authoritative recalculation
 * @param {string} customerId
 * @returns {Promise<object>} Authoritative checkout preview
 */
async function previewCheckout(customerId) {
  if (!customerId) {
    const err = new Error('CUSTOMER_ID_REQUIRED');
    err.code = 'CUSTOMER_ID_REQUIRED';
    throw err;
  }

  // 1. Fetch live persistent cart
  const cart = await cartEngine.getCart(customerId);
  if (!cart.items || cart.items.length === 0) {
    const err = new Error('Your cart is empty. Please add fish before proceeding to checkout.');
    err.code = 'EMPTY_CART';
    throw err;
  }

  // 2. Validate operational inventory availability
  const inventoryCheck = await inventoryEngine.validateAvailability(cart.items);

  // 3. Authoritative subscription coverage calculation
  const subCoverage = await customerSubscriptionEngine.calculateSubscriptionCoverage({
    customerId,
    cartItems: cart.items,
  });

  // 4. Calculate gateway surcharge on additional payable amount
  const feeCalculation = paymentEngine.calculatePaymentFees(subCoverage.extraPayableAmount);

  // 5. Combine and enrich item records
  const itemsWithStatus = cart.items.map((item) => {
    const inv = inventoryCheck.inventoryMap.get(item.fishId);
    const available = inv ? parseFloat(inv.available_quantity) : 0;
    const subItem = subCoverage.itemBreakdown.find((b) => b.fishId === item.fishId);

    return {
      fishId: item.fishId,
      name: item.name,
      imageUrl: item.imageUrl,
      categoryName: item.categoryName,
      quantityKg: item.quantity,
      unitPrice: item.unitPrice,
      effectivePrice: item.effectivePrice,
      subtotal: item.subtotal,
      hasDiscount: item.hasDiscount,
      discount: item.discount,
      availableStockKg: available,
      isStockSufficient: available >= item.quantity,
      subscriptionCoveredKg: subItem?.coveredQty || 0,
      subscriptionCreditUsed: subItem?.subCreditAmount || 0,
      extraQuantityKg: subItem?.extraQty || item.quantity,
      extraAmountPayable: subItem?.extraAmount || item.subtotal,
      isSubscriptionEligible: subItem?.isEligible || false,
    };
  });

  const isRazorpayConfigured = paymentEngine.isRazorpayConfigured();
  const paymentRequired = feeCalculation.finalPayable > 0;

  return {
    items: itemsWithStatus,
    summary: {
      totalItems: itemsWithStatus.length,
      totalQuantityKg: cart.summary.totalQuantity,
      subtotal: cart.summary.totalAmount,
      subscriptionCoveredKg: subCoverage.coveredQuantityKg,
      subscriptionCreditUsed: subCoverage.subCreditUsed,
      extraQuantityKg: subCoverage.extraQuantityKg,
      basePayableAmount: feeCalculation.basePayable,
      gatewayFeeRatePercent: feeCalculation.gatewayFeeRate || 0,
      gatewayFee: feeCalculation.gatewayFee,
      gstRatePercent: feeCalculation.gstRate || 0,
      feeGst: feeCalculation.feeGst,
      totalFee: feeCalculation.totalFee,
      finalPayableAmount: feeCalculation.finalPayable,
    },
    subscription: subCoverage.hasActiveSubscription
      ? {
          active: true,
          planTitle: subCoverage.subscription.planTitle,
          weeklyLimitKg: subCoverage.subscription.weeklyLimitKg,
          weeklyUsedKg: subCoverage.subscription.weeklyUsedKg,
          remainingWeeklyKg: subCoverage.subscription.remainingWeeklyKg,
          creditBalance: subCoverage.subscription.creditBalance,
          remainingCreditBalance: subCoverage.subscription.remainingCreditBalance,
          statusText: subCoverage.statusText,
        }
      : {
          active: false,
          statusText: subCoverage.statusText,
        },
    inventory: {
      isAvailable: inventoryCheck.isAvailable,
      issues: inventoryCheck.issues,
    },
    paymentGateway: {
      required: paymentRequired,
      configured: isRazorpayConfigured,
      provider: 'RAZORPAY',
      status: paymentRequired && !isRazorpayConfigured
        ? 'GATEWAY_CREDENTIALS_PENDING'
        : 'READY',
    },
    canProceedToBooking: inventoryCheck.isAvailable && (!paymentRequired || isRazorpayConfigured),
  };
}

/**
 * Create customer booking with atomic concurrency-safe inventory reservation and ledger updates.
 * @param {object} params
 * @param {string} params.customerId
 * @param {object} [params.paymentVerification] - { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 * @returns {Promise<object>} Created booking with QR pickup ticket
 */
async function createBooking({ customerId, paymentVerification = null }) {
  if (!customerId) {
    const err = new Error('CUSTOMER_ID_REQUIRED');
    err.code = 'CUSTOMER_ID_REQUIRED';
    throw err;
  }

  // 0. Enforce account governance: blocked customers cannot create bookings
  const blockedIds = await customerRepository.getBlockedCustomerIds();
  if (blockedIds.has(customerId)) {
    const err = new Error('Your customer account is currently blocked from creating new bookings.');
    err.code = 'CUSTOMER_BLOCKED';
    err.status = 403;
    throw err;
  }

  // 1. Fetch persistent cart
  const cart = await cartEngine.getCart(customerId);
  if (!cart.items || cart.items.length === 0) {
    const err = new Error('Cannot create booking with an empty cart.');
    err.code = 'EMPTY_CART';
    throw err;
  }

  // 2. Validate all fish active & online bookable
  for (const item of cart.items) {
    const fish = await fishRepository.findFishById(item.fishId);
    if (!fish || !fish.physical_available || !fish.online_bookable) {
      const err = new Error(`Fish "${item.name}" is no longer available for online booking.`);
      err.code = 'FISH_UNAVAILABLE';
      err.fishId = item.fishId;
      throw err;
    }
  }

  // 3. Pre-validate subscription coverage & fees
  const subCoverage = await customerSubscriptionEngine.calculateSubscriptionCoverage({
    customerId,
    cartItems: cart.items,
  });
  const feeCalc = paymentEngine.calculatePaymentFees(subCoverage.extraPayableAmount);
  const paymentRequired = feeCalc.finalPayable > 0;

  // 4. Verify payment boundary: if payment is required, enforce genuine server-side verification
  if (paymentRequired) {
    if (!paymentVerification) {
      const isConfigured = paymentEngine.isRazorpayConfigured();
      const err = new Error(
        isConfigured
          ? 'Payment required. Please complete online checkout through Razorpay.'
          : 'Razorpay credentials are not configured on this environment. Online payment cannot be completed.'
      );
      err.code = isConfigured ? 'PAYMENT_REQUIRED' : 'PAYMENT_GATEWAY_NOT_CONFIGURED';
      err.amount = feeCalc.finalPayable;
      throw err;
    }

    // Verify signature
    const isValid = paymentEngine.verifyPaymentSignature(paymentVerification);
    if (!isValid) {
      const err = new Error('Razorpay payment signature verification failed.');
      err.code = 'PAYMENT_VERIFICATION_FAILED';
      throw err;
    }
  }

  // 5. Begin PostgreSQL transaction for atomic execution
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step A: Concurrency-safe atomic inventory reservation
    // Locks rows using SELECT ... FOR UPDATE; throws INSUFFICIENT_INVENTORY if stock < requested
    const bookingCode = bookingRepository.generateBookingCode();
    await inventoryEngine.reserveItemsAtomic(client, cart.items, {
      bookingCode,
    });

    // Step B: Generate secure server-side QR booking ticket data
    let bookingExpiryHours = 48;
    try {
      const opRules = await businessSettingsEngine.getSetting('operational_rules');
      if (opRules && typeof opRules.bookingExpiryHours === 'number') {
        bookingExpiryHours = opRules.bookingExpiryHours;
      }
    } catch (e) {
      // default 48h
    }
    const expiresAt = new Date(Date.now() + bookingExpiryHours * 60 * 60 * 1000);
    const tempBooking = {
      booking_code: bookingCode,
      customer_id: customerId,
      created_at: new Date(),
    };
    const qrCodeData = qrVerificationEngine.generateBookingQrData(tempBooking);

    // Step C: Create booking record
    const bookingRecord = await bookingRepository.createBooking(client, {
      customerId,
      bookingCode,
      qrCodeData,
      totalAmount: cart.summary.totalAmount,
      subCreditUsed: subCoverage.subCreditUsed,
      razorpayPaid: paymentRequired ? feeCalc.finalPayable : 0,
      razorpayOrderId: paymentVerification?.razorpayOrderId || null,
      status: 'CONFIRMED',
      expiresAt,
    });

    // Step D: Deduct subscription credit and log weekly quantity usage linked to bookingId
    if (subCoverage.hasActiveSubscription && subCoverage.subCreditUsed > 0) {
      await subscriptionRepository.recordCreditDeduction(client, {
        subscriptionId: subCoverage.subscription.subscriptionId,
        bookingId: bookingRecord.id,
        amount: subCoverage.subCreditUsed,
      });

      for (const item of subCoverage.itemBreakdown) {
        if (item.coveredQty > 0) {
          await subscriptionRepository.recordWeeklyUsage(client, {
            subscriptionId: subCoverage.subscription.subscriptionId,
            bookingId: bookingRecord.id,
            fishId: item.fishId,
            quantityKg: item.coveredQty,
          });
        }
      }
    }

    // Step E: Create booking line items
    const bookingItemsData = cart.items.map((item) => ({
      fishId: item.fishId,
      quantityKg: item.quantity,
      unitPrice: item.effectivePrice || item.unitPrice,
      subtotal: item.subtotal,
    }));
    await bookingRepository.createBookingItems(client, bookingRecord.id, bookingItemsData);

    // Step F: Record payment if payment occurred
    if (paymentRequired && paymentVerification) {
      await bookingRepository.createPayment(client, {
        bookingId: bookingRecord.id,
        razorpayOrderId: paymentVerification.razorpayOrderId,
        razorpayPaymentId: paymentVerification.razorpayPaymentId,
        razorpaySignature: paymentVerification.razorpaySignature,
        amount: feeCalc.finalPayable,
        method: 'RAZORPAY',
        status: 'SUCCESS',
      });
    }

    // Step G: Clear customer persistent cart upon successful booking
    await cartRepository.clearCart(customerId, client);

    await client.query('COMMIT');

    // Step H: Emit domain event for real-time TV display / notifications
    try {
      if (domainEventsEngine && domainEventsEngine.emit) {
        domainEventsEngine.emit('BOOKING_CREATED', {
          bookingId: bookingRecord.id,
          bookingCode: bookingRecord.booking_code,
          customerId,
          totalAmount: cart.summary.totalAmount,
          expiresAt: expiresAt.toISOString(),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (eventErr) {
      console.warn('[DOMAIN EVENT EMIT WARNING]', eventErr.message);
    }

    // Step I: Record authoritative audit log
    try {
      await auditEngine.recordAuditLog({
        actorType: 'CUSTOMER',
        actorId: customerId,
        action: 'BOOKING_CREATED',
        entityType: 'BOOKING',
        entityId: bookingRecord.id,
        payload: {
          bookingCode: bookingRecord.booking_code,
          totalAmount: cart.summary.totalAmount,
          subCreditUsed: subCoverage.subCreditUsed,
          razorpayPaid: paymentRequired ? feeCalc.finalPayable : 0,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (auditErr) {
      console.warn('[BOOKING AUDIT WARNING]', auditErr.message);
    }

    // Retrieve fresh booking details to return
    const createdBooking = await bookingRepository.findBookingById(bookingRecord.id, customerId);
    return createdBooking;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BOOKING TRANSACTION ROLLBACK]', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retrieve booking details by ID with customer isolation.
 * Automatically reconciles overdue bookings past their 48-hour window.
 * @param {object} params - { customerId, bookingId }
 * @returns {Promise<object>}
 */
async function getBookingDetails({ customerId, bookingId }) {
  if (!customerId || !bookingId) {
    const err = new Error('CUSTOMER_ID_AND_BOOKING_ID_REQUIRED');
    err.code = 'INVALID_PARAMETERS';
    throw err;
  }

  let booking = await bookingRepository.findBookingById(bookingId, customerId);
  if (!booking) {
    const err = new Error('Booking not found or access denied.');
    err.code = 'BOOKING_NOT_FOUND';
    throw err;
  }

  // Authoritative server-side expiration reconciliation if overdue
  const isOverdue = new Date(booking.expires_at) <= new Date();
  if (isOverdue && ['CREATED', 'CONFIRMED', 'PENDING_COLLECTION'].includes(booking.status)) {
    const bookingExpiryEngine = require('./booking-expiry');
    await bookingExpiryEngine.expireBooking(booking.id);
    const refreshed = await bookingRepository.findBookingById(bookingId, customerId);
    if (refreshed) {
      booking = refreshed;
    }
  }

  return booking;
}

/**
 * List all bookings for an authenticated customer
 * @param {object} params - { customerId, limit, offset }
 * @returns {Promise<Array>}
 */
async function listBookings({ customerId, limit, offset }) {
  if (!customerId) {
    const err = new Error('CUSTOMER_ID_REQUIRED');
    err.code = 'CUSTOMER_ID_REQUIRED';
    throw err;
  }
  return bookingRepository.listCustomerBookings(customerId, { limit, offset });
}

/**
 * Cancel an active customer booking and restore reserved stock, subscription quantity,
 * subscription credit, and applicable Razorpay-paid amount into subscription credit.
 * @param {object} params - { customerId, bookingId }
 * @returns {Promise<object>}
 */
async function cancelBooking({ customerId, bookingId }) {
  if (!customerId || !bookingId) {
    const err = new Error('CUSTOMER_ID_AND_BOOKING_ID_REQUIRED');
    err.code = 'INVALID_PARAMETERS';
    throw err;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Row lock on booking with customer isolation
    const bookingRes = await client.query(
      `SELECT * FROM bookings WHERE id = $1 AND customer_id = $2 FOR UPDATE;`,
      [bookingId, customerId]
    );

    if (bookingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Booking not found or access denied.');
      err.code = 'BOOKING_NOT_FOUND';
      throw err;
    }

    const booking = bookingRes.rows[0];

    // Check cancellation eligibility
    if (booking.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      const err = new Error('Cannot cancel a completed booking.');
      err.code = 'BOOKING_ALREADY_COMPLETED';
      throw err;
    }

    if (booking.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      const err = new Error('Booking is already cancelled.');
      err.code = 'BOOKING_ALREADY_CANCELLED';
      throw err;
    }

    if (booking.status === 'EXPIRED') {
      await client.query('ROLLBACK');
      const err = new Error('Cannot cancel an expired booking.');
      err.code = 'BOOKING_ALREADY_EXPIRED';
      throw err;
    }

    // 1. Fetch line items
    const itemsRes = await client.query(
      `SELECT * FROM booking_items WHERE booking_id = $1;`,
      [bookingId]
    );

    // 2. Release reserved inventory back to available stock atomically
    for (const item of itemsRes.rows) {
      await inventoryRepository.releaseInventoryAtomic(client, {
        fishId: item.fish_id,
        quantityKg: item.quantity_kg,
        bookingId: booking.id,
        bookingCode: booking.booking_code,
        reason: 'CUSTOMER_CANCELLATION',
      });
    }

    // 3. Restore weekly subscription quantity usage if debited
    const usageEntries = await subscriptionRepository.getBookingUsageLedgerEntries(client, booking.id);
    if (usageEntries && usageEntries.length > 0) {
      for (const u of usageEntries) {
        await subscriptionRepository.restoreWeeklyUsage(client, {
          subscriptionId: u.subscription_id,
          bookingId: booking.id,
          fishId: u.fish_id,
          quantityKg: u.quantity_kg,
        });
      }
    } else if (booking.sub_credit_used > 0) {
      const activeSub = await subscriptionRepository.getActiveSubscription(customerId, client);
      if (activeSub) {
        for (const item of itemsRes.rows) {
          await subscriptionRepository.restoreWeeklyUsage(client, {
            subscriptionId: activeSub.subscription_id,
            bookingId: booking.id,
            fishId: item.fish_id,
            quantityKg: item.quantity_kg,
          });
        }
      }
    }

    // 4. Restore monetary benefits: subscription credit used + applicable Razorpay-paid booking value -> added to subscription credit
    await subscriptionRepository.restoreCustomerBookingCredits(client, {
      customerId,
      bookingId: booking.id,
      subCreditUsed: booking.sub_credit_used,
      razorpayPaid: booking.razorpay_paid,
    });

    // 5. Update status to CANCELLED
    const updated = await bookingRepository.updateBookingStatus(client, booking.id, 'CANCELLED');

    await client.query('COMMIT');

    // 6. Emit domain event
    try {
      if (domainEventsEngine && domainEventsEngine.emit) {
        domainEventsEngine.emit('BOOKING_CANCELLED', {
          bookingId: booking.id,
          bookingCode: booking.booking_code,
          customerId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (eventErr) {
      console.warn('[DOMAIN EVENT EMIT WARNING]', eventErr.message);
    }

    // 7. Record authoritative audit log
    try {
      await auditEngine.recordAuditLog({
        actorType: 'CUSTOMER',
        actorId: customerId,
        action: 'BOOKING_CANCELLED',
        entityType: 'BOOKING',
        entityId: booking.id,
        payload: {
          bookingCode: booking.booking_code,
          reason: 'Customer initiated cancellation',
        },
      });
    } catch (auditErr) {
      console.warn('[BOOKING AUDIT WARNING]', auditErr.message);
    }

    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CANCEL BOOKING ERROR]', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List bookings for Admin Portal with multi-field search, status filtering, and pagination
 * Traceability: ADMIN-12 Bookings Management
 * @param {object} options
 * @returns {Promise<{ bookings: Array<object>, total: number, counts: object }>}
 */
async function listAdminBookings(options) {
  return bookingRepository.listAdminBookings(options);
}

/**
 * Retrieve comprehensive booking detail for Admin Portal with 48h expiry reconciliation
 * @param {string} bookingId
 * @returns {Promise<object>}
 */
async function getAdminBookingDetail(bookingId) {
  if (!bookingId) {
    const err = new Error('Booking ID is required.');
    err.code = 'INVALID_PARAMETERS';
    err.status = 400;
    throw err;
  }

  let booking = await bookingRepository.findBookingDetailForAdmin(bookingId);
  if (!booking) {
    const err = new Error('Booking not found.');
    err.code = 'BOOKING_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Authoritative server-side expiration reconciliation if overdue
  const isOverdue = new Date(booking.expires_at) <= new Date();
  if (isOverdue && ['CREATED', 'CONFIRMED', 'PENDING_COLLECTION'].includes(booking.status)) {
    const bookingExpiryEngine = require('./booking-expiry');
    await bookingExpiryEngine.expireBooking(booking.id);
    const refreshed = await bookingRepository.findBookingDetailForAdmin(bookingId);
    if (refreshed) {
      booking = refreshed;
    }
  }

  return booking;
}

/**
 * Admin-approved operational booking cancellation with full atomic restoration
 * Concurrency-safe, row-locking transaction that:
 * 1. Locks booking row with SELECT ... FOR UPDATE
 * 2. Re-validates current status (rejects COMPLETED, CANCELLED, EXPIRED)
 * 3. Enforces valid cancellation reason (and notes if "Other")
 * 4. Atomically releases reserved inventory to available stock
 * 5. Restores weekly subscription quantity usage if debited
 * 6. Restores monetary credit: subscription credit used + Razorpay paid amount credited as subscription credit
 * 7. Updates status to CANCELLED
 * 8. Permanently invalidates QR ticket
 * 9. Emits BOOKING_CANCELLED_BY_ADMIN domain event
 * 10. Records authoritative immutable audit log with admin actor and reason (no swallowed errors)
 * 
 * @param {object} params
 * @param {string} params.bookingId
 * @param {string} params.reason
 * @param {string} [params.cancellationNotes]
 * @param {object} [context]
 * @param {string} [context.actorId]
 * @param {string} [context.ip]
 * @returns {Promise<{ success: boolean, booking: object, restoration: object }>}
 */
async function adminCancelBooking(
  { bookingId, reason, cancellationNotes = null },
  { actorId = 'system', ip = '127.0.0.1' } = {}
) {
  if (!bookingId) {
    const err = new Error('Booking ID is required.');
    err.code = 'INVALID_PARAMETERS';
    err.status = 400;
    throw err;
  }

  const validReasons = [
    'Fish unavailable',
    'Technical issue',
    'Operational issue',
    'Other',
  ];

  if (!reason || !reason.trim()) {
    const err = new Error('Cancellation reason is required.');
    err.code = 'CANCELLATION_REASON_REQUIRED';
    err.status = 400;
    throw err;
  }

  const trimmedReason = reason.trim();
  if (!validReasons.includes(trimmedReason)) {
    const err = new Error(`Invalid cancellation reason. Allowed reasons: ${validReasons.join(', ')}`);
    err.code = 'INVALID_CANCELLATION_REASON';
    err.status = 400;
    throw err;
  }

  if (trimmedReason === 'Other' && (!cancellationNotes || cancellationNotes.trim().length < 3)) {
    const err = new Error('An explanatory note is required when "Other" cancellation reason is selected.');
    err.code = 'CANCELLATION_NOTES_REQUIRED';
    err.status = 400;
    throw err;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Concurrency-safe exclusive row lock on bookings table
    const lockRes = await client.query(
      `SELECT * FROM bookings WHERE id = $1 FOR UPDATE;`,
      [bookingId]
    );

    if (lockRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Booking not found.');
      err.code = 'BOOKING_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const booking = lockRes.rows[0];

    // 2. Strict state validation & idempotency checks
    if (booking.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      const err = new Error('Cannot cancel a completed booking.');
      err.code = 'BOOKING_ALREADY_COMPLETED';
      err.status = 409;
      throw err;
    }

    if (booking.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      const err = new Error('Booking is already cancelled.');
      err.code = 'BOOKING_ALREADY_CANCELLED';
      err.status = 409;
      throw err;
    }

    if (booking.status === 'EXPIRED') {
      await client.query('ROLLBACK');
      const err = new Error('Cannot cancel an expired booking.');
      err.code = 'BOOKING_ALREADY_EXPIRED';
      err.status = 409;
      throw err;
    }

    if (!['CREATED', 'CONFIRMED', 'PENDING_COLLECTION'].includes(booking.status)) {
      await client.query('ROLLBACK');
      const err = new Error(`Cannot cancel booking in ${booking.status} state.`);
      err.code = 'INVALID_BOOKING_STATUS';
      err.status = 400;
      throw err;
    }

    // 3. Fetch booking line items
    const itemsRes = await client.query(
      `SELECT * FROM booking_items WHERE booking_id = $1;`,
      [bookingId]
    );

    // 4. Atomically release reserved inventory back to available stock
    for (const item of itemsRes.rows) {
      await inventoryRepository.releaseInventoryAtomic(client, {
        fishId: item.fish_id,
        quantityKg: item.quantity_kg,
        bookingId: booking.id,
        bookingCode: booking.booking_code,
        reason: `ADMIN_CANCELLATION: ${trimmedReason}`,
      });
    }

    // 5. Restore weekly subscription quantity usage if debited
    const usageEntries = await subscriptionRepository.getBookingUsageLedgerEntries(client, booking.id);
    let totalWeeklyRestoredKg = 0;
    if (usageEntries && usageEntries.length > 0) {
      for (const u of usageEntries) {
        await subscriptionRepository.restoreWeeklyUsage(client, {
          subscriptionId: u.subscription_id,
          bookingId: booking.id,
          fishId: u.fish_id,
          quantityKg: u.quantity_kg,
        });
        totalWeeklyRestoredKg += parseFloat(u.quantity_kg) || 0;
      }
    } else if (booking.sub_credit_used > 0) {
      const activeSub = await subscriptionRepository.getActiveSubscription(booking.customer_id, client);
      if (activeSub) {
        for (const item of itemsRes.rows) {
          await subscriptionRepository.restoreWeeklyUsage(client, {
            subscriptionId: activeSub.subscription_id,
            bookingId: booking.id,
            fishId: item.fish_id,
            quantityKg: item.quantity_kg,
          });
          totalWeeklyRestoredKg += parseFloat(item.quantity_kg) || 0;
        }
      }
    }

    // 6. Restore monetary benefits: subscription credit used + Razorpay paid amount credited as subscription credit
    const creditRestoreResult = await subscriptionRepository.restoreCustomerBookingCredits(client, {
      customerId: booking.customer_id,
      bookingId: booking.id,
      subCreditUsed: booking.sub_credit_used,
      razorpayPaid: booking.razorpay_paid,
    });

    // 7. Transition booking status to CANCELLED
    const updated = await bookingRepository.updateBookingStatus(client, booking.id, 'CANCELLED');

    await client.query('COMMIT');

    // 8. Emit domain event for real-time notification
    try {
      if (domainEventsEngine && domainEventsEngine.emit) {
        domainEventsEngine.emit('BOOKING_CANCELLED_BY_ADMIN', {
          bookingId: booking.id,
          bookingCode: booking.booking_code,
          customerId: booking.customer_id,
          adminId: actorId,
          reason: trimmedReason,
          notes: cancellationNotes ? cancellationNotes.trim() : null,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (eventErr) {
      console.warn('[DOMAIN EVENT EMIT WARNING]', eventErr.message);
    }

    // 9. Record authoritative immutable audit log (Hardened: never swallowed)
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId: String(actorId),
      action: 'BOOKING_CANCELLED_BY_ADMIN',
      entityType: 'BOOKING',
      entityId: booking.id,
      payload: {
        bookingCode: booking.booking_code,
        customerId: booking.customer_id,
        previousStatus: booking.status,
        newStatus: 'CANCELLED',
        reason: trimmedReason,
        notes: cancellationNotes ? cancellationNotes.trim() : null,
        subCreditRestored: booking.sub_credit_used,
        razorpayPaidRestoredAsCredit: booking.razorpay_paid,
        totalCreditRestored: creditRestoreResult?.amountRestored || ((booking.sub_credit_used || 0) + (booking.razorpay_paid || 0)),
        resultingCreditBalance: creditRestoreResult?.resultingBalance,
        weeklyQuantityRestoredKg: totalWeeklyRestoredKg,
        ip,
      },
    });

    return {
      success: true,
      booking: updated,
      restoration: {
        inventoryRestored: itemsRes.rows.map((r) => ({
          fishId: r.fish_id,
          quantityKg: parseFloat(r.quantity_kg),
        })),
        subscriptionQuantityRestoredKg: totalWeeklyRestoredKg,
        subCreditRestored: parseFloat(booking.sub_credit_used || 0),
        razorpayPaidRestoredAsCredit: parseFloat(booking.razorpay_paid || 0),
        totalCreditRestored: creditRestoreResult?.amountRestored || ((booking.sub_credit_used || 0) + (booking.razorpay_paid || 0)),
        resultingCreditBalance: creditRestoreResult?.resultingBalance,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ADMIN CANCEL BOOKING ERROR]', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  name: 'BookingEngine',
  previewCheckout,
  createBooking,
  getBookingDetails,
  listBookings,
  cancelBooking,
  listAdminBookings,
  getAdminBookingDetail,
  adminCancelBooking,
};
