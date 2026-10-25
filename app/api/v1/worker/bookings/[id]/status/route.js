/**
 * Worker Update Booking Status Endpoint
 * PATCH /api/v1/worker/bookings/[id]/status
 * Traceability: PondFish Worker Portal Spec (WP-07, Section 15)
 * Transitions booking state (CONFIRMED -> PENDING_COLLECTION).
 */

import { NextResponse } from 'next/server';
const { authenticateWorkerAsync, updateBookingPreparationStatus } = require('../../../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  try {
    const session = await authenticateWorkerAsync(request);
    const workerStoreId = session?.worker?.store_id || session?.worker?.storeId || session?.storeId || null;
    if (!workerStoreId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'STORE_MISMATCH',
            message: 'Worker has no authoritative store assignment.',
          },
        },
        { status: 403 }
      );
    }
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
      workerStoreId,
    });

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: 'Booking status updated to PENDING_COLLECTION.',
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

    if (error.code === 'STORE_MISMATCH') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'STORE_MISMATCH',
            message: error.message || 'Worker is not authorized for this store resource.',
          },
        },
        { status: 403 }
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
