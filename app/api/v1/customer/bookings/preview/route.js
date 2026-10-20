/**
 * Customer Checkout Preview Endpoint
 * POST /api/v1/customer/bookings/preview
 * Traceability: PondFish API Spec (Section 27, 37) & Core Engines Spec (Section 13)
 * Server-authoritative checkout calculation from persistent cart.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
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
    const preview = await previewCheckout(session.customerId);

    return NextResponse.json({
      success: true,
      data: preview,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required to preview checkout.',
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

    console.error('[API ERROR] POST /api/v1/customer/bookings/preview:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CHECKOUT_PREVIEW_FAILED',
          message: error.message || 'Unable to calculate checkout preview at this time.',
        },
      },
      { status: 500 }
    );
  }
}
