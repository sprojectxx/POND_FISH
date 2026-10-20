/**
 * Customer GPS Journey Detail Endpoint
 * GET /api/v1/customer/gps/journeys/[id]
 * Traceability: PondFish Master PRD v2 (Section 22.2) & Customer Mobile App Spec (CP-14)
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../../lib/engines/customer');
const gpsTrackingEngine = require('../../../../../../../lib/engines/gps-tracking');

export const dynamic = 'force-dynamic';

function authenticateCustomer(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('MISSING_BEARER_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const token = authHeader.substring(7).trim();
  try {
    const session = verifySessionToken(token);
    if (!session || !session.customerId) {
      const err = new Error('INVALID_SESSION_TOKEN');
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    return session;
  } catch {
    const err = new Error('INVALID_SESSION_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
}

export async function GET(request, { params }) {
  try {
    authenticateCustomer(request);

    const { id } = params;
    const journeyData = await gpsTrackingEngine.getCustomerJourneyById(id);

    return NextResponse.json({
      success: true,
      data: journeyData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authenticated customer session required.',
          },
        },
        { status: 401 }
      );
    }

    if (error.code === 'NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Journey not found.',
          },
        },
        { status: 404 }
      );
    }

    if (error.code === 'FORBIDDEN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'This delivery journey is not published for customer tracking or has concluded.',
          },
        },
        { status: 403 }
      );
    }

    console.error('[API ERROR] GET /api/v1/customer/gps/journeys/[id]:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CUSTOMER_JOURNEY_FAILED',
          message: 'Unable to retrieve journey details.',
        },
      },
      { status: 500 }
    );
  }
}
