/**
 * Customer Subscription Payment Verification & Activation Endpoint
 * POST /api/v1/customer/subscription/verify
 * Traceability: PondFish API Spec (Section 17), Payment Spec (Section 19), Core Engines Spec (Section 12)
 * Verifies Razorpay HMAC signature and performs atomic PostgreSQL subscription activation.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { verifyAndActivateSubscription } = require('../../../../../../lib/engines/customer-subscription');

export const dynamic = 'force-dynamic';

function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('MISSING_BEARER_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const token = authHeader.substring(7).trim();
  let session;
  try {
    session = verifySessionToken(token);
  } catch {
    const err = new Error('INVALID_SESSION_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  if (session.role !== 'CUSTOMER') {
    const err = new Error('FORBIDDEN_ROLE');
    err.code = 'FORBIDDEN';
    throw err;
  }

  return session;
}

export async function POST(request) {
  try {
    const session = authenticateRequest(request);

    let body = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON_BODY',
            message: 'Request body must be a valid JSON object.',
          },
        },
        { status: 400 }
      );
    }

    const { planId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

    if (!planId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PAYMENT_IDENTIFIERS',
            message: 'planId, razorpayOrderId, razorpayPaymentId, and razorpaySignature are required.',
          },
        },
        { status: 400 }
      );
    }

    // Verify HMAC-SHA256 signature and atomically activate or recharge subscription
    const result = await verifyAndActivateSubscription({
      customerId: session.customerId,
      planId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    return NextResponse.json({
      success: true,
      data: {
        subscription: result.subscription,
        ledger: result.ledgerEntry,
        payment: result.payment,
        plan: result.plan,
      },
      message: 'Subscription successfully activated.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required to verify subscription payment.',
          },
        },
        { status: 401 }
      );
    }

    if (error.code === 'FORBIDDEN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only customer accounts are authorized to activate subscriptions.',
          },
        },
        { status: 403 }
      );
    }

    if (error.code === 'INVALID_PAYMENT_SIGNATURE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PAYMENT_SIGNATURE',
            message: 'Payment verification failed: invalid HMAC-SHA256 signature. Zero database mutations occurred.',
          },
        },
        { status: 400 }
      );
    }

    if (error.code === 'PLAN_NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PLAN_NOT_FOUND',
            message: 'The requested subscription plan does not exist.',
          },
        },
        { status: 404 }
      );
    }

    if (error.code === 'PLAN_INACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PLAN_INACTIVE',
            message: 'The requested subscription plan is inactive.',
          },
        },
        { status: 400 }
      );
    }

    console.error('[API ERROR] POST /api/v1/customer/subscription/verify:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'SUBSCRIPTION_VERIFICATION_FAILED',
          message: error.message || 'An unexpected error occurred during subscription activation.',
        },
      },
      { status: 500 }
    );
  }
}
