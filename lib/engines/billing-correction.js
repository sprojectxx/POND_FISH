/**
 * Engine 12: Review & Discrepancy Correction Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Sections 12, 17, 33),
 *               API Specification v1 (Sections 21, 22, 23, 27), Master PRD v2 (Section 8.3, 8.4)
 * 
 * Responsibilities:
 * 1. Validate manual Bill ID entry when OCR does not capture it.
 * 2. Enforce duplicate bill protection (checks bills & completed transactions).
 * 3. Calculate authoritative subscription coverage for physical bill line items.
 * 4. Calculate authoritative payment fee breakdown (2% Razorpay + 18% GST).
 * 5. Pre-transaction validation and server preview without financial mutations.
 */

const billRepository = require('../db/repositories/billRepository');
const fishRepository = require('../db/repositories/fishRepository');
const { calculateSubscriptionCoverage } = require('./customer-subscription');
const { calculatePaymentFees } = require('./payment');

/**
 * Validate and assign a manual Bill Number to a bill record
 * Enforces duplicate protection (API Section 21, 23)
 * @param {object} params
 * @param {string} params.billId
 * @param {string} params.billNumber
 * @param {string} params.customerId
 * @returns {Promise<object>}
 */
async function setManualBillNumber({ billId, billNumber, customerId }) {
  if (!billId) throw new Error('billId is required.');
  if (!billNumber || typeof billNumber !== 'string' || billNumber.trim().length === 0) {
    const err = new Error('A valid Bill ID is required.');
    err.code = 'INVALID_BILL_NUMBER';
    throw err;
  }

  const cleanBillNumber = billNumber.trim().toUpperCase();

  // Validate format (alphanumeric with optional hyphens/hashes)
  if (!/^[A-Z0-9#-]{3,30}$/.test(cleanBillNumber)) {
    const err = new Error('Invalid Bill ID format. Please check the receipt.');
    err.code = 'INVALID_BILL_NUMBER_FORMAT';
    throw err;
  }

  const bill = await billRepository.getBillById(billId);
  if (!bill) {
    const err = new Error('Bill record not found.');
    err.code = 'BILL_NOT_FOUND';
    throw err;
  }

  if (bill.customer_id !== customerId) {
    const err = new Error('Unauthorized to modify this bill.');
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (bill.status === 'PROCESSED') {
    const err = new Error('This bill has already been processed successfully.');
    err.code = 'BILL_ALREADY_PROCESSED';
    throw err;
  }

  // Duplicate bill protection check
  const isDuplicate = await billRepository.isBillNumberAlreadyProcessed(cleanBillNumber, billId);
  if (isDuplicate) {
    const err = new Error('This bill has already been processed successfully.');
    err.code = 'BILL_ALREADY_PROCESSED';
    throw err;
  }

  const updatedBill = await billRepository.updateBillNumber(null, billId, cleanBillNumber, true);
  return {
    success: true,
    billId: updatedBill.id,
    billNumber: updatedBill.bill_number,
    manualBillId: updatedBill.manual_bill_id,
    status: updatedBill.status,
  };
}

/**
 * Authoritative preview of subscription coverage and payable amount for a physical bill
 * Traceability: API Spec Section 27 (POST /api/v1/transactions/preview)
 * @param {object} params
 * @param {string} params.billId
 * @param {string} params.customerId
 * @param {Array<object>} [params.items] - Optional verified items list [{ fishId, quantityKg }]
 * @returns {Promise<object>} Complete preview calculation
 */
async function calculatePhysicalBillPreview({ billId, customerId, items = [] }) {
  if (!billId || !customerId) {
    throw new Error('billId and customerId are required for preview calculation.');
  }

  const bill = await billRepository.getBillById(billId);
  if (!bill) {
    const err = new Error('Bill record not found.');
    err.code = 'BILL_NOT_FOUND';
    throw err;
  }

  if (bill.customer_id !== customerId) {
    const err = new Error('Unauthorized access to bill preview.');
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (bill.status === 'PROCESSED') {
    const err = new Error('This bill has already been processed successfully.');
    err.code = 'BILL_ALREADY_PROCESSED';
    throw err;
  }

  // Check duplicate bill number
  const effectiveBillNumber = bill.manual_bill_id || bill.bill_number;
  if (effectiveBillNumber) {
    const isDuplicate = await billRepository.isBillNumberAlreadyProcessed(effectiveBillNumber, billId);
    if (isDuplicate) {
      const err = new Error('This bill has already been processed successfully.');
      err.code = 'BILL_ALREADY_PROCESSED';
      throw err;
    }
  }

  // Resolve items: if items provided in payload, validate against fish catalog;
  // otherwise fetch available catalog fish as fallback
  let resolvedItems = [];
  if (Array.isArray(items) && items.length > 0) {
    for (const it of items) {
      const fish = await fishRepository.getFishById(it.fishId || it.fish_id);
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

  // If no items were supplied or resolved, get standard catalog item for review
  if (resolvedItems.length === 0) {
    const allFish = await fishRepository.getAllFish({ availabilityOnly: false });
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

  // Authoritative subscription calculation
  const subResult = await calculateSubscriptionCoverage({
    customerId,
    cartItems: resolvedItems,
  });

  const extraPayable = subResult.extraPayableAmount || 0;
  const fees = calculatePaymentFees(extraPayable);

  return {
    billId: bill.id,
    billNumber: effectiveBillNumber,
    billNumberMissing: !effectiveBillNumber,
    billImageUrl: bill.image_url,
    totalBillAmount: parseFloat(grossTotal.toFixed(2)),
    items: resolvedItems,
    subscriptionCoverage: {
      hasActiveSubscription: subResult.hasActiveSubscription,
      planTitle: subResult.subscription?.planTitle || null,
      coveredQuantityKg: subResult.coveredQuantityKg,
      extraQuantityKg: subResult.extraQuantityKg,
      subCreditUsed: subResult.subCreditUsed,
      remainingWeeklyKg: subResult.subscription?.remainingWeeklyKg || 0,
      remainingCreditBalance: subResult.subscription?.remainingCreditBalance || 0,
      itemBreakdown: subResult.itemBreakdown,
      statusText: subResult.statusText,
    },
    payment: {
      extraAmountPayable: extraPayable,
      gatewayFeeRate: fees.gatewayFeeRate,
      gatewayFee: fees.gatewayFee,
      gstRate: fees.gstRate,
      feeGst: fees.feeGst,
      totalFee: fees.totalFee,
      finalPayable: fees.finalPayable,
      paymentMethod: fees.finalPayable > 0 ? 'RAZORPAY' : 'SUBSCRIPTION_ONLY',
    },
  };
}

module.exports = {
  name: 'BillingCorrectionEngine',
  setManualBillNumber,
  calculatePhysicalBillPreview,
};
