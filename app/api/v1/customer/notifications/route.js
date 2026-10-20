/**
 * Customer Notifications List Endpoint
 * GET /api/v1/customer/notifications
 * Traceability: PondFish Customer Mobile App Spec (CP-10 Notification Center), API Spec v1
 * Retrieves permanent in-app notification history with pagination, category filtering, and unread count.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../lib/engines/customer');
const { getCustomerNotifications } = require('../../../../../lib/engines/notifications');

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

export async function GET(request) {
  try {
    const session = authenticateCustomer(request);

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const type = searchParams.get('type') || null;

    const data = await getCustomerNotifications({
      customerId: session.customerId,
      limit,
      offset,
      type,
    });

    return NextResponse.json({
      success: true,
      data,
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

    console.error('[API ERROR] GET /api/v1/customer/notifications:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOTIFICATIONS_FETCH_FAILED',
          message: error.message || 'Unable to retrieve notifications.',
        },
      },
      { status: 500 }
    );
  }
}
