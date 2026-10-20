/**
 * Customer Device Token Registration Endpoint
 * POST /api/v1/customer/notifications/device
 * DELETE /api/v1/customer/notifications/device
 * Traceability: PondFish Integration Spec (Section 7.3 Device Token Management)
 * Registers or removes customer FCM device registration tokens for push delivery.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { registerDevice, unregisterDevice } = require('../../../../../../lib/engines/notifications');

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

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { deviceToken, platform = 'android' } = body;

    if (!deviceToken || typeof deviceToken !== 'string' || !deviceToken.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_DEVICE_TOKEN',
            message: 'A non-empty deviceToken string is required.',
          },
        },
        { status: 400 }
      );
    }

    const record = await registerDevice({
      customerId: session.customerId,
      deviceToken: deviceToken.trim(),
      platform: typeof platform === 'string' ? platform.toLowerCase() : 'android',
    });

    return NextResponse.json({
      success: true,
      data: record,
      message: 'Device registration token saved successfully.',
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

    console.error('[API ERROR] POST /api/v1/customer/notifications/device:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DEVICE_REGISTRATION_FAILED',
          message: error.message || 'Unable to register device token.',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const session = authenticateCustomer(request);

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { deviceToken } = body;
    if (!deviceToken || typeof deviceToken !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_DEVICE_TOKEN',
            message: 'deviceToken is required for unregistration.',
          },
        },
        { status: 400 }
      );
    }

    const result = await unregisterDevice({
      customerId: session.customerId,
      deviceToken,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Device token removed.',
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

    console.error('[API ERROR] DELETE /api/v1/customer/notifications/device:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DEVICE_UNREGISTRATION_FAILED',
          message: error.message || 'Unable to remove device token.',
        },
      },
      { status: 500 }
    );
  }
}
