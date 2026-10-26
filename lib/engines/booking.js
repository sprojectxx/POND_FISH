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
      subscriptionCoveredKg: subItem ? (subItem.coveredQty ?? 0) : 0,
      subscriptionCreditUsed: subItem ? (subItem.subCreditAmount ?? 0) : 0,
      extraQuantityKg: subItem && typeof subItem.extraQty === 'number' ? subItem.extraQty : item.quantity,
      extraAmountPayable: subItem && typeof subItem.extraAmount === 'number' ? subItem.extraAmount : item.subtotal,
      isSubscriptionEligible: subItem ? Boolean(subItem.isEligible) : false,
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
 * Resolve and validate authoritative store identity for a new booking.
 * Enforces server-side validation for client-supplied store IDs and derives
 * from authoritative database settings if omitted.
 * @param {object} client - Active pg client or pool
 * @param {string} [requestedStoreId]
 * @returns {Promise<string>} authoritative store_id
 */
async function resolveAuthoritativeBookingStore(client, requestedStoreId = null) {
  const runner = client || getPool();

  // 1. Fetch configured store identity from database settings
  let configuredStoreId = null;
  const activeStoreRegistry = new Set();

  try {
    const res = await runner.query(
      "SELECT key, value FROM settings WHERE key IN ('active_store_id', 'store_info', 'store_destination', 'authorized_stores', 'store_registry', 'stores');"
    );
    for (const r of res.rows) {
      if (r.key === 'active_store_id' && typeof r.value === 'string' && r.value.trim()) {
        configuredStoreId = r.value.trim();
        activeStoreRegistry.add(configuredStoreId);
      } else if (r.key === 'active_store_id' && r.value && typeof r.value === 'object') {
        const sid = r.value.storeId || r.value.store_id || r.value.id;
        if (sid && String(sid).trim()) {
          configuredStoreId = String(sid).trim();
          activeStoreRegistry.add(configuredStoreId);
        }
      }

      if (r.key === 'store_info' && r.value) {
        const val = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
        const sid = val.storeId || val.store_id || val.id;
        if (sid && String(sid).trim()) {
          if (!configuredStoreId) configuredStoreId = String(sid).trim();
          activeStoreRegistry.add(String(sid).trim());
        }
      }

      if (r.key === 'store_destination' && r.value) {
        const val = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
        const sid = val.storeId || val.store_id || val.id;
        if (sid && String(sid).trim()) {
          if (!configuredStoreId) configuredStoreId = String(sid).trim();
          activeStoreRegistry.add(String(sid).trim());
        }
      }

      if (['authorized_stores', 'store_registry', 'stores'].includes(r.key) && r.value) {
        const list = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
        if (Array.isArray(list)) {
          for (const item of list) {
            if (typeof item === 'string' && item.trim()) {
              activeStoreRegistry.add(item.trim());
            } else if (item && typeof item === 'object') {
              const sid = item.storeId || item.store_id || item.id;
              const isActive = item.active !== false && item.is_active !== false && item.status !== 'INACTIVE';
              if (sid && String(sid).trim() && isActive) {
                activeStoreRegistry.add(String(sid).trim());
              }
            }
          }
        }
      }
    }
  } catch (_) {}

  // Single Store MVP fallback
  if (!configuredStoreId) {
    configuredStoreId = (process.env.PONDFISH_STORE_ID && process.env.PONDFISH_STORE_ID.trim())
      ? process.env.PONDFISH_STORE_ID.trim()
      : 'main_store';
    activeStoreRegistry.add(configuredStoreId);
  }

  // 2. Validate client-supplied storeId against authoritative store registry
  if (requestedStoreId !== null && requestedStoreId !== undefined) {
    const cleanRequested = typeof requestedStoreId === 'string' ? requestedStoreId.trim() : '';
    if (!cleanRequested) {
      const err = new Error('Requested store ID cannot be blank.');
      err.code = 'INVALID_STORE_ID';
      err.status = 400;
      throw err;
    }

    if (cleanRequested === configuredStoreId || activeStoreRegistry.has(cleanRequested)) {
      return cleanRequested;
    }

    const err = new Error(`Requested store "${cleanRequested}" is not an authorized active store.`);
    err.code = 'INVALID_STORE_ID';
    err.status = 400;
    throw err;
  }

  return configuredStoreId;
}

/**
 * Create customer booking with atomic concurrency-safe inventory reservation and ledger updates.
 * @param {object} params
 * @param {string} params.customerId
 * @param {object} [params.paymentVerification] - { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 * @param {object} [params.checkoutSnapshot]
 * @param {string} [params.storeId]
 * @param {object} [params.client]
 * @returns {Promise<object>} Created booking with QR pickup ticket
 */
async function createBooking({ customerId, paymentVerification = null, checkoutSnapshot = null, storeId = null, client: externalClient = null }) {
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

  // Auto-resolve immutable snapshot from checkout intent if razorpay order ID is provided and snapshot is absent (Phase 2J-L)
  const oId = paymentVerification?.razorpayOrderId || paymentVerification?.orderId || paymentVerification?.razorpay_order_id;
  if (!checkoutSnapshot && oId) {
    try {
      const checkoutIntentRepo = require('../db/repositories/checkoutIntentRepository');
      const storedIntent = await checkoutIntentRepo.getIntentByOrderId(externalClient, oId);
      if (storedIntent && storedIntent.cart_snapshot) {
        checkoutSnapshot = {
          items: typeof storedIntent.cart_snapshot === 'string'
            ? JSON.parse(storedIntent.cart_snapshot)
            : storedIntent.cart_snapshot,
          summary: typeof storedIntent.fee_breakdown === 'string'
            ? JSON.parse(storedIntent.fee_breakdown)
            : storedIntent.fee_breakdown,
          subscriptionCoverage: storedIntent.subscription_snapshot
            ? (typeof storedIntent.subscription_snapshot === 'string'
                ? JSON.parse(storedIntent.subscription_snapshot)
                : storedIntent.subscription_snapshot)
            : null,
        };
      }
    } catch (e) {
      // Table unapplied fallback
    }
  }

  // 1. Fetch persistent cart or use authoritative immutable checkout snapshot (Phase 2J-K)
  let cartItems;
  let cartSummary;
  let subCoverage;
  let feeCalc;

  if (checkoutSnapshot && checkoutSnapshot.items && checkoutSnapshot.items.length > 0) {
    cartItems = checkoutSnapshot.items;
    const derivedTotal = cartItems.reduce((acc, i) => acc + (parseFloat(i.subtotal) || (parseFloat(i.quantityKg || i.quantity || 0) * parseFloat(i.effectivePrice || i.unitPrice || 0))), 0);
    const derivedQty = cartItems.reduce((acc, i) => acc + parseFloat(i.quantityKg || i.quantity || 0), 0);
    cartSummary = {
      ...(checkoutSnapshot.summary || {}),
      totalAmount: checkoutSnapshot.summary?.totalAmount ?? checkoutSnapshot.summary?.subtotal ?? checkoutSnapshot.summary?.finalPayableAmount ?? derivedTotal,
      totalQuantity: checkoutSnapshot.summary?.totalQuantity ?? checkoutSnapshot.summary?.totalQuantityKg ?? derivedQty,
    };
    if (checkoutSnapshot.subscriptionCoverage) {
      subCoverage = checkoutSnapshot.subscriptionCoverage;
    } else {
      subCoverage = await customerSubscriptionEngine.calculateSubscriptionCoverage({
        customerId,
        cartItems,
      });
    }
    feeCalc = checkoutSnapshot.feeCalc || paymentEngine.calculatePaymentFees(subCoverage.extraPayableAmount);
  } else {
    const cart = await cartEngine.getCart(customerId);
    if (!cart.items || cart.items.length === 0) {
      const err = new Error('Cannot create booking with an empty cart.');
      err.code = 'EMPTY_CART';
      throw err;
    }
    cartItems = cart.items;
    cartSummary = cart.summary;
    subCoverage = await customerSubscriptionEngine.calculateSubscriptionCoverage({
      customerId,
      cartItems,
    });
    feeCalc = paymentEngine.calculatePaymentFees(subCoverage.extraPayableAmount);
  }

  // 2. Validate all fish active & online bookable
  for (const item of cartItems) {
    const fishId = item.fishId || item.id;
    const fish = await fishRepository.findFishById(fishId);
    if (!fish || !fish.physical_available || !fish.online_bookable) {
      const err = new Error(`Fish "${item.name}" is no longer available for online booking.`);
      err.code = 'FISH_UNAVAILABLE';
      err.fishId = fishId;
      throw err;
    }
  }

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

    // Verify signature: if verified via webhook HMAC ingress boundary, accept authoritative webhook source
    const isWebhookSource = paymentVerification.source === 'WEBHOOK' || paymentVerification.signature === 'WEBHOOK_VERIFIED';
    const isValid = isWebhookSource || paymentEngine.verifyPaymentSignature(paymentVerification);
    if (!isValid) {
      const err = new Error('Razorpay payment signature verification failed.');
      err.code = 'PAYMENT_VERIFICATION_FAILED';
      throw err;
    }

    // If Razorpay is configured, verify that paid order amount matches current cart payable total (fail-closed)
    if (paymentEngine.isRazorpayConfigured()) {
      const oId = paymentVerification.razorpayOrderId || paymentVerification.orderId || paymentVerification.razorpay_order_id;
      if (!oId) {
        const err = new Error('Razorpay orderId is required for payment verification.');
        err.code = 'MISSING_PAYMENT_ORDER_ID';
        throw err;
      }
      const rzpOrder = await paymentEngine.getRazorpayOrder(oId);
      if (!rzpOrder) {
        const err = new Error('Razorpay order could not be retrieved from gateway for payment verification.');
        err.code = 'PAYMENT_ORDER_NOT_FOUND';
        throw err;
      }
      if (rzpOrder.id !== oId) {
        const err = new Error(`Payment order ID mismatch: expected ${oId}, received ${rzpOrder.id}.`);
        err.code = 'PAYMENT_ORDER_ID_MISMATCH';
        throw err;
      }
      if (!rzpOrder.currency || rzpOrder.currency.toUpperCase() !== 'INR') {
        const err = new Error(`Payment currency mismatch: expected INR, received ${rzpOrder.currency || 'UNKNOWN'}.`);
        err.code = 'PAYMENT_CURRENCY_MISMATCH';
        throw err;
      }
      const expectedPaise = Math.round(feeCalc.finalPayable * 100);
      if (typeof rzpOrder.amount !== 'number' || rzpOrder.amount !== expectedPaise) {
        const err = new Error('Payment order amount does not match current cart total. Please review your cart.');
        err.code = 'PAYMENT_AMOUNT_MISMATCH';
        throw err;
      }
    }
  }

  // 5. Begin PostgreSQL transaction for atomic execution (or reuse caller's transaction client)
  const shouldManageTransaction = !externalClient;
  const pool = shouldManageTransaction ? getPool() : null;
  const client = externalClient || (await pool.connect());

  try {
    if (shouldManageTransaction) {
      await client.query('BEGIN');
    }

    // Step 0: Idempotency check for payment retries
    if (paymentRequired && paymentVerification) {
      const pId = paymentVerification.razorpayPaymentId || paymentVerification.paymentId || paymentVerification.razorpay_payment_id;
      const oId = paymentVerification.razorpayOrderId || paymentVerification.orderId || paymentVerification.razorpay_order_id;
      if (pId || oId) {
        const existingPayment = await client.query(
          `SELECT booking_id FROM payments 
           WHERE ($1::text IS NOT NULL AND razorpay_payment_id = $1)
              OR ($2::text IS NOT NULL AND razorpay_order_id = $2)
           LIMIT 1`,
          [pId || null, oId || null]
        );
        if (existingPayment.rows.length > 0) {
          const existingBooking = await bookingRepository.findBookingById(
            existingPayment.rows[0].booking_id,
            customerId,
            client
          );
          await client.query('COMMIT');
          return existingBooking;
        }
      }
    } else if (!checkoutSnapshot) {
      // Step 0b: Check that customer persistent cart is still active and has items (concurrency safeguard for non-snapshot path)
      const liveCartCheck = await client.query(
        'SELECT COUNT(*)::int AS count FROM customer_cart_items WHERE customer_id = $1',
        [customerId]
      );
      if (liveCartCheck.rows[0].count === 0) {
        await client.query('ROLLBACK');
        const err = new Error('Cart has already been checked out or is empty.');
        err.code = 'CART_ALREADY_PROCESSED';
        throw err;
      }
    }

    // Step A0: Resolve and validate authoritative store assignment
    const authoritativeStoreId = await resolveAuthoritativeBookingStore(client, storeId);

    // Step A: Concurrency-safe atomic inventory reservation
    // Locks rows using SELECT ... FOR UPDATE; throws INSUFFICIENT_INVENTORY if stock < requested
    const bookingCode = bookingRepository.generateBookingCode();
    await inventoryEngine.reserveItemsAtomic(client, cartItems, {
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
      store_id: authoritativeStoreId,
      created_at: new Date(),
    };
    const qrCodeData = qrVerificationEngine.generateBookingQrData(tempBooking);

    // Step C: Create booking record
    const bookingRecord = await bookingRepository.createBooking(client, {
      customerId,
      bookingCode,
      qrCodeData,
      totalAmount: cartSummary.totalAmount,
      subCreditUsed: subCoverage.subCreditUsed,
      razorpayPaid: paymentRequired ? feeCalc.finalPayable : 0,
      razorpayOrderId: paymentVerification?.razorpayOrderId || paymentVerification?.orderId || paymentVerification?.razorpay_order_id || null,
      status: 'CONFIRMED',
      expiresAt,
      storeId: authoritativeStoreId,
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
    const bookingItemsData = cartItems.map((item) => ({
      fishId: item.fishId || item.id,
      quantityKg: item.quantityKg || item.quantity,
      unitPrice: item.effectivePrice || item.unitPrice,
      subtotal: item.subtotal || ((item.quantityKg || item.quantity) * (item.effectivePrice || item.unitPrice)),
    }));
    await bookingRepository.createBookingItems(client, bookingRecord.id, bookingItemsData);

    // Step F: Record payment if payment occurred
    if (paymentRequired && paymentVerification) {
      await bookingRepository.createPayment(client, {
        bookingId: bookingRecord.id,
        razorpayOrderId: paymentVerification.razorpayOrderId || paymentVerification.orderId || paymentVerification.razorpay_order_id,
        razorpayPaymentId: paymentVerification.razorpayPaymentId || paymentVerification.paymentId || paymentVerification.razorpay_payment_id,
        razorpaySignature: paymentVerification.razorpaySignature || paymentVerification.signature || paymentVerification.razorpay_signature,
        amount: feeCalc.finalPayable,
        method: 'RAZORPAY',
        status: 'SUCCESS',
      });
    }

    // Step G: Clear customer persistent cart upon successful booking
    await cartRepository.clearCart(customerId, client);

    // Step G2: Mark checkout intent completed if razorpay order ID is associated (Phase 2J-K)
    const oId = paymentVerification?.razorpayOrderId || paymentVerification?.orderId || paymentVerification?.razorpay_order_id;
    if (oId) {
      try {
        const checkoutIntentRepo = require('../db/repositories/checkoutIntentRepository');
        await checkoutIntentRepo.markIntentCompleted(client, oId, bookingRecord.id);
      } catch (intentErr) {
        // Table unapplied fallback
      }
    }

    if (shouldManageTransaction) {
      await client.query('COMMIT');
    }

    // Step H: Emit domain event for real-time TV display / notifications
    try {
      if (domainEventsEngine && domainEventsEngine.emit) {
        domainEventsEngine.emit('BOOKING_CREATED', {
          bookingId: bookingRecord.id,
          bookingCode: bookingRecord.booking_code,
          customerId,
          totalAmount: cartSummary.totalAmount,
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
          totalAmount: cartSummary.totalAmount,
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
    if (shouldManageTransaction) {
      await client.query('ROLLBACK');
    }
    console.error('[BOOKING TRANSACTION ROLLBACK]', err.message);
    throw err;
  } finally {
    if (shouldManageTransaction) {
      client.release();
    }
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

    // 3. Restore weekly subscription quantity usage if debited (strictly from authoritative ledger entries)
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

    // 8. Record authoritative immutable audit log INSIDE the transaction
    // Enforces atomicity: cancellation cannot commit without its required audit record
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
    }, client);

    await client.query('COMMIT');

    // 9. Emit domain event for real-time notification (post-commit)
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
  resolveAuthoritativeBookingStore,
  getBookingDetails,
  listBookings,
  cancelBooking,
  listAdminBookings,
  getAdminBookingDetail,
  adminCancelBooking,
};
