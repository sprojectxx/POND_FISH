/**
 * Admin Profile & Identity API Endpoint
 * GET /api/v1/admin/auth/me
 * Traceability: ADMIN-22 — Profile Specification
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const rbacEngine = require('../../../../../../lib/engines/rbac');
const { isDatabaseConnectionError } = require('../../../../../../lib/db/pool');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const admin = await authenticateAdminAsync(request);
    const profile = await rbacEngine.getAdminProfile(admin.id);

    return NextResponse.json({
      success: true,
      admin: profile,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (
      error.code === 'SESSION_REGISTRY_UNAVAILABLE' ||
      error.status === 503 ||
      error.isConnectionError ||
      isDatabaseConnectionError(error)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SESSION_REGISTRY_UNAVAILABLE',
            message: 'Session verification temporarily unavailable. Please retry.',
          },
        },
        { status: 503 }
      );
    }

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

    if (error.code === 'FORBIDDEN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message || 'Administrative privileges required.',
          },
        },
        { status: 403 }
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

    console.error('[API ERROR] GET /api/v1/admin/auth/me:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred.',
        },
      },
      { status: 500 }
    );
  }
}
