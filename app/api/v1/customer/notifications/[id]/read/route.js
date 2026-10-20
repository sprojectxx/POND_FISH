/**
 * Mark Single Notification Read Endpoint
 * PATCH /api/v1/customer/notifications/[id]/read
 * Traceability: PondFish Customer Mobile App Spec (CP-10 Notification Center), API Spec v1
 * Updates read state for a notification with customer isolation.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../../lib/engines/customer');
const { markNotificationAsRead } = require('../../../../../../../lib/engines/notifications');

export const dynamic = 'force-dynamic';

function authenticateCustomer(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('MISSING_BEARER_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const token = authHeader.substring(7).trim();
  try {
    const session = verifySessionToken(token);
    if (!session || !session.customerId) {
      const err = new Error('INVALID_SESSION_TOKEN');
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    return session;
  } catch {
    const err = new Error('INVALID_SESSION_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = authenticateCustomer(request);
    const { id: notificationId } = await params;

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!notificationId || !UUID_REGEX.test(notificationId.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOTIFICATION_NOT_FOUND',
            message: 'Notification not found or access denied.',
          },
        },
        { status: 404 }
      );
    }

    const updated = await markNotificationAsRead({
      customerId: session.customerId,
      notificationId: notificationId.trim(),
    });

    return NextResponse.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required.',
          },
        },
        { status: 401 }
      );
    }

    if (error.code === 'NOTIFICATION_NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOTIFICATION_NOT_FOUND',
            message: 'Notification not found or access denied.',
          },
        },
        { status: 404 }
      );
    }

    console.error('[API ERROR] PATCH /api/v1/customer/notifications/[id]/read:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MARK_READ_FAILED',
          message: error.message || 'Unable to update notification status.',
        },
      },
      { status: 500 }
    );
  }
}
