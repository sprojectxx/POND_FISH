/**
 * Worker Booking Search Endpoint
 * GET /api/v1/worker/bookings/search?q=...
 * Traceability: PondFish API Spec (Section 37) & Worker Portal Spec (WP-04)
 * Searches bookings by Booking Code, Customer Name, or Phone.
 */

import { NextResponse } from 'next/server';
const { authenticateWorkerAsync, searchBookings } = require('../../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateWorkerAsync(request);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const bookings = await searchBookings({ query, limit });

    return NextResponse.json({
      success: true,
      data: bookings,
      count: bookings.length,
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
            message: error.message || 'Valid worker authorization is required.',
          },
        },
        { status }
      );
    }

    console.error('[API ERROR] GET /api/v1/worker/bookings/search:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: 'Unable to perform booking search at this time.',
        },
      },
      { status: 500 }
    );
  }
}
