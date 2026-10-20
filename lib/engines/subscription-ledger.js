/**
 * Engine 07: Financial Credit Ledger & Usage Balance Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 7) & Database ERD (Section 11)
 * Audit-grade credit ledger retrieval for authenticated customer.
 */

const subscriptionRepository = require('../db/repositories/subscriptionRepository');

/**
 * Fetch credit movement history for a customer
 * @param {object} params
 * @param {string} params.customerId
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 * @returns {Promise<{ entries: Array<object>, total: number }>}
 */
async function getCustomerLedger({ customerId, limit = 50, offset = 0 }) {
  if (!customerId) {
    throw new Error('customerId is required to retrieve credit ledger.');
  }

  const { entries, total } = await subscriptionRepository.getCustomerCreditLedger(customerId, {
    limit,
    offset,
  });

  const formattedEntries = entries.map((entry) => ({
    id: entry.id,
    subscriptionId: entry.subscription_id,
    transactionId: entry.transaction_id,
    bookingId: entry.booking_id,
    type: entry.type,
    amount: parseFloat(entry.amount),
    resultingBalance: parseFloat(entry.resulting_balance),
    createdAt: entry.created_at,
    planId: entry.plan_id,
  }));

  return {
    entries: formattedEntries,
    total,
  };
}

module.exports = {
  name: 'SubscriptionLedgerEngine',
  getCustomerLedger,
};
