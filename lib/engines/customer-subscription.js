/**
 * Engine 08: Customer Subscription Business Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 12) & API Spec (Section 17)
 * Authoritative subscription coverage calculation, weekly quantity allowance enforcement,
 * and monetary credit deduction/restoration backed by PostgreSQL ledgers.
 */

const subscriptionRepository = require('../db/repositories/subscriptionRepository');
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

module.exports = {
  name: 'CustomerSubscriptionEngine',
  calculateSubscriptionCoverage,
  getCustomerSubscription,
  initiateSubscriptionPurchase,
  verifyAndActivateSubscription,
};

