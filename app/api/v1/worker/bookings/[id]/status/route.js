/**
 * Worker Update Booking Status Endpoint
 * PATCH /api/v1/worker/bookings/[id]/status
 * Traceability: PondFish Worker Portal Spec (WP-07, Section 15)
 * Transitions booking state (CONFIRMED -> PENDING_COLLECTION).
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionToken, updateBookingPreparationStatus } = require('../../../../../../../lib/engines/worker');

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

export async function PATCH(request, { params }) {
  try {
    const session = authenticateWorker(request);
    const bookingId = params.id;
    const body = await request.json().catch(() => ({}));
    const { status } = body;

    if (status && status !== 'PENDING_COLLECTION') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: 'Preparation endpoint only supports transition to PENDING_COLLECTION.',
          },
        },
        { status: 400 }
      );
    }

    const updatedBooking = await updateBookingPreparationStatus({
      bookingId,
      workerId: session.workerId,
    });

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: 'Booking status updated to PENDING_COLLECTION.',
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

    if (error.code === 'BOOKING_ALREADY_COMPLETED' || error.code === 'BOOKING_CANCELLED' || error.code === 'BOOKING_EXPIRED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 409 }
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

    console.error('[API ERROR] PATCH /api/v1/worker/bookings/[id]/status:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'STATUS_UPDATE_FAILED',
          message: error.message || 'Unable to update booking preparation status.',
        },
      },
      { status: 500 }
    );
  }
}
