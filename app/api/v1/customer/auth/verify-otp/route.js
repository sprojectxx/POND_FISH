/**
 * Customer Verify Token & Session Issuance Endpoint
 * POST /api/v1/customer/auth/verify-otp
 * Traceability: PondFish API Specification (Section 7) & Integration Specification (Section 6)
 * Validates real Firebase ID Token and establishes authenticated customer session.
 */

import { NextResponse } from 'next/server';
const { authenticateCustomer } = require('../../../../../../lib/engines/customer');
const { isValidIndianMobile } = require('../../../../../../lib/validators/common');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { mobileNumber, idToken } = body || {};

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

    if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FIREBASE_ID_TOKEN',
            message: 'A valid Firebase ID token is required for authentication.',
          },
        },
        { status: 400 }
      );
    }

    // Call domain customer business engine with real Firebase ID token
    const authResult = await authenticateCustomer({
      mobileNumber,
      idToken: idToken.trim(),
    });

    return NextResponse.json({
      success: true,
      data: authResult,
      message: 'Customer authenticated successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API ERROR] POST /api/v1/customer/auth/verify-otp:', error.message);

    if (error.code === 'PHONE_NUMBER_MISMATCH' || error.message === 'PHONE_NUMBER_MISMATCH') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PHONE_NUMBER_MISMATCH',
            message: 'Verified Firebase credentials do not match the provided phone number.',
          },
        },
        { status: 400 }
      );
    }

    if (
      error.code === 'FIREBASE_VERIFICATION_FAILED' ||
      error.message?.includes('FIREBASE_VERIFICATION_FAILED') ||
      error.message?.includes('Firebase Auth is not configured')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FIREBASE_VERIFICATION_FAILED',
            message: error.message || 'Firebase token verification failed. Please try signing in again.',
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
          message: error.message || 'Unable to complete verification at this time. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}
