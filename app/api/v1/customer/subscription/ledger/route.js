/**
 * Customer Subscription Credit Ledger Endpoint
 * GET /api/v1/customer/subscription/ledger
 * Traceability: PondFish API Spec (Section 17) & Core Engines Spec (Section 7)
 * Retrieves historical credit movements (PURCHASE, DEBIT_BOOKING, DEBIT_BILL, CREDIT_REFUND)
 * with strict customer isolation.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { getCustomerLedger } = require('../../../../../../lib/engines/subscription-ledger');

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
    const { searchParams } = new URL(request.url);

    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const { entries, total } = await getCustomerLedger({
      customerId: session.customerId,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: entries,
      count: total,
      limit,
      offset,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required to view subscription ledger.',
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
            message: 'Only customer accounts are authorized to access this ledger.',
          },
        },
        { status: 403 }
      );
    }

    console.error('[API ERROR] GET /api/v1/customer/subscription/ledger:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while loading credit ledger.',
        },
      },
      { status: 500 }
    );
  }
}
