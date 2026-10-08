/**
 * Admin Broadcast Immediate Dispatch API ("Send Now" on Draft or Scheduled)
 * POST /api/v1/admin/notifications/broadcasts/[id]/dispatch
 * Traceability: Admin Portal Specification Section 132
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

    const result = await notificationsEngine.executeBroadcastDispatch(id, {
      actorId: admin.id || 'admin-system',
      ip,
    });

    return NextResponse.json({
      success: result.success,
      message: 'Broadcast dispatched.',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'BROADCAST_DISPATCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
