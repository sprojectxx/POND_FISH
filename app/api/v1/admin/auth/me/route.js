/**
 * Admin Profile & Identity API Endpoint
 * GET /api/v1/admin/auth/me
 * Traceability: ADMIN-22 — Profile Specification
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../../lib/auth/admin-auth');
const rbacEngine = require('../../../../../../lib/engines/rbac');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const admin = authenticateAdmin(request);
    const profile = await rbacEngine.getAdminProfile(admin.id);

    return NextResponse.json({
      success: true,
      admin: profile,
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

    if (error.code === 'NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Admin profile not found.',
          },
        },
        { status: 404 }
      );
    }

    console.error('[API ERROR] GET /api/v1/admin/auth/me:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROFILE_FETCH_FAILED',
          message: error.message,
        },
      },
      { status: 500 }
    );
  }
}
