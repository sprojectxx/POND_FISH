/**
 * Engine 11: Payment & Gateway Boundary Engine
 * Traceability: PondFish Core Business Engines Spec (Section 19) & API Spec (Sections 28, 29, 30)
 * Server-authoritative fee calculation (2% gateway + 18% GST),
 * and transparent Razorpay boundary adapter. Zero fake payments.
 */

const crypto = require('crypto');

const GATEWAY_FEE_PERCENT = 2.0; // 2%
const GST_PERCENT_ON_FEE = 18.0; // 18% on fee

/**
 * Calculates authoritative gateway surcharge and final payable amount
 * @param {number} baseAmount
 * @returns {object}
 */
function calculatePaymentFees(baseAmount) {
  const base = Math.max(0, parseFloat((baseAmount || 0).toFixed(2)));

  if (base === 0) {
    return {
      basePayable: 0,
      gatewayFee: 0,
      feeGst: 0,
      totalFee: 0,
      finalPayable: 0,
    };
  }

  const gatewayFee = parseFloat(((base * GATEWAY_FEE_PERCENT) / 100).toFixed(2));
  const feeGst = parseFloat(((gatewayFee * GST_PERCENT_ON_FEE) / 100).toFixed(2));
  const totalFee = parseFloat((gatewayFee + feeGst).toFixed(2));
  const finalPayable = parseFloat((base + totalFee).toFixed(2));

  return {
    basePayable: base,
    gatewayFeeRate: GATEWAY_FEE_PERCENT,
    gatewayFee,
    gstRate: GST_PERCENT_ON_FEE,
    feeGst,
    totalFee,
    finalPayable,
  };
}

/**
 * Check if real Razorpay credentials are configured in the environment
 * @returns {boolean}
 */
function isRazorpayConfigured() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return Boolean(keyId && keySecret && !keyId.includes('YOUR_') && !keySecret.includes('YOUR_'));
}

/**
 * Create a real Razorpay Order or return boundary state if unconfigured
 * @param {object} params - { amount, currency, receipt, notes }
 * @returns {Promise<object>}
 */
async function createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  const amountInPaise = Math.round(amount * 100);

  if (!isRazorpayConfigured()) {
    return {
      success: false,
      configured: false,
      code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      message: 'Genuine Razorpay credentials are not configured on this server environment.',
      amount,
      currency,
      receipt,
    };
  }

  // Real Razorpay API call using HTTP Basic Auth
  const authHeader = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency,
      receipt,
      notes,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error?.description || 'Razorpay order creation failed');
    err.code = data.error?.code || 'RAZORPAY_ORDER_FAILED';
    err.details = data.error;
    throw err;
  }

  return {
    success: true,
    configured: true,
    orderId: data.id,
    amount: data.amount,
    currency: data.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
}

/**
 * Verify Razorpay payment signature
 * @param {object} params - { orderId, paymentId, signature }
 * @returns {boolean}
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!isRazorpayConfigured()) {
    return false;
  }

  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return generatedSignature === signature;
}

/**
 * Fetch a Razorpay order from the official API to verify details and amount
 * @param {string} orderId
 * @returns {Promise<object|null>}
 */
async function getRazorpayOrder(orderId) {
  if (!isRazorpayConfigured() || !orderId) {
    return null;
  }

  const authHeader = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');

  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${authHeader}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

module.exports = {
  name: 'PaymentEngine',
  calculatePaymentFees,
  isRazorpayConfigured,
  createRazorpayOrder,
  verifyPaymentSignature,
  getRazorpayOrder,
};
