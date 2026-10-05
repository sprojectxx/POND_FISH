/**
 * Engine 14: Shop TV Live Transaction Display Engine
 * Traceability: PondFish Core Business Engines Spec v1 (Section 25), Transaction TV Spec (Sections 11-13, 64-67)
 * 
 * Orchestrates:
 * 1. Active business-day successful transactions hydration for TV startup and reconnects.
 * 2. Privacy-safe display normalization (customer name masking, time format, line items).
 * 3. Domain event listener binding on DomainEventsEngine (e.g. BOOKING_COMPLETED) to automatically
 *    broadcast verified transactions via RealtimeBroadcastEngine.
 * 4. Deduplication and strictly read-only display guarantees.
 */

const transactionRepository = require('../db/repositories/transactionRepository');
const realtimeBroadcastEngine = require('./realtime-broadcast');
const domainEventsEngine = require('./domain-events');

/**
 * Format customer name for distance and privacy readability (TV Spec Section 88)
 * e.g. "Rahul Sharma" -> "Rahul S.", "C" -> "Customer"
 * @param {string} rawName
 * @returns {string}
 */
function formatDisplayName(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'Valued Customer';
  const parts = rawName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

/**
 * Format timestamp into HH:mm (24h or 12h Indian Standard Time)
 * @param {Date|string} dateInput
 * @returns {string}
 */
function formatDisplayTime(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Normalize raw transaction record into the authoritative TV Display Payload (TV Spec Section 64)
 * @param {object} tx
 * @returns {object}
 */
function normalizeTVPayload(tx) {
  return {
    id: tx.id,
    transactionNumber: tx.transactionNumber,
    billNumber: tx.bookingCode ? `#${tx.bookingCode}` : (tx.billId ? `BILL-${tx.billId.slice(0, 6).toUpperCase()}` : tx.transactionNumber),
    customerName: formatDisplayName(tx.customerName),
    paidAmount: Math.round(tx.finalPaidAmount || tx.totalBillAmount || 0),
    time: formatDisplayTime(tx.createdAt),
    items: Array.isArray(tx.items)
      ? tx.items.map((it) => ({
          fishName: it.fishName || 'Fresh Catch',
          quantityKg: Number(it.quantityKg || 0).toFixed(1),
        }))
      : [],
    createdAt: tx.createdAt,
  };
}

/**
 * Retrieve active business day successful transactions for TV hydration/reconnect
 * @param {object} [options]
 * @param {number} [options.limit=50]
 * @param {string} [options.businessDate]
 * @returns {Promise<Array<object>>}
 */
async function getTodayTVFeed({ limit = 50, businessDate = null } = {}) {
  const transactions = await transactionRepository.getTodaySuccessfulTransactions({
    limit,
    businessDate,
  });

  return transactions.map(normalizeTVPayload);
}

/**
 * Handle committed transaction event and broadcast to TV clients
 * @param {string} transactionId
 */
async function broadcastCommittedTransaction(transactionId) {
  if (!transactionId) return;

  try {
    const tx = await transactionRepository.getTransactionById(transactionId);
    if (!tx || tx.status !== 'COMPLETED') {
      console.warn('[TV FEED ENGINE] Skipped broadcast: Transaction not completed or not found:', transactionId);
      return;
    }

    const tvPayload = normalizeTVPayload(tx);
    realtimeBroadcastEngine.broadcastTransaction(tvPayload);
    console.log(`[TV FEED ENGINE] Broadcast successful transaction: ${tvPayload.transactionNumber} (${tvPayload.billNumber})`);
  } catch (err) {
    console.error('[TV FEED ENGINE ERROR] Failed to broadcast transaction:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Domain Event Listener Registration
// Connects BOOKING_COMPLETED and TRANSACTION_COMPLETED events
// ---------------------------------------------------------------------------

let listenersRegistered = false;

function registerTVDomainEventListeners() {
  if (listenersRegistered) return;

  domainEventsEngine.on('BOOKING_COMPLETED', async (payload) => {
    try {
      if (!payload || !payload.transactionId) return;
      await broadcastCommittedTransaction(payload.transactionId);
    } catch (err) {
      console.warn('[TV FEED ENGINE] BOOKING_COMPLETED handler warning:', err.message);
    }
  });

  domainEventsEngine.on('TRANSACTION_COMPLETED', async (payload) => {
    try {
      if (!payload || !payload.transactionId) return;
      await broadcastCommittedTransaction(payload.transactionId);
    } catch (err) {
      console.warn('[TV FEED ENGINE] TRANSACTION_COMPLETED handler warning:', err.message);
    }
  });

  listenersRegistered = true;
  console.log('[TV FEED ENGINE] Domain event listeners registered for: BOOKING_COMPLETED, TRANSACTION_COMPLETED');
}

// Automatically register listeners on module load
registerTVDomainEventListeners();

module.exports = {
  name: 'TVFeedEngine',
  getTodayTVFeed,
  broadcastCommittedTransaction,
  normalizeTVPayload,
  formatDisplayName,
  formatDisplayTime,
  registerTVDomainEventListeners,
};
