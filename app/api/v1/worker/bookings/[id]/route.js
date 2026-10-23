/**
 * Worker Booking Details Endpoint
 * GET /api/v1/worker/bookings/[id]
 * Traceability: PondFish Worker Portal Spec (WP-06, Section 14)
 * Retrieves complete booking, line items, and customer information for fulfillment.
 */

import { NextResponse } from 'next/server';
const { authenticateWorkerAsync, getBookingDetailsForWorker } = require('../../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await authenticateWorkerAsync(request);
    const bookingId = params.id;

    const booking = await getBookingDetailsForWorker(bookingId);

    return NextResponse.json({
      success: true,
      data: booking,
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

    if (error.code === 'BOOKING_NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BOOKING_NOT_FOUND',
            message: error.message,
          },
        },
        { status: 404 }
      );
    }

    console.error('[API ERROR] GET /api/v1/worker/bookings/[id]:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BOOKING_FETCH_FAILED',
          message: 'Unable to retrieve booking details at this time.',
        },
      },
      { status: 500 }
    );
  }
}
