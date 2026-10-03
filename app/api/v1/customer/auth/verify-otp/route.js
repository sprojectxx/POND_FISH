/**
 * Customer Verify OTP & Session Issuance Endpoint
 * POST /api/v1/customer/auth/verify-otp
 * Traceability: PondFish API Specification (Section 7) & Customer Portal PRD (CP-01D)
 */

import { NextResponse } from 'next/server';
const { authenticateCustomer } = require('../../../../../../lib/engines/customer');
const { isValidIndianMobile } = require('../../../../../../lib/validators/common');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { mobileNumber, idToken, otp } = body || {};

    if (!mobileNumber || !isValidIndianMobile(mobileNumber)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_MOBILE_NUMBER',
            message: 'A valid 10-digit mobile number is required.',
          },
        },
        { status: 400 }
      );
    }

    if (!idToken && !otp) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_VERIFICATION_PROOF',
            message: 'Firebase verification token or OTP is required.',
          },
        },
        { status: 400 }
      );
    }

    // Call domain customer business engine
    const authResult = await authenticateCustomer({
      mobileNumber,
      idToken,
      otp,
    });

    return NextResponse.json({
      success: true,
      data: authResult,
      message: 'Customer authenticated successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API ERROR] POST /api/v1/customer/auth/verify-otp:', error.message);

    if (error.message === 'PHONE_NUMBER_MISMATCH') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PHONE_NUMBER_MISMATCH',
            message: 'Verified credentials do not match the provided phone number.',
          },
        },
        { status: 400 }
      );
    }

    if (error.message === 'FIREBASE_VERIFICATION_FAILED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FIREBASE_VERIFICATION_FAILED',
            message: 'Firebase token verification failed. Please try signing in again.',
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'AUTH_VERIFICATION_FAILED',
          message: 'Unable to complete verification at this time. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}
