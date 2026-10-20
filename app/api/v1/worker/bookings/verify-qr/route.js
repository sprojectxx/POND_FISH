/**
 * Worker QR Ticket Verification Endpoint
 * POST /api/v1/worker/bookings/verify-qr
 * Traceability: PondFish Core Engines Spec (Section 15) & Worker Portal Spec (WP-05)
 * Server-side cryptographic HMAC-SHA256 signature verification and booking state validation.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionToken, verifyBookingQr } = require('../../../../../../lib/engines/worker');

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

export async function POST(request) {
  try {
    authenticateWorker(request);
    const body = await request.json().catch(() => ({}));
    const { qrCodeData } = body;

    if (!qrCodeData || typeof qrCodeData !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_QR_TOKEN',
            message: 'Please provide valid QR ticket token data.',
          },
        },
        { status: 400 }
      );
    }

    const booking = await verifyBookingQr(qrCodeData);

    return NextResponse.json({
      success: true,
      verified: true,
      data: booking,
      message: 'QR ticket signature verified and active booking retrieved.',
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

    if (error.code === 'INVALID_QR_SIGNATURE' || error.code === 'INVALID_QR_TOKEN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_QR',
            message: 'Invalid QR. This QR cannot be used for this order.',
            details: error.details,
          },
        },
        { status: 400 }
      );
    }

    if (error.code === 'BOOKING_ALREADY_COMPLETED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BOOKING_ALREADY_COMPLETED',
            message: 'Order Already Completed. This booking has already been fulfilled.',
            booking: error.booking,
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
            message: 'Booking Expired. This booking is no longer available for collection.',
            booking: error.booking,
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
            booking: error.booking,
          },
        },
        { status: 410 }
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

    console.error('[API ERROR] POST /api/v1/worker/bookings/verify-qr:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'QR_VERIFICATION_FAILED',
          message: 'Unable to verify QR ticket at this time.',
        },
      },
      { status: 500 }
    );
  }
}
