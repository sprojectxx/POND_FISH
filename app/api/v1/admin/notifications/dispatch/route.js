/**
 * Admin Notification Dispatch API
 * POST /api/v1/admin/notifications/dispatch
 * Traceability: ADMIN-15 / ADMIN-17 (Sections 131–137)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const notificationsEngine = require('../../../../../../lib/engines/notifications');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const admin = await authenticateAdminAsync(request);

    const body = await request.json().catch(() => ({}));
    const {
      title,
      message,
      type,
      audienceType,
      planId,
      customerId,
      channels,
      deepLink,
    } = body;

    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const result = await notificationsEngine.dispatchAdminNotification(
      {
        title,
        message,
        type,
        audienceType,
        planId,
        customerId,
        channels,
        deepLink,
      },
      {
        actorId: admin.id || admin.username || 'admin-system',
        ip,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Notification dispatched successfully.',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'NOTIFICATION_DISPATCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
