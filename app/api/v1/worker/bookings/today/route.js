/**
 * Worker Today's Bookings Queue Endpoint
 * GET /api/v1/worker/bookings/today
 * Traceability: PondFish API Spec (Section 37) & Worker Portal Spec (WP-02, WP-03)
 * Retrieves today's active store bookings queue and status counts.
 */

import { NextResponse } from 'next/server';
const { authenticateWorkerAsync, getTodayBookingsQueue } = require('../../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await authenticateWorkerAsync(request);
    const storeId = session?.worker?.store_id || session?.worker?.storeId || session?.storeId || null;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || null;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const result = await getTodayBookingsQueue({ status, limit, offset, storeId });

    return NextResponse.json({
      success: true,
      data: result.bookings,
      counts: result.counts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (
      error.code === 'UNAUTHORIZED' ||
      error.code === 'FORBIDDEN' ||
      error.code === 'SESSION_EXPIRED' ||
      error.code === 'SESSION_REVOKED' ||
      error.code === 'WORKER_NOT_FOUND' ||
      error.code === 'WORKER_ACCOUNT_DISABLED'
    ) {
      const status = error.status || (error.code === 'FORBIDDEN' || error.code === 'WORKER_ACCOUNT_DISABLED' ? 403 : 401);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message || 'Valid worker authorization is required to access the booking queue.',
          },
        },
        { status }
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
