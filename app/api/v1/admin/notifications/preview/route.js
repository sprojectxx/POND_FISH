/**
 * Admin Notification Audience Preview API
 * POST /api/v1/admin/notifications/preview
 * Traceability: ADMIN-15 / ADMIN-17 (Section 134 - Notification Preview)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const notificationsEngine = require('../../../../../../lib/engines/notifications');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await authenticateAdminAsync(request);

    const body = await request.json().catch(() => ({}));
    const { audienceType, planId, customerId } = body;

    const preview = await notificationsEngine.previewAudienceScope({
      audienceType,
      planId,
      customerId,
    });

    return NextResponse.json({
      success: true,
      preview,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'AUDIENCE_PREVIEW_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
