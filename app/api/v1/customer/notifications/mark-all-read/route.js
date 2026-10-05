/**
 * Mark All Notifications Read Endpoint
 * POST /api/v1/customer/notifications/mark-all-read
 * Traceability: PondFish Customer Mobile App Spec (CP-10 Actions - Mark all read)
 * Marks all unread in-app notifications for the authenticated customer as read.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { markAllNotificationsAsRead } = require('../../../../../../lib/engines/notifications');

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

export async function POST(request) {
  try {
    const session = authenticateCustomer(request);

    const result = await markAllNotificationsAsRead({
      customerId: session.customerId,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Marked ${result.count} notifications as read.`,
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

    console.error('[API ERROR] POST /api/v1/customer/notifications/mark-all-read:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MARK_ALL_READ_FAILED',
          message: error.message || 'Unable to update notification statuses.',
        },
      },
      { status: 500 }
    );
  }
}
