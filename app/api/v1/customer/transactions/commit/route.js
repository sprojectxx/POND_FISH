/**
 * Physical Store Purchase Transaction Commit API
 * POST /api/v1/customer/transactions/commit
 * Traceability: PondFish API Specification v1 (Sections 33, 80),
 *               Core Business Engines Specification v1 (Sections 18, 33), Master PRD v2 (Sections 6, 11)
 * 
 * Server-authoritative atomic finalization of a physical in-store purchase.
 * Enforces:
 * 1. Concurrency-safe row locking (SELECT ... FOR UPDATE on bills)
 * 2. Duplicate bill protection
 * 3. Physical counter inventory deduction (inventory_ledger SALE)
 * 4. Subscription credit deduction (subscription_credit_ledger DEBIT_BILL)
 * 5. Weekly quantity allowance deduction (subscription_usage_ledger BILL_USAGE)
 * 6. Transaction & items persistence
 * 7. Realtime broadcast to Shop TV Display Portal via WebSocket
 * 8. Customer transaction notification dispatch
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { finalizePhysicalPurchaseAtomic } = require('../../../../../../lib/engines/pos-finalization');

export const dynamic = 'force-dynamic';

function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('A valid customer session is required.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const token = authHeader.substring(7).trim();
  let session;
  try {
    session = verifySessionToken(token);
  } catch {
    const err = new Error('Invalid or expired authentication session.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (session.role !== 'CUSTOMER') {
    const err = new Error('Forbidden: Only customers can access this endpoint.');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return session;
}

export async function POST(request) {
  try {
    const session = authenticateRequest(request);
    const body = await request.json().catch(() => ({}));

    const billId = body?.bill_id || body?.scan_id || body?.billId;
    if (!billId) {
      return NextResponse.json(
        { success: false, error: { code: 'BILL_ID_REQUIRED', message: 'Bill ID is required to commit transaction.' } },
        { status: 400 }
      );
    }

    const transaction = await finalizePhysicalPurchaseAtomic({
      billId,
      customerId: session.customerId,
      paymentMethod: body?.payment_method || body?.paymentMethod || 'RAZORPAY',
      razorpayPaymentId: body?.razorpay_payment_id || body?.razorpayPaymentId || null,
      razorpayOrderId: body?.razorpay_order_id || body?.razorpayOrderId || null,
      razorpaySignature: body?.razorpay_signature || body?.razorpaySignature || null,
      items: body?.items || [],
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          transaction_id: transaction.id,
          transaction_number: transaction.transaction_number || transaction.transactionNumber,
          bill_id: transaction.bill_id || transaction.billId,
          bill_number: transaction.billNumber,
          customer_id: transaction.customer_id || transaction.customerId,
          total_bill_amount: transaction.total_bill_amount || transaction.totalBillAmount,
          sub_qty_covered_kg: transaction.sub_qty_covered_kg || transaction.subQtyCoveredKg,
          sub_credit_used: transaction.sub_credit_used || transaction.subCreditUsed,
          extra_amount_payable: transaction.extra_amount_payable || transaction.extraAmountPayable,
          final_paid_amount: transaction.final_paid_amount || transaction.finalPaidAmount,
          payment_method: transaction.payment_method || transaction.paymentMethod,
          status: transaction.status,
          created_at: transaction.created_at || transaction.createdAt,
          items: transaction.items || [],
        },
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[TRANSACTION COMMIT ERROR]', error);
    let status = 500;
    if (error.code === 'UNAUTHORIZED') status = 401;
    else if (error.code === 'FORBIDDEN') status = 403;
    else if (error.code === 'BILL_NOT_FOUND') status = 404;
    else if (error.code === 'BILL_ALREADY_PROCESSED' || error.code === 'PAYMENT_ALREADY_USED') status = 409;
    else if (error.code === 'PAYMENT_REQUIRED') status = 402;
    else if (error.code === 'PAYMENT_GATEWAY_NOT_CONFIGURED') status = 503;
    else if (
      error.code === 'BILL_NUMBER_MISSING' ||
      error.code === 'INVALID_PAYMENT_SIGNATURE' ||
      error.code === 'PAYMENT_ORDER_NOT_FOUND' ||
      error.code === 'PAYMENT_AMOUNT_MISMATCH'
    ) status = 400;
    else if (error.code === 'INSUFFICIENT_INVENTORY' || error.code === 'INSUFFICIENT_SUBSCRIPTION_CREDIT') status = 409;

    return NextResponse.json(
      { success: false, error: { code: error.code || 'SERVER_ERROR', message: error.message } },
      { status }
    );
  }
}
