/**
 * Razorpay Order Creation Endpoint
 * POST /api/v1/payments/razorpay/orders
 * Traceability: PondFish API Spec (Section 29) & Core Engines Spec (Section 19)
 * Server-authoritative order creation with transparent credentials boundary.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { createRazorpayOrder, isRazorpayConfigured } = require('../../../../../../lib/engines/payment');
const { previewCheckout } = require('../../../../../../lib/engines/booking');

export const dynamic = 'force-dynamic';

function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('MISSING_BEARER_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const token = authHeader.substring(7).trim();
  try {
    return verifySessionToken(token);
  } catch {
    const err = new Error('INVALID_SESSION_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
}

export async function POST(request) {
  try {
    const session = authenticateRequest(request);
    const body = await request.json().catch(() => ({}));
    const billId = body?.billId || body?.bill_id;

    let authoritativeAmount = 0;
    const notes = { customerId: session.customerId };

    if (billId) {
      // Physical Bill Purchase (Slice 10)
      const { calculatePhysicalBillPreview } = require('../../../../../../lib/engines/billing-correction');
      const preview = await calculatePhysicalBillPreview({
        billId,
        customerId: session.customerId,
        items: body?.items || [],
      });
      authoritativeAmount = preview.payment.finalPayable;
      notes.billId = billId;
      notes.billNumber = preview.billNumber;
    } else {
      // Online Cart Booking (Slice 4)
      const preview = await previewCheckout(session.customerId);
      authoritativeAmount = preview.summary.finalPayableAmount;
    }

    if (authoritativeAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_PAYMENT_REQUIRED',
            message: 'Your order is fully covered by your active subscription. No online payment is required.',
          },
        },
        { status: 400 }
      );
    }

    if (!isRazorpayConfigured()) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          error: {
            code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
            message: 'Genuine Razorpay credentials are not configured in this server environment. Payment cannot be processed.',
            amount: authoritativeAmount,
          },
        },
        { status: 503 }
      );
    }

    const order = await createRazorpayOrder({
      amount: authoritativeAmount,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes,
    });

    return NextResponse.json({
      success: true,
      data: order,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required.',
          },
        },
        { status: 401 }
      );
    }

    if (error.code === 'EMPTY_CART') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMPTY_CART',
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    console.error('[API ERROR] POST /api/v1/payments/razorpay/orders:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RAZORPAY_ORDER_FAILED',
          message: error.message || 'Unable to create payment order at this time.',
        },
      },
      { status: 500 }
    );
  }
}
