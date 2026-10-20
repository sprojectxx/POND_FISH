/**
 * Engine 05: Subscription Plan Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 5) & Database ERD (Section 9)
 * Authoritative plan catalogue and rule retrieval from PostgreSQL.
 */

const subscriptionRepository = require('../db/repositories/subscriptionRepository');

/**
 * Retrieve all active subscription plans
 * @returns {Promise<Array<object>>}
 */
async function getActivePlans() {
  const plans = await subscriptionRepository.listActivePlans();
  return plans.map((p) => ({
    id: p.id,
    title: p.title,
    price: parseFloat(p.price),
    creditAmount: parseFloat(p.credit_amount),
    weeklyQtyLimitKg: parseFloat(p.weekly_qty_limit_kg),
    validityDays: parseInt(p.validity_days, 10),
    active: p.active,
    createdAt: p.created_at,
  }));
}

/**
 * Retrieve a specific plan by ID
 * @param {string} planId
 * @returns {Promise<object|null>}
 */
async function getPlanById(planId) {
  if (!planId) return null;
  const p = await subscriptionRepository.findPlanById(planId);
  if (!p) return null;
  return {
    id: p.id,
    title: p.title,
    price: parseFloat(p.price),
    creditAmount: parseFloat(p.credit_amount),
    weeklyQtyLimitKg: parseFloat(p.weekly_qty_limit_kg),
    validityDays: parseInt(p.validity_days, 10),
    active: p.active,
    createdAt: p.created_at,
  };
}

module.exports = {
  name: 'SubscriptionPlanEngine',
  getActivePlans,
  getPlanById,
};
