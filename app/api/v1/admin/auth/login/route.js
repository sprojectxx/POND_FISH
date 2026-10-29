/**
 * Admin Login API Endpoint
 * POST /api/v1/admin/auth/login
 * Traceability: ADMIN-01 — Admin Login Specification
 */

import { NextResponse } from 'next/server.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rbacEngine = require('../../../../../../lib/engines/rbac');
const { isDatabaseConnectionError } = require('../../../../../../lib/db/pool');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    const forwardedFor = request.headers.get('x-forwarded-for');
    const rawIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (request.headers.get('x-real-ip') || '127.0.0.1');
    const ip = rawIp || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const result = await rbacEngine.loginAdmin({
      email,
      password,
      ip,
      userAgent,
    });

    const response = NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      admin: result.admin,
      timestamp: new Date().toISOString(),
    });

    // Set secure production-grade session cookie
    response.cookies.set('admin_session', result.token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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

    if (
      error.code === 'SESSION_REGISTRY_UNAVAILABLE' ||
      error.status === 503 ||
      error.isConnectionError ||
      isDatabaseConnectionError(error)
    ) {
      console.error('[API ERROR] POST /api/v1/admin/auth/login: Database or session registry unavailable:', error.message);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'Authentication service is temporarily unavailable. Please retry in a few moments.',
          },
        },
        { status: 503 }
      );
    }

    const isAuthConfigError = error.code === 'MISSING_AUTH_CONFIG' || (error.message && error.message.includes('JWT_SECRET'));
    if (isAuthConfigError) {
      console.error('[AUTH CONFIG ERROR] FATAL: JWT_SECRET environment variable is missing in production runtime.');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_CONFIG_ERROR',
            message: 'Authentication service configuration error.',
          },
        },
        { status: 500 }
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
