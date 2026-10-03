/**
 * Customer Profile Management Endpoint
 * GET /api/v1/customer/profile
 * PATCH /api/v1/customer/profile
 * Traceability: PondFish API Specification (Section 11) & Customer Portal PRD (CP-01E)
 */

import { NextResponse } from 'next/server';
const {
  verifySessionToken,
  getCustomerProfile,
  updateCustomerProfile,
} = require('../../../../../lib/engines/customer');

export const dynamic = 'force-dynamic';

/**
 * Helper to extract and verify Bearer token from Authorization header
 */
function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('MISSING_BEARER_TOKEN');
  }
  const token = authHeader.substring(7).trim();
  return verifySessionToken(token);
}

export async function GET(request) {
  try {
    const session = authenticateRequest(request);
    const profile = await getCustomerProfile(session.customerId);

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer record was not found.',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.message === 'MISSING_BEARER_TOKEN' || error.message === 'INVALID_SESSION_TOKEN') {
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

    console.error('[API ERROR] GET /api/v1/customer/profile:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROFILE_FETCH_FAILED',
          message: 'Unable to retrieve customer profile.',
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const session = authenticateRequest(request);
    const body = await request.json();
    const { name, age, area } = body || {};

    const updatedProfile = await updateCustomerProfile(session.customerId, {
      name,
      age,
      area,
    });

    return NextResponse.json({
      success: true,
      data: updatedProfile,
      message: 'Profile updated successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.message === 'MISSING_BEARER_TOKEN' || error.message === 'INVALID_SESSION_TOKEN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication session expired or invalid. Please sign in again.',
          },
        },
        { status: 401 }
      );
    }

    if (error.message === 'INVALID_NAME') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_NAME',
            message: 'Full name must contain at least 2 characters.',
          },
        },
        { status: 400 }
      );
    }

    if (error.message === 'INVALID_AGE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_AGE',
            message: 'Age must be a valid number between 18 and 120.',
          },
        },
        { status: 400 }
      );
    }

    if (error.message === 'INVALID_AREA') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_AREA',
            message: 'Area/locality must contain at least 2 characters.',
          },
        },
        { status: 400 }
      );
    }

    if (error.message === 'CUSTOMER_NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer record was not found.',
          },
        },
        { status: 404 }
      );
    }

    console.error('[API ERROR] PATCH /api/v1/customer/profile:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROFILE_UPDATE_FAILED',
          message: 'Unable to update customer profile at this time.',
        },
      },
      { status: 500 }
    );
  }
}
