/**
 * Booking Expiry Processing Endpoint
 * POST /api/v1/customer/bookings/expire
 * Traceability: PondFish API Spec (Section 68), Core Engines Spec (Section 14.6, 36)
 * Processes overdue bookings or a specific booking, atomically executing 48-hour expiration lifecycle
 * and restoring inventory, subscription usage, and credits.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { verifyWorkerSessionToken } = require('../../../../../../lib/engines/worker');
const { expireBooking, processOverdueBookings } = require('../../../../../../lib/engines/booking-expiry');
const bookingRepository = require('../../../../../../lib/db/repositories/bookingRepository');

export const dynamic = 'force-dynamic';

const SYSTEM_INTERNAL_SECRET =
  process.env.INTERNAL_SYSTEM_SECRET ||
  process.env.CRON_SECRET ||
  'pondfish-internal-system-secret-2026';

function authenticateRequest(request) {
  // 1. Trusted internal header for background jobs / crons
  const internalHeader = request.headers.get('x-internal-secret') || '';
  if (internalHeader && internalHeader === SYSTEM_INTERNAL_SECRET) {
    return { role: 'SYSTEM' };
  }

  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('MISSING_BEARER_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const token = authHeader.substring(7).trim();

  // 2. Direct system bearer token
  if (token === SYSTEM_INTERNAL_SECRET) {
    return { role: 'SYSTEM' };
  }

  // 3. Worker session token
  try {
    const workerSession = verifyWorkerSessionToken(token);
    if (workerSession && workerSession.role === 'WORKER') {
      return { role: 'WORKER', workerId: workerSession.workerId };
    }
  } catch {
    // Not a worker token; fall through
  }

  // 4. Customer session token
  try {
    const customerSession = verifySessionToken(token);
    if (customerSession && customerSession.customerId) {
      return {
        role: 'CUSTOMER',
        customerId: customerSession.customerId,
        mobileNumber: customerSession.mobileNumber,
      };
    }
  } catch {
    // Invalid customer token
  }

  const err = new Error('INVALID_SESSION_TOKEN');
  err.code = 'UNAUTHORIZED';
  throw err;
}

export async function POST(request) {
  try {
    const auth = authenticateRequest(request);

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { bookingId } = body;

    // Path 1: Single booking expiry
    if (bookingId) {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (typeof bookingId !== 'string' || !UUID_REGEX.test(bookingId.trim())) {
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

      // Validate customer isolation if called by customer
      if (auth.role === 'CUSTOMER') {
        if (!auth.customerId || !UUID_REGEX.test(auth.customerId)) {
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

        const booking = await bookingRepository.findBookingById(bookingId, auth.customerId);
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

    // Path 2: System global overdue sweep
    // STRICT SECURITY BOUNDARY: Ordinary customer tokens can NEVER execute global sweeps
    if (auth.role === 'CUSTOMER') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden. Global overdue sweeps are restricted to system background jobs.',
          },
        },
        { status: 403 }
      );
    }

    // Sweep all overdue bookings past their 48-hour window (SYSTEM or WORKER only)
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
