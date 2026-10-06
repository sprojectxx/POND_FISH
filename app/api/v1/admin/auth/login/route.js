/**
 * Admin Login API Endpoint
 * POST /api/v1/admin/auth/login
 * Traceability: ADMIN-01 — Admin Login Specification
 */

import { NextResponse } from 'next/server';
const rbacEngine = require('../../../../../../lib/engines/rbac');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const result = await rbacEngine.loginAdmin({
      email,
      password,
      ip,
      userAgent,
    });

    const response = NextResponse.json({
      success: true,
      token: result.token,
      sessionId: result.sessionId,
      admin: result.admin,
      timestamp: new Date().toISOString(),
    });

    // Set secure session cookie
    response.cookies.set('admin_session', result.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60, // 12 hours
    });

    return response;
  } catch (error) {
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: error.message,
            remainingSeconds: error.remainingSeconds,
          },
        },
        { status: 429 }
      );
    }

    if (error.code === 'INVALID_CREDENTIALS' || error.code === 'INVALID_INPUT') {
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

    console.error('[API ERROR] POST /api/v1/admin/auth/login:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: 'An unexpected error occurred during authentication. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}
