/**
 * Customer Subscription Status Endpoint
 * GET /api/v1/customer/subscription
 * Traceability: PondFish API Spec (Section 17) & Core Engines Spec (Section 12)
 * Retrieves authenticated customer's current active subscription, credit balance, and weekly limit.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../lib/engines/customer');
const { getCustomerSubscription } = require('../../../../../lib/engines/customer-subscription');

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

export async function GET(request) {
  try {
    const session = authenticateRequest(request);
    const subState = await getCustomerSubscription(session.customerId);

    return NextResponse.json({
      success: true,
      data: subState,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required to view subscription state.',
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
            message: 'Only customer accounts are authorized to access this subscription resource.',
          },
        },
        { status: 403 }
      );
    }

    console.error('[API ERROR] GET /api/v1/customer/subscription:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while loading subscription.',
        },
      },
      { status: 500 }
    );
  }
}
