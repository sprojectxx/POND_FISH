/**
 * Worker Booking Details Endpoint
 * GET /api/v1/worker/bookings/[id]
 * Traceability: PondFish Worker Portal Spec (WP-06, Section 14)
 * Retrieves complete booking, line items, and customer information for fulfillment.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionToken, getBookingDetailsForWorker } = require('../../../../../../lib/engines/worker');

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

export async function GET(request, { params }) {
  try {
    authenticateWorker(request);
    const bookingId = params.id;

    const booking = await getBookingDetailsForWorker(bookingId);

    return NextResponse.json({
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: 'Valid worker authorization is required.',
          },
        },
        { status: error.code === 'FORBIDDEN' ? 403 : 401 }
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
