/**
 * Worker Booking Completion & Handover Finalization Endpoint
 * POST /api/v1/worker/bookings/[id]/complete
 * Traceability: PondFish Core Engines Spec (Section 14) & Worker Portal Spec (WP-10, Sections 18, 69)
 * Irreversible atomic execution of inventory consumption, financial transaction creation,
 * status transition to COMPLETED, and QR invalidation.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionToken, completeBookingOrder } = require('../../../../../../../lib/engines/worker');

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

export async function POST(request, { params }) {
  try {
    const session = authenticateWorker(request);
    const bookingId = params.id;

    const result = await completeBookingOrder({
      bookingId,
      workerId: session.workerId,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'Booking completed successfully. Reserved stock consumed and QR ticket invalidated.',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
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

    if (error.code === 'BOOKING_ALREADY_COMPLETED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BOOKING_ALREADY_COMPLETED',
            message: 'Order Already Completed. This booking has already been fulfilled.',
          },
        },
        { status: 409 }
      );
    }

    if (error.code === 'BOOKING_EXPIRED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BOOKING_EXPIRED',
            message: 'Booking Expired. The 48-hour pickup window has lapsed.',
          },
        },
        { status: 410 }
      );
    }

    if (error.code === 'BOOKING_CANCELLED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BOOKING_CANCELLED',
            message: 'Booking Cancelled. This booking has been cancelled and cannot be fulfilled.',
          },
        },
        { status: 410 }
      );
    }

    if (error.code === 'INVALID_BOOKING_STATUS' || error.code === 'EMPTY_BOOKING_ITEMS') {
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

    if (error.code === 'INSUFFICIENT_PHYSICAL_STOCK') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_PHYSICAL_STOCK',
            message: error.message,
            fishId: error.fishId,
            physical: error.physical,
            requested: error.requested,
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

    console.error('[API ERROR] POST /api/v1/worker/bookings/[id]/complete:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'COMPLETION_FAILED',
          message: error.message || 'Unable to finalize order completion at this time.',
        },
      },
      { status: 500 }
    );
  }
}
