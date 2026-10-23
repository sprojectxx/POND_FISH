/**
 * Pure In-Memory Unit Test Suite for Phase 2: Checkout & Payment Integrity
 * ZERO real database connections, ZERO live payment credentials or network requests.
 * Directly exercises production engines, repositories, and routes:
 * 1. Fail-closed Razorpay order verification in customerSubscriptionEngine & bookingEngine
 * 2. Subscription payment idempotency, cross-customer rejection, identifier consistency in subscriptionRepository
 * 3. Booking cancellation and expiry restoring subscription credits without marking gateway payments REFUNDED
 * 4. Actual POS payment/order reuse prevention in posFinalizationEngine
 * 5. Checkout-intent persistence failure handling in razorpay orders route
 */

const assert = require('assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const pg = require('pg');

const paymentEngine = require('../../lib/engines/payment');
const customerSubscriptionEngine = require('../../lib/engines/customer-subscription');
const subscriptionRepository = require('../../lib/db/repositories/subscriptionRepository');
const bookingEngine = require('../../lib/engines/booking');
const bookingExpiryEngine = require('../../lib/engines/booking-expiry');
const posFinalizationEngine = require('../../lib/engines/pos-finalization');
const checkoutIntentRepository = require('../../lib/db/repositories/checkoutIntentRepository');
const fishRepository = require('../../lib/db/repositories/fishRepository');
const customerRepository = require('../../lib/db/repositories/customerRepository');
const customerEngine = require('../../lib/engines/customer');

// Dynamic route loader adhering to repository conventions (admin-route-authorization & post-ui-integration-audit)
function loadRoute(relPath) {
  const fullPath = path.resolve(__dirname, relPath);
  let code = fs.readFileSync(fullPath, 'utf8');

  code = code.replace(/import\s*\{\s*NextResponse\s*\}\s*from\s*['"]next\/server(\.js)?['"];?/g, 'const { NextResponse } = require("next/server");');
  code = code.replace(/import\s*\{\s*([a-zA-Z0-9_,\s]+)\s*\}\s*from\s*['"]([^'"]+)['"];?/g, 'const { $1 } = require("$2");');
  code = code.replace(/export\s+const\s+dynamic\s*=\s*['"][^'"]+['"];?/g, '');
  code = code.replace(/export\s+async\s+function\s+([a-zA-Z0-9_]+)/g, 'exports.$1 = async function $1');

  const m = { exports: {} };
  const customRequire = (specifier) => {
    if (specifier === 'next/server' || specifier === 'next/server.js') {
      return {
        NextResponse: {
          json: (data, init = {}) => ({
            status: init.status || 200,
            json: async () => data,
            headers: new Map(Object.entries(init.headers || {})),
          }),
        },
      };
    }
    if (specifier.startsWith('.')) {
      return require(path.resolve(path.dirname(fullPath), specifier));
    }
    return require(specifier);
  };

  const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', code);
  fn(customRequire, m, m.exports, fullPath, path.dirname(fullPath));
  return m.exports;
}

const { POST: ordersPost } = loadRoute('../../app/api/v1/payments/razorpay/orders/route.js');

// Helper to install mock pg client for withTransaction and pool.connect/query calls
function withMockPgClient(clientQueryHandler, testFn) {
  const origConnect = pg.Pool.prototype.connect;
  const origQuery = pg.Pool.prototype.query;
  const mockClient = {
    query: clientQueryHandler,
    release: () => {},
  };
  pg.Pool.prototype.connect = async function() {
    return mockClient;
  };
  pg.Pool.prototype.query = async function(...args) {
    return clientQueryHandler(...args);
  };

  const origDbUrl = process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock_db';
  }

  return Promise.resolve()
    .then(() => testFn(mockClient))
    .finally(() => {
      pg.Pool.prototype.connect = origConnect;
      pg.Pool.prototype.query = origQuery;
      if (origDbUrl !== undefined) process.env.DATABASE_URL = origDbUrl;
      else delete process.env.DATABASE_URL;
    });
}

test('Phase 2 Payment & Checkout Integrity Suite', async (t) => {

  // -------------------------------------------------------------------------
  // 1. Fail-Closed Razorpay Order Verification (Production Engines)
  // -------------------------------------------------------------------------
  await t.test('1.1 verifyAndActivateSubscription rejects when Razorpay order lookup fails', async () => {
    const origConfigured = paymentEngine.isRazorpayConfigured;
    const origVerifySig = paymentEngine.verifyPaymentSignature;
    const origGetOrder = paymentEngine.getRazorpayOrder;
    const origFindPlan = subscriptionRepository.findPlanById;

    try {
      paymentEngine.isRazorpayConfigured = () => true;
      paymentEngine.verifyPaymentSignature = () => true;
      paymentEngine.getRazorpayOrder = async () => null; // Gateway returns null / 404
      subscriptionRepository.findPlanById = async () => ({
        id: 'plan-gold-1',
        title: 'Weekly Gold',
        price: '500.00',
        credit_amount: '500.00',
        active: true,
      });

      await assert.rejects(
        async () => {
          await customerSubscriptionEngine.verifyAndActivateSubscription({
            customerId: 'cust-uuid-1',
            planId: 'plan-gold-1',
            razorpayOrderId: 'order_lookup_fail_123',
            razorpayPaymentId: 'pay_123',
            razorpaySignature: 'valid_sig',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_ORDER_NOT_FOUND');
          return true;
        }
      );
    } finally {
      paymentEngine.isRazorpayConfigured = origConfigured;
      paymentEngine.verifyPaymentSignature = origVerifySig;
      paymentEngine.getRazorpayOrder = origGetOrder;
      subscriptionRepository.findPlanById = origFindPlan;
    }
  });

  await t.test('1.2 verifyAndActivateSubscription rejects when order currency is missing or not INR', async () => {
    const origConfigured = paymentEngine.isRazorpayConfigured;
    const origVerifySig = paymentEngine.verifyPaymentSignature;
    const origGetOrder = paymentEngine.getRazorpayOrder;
    const origFindPlan = subscriptionRepository.findPlanById;

    try {
      paymentEngine.isRazorpayConfigured = () => true;
      paymentEngine.verifyPaymentSignature = () => true;
      subscriptionRepository.findPlanById = async () => ({
        id: 'plan-gold-1',
        title: 'Weekly Gold',
        price: '500.00',
        active: true,
      });

      // Case A: Missing currency
      paymentEngine.getRazorpayOrder = async () => ({
        id: 'order_curr_123',
        amount: 50000,
        currency: null,
      });

      await assert.rejects(
        async () => {
          await customerSubscriptionEngine.verifyAndActivateSubscription({
            customerId: 'cust-uuid-1',
            planId: 'plan-gold-1',
            razorpayOrderId: 'order_curr_123',
            razorpayPaymentId: 'pay_123',
            razorpaySignature: 'valid_sig',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_CURRENCY_MISMATCH');
          return true;
        }
      );

      // Case B: Foreign currency (USD)
      paymentEngine.getRazorpayOrder = async () => ({
        id: 'order_curr_123',
        amount: 50000,
        currency: 'USD',
      });

      await assert.rejects(
        async () => {
          await customerSubscriptionEngine.verifyAndActivateSubscription({
            customerId: 'cust-uuid-1',
            planId: 'plan-gold-1',
            razorpayOrderId: 'order_curr_123',
            razorpayPaymentId: 'pay_123',
            razorpaySignature: 'valid_sig',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_CURRENCY_MISMATCH');
          return true;
        }
      );
    } finally {
      paymentEngine.isRazorpayConfigured = origConfigured;
      paymentEngine.verifyPaymentSignature = origVerifySig;
      paymentEngine.getRazorpayOrder = origGetOrder;
      subscriptionRepository.findPlanById = origFindPlan;
    }
  });

  await t.test('1.3 verifyAndActivateSubscription rejects mismatched order ID or order amount', async () => {
    const origConfigured = paymentEngine.isRazorpayConfigured;
    const origVerifySig = paymentEngine.verifyPaymentSignature;
    const origGetOrder = paymentEngine.getRazorpayOrder;
    const origFindPlan = subscriptionRepository.findPlanById;

    try {
      paymentEngine.isRazorpayConfigured = () => true;
      paymentEngine.verifyPaymentSignature = () => true;
      subscriptionRepository.findPlanById = async () => ({
        id: 'plan-gold-1',
        title: 'Weekly Gold',
        price: '500.00',
        active: true,
      });

      // Case A: Mismatched Order ID
      paymentEngine.getRazorpayOrder = async () => ({
        id: 'order_different_999',
        amount: 50000,
        currency: 'INR',
      });

      await assert.rejects(
        async () => {
          await customerSubscriptionEngine.verifyAndActivateSubscription({
            customerId: 'cust-uuid-1',
            planId: 'plan-gold-1',
            razorpayOrderId: 'order_expected_111',
            razorpayPaymentId: 'pay_123',
            razorpaySignature: 'valid_sig',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_ORDER_ID_MISMATCH');
          return true;
        }
      );

      // Case B: Amount mismatch (underpayment)
      paymentEngine.getRazorpayOrder = async () => ({
        id: 'order_expected_111',
        amount: 30000, // 300 INR vs 500 INR plan
        currency: 'INR',
      });

      await assert.rejects(
        async () => {
          await customerSubscriptionEngine.verifyAndActivateSubscription({
            customerId: 'cust-uuid-1',
            planId: 'plan-gold-1',
            razorpayOrderId: 'order_expected_111',
            razorpayPaymentId: 'pay_123',
            razorpaySignature: 'valid_sig',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_AMOUNT_MISMATCH');
          return true;
        }
      );
    } finally {
      paymentEngine.isRazorpayConfigured = origConfigured;
      paymentEngine.verifyPaymentSignature = origVerifySig;
      paymentEngine.getRazorpayOrder = origGetOrder;
      subscriptionRepository.findPlanById = origFindPlan;
    }
  });

  await t.test('1.4 createBooking enforces fail-closed Razorpay order verification', async () => {
    const origConfigured = paymentEngine.isRazorpayConfigured;
    const origVerifySig = paymentEngine.verifyPaymentSignature;
    const origGetOrder = paymentEngine.getRazorpayOrder;
    const origFindFish = fishRepository.findFishById;
    const origBlocked = customerRepository.getBlockedCustomerIds;

    try {
      paymentEngine.isRazorpayConfigured = () => true;
      paymentEngine.verifyPaymentSignature = () => true;
      paymentEngine.getRazorpayOrder = async () => null; // Gateway lookup fails
      customerRepository.getBlockedCustomerIds = async () => new Set();
      fishRepository.findFishById = async () => ({
        id: 'fish-1',
        name: 'Rohu',
        physical_available: true,
        online_bookable: true,
      });

      const fakeCartSnapshot = {
        items: [{ fishId: 'fish-1', name: 'Rohu', quantityKg: 1, unitPrice: 200, effectivePrice: 200, subtotal: 200 }],
        summary: { totalCartAmount: 200, subscriptionCreditUsed: 0, basePayableAmount: 200, finalPayableAmount: 204.72 },
        subscriptionCoverage: { extraPayableAmount: 200, coveredQuantityKg: 0, subCreditUsed: 0 },
        feeCalc: { finalPayable: 204.72 },
      };

      await withMockPgClient(async (sql, params) => {
        return { rows: [] };
      }, async () => {
        await assert.rejects(
          async () => {
            await bookingEngine.createBooking({
              customerId: 'cust-uuid-1',
              checkoutSnapshot: fakeCartSnapshot,
              paymentVerification: {
                razorpayOrderId: 'order_booking_fail_1',
                razorpayPaymentId: 'pay_booking_fail_1',
                razorpaySignature: 'sig_1',
              },
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'PAYMENT_ORDER_NOT_FOUND');
            return true;
          }
        );
      });
    } finally {
      paymentEngine.isRazorpayConfigured = origConfigured;
      paymentEngine.verifyPaymentSignature = origVerifySig;
      paymentEngine.getRazorpayOrder = origGetOrder;
      fishRepository.findFishById = origFindFish;
      customerRepository.getBlockedCustomerIds = origBlocked;
    }
  });

// Projects rows strictly according to the SELECT columns in sql to catch omitted query columns
function projectColumns(sql, row) {
  if (!row) return row;
  const match = sql.match(/SELECT\s+(.*?)\s+FROM/is);
  if (!match) return { ...row };
  const rawCols = match[1].split(',');
  const colNames = rawCols.map(c => {
    const trimmed = c.trim();
    const asMatch = trimmed.match(/\s+AS\s+([a-zA-Z0-9_]+)/i);
    if (asMatch) return asMatch[1];
    const dotParts = trimmed.split('.');
    return dotParts[dotParts.length - 1].trim();
  });
  if (colNames.includes('*')) return { ...row };
  const projected = {};
  for (const col of colNames) {
    if (col in row) {
      projected[col] = row[col];
    }
  }
  return projected;
}

  // -------------------------------------------------------------------------
  // 2. Subscription Idempotency, Replay & Constraint Protection
  // -------------------------------------------------------------------------
  await t.test('2.1 activateOrRenewSubscription rejects conflicting records matching order/payment', async () => {
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: 'plan-1', active: true, price: '500.00', credit_amount: '500.00', validity_days: 30 }] };
      }
      if (sql.includes('FROM payments')) {
        // Return 2 distinct conflicting records
        return {
          rows: [
            { id: 'pay-1', razorpay_payment_id: 'pay_conflict_1', razorpay_order_id: 'order_conflict_A', amount: 500, status: 'SUCCESS' },
            { id: 'pay-2', razorpay_payment_id: 'pay_conflict_2', razorpay_order_id: 'order_conflict_B', amount: 500, status: 'SUCCESS' },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await subscriptionRepository.activateOrRenewSubscription({
            customerId: 'cust-1',
            planId: 'plan-1',
            razorpayOrderId: 'order_conflict_B',
            razorpayPaymentId: 'pay_conflict_1',
            razorpaySignature: 'sig',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_IDENTIFIER_CONFLICT');
          return true;
        }
      );
    });
  });

  await t.test('2.2 activateOrRenewSubscription rejects identifier mismatch on stored payment', async () => {
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: 'plan-1', active: true, price: '500.00', credit_amount: '500.00', validity_days: 30 }] };
      }
      if (sql.includes('FROM payments')) {
        // Record has order_1 but payment_old
        return {
          rows: [
            { id: 'pay-1', razorpay_payment_id: 'pay_old', razorpay_order_id: 'order_1', amount: 500, status: 'SUCCESS', booking_id: null, transaction_id: null },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await subscriptionRepository.activateOrRenewSubscription({
            customerId: 'cust-1',
            planId: 'plan-1',
            razorpayOrderId: 'order_1',
            razorpayPaymentId: 'pay_different',
            razorpaySignature: 'sig',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_IDENTIFIER_MISMATCH');
          return true;
        }
      );
    });
  });

  await t.test('2.3 activateOrRenewSubscription rejects stored payment with non-SUCCESS status', async () => {
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: 'plan-1', active: true, price: '500.00', credit_amount: '500.00', validity_days: 30 }] };
      }
      if (sql.includes('FROM payments')) {
        return {
          rows: [
            { id: 'pay-1', razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', amount: 500, status: 'FAILED', booking_id: null, transaction_id: null },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await subscriptionRepository.activateOrRenewSubscription({
            customerId: 'cust-1',
            planId: 'plan-1',
            razorpayOrderId: 'order_1',
            razorpayPaymentId: 'pay_1',
            razorpaySignature: 'sig',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_NOT_SETTLED');
          return true;
        }
      );
    });
  });

  await t.test('2.4 activateOrRenewSubscription safe replay returns linked subscription with zero duplicate writes', async () => {
    const executedWrites = [];
    const now = new Date();

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('INSERT') || sql.includes('UPDATE')) {
        executedWrites.push(sql);
      }
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: 'plan-1', active: true, price: '500.00', credit_amount: '500.00', validity_days: 30 }] };
      }
      if (sql.includes('FROM payments')) {
        const stored = { id: 'pay-1', razorpay_payment_id: 'pay_same_1', razorpay_order_id: 'order_same_1', amount: 500, status: 'SUCCESS', subscription_id: 'sub-same-1', booking_id: null, transaction_id: null, created_at: now };
        return { rows: [projectColumns(sql, stored)] };
      }
      if (sql.includes('FROM customer_subscriptions')) {
        return {
          rows: [
            { id: 'sub-same-1', customer_id: 'cust-legit', plan_id: 'plan-1', credit_balance: 500, status: 'ACTIVE', ledger_id: 'ledg-same-1', ledger_amount: 500, ledger_resulting_balance: 500 },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      const result = await subscriptionRepository.activateOrRenewSubscription({
        customerId: 'cust-legit',
        planId: 'plan-1',
        razorpayOrderId: 'order_same_1',
        razorpayPaymentId: 'pay_same_1',
        razorpaySignature: 'sig',
      });

      assert.strictEqual(result.idempotentReplay, true);
      assert.strictEqual(result.subscription.id, 'sub-same-1');
      assert.strictEqual(result.subscription.customer_id, 'cust-legit');
      assert.strictEqual(result.payment.id, 'pay-1');
      assert.strictEqual(result.payment.subscription_id, 'sub-same-1');

      // Zero writes to customer_subscriptions or subscription_credit_ledger
      const subWrites = executedWrites.filter(s => s.includes('customer_subscriptions') || s.includes('subscription_credit_ledger'));
      assert.strictEqual(subWrites.length, 0, 'Replay must not write any subscription or ledger updates');
    });
  });

  await t.test('2.5 activateOrRenewSubscription rejects cross-customer payment replay', async () => {
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: 'plan-1', active: true, price: '500.00', credit_amount: '500.00', validity_days: 30 }] };
      }
      if (sql.includes('FROM payments')) {
        const stored = { id: 'pay-1', razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', amount: 500, status: 'SUCCESS', subscription_id: 'sub-victim-1', booking_id: null, transaction_id: null, created_at: new Date() };
        return { rows: [projectColumns(sql, stored)] };
      }
      if (sql.includes('FROM customer_subscriptions')) {
        // Linked subscription belongs to cust-VICTIM, not cust-ATTACKER
        return {
          rows: [
            { id: 'sub-victim-1', customer_id: 'cust-VICTIM', plan_id: 'plan-1', credit_balance: 500, ledger_id: 'ledg-1', ledger_amount: 500, ledger_resulting_balance: 500 },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await subscriptionRepository.activateOrRenewSubscription({
            customerId: 'cust-ATTACKER',
            planId: 'plan-1',
            razorpayOrderId: 'order_1',
            razorpayPaymentId: 'pay_1',
            razorpaySignature: 'sig',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_CUSTOMER_MISMATCH');
          return true;
        }
      );
    });
  });

  await t.test('2.6 activateOrRenewSubscription rejects plan mismatch on replayed payment', async () => {
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: 'plan-silver', active: true, price: '500.00', credit_amount: '500.00', validity_days: 30 }] };
      }
      if (sql.includes('FROM payments')) {
        const stored = { id: 'pay-1', razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', amount: 500, status: 'SUCCESS', subscription_id: 'sub-gold-1', booking_id: null, transaction_id: null, created_at: new Date() };
        return { rows: [projectColumns(sql, stored)] };
      }
      if (sql.includes('FROM customer_subscriptions')) {
        // Linked subscription was created for plan-gold, not requested plan-silver
        return {
          rows: [
            { id: 'sub-gold-1', customer_id: 'cust-1', plan_id: 'plan-gold', credit_balance: 500, ledger_id: 'ledg-1', ledger_amount: 500, ledger_resulting_balance: 500 },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await subscriptionRepository.activateOrRenewSubscription({
            customerId: 'cust-1',
            planId: 'plan-silver',
            razorpayOrderId: 'order_1',
            razorpayPaymentId: 'pay_1',
            razorpaySignature: 'sig',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_PLAN_MISMATCH');
          return true;
        }
      );
    });
  });

  await t.test('2.7 Two purchases of the same plan close together must never cause one payment to resolve to the other purchase', async () => {
    // Payment 2 was created for Sub B. It must strictly resolve to Sub B, never falling back to Sub A
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: 'plan-gold', active: true, price: '500.00', credit_amount: '500.00', validity_days: 30 }] };
      }
      if (sql.includes('FROM payments')) {
        const stored = {
          id: 'pay-purchase-2',
          razorpay_payment_id: 'pay_rzp_2',
          razorpay_order_id: 'order_rzp_2',
          amount: 500,
          status: 'SUCCESS',
          subscription_id: 'sub-purchase-2', // Deterministically linked to Sub B
          booking_id: null,
          transaction_id: null,
          created_at: new Date(),
        };
        return { rows: [projectColumns(sql, stored)] };
      }
      if (sql.includes('FROM customer_subscriptions')) {
        // Query must be by specific subscription ID, returning Sub B
        if (params && params[0] === 'sub-purchase-2') {
          return {
            rows: [
              { id: 'sub-purchase-2', customer_id: 'cust-1', plan_id: 'plan-gold', credit_balance: 1000, ledger_id: 'ledg-2', ledger_amount: 500, ledger_resulting_balance: 1000 },
            ],
          };
        }
        return { rows: [] };
      }
      return { rows: [] };
    }, async () => {
      const result = await subscriptionRepository.activateOrRenewSubscription({
        customerId: 'cust-1',
        planId: 'plan-gold',
        razorpayOrderId: 'order_rzp_2',
        razorpayPaymentId: 'pay_rzp_2',
        razorpaySignature: 'sig_2',
      });

      assert.strictEqual(result.idempotentReplay, true);
      assert.strictEqual(result.subscription.id, 'sub-purchase-2', 'Must resolve to the exact purchase 2 subscription');
      assert.notStrictEqual(result.subscription.id, 'sub-purchase-1', 'Must never resolve to purchase 1');
    });
  });

  await t.test('2.8 A replay with no provable payment-to-subscription relationship must fail closed', async () => {
    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: 'plan-1', active: true, price: '500.00', credit_amount: '500.00', validity_days: 30 }] };
      }
      if (sql.includes('FROM payments')) {
        const stored = {
          id: 'pay-unprovable',
          razorpay_payment_id: 'pay_unprovable_1',
          razorpay_order_id: 'order_unprovable_1',
          amount: 500,
          status: 'SUCCESS',
          subscription_id: null,
          booking_id: null,
          transaction_id: null,
          created_at: new Date(),
        };
        return { rows: [projectColumns(sql, stored)] };
      }
      return { rows: [] };
    }, async () => {
      await assert.rejects(
        async () => {
          await subscriptionRepository.activateOrRenewSubscription({
            customerId: 'cust-1',
            planId: 'plan-1',
            razorpayOrderId: 'order_unprovable_1',
            razorpayPaymentId: 'pay_unprovable_1',
            razorpaySignature: 'sig',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'PAYMENT_SUBSCRIPTION_UNPROVABLE');
          return true;
        }
      );
    });
  });

  await t.test('2.9 Query projection: safe replay retrieves subscription_id from DB via SELECT projection and resolves subscription', async () => {
    const dbStoredPayment = {
      id: 'pay-db-1',
      transaction_id: null,
      booking_id: null,
      razorpay_order_id: 'order_proj_1',
      razorpay_payment_id: 'pay_proj_1',
      amount: 500,
      method: 'RAZORPAY',
      status: 'SUCCESS',
      subscription_id: 'sub-db-1', // Present in DB table, and retrieved by SELECT query
      created_at: new Date(),
    };

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: 'plan-1', active: true, price: '500.00', credit_amount: '500.00', validity_days: 30 }] };
      }
      if (sql.includes('FROM payments')) {
        // Enforce actual query shape: project only columns present in the SQL SELECT clause
        const projected = projectColumns(sql, dbStoredPayment);
        // Assert that subscription_id was selected by the production SQL query
        assert.strictEqual(projected.subscription_id, 'sub-db-1', 'SELECT query must project subscription_id');
        return { rows: [projected] };
      }
      if (sql.includes('FROM customer_subscriptions')) {
        return {
          rows: [
            { id: 'sub-db-1', customer_id: 'cust-1', plan_id: 'plan-1', credit_balance: 500, ledger_id: 'ledg-1', ledger_amount: 500, ledger_resulting_balance: 500 },
          ],
        };
      }
      return { rows: [] };
    }, async () => {
      const result = await subscriptionRepository.activateOrRenewSubscription({
        customerId: 'cust-1',
        planId: 'plan-1',
        razorpayOrderId: 'order_proj_1',
        razorpayPaymentId: 'pay_proj_1',
        razorpaySignature: 'sig',
      });

      assert.strictEqual(result.idempotentReplay, true);
      assert.strictEqual(result.subscription.id, 'sub-db-1');
      assert.strictEqual(result.payment.subscription_id, 'sub-db-1');
    });
  });

  await t.test('2.10 activateOrRenewSubscription atomically records subscription_id on payments table during purchase', async () => {
    let recordedPaymentRow = null;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: 'plan-1', active: true, price: '500.00', credit_amount: '500.00', validity_days: 30 }] };
      }
      if (sql.includes('FROM payments')) {
        // No existing payment on first purchase
        return { rows: [] };
      }
      if (sql.includes('FROM customer_subscriptions')) {
        // No active subscription, creating first time
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO customer_subscriptions')) {
        return {
          rows: [
            { id: 'sub-brand-new-123', customer_id: 'cust-1', plan_id: 'plan-1', credit_balance: 500, status: 'ACTIVE', created_at: new Date() },
          ],
        };
      }
      if (sql.includes('INSERT INTO subscription_credit_ledger')) {
        return {
          rows: [
            { id: 'ledg-1', subscription_id: 'sub-brand-new-123', type: 'PURCHASE', amount: 500, resulting_balance: 500 },
          ],
        };
      }
      if (sql.includes('INSERT INTO payments')) {
        // Check params: $1 must be subscription.id
        assert.strictEqual(params[0], 'sub-brand-new-123', 'First parameter of payments insert must be subscription.id');
        assert.strictEqual(params[1], 'order_new_1');
        assert.strictEqual(params[2], 'pay_new_1');
        recordedPaymentRow = {
          id: 'pay-new-1',
          subscription_id: params[0],
          razorpay_order_id: params[1],
          razorpay_payment_id: params[2],
          amount: params[4],
          status: 'SUCCESS',
        };
        return { rows: [recordedPaymentRow] };
      }
      return { rows: [] };
    }, async () => {
      const result = await subscriptionRepository.activateOrRenewSubscription({
        customerId: 'cust-1',
        planId: 'plan-1',
        razorpayOrderId: 'order_new_1',
        razorpayPaymentId: 'pay_new_1',
        razorpaySignature: 'sig',
      });

      assert.strictEqual(result.subscription.id, 'sub-brand-new-123');
      assert.strictEqual(result.payment.subscription_id, 'sub-brand-new-123');
      assert.strictEqual(recordedPaymentRow.subscription_id, 'sub-brand-new-123');
    });
  });

  await t.test('2.11 adminPurchaseSubscriptionAtomic atomically records subscription_id on payments table', async () => {
    let recordedPaymentRow = null;

    await withMockPgClient(async (sql, params) => {
      if (sql.includes('FROM subscription_plans')) {
        return { rows: [{ id: 'plan-1', active: true, price: '500.00', credit_amount: '500.00', validity_days: 30 }] };
      }
      if (sql.includes('FROM customer_subscriptions')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO customer_subscriptions')) {
        return {
          rows: [
            { id: 'sub-admin-cash-456', customer_id: 'cust-1', plan_id: 'plan-1', credit_balance: 500, status: 'ACTIVE', created_at: new Date() },
          ],
        };
      }
      if (sql.includes('INSERT INTO subscription_credit_ledger')) {
        return {
          rows: [
            { id: 'ledg-admin-1', subscription_id: 'sub-admin-cash-456', type: 'PURCHASE', amount: 500, resulting_balance: 500 },
          ],
        };
      }
      if (sql.includes('INSERT INTO payments')) {
        assert.strictEqual(params[0], 'sub-admin-cash-456', 'First parameter of admin payments insert must be subscription.id');
        assert.ok(params[1].startsWith('CASH_ADMIN_'), 'Admin cash order must have authoritative CASH_ADMIN identifier');
        recordedPaymentRow = {
          id: 'pay-admin-cash-1',
          subscription_id: params[0],
          razorpay_order_id: params[1],
          amount: params[4],
          method: params[5],
          status: 'SUCCESS',
        };
        return { rows: [recordedPaymentRow] };
      }
      return { rows: [] };
    }, async () => {
      const result = await subscriptionRepository.adminPurchaseSubscriptionAtomic({
        customerId: 'cust-1',
        planId: 'plan-1',
        paymentMethod: 'CASH',
        adminId: 'admin-1',
      });

      assert.strictEqual(result.subscription.id, 'sub-admin-cash-456');
      assert.strictEqual(result.payment.subscription_id, 'sub-admin-cash-456');
      assert.strictEqual(recordedPaymentRow.subscription_id, 'sub-admin-cash-456');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Keep Gateway Refunds Separate from Internal Credit Restoration
  // -------------------------------------------------------------------------
  await t.test('3.1 cancelBooking restores internal credit without marking gateway payments REFUNDED', async () => {
    const executedSql = [];

    await withMockPgClient(async (sql, params) => {
      executedSql.push(sql);
      if (sql.includes('SELECT * FROM bookings')) {
        return {
          rows: [{
            id: 'booking-uuid-1',
            customer_id: 'cust-1',
            status: 'CONFIRMED',
            booking_code: 'BK-100',
            sub_credit_used: 100,
            razorpay_paid: 300,
          }],
        };
      }
      if (sql.includes('SELECT * FROM booking_items')) {
        return { rows: [] };
      }
      if (sql.includes('customer_subscriptions')) {
        return { rows: [{ id: 'sub-1', credit_balance: 200, status: 'ACTIVE' }] };
      }
      if (sql.includes('UPDATE bookings')) {
        return { rows: [{ id: 'booking-uuid-1', status: 'CANCELLED' }] };
      }
      return { rows: [] };
    }, async () => {
      const result = await bookingEngine.cancelBooking({
        customerId: 'cust-1',
        bookingId: 'booking-uuid-1',
      });

      assert.strictEqual(result.status, 'CANCELLED');

      // Critical Invariant: payments table must NEVER be updated to REFUNDED
      const paymentRefundSql = executedSql.find(s => s.includes('UPDATE payments') && s.includes('REFUNDED'));
      assert.strictEqual(paymentRefundSql, undefined, 'cancelBooking must NOT alter payment status to REFUNDED');

      // Internal credit restoration was executed
      const creditRestoreSql = executedSql.find(s => s.includes('subscription_credit_ledger'));
      assert.ok(creditRestoreSql, 'Internal credit restoration was recorded in subscription_credit_ledger');
    });
  });

  await t.test('3.2 expireBooking restores internal credit without marking gateway payments REFUNDED', async () => {
    const executedSql = [];

    await withMockPgClient(async (sql, params) => {
      executedSql.push(sql);
      if (sql.includes('SELECT * FROM bookings')) {
        return {
          rows: [{
            id: 'booking-uuid-2',
            customer_id: 'cust-1',
            status: 'CREATED',
            booking_code: 'BK-200',
            sub_credit_used: 50,
            razorpay_paid: 200,
            expires_at: new Date(Date.now() - 3600000), // Expired 1 hr ago
          }],
        };
      }
      if (sql.includes('SELECT * FROM booking_items')) {
        return { rows: [] };
      }
      if (sql.includes('customer_subscriptions')) {
        return { rows: [{ id: 'sub-1', credit_balance: 150, status: 'ACTIVE' }] };
      }
      if (sql.includes('UPDATE bookings')) {
        return { rows: [{ id: 'booking-uuid-2', status: 'EXPIRED' }] };
      }
      return { rows: [] };
    }, async () => {
      const result = await bookingExpiryEngine.expireBooking('booking-uuid-2', { force: true });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.booking.status, 'EXPIRED');

      const paymentRefundSql = executedSql.find(s => s.includes('UPDATE payments') && s.includes('REFUNDED'));
      assert.strictEqual(paymentRefundSql, undefined, 'expireBooking must NOT alter payment status to REFUNDED');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Actual POS Payment / Order Reuse Prevention (Production Function)
  // -------------------------------------------------------------------------
  await t.test('4.1 finalizePhysicalPurchaseAtomic rejects reused Razorpay payment ID or order ID', async () => {
    const origConfigured = paymentEngine.isRazorpayConfigured;
    const origVerifySig = paymentEngine.verifyPaymentSignature;
    const origGetOrder = paymentEngine.getRazorpayOrder;

    try {
      paymentEngine.isRazorpayConfigured = () => true;
      paymentEngine.verifyPaymentSignature = () => true;
      paymentEngine.getRazorpayOrder = async (id) => ({
        id,
        amount: 25590, // 250 INR + 2% + 18% GST = 255.90 INR = 25590 paise
        currency: 'INR',
      });

      await withMockPgClient(async (sql, params) => {
        if (sql.includes('SELECT * FROM bills')) {
          return {
            rows: [{
              id: 'bill-123',
              customer_id: 'cust-pos-1',
              manual_bill_id: 'BILL-999',
              status: 'CAPTURED',
              extracted_text: null,
            }],
          };
        }
        if (sql.includes('bills b') || sql.includes('transactions t')) {
          return { rows: [] };
        }
        if (sql.includes('fish')) {
          return {
            rows: [{
              id: 'fish-1',
              name: 'Rohu',
              unit_price: 250,
              physical_available: true,
              online_bookable: true,
            }],
          };
        }
        if (sql.includes('FROM payments')) {
          // Stored payment match detected
          return { rows: [{ id: 'existing-payment-uuid' }] };
        }
        return { rows: [] };
      }, async () => {
        await assert.rejects(
          async () => {
            await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
              billId: 'bill-123',
              customerId: 'cust-pos-1',
              paymentMethod: 'RAZORPAY',
              razorpayOrderId: 'order_reused_123',
              razorpayPaymentId: 'pay_reused_123',
              razorpaySignature: 'sig_valid',
              items: [{ fishId: 'fish-1', quantity: 1, unitPrice: 250, subtotal: 250 }],
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'PAYMENT_ALREADY_USED');
            return true;
          }
        );
      });
    } finally {
      paymentEngine.isRazorpayConfigured = origConfigured;
      paymentEngine.verifyPaymentSignature = origVerifySig;
      paymentEngine.getRazorpayOrder = origGetOrder;
    }
  });

  await t.test('4.2 finalizePhysicalPurchaseAtomic rejects 1-paise discrepancy under exact matching', async () => {
    const origConfigured = paymentEngine.isRazorpayConfigured;
    const origVerifySig = paymentEngine.verifyPaymentSignature;
    const origGetOrder = paymentEngine.getRazorpayOrder;

    try {
      paymentEngine.isRazorpayConfigured = () => true;
      paymentEngine.verifyPaymentSignature = () => true;
      // Expected paise for 250 INR + fee + GST is 25590. Here gateway has 25591 (1 paise off)
      paymentEngine.getRazorpayOrder = async (id) => ({
        id,
        amount: 25591,
        currency: 'INR',
      });

      await withMockPgClient(async (sql, params) => {
        if (sql.includes('SELECT * FROM bills')) {
          return {
            rows: [{
              id: 'bill-exact-1',
              customer_id: 'cust-pos-1',
              manual_bill_id: 'BILL-1001',
              status: 'CAPTURED',
              extracted_text: null,
            }],
          };
        }
        if (sql.includes('bills b') || sql.includes('transactions t')) {
          return { rows: [] };
        }
        if (sql.includes('fish')) {
          return {
            rows: [{
              id: 'fish-1',
              name: 'Rohu',
              unit_price: 250,
              physical_available: true,
              online_bookable: true,
            }],
          };
        }
        return { rows: [] };
      }, async () => {
        await assert.rejects(
          async () => {
            await posFinalizationEngine.finalizePhysicalPurchaseAtomic({
              billId: 'bill-exact-1',
              customerId: 'cust-pos-1',
              paymentMethod: 'RAZORPAY',
              razorpayOrderId: 'order_exact_mismatch',
              razorpayPaymentId: 'pay_exact_mismatch',
              razorpaySignature: 'sig_valid',
              items: [{ fishId: 'fish-1', quantity: 1, unitPrice: 250, subtotal: 250 }],
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'PAYMENT_AMOUNT_MISMATCH');
            return true;
          }
        );
      });
    } finally {
      paymentEngine.isRazorpayConfigured = origConfigured;
      paymentEngine.verifyPaymentSignature = origVerifySig;
      paymentEngine.getRazorpayOrder = origGetOrder;
    }
  });

  // -------------------------------------------------------------------------
  // 5. Checkout-Intent Persistence Failure Handling
  // -------------------------------------------------------------------------
  await t.test('5.1 Razorpay orders route fails closed with 500 when intent persistence fails', async () => {
    const origCreateOrder = paymentEngine.createRazorpayOrder;
    const origConfigured = paymentEngine.isRazorpayConfigured;
    const origCreateIntent = checkoutIntentRepository.createIntent;

    try {
      paymentEngine.isRazorpayConfigured = () => true;
      paymentEngine.createRazorpayOrder = async () => ({
        success: true,
        configured: true,
        orderId: 'order_intent_err_1',
        amount: 50000,
        currency: 'INR',
      });

      // Simulate failure in checkout intent persistence
      checkoutIntentRepository.createIntent = async () => {
        const err = new Error('Database connection closed abruptly');
        err.code = 'DB_ERROR';
        throw err;
      };

      const token = customerEngine.generateSessionToken({ id: 'cust-intent-fail-1', mobile_number: '+919999999999' });

      const headersMap = new Map([
        ['authorization', `Bearer ${token}`],
        ['content-type', 'application/json'],
      ]);
      const mockRequest = {
        headers: {
          get: (k) => headersMap.get(k.toLowerCase()),
        },
        json: async () => ({
          billId: null,
        }),
      };

      // Mock previewCheckout to return valid payable amount
      const origPreview = bookingEngine.previewCheckout;
      bookingEngine.previewCheckout = async () => ({
        items: [{ fishId: 'fish-1', quantityKg: 1, unitPrice: 500, effectivePrice: 500, subtotal: 500 }],
        summary: { totalCartAmount: 500, finalPayableAmount: 511.80 },
        subscription: null,
      });

      try {
        const response = await ordersPost(mockRequest);
        const data = await response.json();

        assert.strictEqual(response.status, 500);
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.error.code, 'CHECKOUT_INTENT_PERSISTENCE_FAILED');
      } finally {
        bookingEngine.previewCheckout = origPreview;
      }
    } finally {
      paymentEngine.createRazorpayOrder = origCreateOrder;
      paymentEngine.isRazorpayConfigured = origConfigured;
      checkoutIntentRepository.createIntent = origCreateIntent;
    }
  });

  await t.test('5.2 Razorpay orders route rejects missing or empty order ID with 502', async () => {
    const origCreateOrder = paymentEngine.createRazorpayOrder;
    const origConfigured = paymentEngine.isRazorpayConfigured;

    try {
      paymentEngine.isRazorpayConfigured = () => true;
      paymentEngine.createRazorpayOrder = async () => ({
        success: true,
        configured: true,
        orderId: null, // Gateway returned null order ID
        amount: 50000,
        currency: 'INR',
      });

      const token = customerEngine.generateSessionToken({ id: 'cust-no-orderid-1', mobile_number: '+919999999999' });

      const headersMap = new Map([
        ['authorization', `Bearer ${token}`],
        ['content-type', 'application/json'],
      ]);
      const mockRequest = {
        headers: {
          get: (k) => headersMap.get(k.toLowerCase()),
        },
        json: async () => ({
          billId: null,
        }),
      };

      const origPreview = bookingEngine.previewCheckout;
      bookingEngine.previewCheckout = async () => ({
        items: [{ fishId: 'fish-1', quantityKg: 1, unitPrice: 500, effectivePrice: 500, subtotal: 500 }],
        summary: { totalCartAmount: 500, finalPayableAmount: 511.80 },
        subscription: null,
      });

      try {
        const response = await ordersPost(mockRequest);
        const data = await response.json();

        assert.strictEqual(response.status, 502);
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.error.code, 'RAZORPAY_ORDER_CREATION_FAILED');
      } finally {
        bookingEngine.previewCheckout = origPreview;
      }
    } finally {
      paymentEngine.createRazorpayOrder = origCreateOrder;
      paymentEngine.isRazorpayConfigured = origConfigured;
    }
  });

});

