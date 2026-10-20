/**
 * Razorpay Webhook Endpoint
 * POST /api/v1/payments/razorpay/webhook
 * Traceability: PondFish API Spec (Section 31), Core Engines Spec (Section 19),
 * and Master PRD v2 (Section 12, 17)
 * Authoritative, idempotent webhook handler for asynchronous payment capture and recovery.
 */

import { NextResponse } from 'next/server';
const { processRazorpayWebhook } = require('../../../../../../lib/engines/payment-recovery');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const signature = request.headers.get('x-razorpay-signature');
    const rawBody = await request.text();

    const result = await processRazorpayWebhook({
      rawBody,
      signature,
    });

    return NextResponse.json(
      {
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    if (
      error.code === 'MISSING_SIGNATURE' ||
      error.code === 'INVALID_SIGNATURE' ||
      error.code === 'MALFORMED_PAYLOAD'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    if (error.code === 'WEBHOOK_SECRET_NOT_CONFIGURED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 503 }
      );
    }

    console.error('[API ERROR] POST /api/v1/payments/razorpay/webhook:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'WEBHOOK_PROCESSING_FAILED',
          message: error.message || 'Webhook processing encountered an unexpected server error.',
        },
      },
      { status: 500 }
    );
  }
}
