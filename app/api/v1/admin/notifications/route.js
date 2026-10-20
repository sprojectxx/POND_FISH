/**
 * Admin Notifications API - List, Search, Filter & Paginate
 * GET /api/v1/admin/notifications
 * Traceability: ADMIN-15 / ADMIN-17 (Sections 131–137)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../lib/auth/admin-auth');
const notificationsEngine = require('../../../../../lib/engines/notifications');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || null;
    const type = searchParams.get('type') || null;
    const channel = searchParams.get('channel') || null;
    const dateFrom = searchParams.get('dateFrom') || null;
    const dateTo = searchParams.get('dateTo') || null;
    const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit'), 10) || 20));
    const offset = (page - 1) * limit;

    const result = await notificationsEngine.listAdminNotifications({
      search,
      type,
      channel,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    const totalPages = Math.ceil((result.total || 0) / limit) || 1;

    return NextResponse.json({
      success: true,
      notifications: result.notifications,
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
          code: error.code || 'NOTIFICATIONS_FETCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}
