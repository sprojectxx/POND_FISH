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

    let detail = null;
    try {
      detail = await notificationsEngine.getAdminNotificationDetail(id);
    } catch {}

    if (!detail) {
      try {
        const broadcastDetail = await notificationsEngine.getBroadcastDetail(id);
        if (broadcastDetail && broadcastDetail.broadcast) {
          const b = broadcastDetail.broadcast;
          detail = {
            id: b.id,
            customerId: b.created_by,
            customerName: `Broadcast Audience: ${b.audience_type}`,
            customerPhone: `Channels: ${(b.channels || []).join(', ')}`,
            customerArea: b.status,
            title: b.title,
            message: b.message,
            type: b.category,
            read: b.status === 'SENT',
            createdAt: b.created_at,
            deliveries: [
              {
                id: `del-${b.id}`,
                channel: (b.channels || []).join(' / '),
                status: b.status,
                providerMessageId: b.sent_at ? `sent-${b.sent_at}` : 'un-dispatched',
                sentAt: b.sent_at,
                deliveredAt: b.sent_at,
                failedAt: b.status === 'FAILED' ? b.updated_at : null,
                errorMessage: b.status === 'PARTIALLY_FAILED' ? `${b.push_fail_count} push delivery failures` : null,
              },
            ],
            auditLogs: broadcastDetail.auditLogs || [],
          };
        }
      } catch {}
    }

    if (!detail) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOTIFICATION_NOT_FOUND',
            message: `Notification or broadcast ${id} not found.`,
          },
        },
        { status: 404 }
      );
    }

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
