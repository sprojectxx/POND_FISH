/**
 * Engine 13: In-Store POS Checkout & Financial Ledger Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Sections 18, 33),
 *               API Specification v1 (Sections 33, 80), Master PRD v2 (Sections 6, 11)
 * 
 * Responsibilities:
 * 1. Atomically finalize physical store purchase transactions.
 * 2. Enforce duplicate bill protection under row lock (FOR UPDATE).
 * 3. Atomic deduction of physical counter inventory (inventory_ledger SALE).
 * 4. Atomic deduction of subscription credit (subscription_credit_ledger DEBIT_BILL).
 * 5. Atomic recording of weekly quantity usage (subscription_usage_ledger BILL_USAGE).
 * 6. Update bill status to PROCESSED.
 * 7. Emit TRANSACTION_COMPLETED domain event for real-time TV broadcast.
 * 8. Customer transaction notification dispatch.
 */

const { withTransaction } = require('../db/pool');
const billRepository = require('../db/repositories/billRepository');
const transactionRepository = require('../db/repositories/transactionRepository');
const inventoryRepository = require('../db/repositories/inventoryRepository');
const subscriptionRepository = require('../db/repositories/subscriptionRepository');
const fishRepository = require('../db/repositories/fishRepository');
const { calculateSubscriptionCoverage } = require('./customer-subscription');
const { calculatePaymentFees, verifyPaymentSignature, isRazorpayConfigured } = require('./payment');
const domainEventsEngine = require('./domain-events');
const { sendNotificationToCustomer } = require('./notifications');

/**
 * Execute atomic finalization of a physical in-store purchase
 * @param {object} params
 * @param {string} params.billId
 * @param {string} params.customerId
 * @param {string} [params.workerId]
 * @param {string} [params.paymentMethod] - 'RAZORPAY' | 'SUBSCRIPTION_ONLY'
 * @param {string} [params.razorpayPaymentId]
 * @param {string} [params.razorpayOrderId]
 * @param {string} [params.razorpaySignature]
 * @param {Array<object>} [params.items] - Optional customer/worker confirmed items
 * @returns {Promise<object>} Authoritative transaction record
 */
async function finalizePhysicalPurchaseAtomic({
  billId,
  customerId,
  workerId = null,
  paymentMethod = 'RAZORPAY',
  razorpayPaymentId = null,
  razorpayOrderId = null,
  razorpaySignature = null,
  items = [],
}) {
  if (!billId || !customerId) {
    throw new Error('billId and customerId are required for physical purchase finalization.');
  }

  // Execute within atomic PostgreSQL transaction
  const finalizedTransaction = await withTransaction(async (client) => {
    // 1. Lock bill row with FOR UPDATE
    const billLockSql = `
      SELECT * FROM bills
      WHERE id = $1
      FOR UPDATE;
    `;
    const billLockRes = await client.query(billLockSql, [billId]);
    if (billLockRes.rows.length === 0) {
      const err = new Error('Bill record not found.');
      err.code = 'BILL_NOT_FOUND';
      throw err;
    }

    const bill = billLockRes.rows[0];

    // Authorize customer ownership (or worker operation)
    if (bill.customer_id !== customerId && !workerId) {
      const err = new Error('Unauthorized to finalize this bill.');
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (bill.status === 'PROCESSED') {
      const err = new Error('This bill has already been processed successfully.');
      err.code = 'BILL_ALREADY_PROCESSED';
      throw err;
    }

    const effectiveBillNumber = bill.manual_bill_id || bill.bill_number;
    if (!effectiveBillNumber) {
      const err = new Error('A valid Bill ID is required before checkout. Please enter the Bill ID.');
      err.code = 'BILL_NUMBER_MISSING';
      throw err;
    }

    // 2. Duplicate bill check
    const isDuplicate = await billRepository.isBillNumberAlreadyProcessed(effectiveBillNumber, billId, client);
    if (isDuplicate) {
      const err = new Error('This bill has already been processed successfully.');
      err.code = 'BILL_ALREADY_PROCESSED';
      throw err;
    }

    // 3. Resolve fish cuts against catalog
    let resolvedItems = [];
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const fish = await fishRepository.getFishById(it.fishId || it.fish_id, client);
        if (fish) {
          const qty = parseFloat(it.quantityKg || it.quantity || 1.0);
          const unitPrice = parseFloat(fish.unit_price ?? fish.unitPrice ?? 0);
          resolvedItems.push({
            fishId: fish.id,
            fishName: fish.name,
            quantity: qty,
            quantityKg: qty,
            unitPrice,
            subtotal: parseFloat((qty * unitPrice).toFixed(2)),
          });
        }
      }
    }

    // Fallback: If no items passed, fetch standard catalog fish
    if (resolvedItems.length === 0) {
      const allFish = await fishRepository.getAllFish({ availabilityOnly: false }, client);
      if (allFish.length > 0) {
        const sample = allFish[0];
        const samplePrice = parseFloat(sample.unit_price ?? sample.unitPrice ?? 0);
        resolvedItems.push({
          fishId: sample.id,
          fishName: sample.name,
          quantity: 1.0,
          quantityKg: 1.0,
          unitPrice: samplePrice,
          subtotal: samplePrice,
        });
      }
    }

    const grossTotal = resolvedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);

    // 4. Server-authoritative subscription coverage recalculation
    const subResult = await calculateSubscriptionCoverage({
      customerId,
      cartItems: resolvedItems,
    });

    const extraPayable = subResult.extraPayableAmount || 0;
    const fees = calculatePaymentFees(extraPayable);
    const finalAmount = fees.finalPayable;

    // 5. Payment Validation
    let authoritativePaymentMethod = 'RAZORPAY';
    if (finalAmount === 0) {
      authoritativePaymentMethod = 'SUBSCRIPTION_ONLY';
    } else {
      if (paymentMethod === 'CASH' && workerId) {
        authoritativePaymentMethod = 'CASH';
      } else {
        authoritativePaymentMethod = 'RAZORPAY';
      }

      // If Razorpay configured and signature provided, verify signature
      if (
        authoritativePaymentMethod === 'RAZORPAY' &&
        isRazorpayConfigured() &&
        razorpayOrderId &&
        razorpayPaymentId &&
        razorpaySignature
      ) {
        const isValidSignature = verifyPaymentSignature({
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          signature: razorpaySignature,
        });
        if (!isValidSignature) {
          const err = new Error('Invalid Razorpay payment signature.');
          err.code = 'INVALID_PAYMENT_SIGNATURE';
          throw err;
        }
      }
    }

    // 6. Deduct Physical Counter Inventory (SALE in inventory_ledger)
    for (const item of resolvedItems) {
      await inventoryRepository.deductPhysicalInventoryAtomic(client, {
        fishId: item.fishId,
        quantityKg: item.quantityKg,
        billNumber: effectiveBillNumber,
        transactionNumber: null, // Will use reference_id
      });
    }

    // 7. Atomic Transaction & Line Items Record
    const transaction = await transactionRepository.createPhysicalTransactionAtomic(client, {
      billId: bill.id,
      customerId,
      workerId,
      totalBillAmount: parseFloat(grossTotal.toFixed(2)),
      subQtyCoveredKg: subResult.coveredQuantityKg,
      subCreditUsed: subResult.subCreditUsed,
      extraAmountPayable: extraPayable,
      razorpayGatewayFee: fees.gatewayFee,
      gstOnFee: fees.feeGst,
      finalPaidAmount: finalAmount,
      paymentMethod: authoritativePaymentMethod,
      status: 'COMPLETED',
      items: resolvedItems,
    });

    // 8. Deduct Subscription Credit & Record Usage (if applicable)
    if (subResult.hasActiveSubscription && subResult.subscription?.subscriptionId) {
      const subId = subResult.subscription.subscriptionId;

      if (subResult.subCreditUsed > 0) {
        await subscriptionRepository.recordBillCreditDeduction(client, {
          subscriptionId: subId,
          transactionId: transaction.id,
          amount: subResult.subCreditUsed,
        });
      }

      // Record weekly usage for each covered item
      for (const item of subResult.itemBreakdown || []) {
        if (item.coveredQty > 0) {
          await subscriptionRepository.recordBillWeeklyUsage(client, {
            subscriptionId: subId,
            fishId: item.fishId,
            quantityKg: item.coveredQty,
          });
        }
      }
    }

    // 9. Update Bill Status to PROCESSED
    await billRepository.updateBillStatus(client, bill.id, 'PROCESSED');

    return {
      ...transaction,
      billNumber: effectiveBillNumber,
      billImageUrl: bill.image_url,
      subscriptionCoverage: subResult,
      fees,
    };
  });

  // 10. Post-commit side effects: Domain Events & Realtime Notifications
  try {
    domainEventsEngine.emit('TRANSACTION_COMPLETED', {
      transactionId: finalizedTransaction.id,
      billNumber: finalizedTransaction.billNumber,
      billId,
      customerId,
      finalPaidAmount: finalizedTransaction.final_paid_amount || finalizedTransaction.finalPaidAmount,
      timestamp: new Date().toISOString(),
    });
  } catch (eventErr) {
    console.warn('[POS FINALIZATION] TV broadcast event warning:', eventErr.message);
  }

  try {
    await sendNotificationToCustomer({
      customerId,
      title: 'Counter Purchase Successful',
      message: `Your transaction of ₹${finalizedTransaction.final_paid_amount || finalizedTransaction.finalPaidAmount} for Bill ${finalizedTransaction.billNumber} has been completed.`,
      type: 'BOOKING',
      data: {
        transactionId: finalizedTransaction.id,
        billId,
      },
    });
  } catch (notifErr) {
    console.warn('[POS FINALIZATION] Customer notification warning:', notifErr.message);
  }

  return finalizedTransaction;
}

module.exports = {
  name: 'POSFinalizationEngine',
  finalizePhysicalPurchaseAtomic,
};
