/**
 * Admin Notification Detail API
 * GET /api/v1/admin/notifications/[id]
 * Traceability: ADMIN-15 / ADMIN-17 (Section 136 - Notification Details)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const notificationsEngine = require('../../../../../../lib/engines/notifications');

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
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Notification ID is required.',
          },
        },
        { status: 400 }
      );
    }

    const detail = await notificationsEngine.getAdminNotificationDetail(id);

    return NextResponse.json({
      success: true,
      notification: detail,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'NOTIFICATION_DETAIL_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}
