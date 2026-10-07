/**
 * Admin Booking Detail API
 * GET /api/v1/admin/bookings/[id]
 * Traceability: ADMIN-12 Booking Detail
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const bookingEngine = require('../../../../../../lib/engines/booking');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await authenticateAdminAsync(request);
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;

    const booking = await bookingEngine.getAdminBookingDetail(id);

    return NextResponse.json({
      success: true,
      booking,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'BOOKING_DETAIL_ERROR',
          message: error.message,
        },
      },
      { status: error.status || (error.code === 'BOOKING_NOT_FOUND' ? 404 : 500) }
    );
  }
}
