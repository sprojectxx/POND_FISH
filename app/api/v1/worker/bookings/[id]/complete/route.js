/**
 * Worker Booking Completion & Handover Finalization Endpoint
 * POST /api/v1/worker/bookings/[id]/complete
 * Traceability: PondFish Core Engines Spec (Section 14) & Worker Portal Spec (WP-10, Sections 18, 69)
 * Irreversible atomic execution of inventory consumption, financial transaction creation,
 * status transition to COMPLETED, and QR invalidation.
 */

import { NextResponse } from 'next/server';
const { authenticateWorkerAsync, completeBookingOrder } = require('../../../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const session = await authenticateWorkerAsync(request);
    const bookingId = params.id;
    const workerStoreId = typeof session.storeId === 'string' ? session.storeId.trim() : (typeof session.worker?.store_id === 'string' ? session.worker.store_id.trim() : null);

    if (!workerStoreId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'STORE_MISMATCH',
            message: 'Forbidden: Worker lacks a valid authoritative store assignment.',
          },
        },
        { status: 403 }
      );
    }

    const result = await completeBookingOrder({
      bookingId,
      workerId: session.workerId,
      workerStoreId,
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
    if (error.code === 'STORE_MISMATCH') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'STORE_MISMATCH',
            message: error.message || 'This booking belongs to a different store.',
          },
        },
        { status: 403 }
      );
    }
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
