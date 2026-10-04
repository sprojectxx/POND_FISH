/**
 * Available Subscription Plans Endpoint
 * GET /api/v1/customer/subscription/plans
 * Traceability: PondFish API Spec (Section 17) & Core Engines Spec (Section 5)
 * Returns active subscription plans available for purchase.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { getActivePlans } = require('../../../../../../lib/engines/subscription-plan');

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
    authenticateRequest(request);
    const plans = await getActivePlans();

    return NextResponse.json({
      success: true,
      data: plans,
      count: plans.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required to view subscription plans.',
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
            message: 'Only customer accounts are authorized to access subscription plans.',
          },
        },
        { status: 403 }
      );
    }

    console.error('[API ERROR] GET /api/v1/customer/subscription/plans:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while loading subscription plans.',
        },
      },
      { status: 500 }
    );
  }
}
