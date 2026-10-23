/**
 * Worker Login Endpoint
 * POST /api/v1/worker/auth/login
 * Traceability: PondFish API Spec & Worker Portal Spec (WP-01, Section 9)
 * Authenticates store worker via mobile number and password.
 */

import { NextResponse } from 'next/server';
const { authenticateWorker } = require('../../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { mobileNumber, password, clientType, returnToken } = body;

    if (!mobileNumber || !password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Mobile number and password are required.',
          },
        },
        { status: 400 }
      );
    }

    const result = await authenticateWorker({ mobileNumber, password });

    // Determine whether caller is an explicit non-browser/API client requesting bearer token
    const isExplicitApiClient =
      clientType === 'api' ||
      returnToken === true ||
      request.headers?.get?.('x-client-type') === 'api' ||
      request.headers?.get?.('x-auth-mode') === 'token';

    // Browser portal authenticates strictly via HttpOnly cookie; omit token from JSON body.
    // Explicit API clients receive bearer token in data.token.
    const responseData = {
      worker: result.worker,
      sessionId: result.sessionId,
      ...(isExplicitApiClient ? { token: result.token } : {}),
    };

    const response = NextResponse.json(
      {
        success: true,
        data: responseData,
        message: 'Worker signed in successfully.',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

    // Set secure production-grade worker session cookie for page navigation and SSR
    response.cookies.set('worker_session', result.token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60, // 12 hours
    });

    return response;
  } catch (error) {
    if (error.code === 'WORKER_ACCOUNT_DISABLED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WORKER_ACCOUNT_DISABLED',
            message: error.message,
          },
        },
        { status: 403 }
      );
    }

    if (error.code === 'INVALID_CREDENTIALS' || error.code === 'INVALID_MOBILE_NUMBER') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 401 }
      );
    }

    console.error('[API ERROR] POST /api/v1/worker/auth/login:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: 'Unable to sign in at this time. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}
