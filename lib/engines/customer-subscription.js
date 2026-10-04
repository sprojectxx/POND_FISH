/**
 * Engine 08: Customer Subscription Business Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 12) & API Spec (Section 17)
 * Authoritative subscription coverage calculation, weekly quantity allowance enforcement,
 * and monetary credit deduction/restoration backed by PostgreSQL ledgers.
 */

const subscriptionRepository = require('../db/repositories/subscriptionRepository');

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

module.exports = {
  name: 'CustomerSubscriptionEngine',
  calculateSubscriptionCoverage,
};
