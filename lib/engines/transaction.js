/**
 * Engine 27: Admin Transaction Management Engine
 * Traceability:
 * - PondFish Core Business Engines Spec v1 (Section 21: Refund / Restoration Engine)
 * - PondFish Admin Portal PRD v1 / UI Spec (Sections 106–117: ADMIN-13 Transaction Management)
 * - Master PRD v2 (Sections 18, 33)
 * 
 * Responsibilities:
 * 1. Admin transaction search, multi-faceted filtering, status counts & pagination.
 * 2. Complete transaction investigation details (Customer, Bill, AI extraction, Items, Financial breakdown, Attribution, Audit).
 * 3. Server-authoritative atomic refund/restoration with exclusive row-locking (FOR UPDATE).
 * 4. Atomic restitution of physical inventory (inventory_ledger ADJUSTMENT) and subscription credits (subscription_credit_ledger CREDIT_REFUND).
 * 5. Strict idempotency and rollback safety (zero partial mutations on failure).
 * 6. Immutable audit logging and domain event dispatch.
 */

const { getPool, withTransaction } = require('../db/pool');
const transactionRepository = require('../db/repositories/transactionRepository');
const inventoryRepository = require('../db/repositories/inventoryRepository');
const subscriptionRepository = require('../db/repositories/subscriptionRepository');
const auditEngine = require('./audit');
const domainEventsEngine = require('./domain-events');
const { sendNotificationToCustomer } = require('./notifications');

const VALID_REFUND_REASONS = [
  'Quality discrepancy',
  'Customer return',
  'Billed incorrect fish',
  'Billing error',
  'Operational issue',
  'Other',
];

/**
 * List, search, filter and paginate transactions for admin console
 * @param {object} options
 * @returns {Promise<object>}
 */
async function listAdminTransactions(options = {}) {
  return transactionRepository.listAdminTransactions(options);
}

/**
 * Retrieve full investigation detail for a single transaction
 * @param {string} transactionId
 * @returns {Promise<object>}
 */
async function getAdminTransactionDetail(transactionId) {
  if (!transactionId) {
    const err = new Error('Transaction ID is required.');
    err.code = 'INVALID_PARAMETERS';
    err.status = 400;
    throw err;
  }

  const detail = await transactionRepository.getAdminTransactionDetail(transactionId);
  if (!detail) {
    const err = new Error(`Transaction ${transactionId} not found.`);
    err.code = 'TRANSACTION_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  return detail;
}

/**
 * Atomically refund and restore a completed transaction
 * Enforces exclusive row lock, strict idempotency, inventory restock, credit restoration, and immutable audit.
 * 
 * @param {object} params
 * @param {string} params.transactionId
 * @param {string} params.reason
 * @param {string} [params.notes]
 * @param {object} context
 * @param {string} context.actorId - Authenticated admin ID
 * @param {string} [context.ip] - Admin IP address
 * @returns {Promise<object>}
 */
async function adminRefundTransaction(
  { transactionId, reason, notes = null },
  { actorId = 'admin-system', ip = '127.0.0.1' } = {}
) {
  if (!transactionId) {
    const err = new Error('Transaction ID is required.');
    err.code = 'INVALID_PARAMETERS';
    err.status = 400;
    throw err;
  }

  if (!reason || !reason.trim()) {
    const err = new Error('Refund reason is required.');
    err.code = 'REFUND_REASON_REQUIRED';
    err.status = 400;
    throw err;
  }

  const trimmedReason = reason.trim();
  if (!VALID_REFUND_REASONS.includes(trimmedReason)) {
    const err = new Error(`Invalid refund reason. Allowed reasons: ${VALID_REFUND_REASONS.join(', ')}`);
    err.code = 'INVALID_REFUND_REASON';
    err.status = 400;
    throw err;
  }

  if (trimmedReason === 'Other' && (!notes || notes.trim().length < 3)) {
    const err = new Error('An explanatory note is required when "Other" refund reason is selected.');
    err.code = 'REFUND_NOTES_REQUIRED';
    err.status = 400;
    throw err;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Concurrency-safe exclusive row lock on transactions table
    const lockRes = await client.query(
      `SELECT * FROM transactions WHERE id = $1 FOR UPDATE;`,
      [transactionId]
    );

    if (lockRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Transaction not found.');
      err.code = 'TRANSACTION_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const transaction = lockRes.rows[0];

    // 2. Strict state validation & idempotency checks
    if (transaction.status === 'REFUNDED') {
      await client.query('ROLLBACK');
      const err = new Error('Transaction has already been refunded.');
      err.code = 'TRANSACTION_ALREADY_REFUNDED';
      err.status = 409;
      throw err;
    }

    if (transaction.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      const err = new Error('Cannot refund a cancelled transaction.');
      err.code = 'TRANSACTION_ALREADY_CANCELLED';
      err.status = 409;
      throw err;
    }

    if (transaction.status !== 'COMPLETED') {
      await client.query('ROLLBACK');
      const err = new Error(`Cannot refund transaction in '${transaction.status}' state. Only COMPLETED transactions can be refunded.`);
      err.code = 'TRANSACTION_NOT_ELIGIBLE_FOR_REFUND';
      err.status = 400;
      throw err;
    }

    // 3. Fetch transaction line items
    const itemsRes = await client.query(
      `SELECT * FROM transaction_items WHERE transaction_id = $1;`,
      [transactionId]
    );
    const items = itemsRes.rows;

    // 4. Atomically restore inventory for each line item (change_type = 'ADJUSTMENT')
    const restoredItems = [];
    for (const item of items) {
      const parsedQty = parseFloat(item.quantity_kg) || 0;
      if (parsedQty > 0) {
        // Lock inventory row
        const invLock = await client.query(
          `SELECT id, available_quantity, physical_quantity FROM inventory WHERE fish_id = $1 FOR UPDATE;`,
          [item.fish_id]
        );

        if (invLock.rows.length > 0) {
          const invCurrent = invLock.rows[0];
          const newPhysical = parseFloat((parseFloat(invCurrent.physical_quantity) + parsedQty).toFixed(2));
          const newAvailable = parseFloat((parseFloat(invCurrent.available_quantity) + parsedQty).toFixed(2));

          const invUpdate = await client.query(
            `UPDATE inventory 
             SET physical_quantity = $1, available_quantity = $2, updated_at = NOW() 
             WHERE fish_id = $3 
             RETURNING *;`,
            [newPhysical, newAvailable, item.fish_id]
          );

          // Record immutable adjustment entry in inventory_ledger
          await client.query(
            `INSERT INTO inventory_ledger (
              id, fish_id, batch_id, change_type, quantity_change, resulting_qty, reference_id, created_at
            ) VALUES (
              gen_random_uuid(), $1, NULL, 'ADJUSTMENT', $2, $3, $4, NOW()
            );`,
            [
              item.fish_id,
              parsedQty,
              newAvailable,
              `ADMIN_REFUND: ${transaction.transaction_number}`,
            ]
          );

          restoredItems.push({
            fishId: item.fish_id,
            quantityKg: parsedQty,
            newAvailable,
          });
        }
      }
    }

    // 5. Restore subscription benefits if debited (credits and weekly quantity)
    let creditRestoreResult = null;
    const subCredit = parseFloat(transaction.sub_credit_used) || 0;
    if (subCredit > 0) {
      creditRestoreResult = await subscriptionRepository.restoreCustomerBookingCredits(client, {
        customerId: transaction.customer_id,
        bookingId: transaction.id,
        subCreditUsed: subCredit,
        razorpayPaid: 0, // In-store Razorpay refund is handled through gateway or cash accounting, credit restored
      });
    }

    // 6. Update transaction status to REFUNDED
    const updateTxSql = `
      UPDATE transactions
      SET status = 'REFUNDED'
      WHERE id = $1
      RETURNING *;
    `;
    const updatedTxRes = await client.query(updateTxSql, [transactionId]);
    const updatedTx = updatedTxRes.rows[0];

    // 7. Update associated bill status if present
    if (transaction.bill_id) {
      await client.query(
        `UPDATE bills SET status = 'REJECTED' WHERE id = $1;`,
        [transaction.bill_id]
      );
    }

    // 8. Commit the PostgreSQL transaction atomically
    await client.query('COMMIT');

    // 9. Post-commit side effects: Domain event, Notification, Audit Log
    try {
      domainEventsEngine.emit('TRANSACTION_REFUNDED', {
        transactionId: updatedTx.id,
        transactionNumber: updatedTx.transaction_number,
        customerId: updatedTx.customer_id,
        totalBillAmount: updatedTx.total_bill_amount,
        subCreditRestored: subCredit,
        reason: trimmedReason,
        actorId,
        timestamp: new Date().toISOString(),
      });
    } catch (eventErr) {
      console.warn('[TRANSACTION REFUND DOMAIN EVENT WARNING]', eventErr.message);
    }

    try {
      await sendNotificationToCustomer({
        customerId: updatedTx.customer_id,
        title: 'Transaction Refunded',
        message: `Your transaction ${updatedTx.transaction_number} of ₹${updatedTx.total_bill_amount} has been refunded/restored by administration.${subCredit > 0 ? ` ₹${subCredit} subscription credit has been returned to your wallet.` : ''}`,
        type: 'BOOKING',
        data: {
          transactionId: updatedTx.id,
          transactionNumber: updatedTx.transaction_number,
          status: 'REFUNDED',
        },
      });
    } catch (notifErr) {
      console.warn('[TRANSACTION REFUND NOTIFICATION WARNING]', notifErr.message);
    }

    try {
      await auditEngine.recordAuditLog({
        actorType: 'ADMIN',
        actorId,
        action: 'TRANSACTION_REFUNDED',
        entityType: 'TRANSACTION',
        entityId: updatedTx.id,
        payload: {
          transactionNumber: updatedTx.transaction_number,
          customerId: updatedTx.customer_id,
          billId: updatedTx.bill_id,
          totalBillAmount: updatedTx.total_bill_amount,
          finalPaidAmount: updatedTx.final_paid_amount,
          subCreditRestored: subCredit,
          reason: trimmedReason,
          notes: notes?.trim() || null,
          restoredItems,
          ip,
        },
      });
    } catch (auditErr) {
      console.warn('[TRANSACTION REFUND AUDIT WARNING]', auditErr.message);
    }

    return {
      success: true,
      transaction: updatedTx,
      restoration: {
        restoredItems,
        subCreditRestored: subCredit,
        creditBalanceResult: creditRestoreResult,
        reason: trimmedReason,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[TRANSACTION REFUND ERROR] Failed to refund transaction ${transactionId}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  name: 'TransactionEngine',
  listAdminTransactions,
  getAdminTransactionDetail,
  adminRefundTransaction,
  VALID_REFUND_REASONS,
};
