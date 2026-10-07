/**
 * Engine 08: Customer Subscription Business Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 12) & API Spec (Section 17)
 * Authoritative subscription coverage calculation, weekly quantity allowance enforcement,
 * and monetary credit deduction/restoration backed by PostgreSQL ledgers.
 */

const subscriptionRepository = require('../db/repositories/subscriptionRepository');
const customerRepository = require('../db/repositories/customerRepository');
const { query } = require('../db/pool');
const paymentEngine = require('./payment');
const domainEventsEngine = require('./domain-events');
const auditEngine = require('./audit');

/**
 * Authoritative calculation of subscription coverage for checkout items.
 * Enforces:
 * 1. Active subscription validation
 * 2. Fish eligibility via subscription_plan_fish
 * 3. Weekly quantity limit (kg)
 * 4. Monetary subscription credit limit (₹)
 * 
 * @param {object} params
 * @param {string} params.customerId
 * @param {Array<{ fishId: string, quantity: number, unitPrice: number, effectivePrice: number, subtotal: number }>} params.cartItems
 * @returns {Promise<object>} Detailed coverage breakdown
 */
async function calculateSubscriptionCoverage({ customerId, cartItems = [] }) {
  if (!customerId) {
    throw new Error('customerId is required for subscription calculation.');
  }

  const activeSub = await subscriptionRepository.getActiveSubscription(customerId);

  // Non-subscription customer path
  if (!activeSub) {
    const totalAmount = cartItems.reduce((acc, item) => acc + (item.subtotal || 0), 0);
    const totalQuantity = cartItems.reduce((acc, item) => acc + (item.quantity || 0), 0);

    return {
      hasActiveSubscription: false,
      subscription: null,
      coveredQuantityKg: 0,
      extraQuantityKg: parseFloat(totalQuantity.toFixed(2)),
      subCreditUsed: 0,
      extraPayableAmount: parseFloat(totalAmount.toFixed(2)),
      remainingWeeklyKg: 0,
      remainingCreditBalance: 0,
      itemBreakdown: cartItems.map(i => ({
        fishId: i.fishId,
        requestedQty: i.quantity,
        coveredQty: 0,
        extraQty: i.quantity,
        isEligible: false,
        subCreditAmount: 0,
        extraAmount: i.subtotal,
      })),
      statusText: 'No Active Subscription. Full payment required via online checkout.',
    };
  }

  // Active subscription exists
  const planId = activeSub.plan_id;
  const weeklyLimit = parseFloat(activeSub.weekly_qty_limit_kg || 0);
  const weeklyUsed = parseFloat(activeSub.weekly_qty_used || 0);
  let remainingWeeklyKg = Math.max(0, parseFloat((weeklyLimit - weeklyUsed).toFixed(2)));
  let remainingCredit = Math.max(0, parseFloat((activeSub.credit_balance || 0).toFixed(2)));

  let totalCoveredQty = 0;
  let totalExtraQty = 0;
  let totalCreditUsed = 0;
  let totalExtraAmount = 0;
  const itemBreakdown = [];

  for (const item of cartItems) {
    const fishId = item.fishId;
    const requestedQty = parseFloat(item.quantity || 0);
    const unitPrice = parseFloat(item.effectivePrice || item.unitPrice || 0);
    const itemTotal = parseFloat((requestedQty * unitPrice).toFixed(2));

    // Check plan eligibility explicitly against subscription_plan_fish table
    const isEligible = await subscriptionRepository.isFishEligibleForPlan(planId, fishId);

    if (!isEligible) {
      // Ineligible under plan: full item is extra
      totalExtraQty += requestedQty;
      totalExtraAmount += itemTotal;
      itemBreakdown.push({
        fishId,
        requestedQty,
        coveredQty: 0,
        extraQty: requestedQty,
        isEligible: false,
        subCreditAmount: 0,
        extraAmount: itemTotal,
        reason: 'Fish is not eligible under your current subscription plan.',
      });
      continue;
    }

    // Eligible: calculate quantity covered under weekly limit
    const potentialCoveredKg = Math.min(requestedQty, remainingWeeklyKg);
    const extraKg = parseFloat((requestedQty - potentialCoveredKg).toFixed(2));

    // Calculate monetary credit needed for covered quantity
    const creditNeeded = parseFloat((potentialCoveredKg * unitPrice).toFixed(2));
    const creditCovered = Math.min(creditNeeded, remainingCredit);

    // If credit is insufficient to cover all potential covered kg:
    const actualCoveredKg = creditNeeded > 0
      ? parseFloat(((creditCovered / creditNeeded) * potentialCoveredKg).toFixed(2))
      : 0;

    const actualExtraKg = parseFloat((requestedQty - actualCoveredKg).toFixed(2));
    const extraAmount = parseFloat((actualExtraKg * unitPrice).toFixed(2));

    // Deduct from remaining run-time balances for subsequent items
    remainingWeeklyKg = Math.max(0, parseFloat((remainingWeeklyKg - actualCoveredKg).toFixed(2)));
    remainingCredit = Math.max(0, parseFloat((remainingCredit - creditCovered).toFixed(2)));

    totalCoveredQty += actualCoveredKg;
    totalExtraQty += actualExtraKg;
    totalCreditUsed += creditCovered;
    totalExtraAmount += extraAmount;

    itemBreakdown.push({
      fishId,
      requestedQty,
      coveredQty: actualCoveredKg,
      extraQty: actualExtraKg,
      isEligible: true,
      subCreditAmount: creditCovered,
      extraAmount,
      reason: extraKg > 0 ? 'Exceeds weekly quantity limit' : (creditCovered < creditNeeded ? 'Insufficient subscription credit' : null),
    });
  }

  return {
    hasActiveSubscription: true,
    subscription: {
      subscriptionId: activeSub.subscription_id,
      planId: activeSub.plan_id,
      planTitle: activeSub.plan_title,
      weeklyLimitKg: weeklyLimit,
      weeklyUsedKg: weeklyUsed,
      remainingWeeklyKg,
      creditBalance: parseFloat(activeSub.credit_balance.toFixed(2)),
      remainingCreditBalance: remainingCredit,
      expiresAt: activeSub.expires_at,
    },
    coveredQuantityKg: parseFloat(totalCoveredQty.toFixed(2)),
    extraQuantityKg: parseFloat(totalExtraQty.toFixed(2)),
    subCreditUsed: parseFloat(totalCreditUsed.toFixed(2)),
    extraPayableAmount: parseFloat(totalExtraAmount.toFixed(2)),
    itemBreakdown,
    statusText: totalExtraAmount > 0
      ? 'Subscription applied with additional payment required.'
      : 'Order fully covered by active subscription allowance and credit.',
  };
}

/**
 * Retrieve current subscription state for authenticated customer.
 * @param {string} customerId
 * @returns {Promise<object>}
 */
async function getCustomerSubscription(customerId) {
  if (!customerId) {
    throw new Error('customerId is required to retrieve customer subscription.');
  }

  const activeSub = await subscriptionRepository.getActiveSubscription(customerId);
  if (!activeSub) {
    return {
      hasSubscription: false,
      subscription: null,
    };
  }

  const weeklyLimit = parseFloat(activeSub.weekly_qty_limit_kg || 0);
  const weeklyUsed = parseFloat(activeSub.weekly_qty_used || 0);
  const weeklyRemaining = Math.max(0, parseFloat((weeklyLimit - weeklyUsed).toFixed(2)));

  const now = new Date();
  const expiresAt = new Date(activeSub.expires_at);
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    hasSubscription: true,
    subscription: {
      subscriptionId: activeSub.subscription_id,
      customerId: activeSub.customer_id,
      planId: activeSub.plan_id,
      planTitle: activeSub.plan_title,
      planPrice: parseFloat(activeSub.plan_price || 0),
      planCreditAmount: parseFloat(activeSub.plan_credit_amount || 0),
      creditBalance: parseFloat((activeSub.credit_balance || 0).toFixed(2)),
      weeklyLimitKg: weeklyLimit,
      weeklyUsedKg: weeklyUsed,
      weeklyRemainingKg: weeklyRemaining,
      validityDays: parseInt(activeSub.validity_days, 10),
      startsAt: activeSub.starts_at,
      expiresAt: activeSub.expires_at,
      daysRemaining,
      status: activeSub.status,
    },
  };
}

/**
 * Initiate subscription purchase intent and create Razorpay order with server-controlled pricing.
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.planId
 * @returns {Promise<object>}
 */
async function initiateSubscriptionPurchase({ customerId, planId }) {
  if (!customerId) {
    throw new Error('customerId is required to purchase a subscription.');
  }
  if (!planId) {
    const err = new Error('planId is required to purchase a subscription.');
    err.code = 'INVALID_PLAN_ID';
    throw err;
  }

  // 1. Authoritatively retrieve plan from PostgreSQL
  const plan = await subscriptionRepository.findPlanById(planId);
  if (!plan) {
    const err = new Error('Subscription plan not found.');
    err.code = 'PLAN_NOT_FOUND';
    throw err;
  }

  if (!plan.active) {
    const err = new Error('This subscription plan is currently inactive.');
    err.code = 'PLAN_INACTIVE';
    throw err;
  }

  // 2. Server calculates fees authoritatively
  const basePrice = parseFloat(plan.price);
  const feeBreakdown = paymentEngine.calculatePaymentFees(basePrice);

  // 3. Create genuine Razorpay order or boundary unconfigured state
  const receipt = `sub_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const orderResult = await paymentEngine.createRazorpayOrder({
    amount: feeBreakdown.finalPayable,
    currency: 'INR',
    receipt,
    notes: {
      customerId,
      planId: plan.id,
      planTitle: plan.title,
      type: 'SUBSCRIPTION_PURCHASE',
    },
  });

  return {
    order: orderResult,
    plan: {
      id: plan.id,
      title: plan.title,
      basePrice,
      creditAmount: parseFloat(plan.credit_amount),
      weeklyQtyLimitKg: parseFloat(plan.weekly_qty_limit_kg),
      validityDays: parseInt(plan.validity_days, 10),
    },
    feeBreakdown,
  };
}

/**
 * Verify Razorpay HMAC signature and activate or recharge customer subscription atomically.
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.planId
 * @param {string} params.razorpayOrderId
 * @param {string} params.razorpayPaymentId
 * @param {string} params.razorpaySignature
 * @returns {Promise<object>}
 */
async function verifyAndActivateSubscription({
  customerId,
  planId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  if (!customerId) throw new Error('customerId is required.');
  if (!planId) {
    const err = new Error('planId is required.');
    err.code = 'INVALID_PLAN_ID';
    throw err;
  }
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    const err = new Error('Missing payment verification identifiers.');
    err.code = 'MISSING_PAYMENT_IDENTIFIERS';
    throw err;
  }

  // 1. Verify HMAC-SHA256 signature server-side
  const isValid = paymentEngine.verifyPaymentSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!isValid) {
    const err = new Error('Payment verification failed: invalid HMAC-SHA256 signature.');
    err.code = 'INVALID_PAYMENT_SIGNATURE';
    throw err;
  }

  // 2. Perform atomic activation/renewal inside PostgreSQL transaction
  const activationResult = await subscriptionRepository.activateOrRenewSubscription({
    customerId,
    planId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  // 3. Emit SUBSCRIPTION_ACTIVATED domain event
  try {
    if (domainEventsEngine && domainEventsEngine.emit) {
      domainEventsEngine.emit('SUBSCRIPTION_ACTIVATED', {
        customerId,
        subscriptionId: activationResult.subscription.id,
        planId: activationResult.plan.id,
        planTitle: activationResult.plan.title,
        creditAmount: parseFloat(activationResult.plan.credit_amount),
        resultingBalance: parseFloat(activationResult.ledgerEntry.resulting_balance),
        paymentId: activationResult.payment.id,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (eventErr) {
    console.warn('[DOMAIN EVENT EMIT WARNING]', eventErr.message);
  }

  // 4. Record immutable audit log
  try {
    await auditEngine.recordAuditLog({
      actorType: 'CUSTOMER',
      actorId: customerId,
      action: 'SUBSCRIPTION_PURCHASED',
      entityType: 'SUBSCRIPTION',
      entityId: activationResult.subscription.id,
      payload: {
        planId: activationResult.plan.id,
        planTitle: activationResult.plan.title,
        creditAmount: parseFloat(activationResult.plan.credit_amount),
        resultingBalance: parseFloat(activationResult.ledgerEntry.resulting_balance),
        paymentId: activationResult.payment.id,
      },
    });
  } catch (auditErr) {
    console.warn('[SUBSCRIPTION AUDIT WARNING]', auditErr.message);
  }

  return activationResult;
}

// In-memory idempotency cache for critical financial operations (10 minute TTL)
const idempotencyCache = new Map();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

function checkIdempotency(key) {
  if (!key) return null;
  const entry = idempotencyCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > IDEMPOTENCY_TTL_MS) {
    idempotencyCache.delete(key);
    return null;
  }
  return entry.result;
}

function storeIdempotency(key, result) {
  if (!key) return;
  idempotencyCache.set(key, {
    result,
    timestamp: Date.now(),
  });
}

/**
 * List all subscription plans for Admin Portal with subscriber metrics (ADMIN-08)
 */
async function listPlansForAdmin() {
  return await subscriptionRepository.listPlansForAdmin();
}

/**
 * Create a new subscription plan by Admin (ADMIN-08)
 */
async function createPlanByAdmin(data, { actorId = 'system', ip = '127.0.0.1' } = {}) {
  const title = String(data.title || data.name || '').trim();
  if (!title) {
    const err = new Error('Plan name is required.');
    err.code = 'INVALID_PLAN_NAME';
    err.status = 400;
    throw err;
  }

  const price = parseFloat(data.price);
  if (isNaN(price) || price <= 0) {
    const err = new Error('Price must be a positive number greater than 0.');
    err.code = 'INVALID_PRICE';
    err.status = 400;
    throw err;
  }

  const creditAmount = parseFloat(data.creditAmount !== undefined ? data.creditAmount : data.credit_amount);
  if (isNaN(creditAmount) || creditAmount <= 0) {
    const err = new Error('Credit amount must be a positive number greater than 0.');
    err.code = 'INVALID_CREDIT_AMOUNT';
    err.status = 400;
    throw err;
  }

  const validityDays = parseInt(data.validityDays !== undefined ? data.validityDays : data.validity_days, 10);
  if (isNaN(validityDays) || validityDays <= 0) {
    const err = new Error('Validity days must be a positive integer greater than 0.');
    err.code = 'INVALID_VALIDITY_DAYS';
    err.status = 400;
    throw err;
  }

  const weeklyQtyLimitKg = parseFloat(
    data.weeklyQtyLimitKg !== undefined ? data.weeklyQtyLimitKg : (data.weekly_qty_limit_kg || 0)
  );
  if (isNaN(weeklyQtyLimitKg) || weeklyQtyLimitKg < 0) {
    const err = new Error('Weekly quantity limit must be a non-negative number.');
    err.code = 'INVALID_WEEKLY_LIMIT';
    err.status = 400;
    throw err;
  }

  const active = data.active !== undefined ? Boolean(data.active) : true;

  const newPlan = await subscriptionRepository.createPlan({
    title,
    price,
    creditAmount,
    weeklyQtyLimitKg,
    validityDays,
    active,
  });

  // Authoritative audit logging
  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'SUBSCRIPTION_PLAN_CREATED',
    entityType: 'SUBSCRIPTION_PLAN',
    entityId: newPlan.id,
    payload: {
      title: newPlan.title,
      price: newPlan.price,
      creditAmount: newPlan.credit_amount,
      weeklyQtyLimitKg: newPlan.weekly_qty_limit_kg,
      validityDays: newPlan.validity_days,
      active: newPlan.active,
      ip,
    },
  });

  return newPlan;
}

/**
 * Update an existing subscription plan by Admin (ADMIN-08)
 * Preserves historical subscriptions.
 */
async function updatePlanByAdmin(planId, data, { actorId = 'system', ip = '127.0.0.1' } = {}) {
  if (!planId) {
    const err = new Error('Plan ID is required.');
    err.code = 'PLAN_ID_REQUIRED';
    err.status = 400;
    throw err;
  }

  const existingPlan = await subscriptionRepository.findPlanById(planId);
  if (!existingPlan) {
    const err = new Error('Subscription plan not found.');
    err.code = 'PLAN_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const updatePayload = {};

  if (data.title !== undefined || data.name !== undefined) {
    const title = String(data.title || data.name || '').trim();
    if (!title) {
      const err = new Error('Plan name cannot be empty.');
      err.code = 'INVALID_PLAN_NAME';
      err.status = 400;
      throw err;
    }
    updatePayload.title = title;
  }

  if (data.price !== undefined) {
    const price = parseFloat(data.price);
    if (isNaN(price) || price <= 0) {
      const err = new Error('Price must be a positive number greater than 0.');
      err.code = 'INVALID_PRICE';
      err.status = 400;
      throw err;
    }
    updatePayload.price = price;
  }

  if (data.creditAmount !== undefined || data.credit_amount !== undefined) {
    const creditAmount = parseFloat(data.creditAmount !== undefined ? data.creditAmount : data.credit_amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      const err = new Error('Credit amount must be a positive number greater than 0.');
      err.code = 'INVALID_CREDIT_AMOUNT';
      err.status = 400;
      throw err;
    }
    updatePayload.creditAmount = creditAmount;
  }

  if (data.validityDays !== undefined || data.validity_days !== undefined) {
    const validityDays = parseInt(data.validityDays !== undefined ? data.validityDays : data.validity_days, 10);
    if (isNaN(validityDays) || validityDays <= 0) {
      const err = new Error('Validity days must be a positive integer greater than 0.');
      err.code = 'INVALID_VALIDITY_DAYS';
      err.status = 400;
      throw err;
    }
    updatePayload.validityDays = validityDays;
  }

  if (data.weeklyQtyLimitKg !== undefined || data.weekly_qty_limit_kg !== undefined) {
    const weeklyQtyLimitKg = parseFloat(
      data.weeklyQtyLimitKg !== undefined ? data.weeklyQtyLimitKg : data.weekly_qty_limit_kg
    );
    if (isNaN(weeklyQtyLimitKg) || weeklyQtyLimitKg < 0) {
      const err = new Error('Weekly quantity limit must be a non-negative number.');
      err.code = 'INVALID_WEEKLY_LIMIT';
      err.status = 400;
      throw err;
    }
    updatePayload.weeklyQtyLimitKg = weeklyQtyLimitKg;
  }

  if (data.active !== undefined) {
    updatePayload.active = Boolean(data.active);
  }

  const updatedPlan = await subscriptionRepository.updatePlan(planId, updatePayload);

  // Authoritative audit logging
  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'SUBSCRIPTION_PLAN_UPDATED',
    entityType: 'SUBSCRIPTION_PLAN',
    entityId: updatedPlan.id,
    payload: {
      previous: {
        title: existingPlan.title,
        price: existingPlan.price,
        creditAmount: existingPlan.credit_amount,
        weeklyQtyLimitKg: existingPlan.weekly_qty_limit_kg,
        validityDays: existingPlan.validity_days,
        active: existingPlan.active,
      },
      updated: {
        title: updatedPlan.title,
        price: updatedPlan.price,
        creditAmount: updatedPlan.credit_amount,
        weeklyQtyLimitKg: updatedPlan.weekly_qty_limit_kg,
        validityDays: updatedPlan.validity_days,
        active: updatedPlan.active,
      },
      ip,
    },
  });

  return updatedPlan;
}

/**
 * Toggle plan active status by Admin (ADMIN-08)
 */
async function togglePlanActiveByAdmin(planId, active, { actorId = 'system', ip = '127.0.0.1' } = {}) {
  if (!planId) {
    const err = new Error('Plan ID is required.');
    err.code = 'PLAN_ID_REQUIRED';
    err.status = 400;
    throw err;
  }

  const existingPlan = await subscriptionRepository.findPlanById(planId);
  if (!existingPlan) {
    const err = new Error('Subscription plan not found.');
    err.code = 'PLAN_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const updatedPlan = await subscriptionRepository.togglePlanActive(planId, Boolean(active));

  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: Boolean(active) ? 'SUBSCRIPTION_PLAN_ACTIVATED' : 'SUBSCRIPTION_PLAN_DEACTIVATED',
    entityType: 'SUBSCRIPTION_PLAN',
    entityId: planId,
    payload: {
      planTitle: existingPlan.title,
      active: Boolean(active),
      ip,
    },
  });

  return updatedPlan;
}

/**
 * Search customers with their subscription summary for Admin Portal (ADMIN-09)
 */
async function searchCustomersForSubscription({ search = '', limit = 20, offset = 0 } = {}) {
  return await subscriptionRepository.searchCustomersForSubscription({ search, limit, offset });
}

/**
 * Get comprehensive customer subscription overview for Admin Portal (ADMIN-09)
 */
async function getCustomerSubscriptionDetails(customerId) {
  if (!customerId) {
    const err = new Error('Customer ID is required.');
    err.code = 'CUSTOMER_ID_REQUIRED';
    err.status = 400;
    throw err;
  }

  const details = await subscriptionRepository.getCustomerSubscriptionSummary(customerId);
  if (!details) {
    const err = new Error('Customer not found.');
    err.code = 'CUSTOMER_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  return details;
}

/**
 * Admin-Assisted Subscription Purchase (ADMIN-09)
 * Supports CASH (with explicit admin confirmation) and RAZORPAY (with server-side signature verification).
 * Enforces:
 * - Server determines authoritative plan price & credit amount
 * - Additive monetary credit accumulation (never overwrites valid existing credit)
 * - Atomic database transaction (payments + customer_subscriptions + subscription_credit_ledger)
 * - Idempotency protection against rapid retries and duplicate payments
 * - Complete audit logging without swallowing errors
 */
async function adminPurchaseSubscription({
  customerId,
  planId,
  paymentSource,
  confirmedByAdmin = false,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  idempotencyKey,
}, { actorId = 'system', ip = '127.0.0.1' } = {}) {
  // Idempotency check
  if (idempotencyKey) {
    const cached = checkIdempotency(idempotencyKey);
    if (cached) return cached;
  }

  if (!customerId) {
    const err = new Error('customerId is required.');
    err.code = 'CUSTOMER_ID_REQUIRED';
    err.status = 400;
    throw err;
  }

  if (!planId) {
    const err = new Error('planId is required.');
    err.code = 'PLAN_ID_REQUIRED';
    err.status = 400;
    throw err;
  }

  const customer = await customerRepository.findCustomerById(customerId);
  if (!customer) {
    const err = new Error('Customer not found.');
    err.code = 'CUSTOMER_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Authoritative server-side plan retrieval
  const plan = await subscriptionRepository.findPlanById(planId);
  if (!plan) {
    const err = new Error('Subscription plan not found.');
    err.code = 'PLAN_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!plan.active) {
    const err = new Error('The selected subscription plan is currently inactive.');
    err.code = 'PLAN_INACTIVE';
    err.status = 400;
    throw err;
  }

  const upperPaymentSource = String(paymentSource || '').trim().toUpperCase();
  if (upperPaymentSource !== 'CASH' && upperPaymentSource !== 'RAZORPAY') {
    const err = new Error("Payment source must be either 'CASH' or 'RAZORPAY'.");
    err.code = 'INVALID_PAYMENT_SOURCE';
    err.status = 400;
    throw err;
  }

  // 1. CASH Verification
  if (upperPaymentSource === 'CASH') {
    if (!confirmedByAdmin) {
      const err = new Error('Cash subscription purchase requires explicit administrative confirmation.');
      err.code = 'CASH_CONFIRMATION_REQUIRED';
      err.status = 400;
      throw err;
    }
  }

  // 2. RAZORPAY Verification
  if (upperPaymentSource === 'RAZORPAY') {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      const err = new Error('razorpayOrderId, razorpayPaymentId, and razorpaySignature are required for online payment.');
      err.code = 'MISSING_PAYMENT_IDENTIFIERS';
      err.status = 400;
      throw err;
    }

    // Verify HMAC-SHA256 signature
    const isValidSignature = paymentEngine.verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValidSignature) {
      const err = new Error('Payment verification failed: invalid HMAC-SHA256 signature.');
      err.code = 'INVALID_PAYMENT_SIGNATURE';
      err.status = 400;
      throw err;
    }

    // Duplicate payment check: ensure payment ID was not already used
    const dupCheck = await query(
      `SELECT id FROM payments WHERE razorpay_payment_id = $1 AND status = 'SUCCESS' LIMIT 1;`,
      [razorpayPaymentId]
    );
    if (dupCheck.rows.length > 0) {
      const err = new Error('This Razorpay payment has already been verified and processed.');
      err.code = 'DUPLICATE_PAYMENT';
      err.status = 409;
      throw err;
    }

    // Verify order amount matches authoritative plan price if gateway order fetchable
    if (paymentEngine.isRazorpayConfigured()) {
      const rzpOrder = await paymentEngine.getRazorpayOrder(razorpayOrderId);
      if (rzpOrder) {
        const authoritativePaise = Math.round(parseFloat(plan.price) * 100);
        if (rzpOrder.amount !== authoritativePaise) {
          const err = new Error(
            `Payment amount mismatch: order amount (${rzpOrder.amount / 100}) does not match authoritative plan price (${plan.price}).`
          );
          err.code = 'PAYMENT_AMOUNT_MISMATCH';
          err.status = 400;
          throw err;
        }
      }
    }
  }

  // 3. Atomic Database Mutation
  const result = await subscriptionRepository.adminPurchaseSubscriptionAtomic({
    customerId,
    planId: plan.id,
    paymentMethod: upperPaymentSource,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  // 4. Audit Log Write (without .catch swallowing)
  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: upperPaymentSource === 'CASH'
      ? 'ADMIN_SUBSCRIPTION_PURCHASE_CASH'
      : 'ADMIN_SUBSCRIPTION_PURCHASE_RAZORPAY',
    entityType: 'CUSTOMER_SUBSCRIPTION',
    entityId: result.subscription.id,
    payload: {
      customerId,
      customerName: customer.name,
      planId: plan.id,
      planTitle: plan.title,
      price: plan.price,
      creditAdded: plan.credit_amount,
      previousCredit: result.previousCredit,
      resultingBalance: result.ledgerEntry.resulting_balance,
      paymentMethod: upperPaymentSource,
      paymentId: result.payment.id,
      razorpayPaymentId: upperPaymentSource === 'RAZORPAY' ? razorpayPaymentId : null,
      confirmedByAdmin: upperPaymentSource === 'CASH' ? true : undefined,
      ip,
    },
  });

  // 5. Emit Domain Event if available
  try {
    if (domainEventsEngine && domainEventsEngine.emit) {
      domainEventsEngine.emit('SUBSCRIPTION_ACTIVATED', {
        customerId,
        subscriptionId: result.subscription.id,
        planId: plan.id,
        planTitle: plan.title,
        creditAmount: parseFloat(plan.credit_amount),
        resultingBalance: parseFloat(result.ledgerEntry.resulting_balance),
        paymentId: result.payment.id,
        actorType: 'ADMIN',
        actorId,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (eventErr) {
    console.warn('[DOMAIN EVENT WARNING]', eventErr.message);
  }

  if (idempotencyKey) {
    storeIdempotency(idempotencyKey, result);
  }

  return result;
}

/**
 * Manual Subscription Credit Adjustment by Admin (ADMIN-09)
 * Rules:
 * - reason is mandatory
 * - cannot produce negative credit
 * - row locked FOR UPDATE
 * - audited
 * - idempotent
 */
async function adminAdjustCustomerCredit({
  customerId,
  amount,
  direction,
  reason,
  idempotencyKey,
}, { actorId = 'system', ip = '127.0.0.1' } = {}) {
  if (idempotencyKey) {
    const cached = checkIdempotency(idempotencyKey);
    if (cached) return cached;
  }

  if (!customerId) {
    const err = new Error('customerId is required.');
    err.code = 'CUSTOMER_ID_REQUIRED';
    err.status = 400;
    throw err;
  }

  const customer = await customerRepository.findCustomerById(customerId);
  if (!customer) {
    const err = new Error('Customer not found.');
    err.code = 'CUSTOMER_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!reason || !reason.trim()) {
    const err = new Error('Reason is mandatory for manual credit adjustment.');
    err.code = 'REASON_REQUIRED';
    err.status = 400;
    throw err;
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    const err = new Error('Adjustment amount must be a positive number greater than 0.');
    err.code = 'INVALID_ADJUSTMENT_AMOUNT';
    err.status = 400;
    throw err;
  }

  const upperDirection = String(direction || '').trim().toUpperCase();
  if (upperDirection !== 'ADD' && upperDirection !== 'DEDUCT') {
    const err = new Error("Direction must be either 'ADD' or 'DEDUCT'.");
    err.code = 'INVALID_DIRECTION';
    err.status = 400;
    throw err;
  }

  // Execute atomic adjustment
  const result = await subscriptionRepository.adjustCustomerCreditAtomic({
    customerId,
    amount: parsedAmount,
    direction: upperDirection,
    reason: reason.trim(),
  });

  // Authoritative audit logging without swallowing
  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'ADMIN_SUBSCRIPTION_CREDIT_ADJUSTMENT',
    entityType: 'CUSTOMER_SUBSCRIPTION',
    entityId: result.subscriptionId,
    payload: {
      customerId,
      customerName: customer.name,
      previousBalance: result.previousBalance,
      adjustmentAmount: result.adjustmentAmount,
      direction: result.direction,
      resultingBalance: result.resultingBalance,
      reason: result.reason,
      ip,
    },
  });

  if (idempotencyKey) {
    storeIdempotency(idempotencyKey, result);
  }

  return result;
}

/**
 * Get traceable credit movement ledger for Admin Portal (ADMIN-09)
 */
async function getCustomerSubscriptionLedger(customerId, { limit = 50, offset = 0 } = {}) {
  if (!customerId) {
    const err = new Error('Customer ID is required.');
    err.code = 'CUSTOMER_ID_REQUIRED';
    err.status = 400;
    throw err;
  }
  return await subscriptionRepository.getAdminSubscriptionCreditLedger(customerId, { limit, offset });
}

module.exports = {
  name: 'CustomerSubscriptionEngine',
  calculateSubscriptionCoverage,
  getCustomerSubscription,
  initiateSubscriptionPurchase,
  verifyAndActivateSubscription,
  // Slice 15 Admin Operations
  listPlansForAdmin,
  createPlanByAdmin,
  updatePlanByAdmin,
  togglePlanActiveByAdmin,
  searchCustomersForSubscription,
  getCustomerSubscriptionDetails,
  adminPurchaseSubscription,
  adminAdjustCustomerCredit,
  getCustomerSubscriptionLedger,
};


