/**
 * Admin Logout API Endpoint
 * POST /api/v1/admin/auth/logout
 * Traceability: ADMIN-23 — Logout Specification
 */

import { NextResponse } from 'next/server';
const { extractToken } = require('../../../../../../lib/auth/admin-auth');
const rbacEngine = require('../../../../../../lib/engines/rbac');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const token = extractToken(request);
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (token) {
      await rbacEngine.logoutAdmin(token, { ip, userAgent });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully.',
      timestamp: new Date().toISOString(),
    });

    // Invalidate session cookie
    response.cookies.set('admin_session', '', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('[API ERROR] POST /api/v1/admin/auth/logout:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: error.message || 'Logout encountered an error.',
        },
      },
      { status: 500 }
    );
  }
}
