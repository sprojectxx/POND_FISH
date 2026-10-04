/**
 * Customer Single Booking Endpoint
 * GET /api/v1/customer/bookings/[id]
 * Traceability: PondFish API Spec (Section 37) & Core Engines Spec (Section 14)
 * Retrieves single booking with QR pickup ticket and customer data isolation.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { getBookingDetails } = require('../../../../../../lib/engines/booking');

export const dynamic = 'force-dynamic';

function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('MISSING_BEARER_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const token = authHeader.substring(7).trim();
  try {
    return verifySessionToken(token);
  } catch {
    const err = new Error('INVALID_SESSION_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
}

export async function GET(request, { params }) {
  try {
    const session = authenticateRequest(request);
    const { id: bookingId } = await params;

    const booking = await getBookingDetails({
      customerId: session.customerId,
      bookingId,
    });

    return NextResponse.json({
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required.',
          },
        },
        { status: 401 }
      );
    }

    if (error.code === 'BOOKING_NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BOOKING_NOT_FOUND',
            message: 'Booking not found or access denied.',
          },
        },
        { status: 404 }
      );
    }

    console.error('[API ERROR] GET /api/v1/customer/bookings/[id]:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BOOKING_FETCH_FAILED',
          message: error.message || 'Unable to retrieve booking details.',
        },
      },
      { status: 500 }
    );
  }
}
