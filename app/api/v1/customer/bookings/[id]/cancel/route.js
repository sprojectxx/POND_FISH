/**
 * Customer Booking Cancellation Endpoint
 * POST /api/v1/customer/bookings/[id]/cancel
 * Traceability: PondFish API Spec (Section 39) & Core Engines Spec (Section 14.9)
 * Cancels booking and releases reserved stock and subscription credit atomically.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../../lib/engines/customer');
const { cancelBooking } = require('../../../../../../../lib/engines/booking');

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

export async function POST(request, { params }) {
  try {
    const session = authenticateRequest(request);
    const { id: bookingId } = await params;

    const cancelledBooking = await cancelBooking({
      customerId: session.customerId,
      bookingId,
    });

    return NextResponse.json({
      success: true,
      data: cancelledBooking,
      message: 'Booking cancelled successfully. Reserved stock has been released.',
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

    if (['BOOKING_ALREADY_COMPLETED', 'BOOKING_ALREADY_CANCELLED', 'BOOKING_ALREADY_EXPIRED'].includes(error.code)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    console.error('[API ERROR] POST /api/v1/customer/bookings/[id]/cancel:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BOOKING_CANCEL_FAILED',
          message: error.message || 'Unable to cancel booking at this time.',
        },
      },
      { status: 500 }
    );
  }
}
