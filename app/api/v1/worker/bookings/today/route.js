/**
 * Worker Today's Bookings Queue Endpoint
 * GET /api/v1/worker/bookings/today
 * Traceability: PondFish API Spec (Section 37) & Worker Portal Spec (WP-02, WP-03)
 * Retrieves today's active store bookings queue and status counts.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionToken, getTodayBookingsQueue } = require('../../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

function authenticateWorker(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('MISSING_BEARER_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const token = authHeader.substring(7).trim();
  return verifyWorkerSessionToken(token);
}

export async function GET(request) {
  try {
    authenticateWorker(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || null;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const result = await getTodayBookingsQueue({ status, limit, offset });

    return NextResponse.json({
      success: true,
      data: result.bookings,
      counts: result.counts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: 'Valid worker authorization is required to access the booking queue.',
          },
        },
        { status: error.code === 'FORBIDDEN' ? 403 : 401 }
      );
    }

    console.error('[API ERROR] GET /api/v1/worker/bookings/today:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'QUEUE_FETCH_FAILED',
          message: 'Unable to retrieve today\'s bookings queue at this time.',
        },
      },
      { status: 500 }
    );
  }
}
