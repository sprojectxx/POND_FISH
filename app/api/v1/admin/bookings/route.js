/**
 * Admin Bookings API - List, Search, Filter & Paginate
 * GET /api/v1/admin/bookings
 * Traceability: ADMIN-12 Bookings List
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../lib/auth/admin-auth');
const bookingEngine = require('../../../../../lib/engines/booking');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || null;
    const status = searchParams.get('status') || null;
    const source = searchParams.get('source') || null;
    const dateFrom = searchParams.get('dateFrom') || null;
    const dateTo = searchParams.get('dateTo') || null;
    const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit'), 10) || 20));
    const offset = (page - 1) * limit;

    const result = await bookingEngine.listAdminBookings({
      search,
      status,
      source,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    const totalPages = Math.ceil((result.total || 0) / limit) || 1;

    return NextResponse.json({
      success: true,
      bookings: result.bookings,
      counts: result.counts,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'BOOKINGS_FETCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}
