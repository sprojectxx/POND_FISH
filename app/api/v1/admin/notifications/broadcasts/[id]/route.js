/**
 * Admin Broadcast Detail & Edit API
 * GET /api/v1/admin/notifications/broadcasts/[id]
 * PUT /api/v1/admin/notifications/broadcasts/[id]
 * Traceability: Admin Portal Specification Sections 131–137
 * Editing allowed ONLY in DRAFT or SCHEDULED state.
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../lib/auth/admin-auth');
const notificationsEngine = require('../../../../../../../lib/engines/notifications');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await authenticateAdminAsync(request);

    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_PARAMETERS', message: 'Broadcast ID is required.' },
        },
        { status: 400 }
      );
    }

    const detail = await notificationsEngine.getBroadcastDetail(id);

    return NextResponse.json({
      success: true,
      broadcast: detail.broadcast,
      auditLogs: detail.auditLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'BROADCAST_DETAIL_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const admin = await authenticateAdminAsync(request);

    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_PARAMETERS', message: 'Broadcast ID is required.' },
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const updated = await notificationsEngine.editBroadcast(id, body, {
      actorId: admin.id || 'admin-system',
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Broadcast updated successfully.',
      broadcast: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'BROADCAST_EDIT_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
