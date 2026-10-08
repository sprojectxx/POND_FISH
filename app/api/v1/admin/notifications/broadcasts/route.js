/**
 * Admin Broadcasts API - List and Create (Draft/Scheduled)
 * GET /api/v1/admin/notifications/broadcasts
 * POST /api/v1/admin/notifications/broadcasts
 * Traceability: Admin Portal Specification Sections 131–137
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const notificationsEngine = require('../../../../../../lib/engines/notifications');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search') || null;
    const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit'), 10) || 20));
    const offset = (page - 1) * limit;

    const result = await notificationsEngine.listBroadcasts({
      status,
      search,
      limit,
      offset,
    });

    const totalPages = Math.ceil((result.total || 0) / limit) || 1;

    return NextResponse.json({
      success: true,
      broadcasts: result.broadcasts,
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
          code: error.code || 'BROADCASTS_FETCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await authenticateAdminAsync(request);

    const body = await request.json().catch(() => ({}));
    const {
      title,
      message,
      category,
      audienceType,
      planId,
      customerId,
      channels,
      deepLink,
      status = 'DRAFT',
      scheduledAt,
    } = body;

    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    let broadcast = null;

    if (status && status.toUpperCase() === 'SCHEDULED') {
      broadcast = await notificationsEngine.scheduleBroadcast(
        {
          title,
          message,
          category,
          audienceType,
          planId,
          customerId,
          channels,
          deepLink,
          scheduledAt,
        },
        {
          actorId: admin.id || 'admin-system',
          ip,
        }
      );
    } else {
      broadcast = await notificationsEngine.saveBroadcastDraft(
        {
          title,
          message,
          category,
          audienceType,
          planId,
          customerId,
          channels,
          deepLink,
        },
        {
          actorId: admin.id || 'admin-system',
          ip,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: broadcast.status === 'SCHEDULED' ? 'Broadcast scheduled successfully.' : 'Draft saved successfully.',
      broadcast,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'BROADCAST_CREATE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
