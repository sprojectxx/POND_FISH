/**
 * Razorpay Signature Verification Endpoint
 * POST /api/v1/payments/razorpay/verify
 * Traceability: PondFish API Spec (Section 30) & Core Engines Spec (Section 19)
 * Official server-side HMAC-SHA256 signature verification.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { verifyPaymentSignature, isRazorpayConfigured } = require('../../../../../../lib/engines/payment');

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
    authenticateRequest(request);
    const body = await request.json().catch(() => ({}));
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PAYMENT_DETAILS',
            message: 'razorpayOrderId, razorpayPaymentId, and razorpaySignature are required.',
          },
        },
        { status: 400 }
      );
    }

    if (!isRazorpayConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
            message: 'Genuine Razorpay credentials are not configured in this server environment.',
          },
        },
        { status: 503 }
      );
    }

    const isValid = verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PAYMENT_SIGNATURE',
            message: 'Razorpay payment signature does not match.',
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      message: 'Payment signature verified successfully.',
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

    console.error('[API ERROR] POST /api/v1/payments/razorpay/verify:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PAYMENT_VERIFICATION_ERROR',
          message: error.message || 'Payment verification failed.',
        },
      },
      { status: 500 }
    );
  }
}
