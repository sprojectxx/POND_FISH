/**
 * Admin Booking Operational Cancellation API
 * POST /api/v1/admin/bookings/[id]/cancel
 * Traceability: ADMIN-12 Booking Cancellation & Atomic Restoration
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../lib/auth/admin-auth');
const bookingEngine = require('../../../../../../../lib/engines/booking');

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const admin = await authenticateAdminAsync(request);
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;

    const body = await request.json().catch(() => ({}));
    const { reason, cancellationNotes } = body;

    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const result = await bookingEngine.adminCancelBooking(
      {
        bookingId: id,
        reason,
        cancellationNotes,
      },
      {
        actorId: admin.id,
        ip,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully. Reserved inventory and customer credits have been restored.',
      booking: result.booking,
      restoration: result.restoration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'BOOKING_CANCELLATION_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
