/**
 * Booking Expiry Processing Endpoint
 * POST /api/v1/customer/bookings/expire
 * Traceability: PondFish API Spec (Section 68), Core Engines Spec (Section 14.6, 36)
 * Processes overdue bookings or a specific booking, atomically executing 48-hour expiration lifecycle
 * and restoring inventory, subscription usage, and credits.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { expireBooking, processOverdueBookings } = require('../../../../../../lib/engines/booking-expiry');
const bookingRepository = require('../../../../../../lib/db/repositories/bookingRepository');

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

export async function POST(request) {
  try {
    const session = authenticateRequest(request);

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { bookingId } = body;

    if (bookingId) {
      // Validate customer isolation if called by customer
      if (session.role === 'CUSTOMER') {
        const booking = await bookingRepository.findBookingById(bookingId, session.customerId);
        if (!booking) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'BOOKING_NOT_FOUND',
                message: 'Booking not found or customer access denied.',
              },
            },
            { status: 404 }
          );
        }
      }

      const result = await expireBooking(bookingId);
      return NextResponse.json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString(),
      });
    }

    // Sweep all overdue bookings past their 48-hour window
    const sweepResult = await processOverdueBookings();
    return NextResponse.json({
      success: true,
      data: sweepResult,
      message: `Processed overdue bookings: ${sweepResult.expiredCount} expired.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid session token is required to execute booking expiry processing.',
          },
        },
        { status: 401 }
      );
    }

    console.error('[API ERROR] POST /api/v1/customer/bookings/expire:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'EXPIRY_PROCESSING_FAILED',
          message: error.message || 'An unexpected error occurred during expiry processing.',
        },
      },
      { status: 500 }
    );
  }
}
