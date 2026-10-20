/**
 * Customer Subscription Purchase Intent Endpoint
 * POST /api/v1/customer/subscription/purchase
 * Traceability: PondFish API Spec (Section 17) & Payment Engine Spec (Section 19)
 * Server-controlled plan pricing and Razorpay order creation.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { initiateSubscriptionPurchase } = require('../../../../../../lib/engines/customer-subscription');

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

    const { planId } = body;
    if (!planId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PLAN_ID',
            message: 'planId is required to initiate a subscription purchase.',
          },
        },
        { status: 400 }
      );
    }

    // Purchase intent with server-authoritative pricing (ignores client-sent prices)
    const result = await initiateSubscriptionPurchase({
      customerId: session.customerId,
      planId,
    });

    if (result.order && result.order.configured === false) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.order.code || 'PAYMENT_GATEWAY_NOT_CONFIGURED',
            message: result.order.message || 'Payment gateway credentials are not configured.',
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: result.order.orderId,
        amount: result.feeBreakdown.finalPayable,
        amountPaise: result.order.amount,
        currency: result.order.currency,
        keyId: result.order.keyId,
        plan: result.plan,
        feeBreakdown: result.feeBreakdown,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required to purchase a subscription.',
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
            message: 'Only customer accounts are authorized to purchase subscriptions.',
          },
        },
        { status: 403 }
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
            message: 'The selected subscription plan is currently inactive.',
          },
        },
        { status: 400 }
      );
    }

    console.error('[API ERROR] POST /api/v1/customer/subscription/purchase:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'SUBSCRIPTION_PURCHASE_FAILED',
          message: error.message || 'An unexpected error occurred during subscription purchase intent.',
        },
      },
      { status: 500 }
    );
  }
}
