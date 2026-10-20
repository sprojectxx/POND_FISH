/**
 * Admin Broadcast Cancellation API
 * POST /api/v1/admin/notifications/broadcasts/[id]/cancel
 * Traceability: Admin Portal Specification Section 135
 * Cancels unsent broadcast. Allowed ONLY in DRAFT or SCHEDULED state.
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../../lib/auth/admin-auth');
const notificationsEngine = require('../../../../../../../../lib/engines/notifications');

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
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

    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const cancelled = await notificationsEngine.cancelBroadcast(id, {
      actorId: admin.id || 'admin-system',
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Broadcast cancelled successfully. It will never be dispatched.',
      broadcast: cancelled,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'BROADCAST_CANCEL_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
