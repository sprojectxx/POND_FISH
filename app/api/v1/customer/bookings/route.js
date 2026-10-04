/**
 * Customer Bookings Collection Endpoint
 * POST /api/v1/customer/bookings - Create online booking from cart with atomic reservation
 * GET /api/v1/customer/bookings - List authenticated customer's booking history
 * Traceability: PondFish API Spec (Section 37) & Core Engines Spec (Section 14)
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../lib/engines/customer');
const { createBooking, listBookings } = require('../../../../../lib/engines/booking');

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

export async function GET(request) {
  try {
    const session = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const bookings = await listBookings({
      customerId: session.customerId,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: bookings,
      count: bookings.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required to view bookings.',
          },
        },
        { status: 401 }
      );
    }

    console.error('[API ERROR] GET /api/v1/customer/bookings:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BOOKINGS_FETCH_FAILED',
          message: 'Unable to retrieve customer bookings at this time.',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = authenticateRequest(request);
    const body = await request.json().catch(() => ({}));

    const booking = await createBooking({
      customerId: session.customerId,
      paymentVerification: body.paymentVerification || null,
    });

    return NextResponse.json(
      {
        success: true,
        data: booking,
        message: 'Online booking created and inventory reserved successfully.',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required to create a booking.',
          },
        },
        { status: 401 }
      );
    }

    if (error.code === 'EMPTY_CART') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMPTY_CART',
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    if (error.code === 'INSUFFICIENT_INVENTORY') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_INVENTORY',
            message: error.message,
            available: error.available,
            requested: error.requested,
            fishId: error.fishId,
          },
        },
        { status: 409 }
      );
    }

    if (error.code === 'PAYMENT_REQUIRED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PAYMENT_REQUIRED',
            message: error.message,
            amount: error.amount,
          },
        },
        { status: 402 }
      );
    }

    if (error.code === 'PAYMENT_GATEWAY_NOT_CONFIGURED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
            message: error.message,
            amount: error.amount,
          },
        },
        { status: 503 }
      );
    }

    if (error.code === 'PAYMENT_VERIFICATION_FAILED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PAYMENT_VERIFICATION_FAILED',
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    if (error.code === 'FISH_UNAVAILABLE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FISH_UNAVAILABLE',
            message: error.message,
            fishId: error.fishId,
          },
        },
        { status: 400 }
      );
    }

    console.error('[API ERROR] POST /api/v1/customer/bookings:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BOOKING_CREATION_FAILED',
          message: error.message || 'Unable to finalize booking reservation at this time.',
        },
      },
      { status: 500 }
    );
  }
}
