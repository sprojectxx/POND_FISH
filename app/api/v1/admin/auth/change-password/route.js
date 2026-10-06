/**
 * Admin Change Password API Endpoint
 * POST /api/v1/admin/auth/change-password
 * Traceability: ADMIN-21 — Admin Security Specification
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../../lib/auth/admin-auth');
const rbacEngine = require('../../../../../../lib/engines/rbac');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const admin = authenticateAdmin(request);
    const body = await request.json().catch(() => ({}));
    const { currentPassword, newPassword, confirmPassword } = body;

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const result = await rbacEngine.changeAdminPassword(admin.id, {
      currentPassword,
      newPassword,
      confirmPassword,
      currentSessionId: admin.sessionId,
      ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      updatedAt: result.updatedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'SESSION_EXPIRED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message || 'Admin authentication required.',
          },
        },
        { status: 401 }
      );
    }

    if (error.code === 'INVALID_CURRENT_PASSWORD') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CURRENT_PASSWORD',
            message: error.message,
          },
        },
        { status: 401 }
      );
    }

    if (error.code === 'PASSWORD_MISMATCH' || error.code === 'WEAK_PASSWORD' || error.code === 'INVALID_INPUT') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    console.error('[API ERROR] POST /api/v1/admin/auth/change-password:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_FAILED',
          message: error.message || 'Failed to update password.',
        },
      },
      { status: 500 }
    );
  }
}
