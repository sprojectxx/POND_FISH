/**
 * Customer Live Delivery Tracking Endpoint
 * GET /api/v1/customer/gps/live
 * Traceability: PondFish Master PRD v2 (Section 22.2, 22.5) & Customer Mobile App Spec (CP-14 / CP-19)
 * 
 * STRICT SECURITY CONSTRAINTS:
 * 1. Customer authentication strictly enforced via PondFish session token.
 * 2. Exposes ONLY journeys where published_to_customer === true AND customer_tracking_closed_at IS NULL.
 * 3. Sanitized customer-safe projection only: never leaks provider credentials, driver mobile, or internal IDs.
 * 4. Automatically halts live delivery tracking once post-arrival window closes.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const gpsTrackingEngine = require('../../../../../../lib/engines/gps-tracking');

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

export async function GET(request) {
  try {
    authenticateCustomer(request);

    const liveData = await gpsTrackingEngine.getCustomerLiveTracking();

    return NextResponse.json({
      success: true,
      data: liveData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authenticated customer session required to access live delivery tracking.',
          },
        },
        { status: 401 }
      );
    }

    console.error('[API ERROR] GET /api/v1/customer/gps/live:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CUSTOMER_GPS_UNAVAILABLE',
          message: 'Unable to retrieve live delivery tracking at this time.',
        },
      },
      { status: 500 }
    );
  }
}
