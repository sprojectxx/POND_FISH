/**
 * Admin Active Sessions API Endpoint
 * GET /api/v1/admin/auth/sessions — Review active sessions
 * DELETE /api/v1/admin/auth/sessions — Terminate all other sessions
 * Traceability: ADMIN-21 — Admin Security Specification (Sections 175–176)
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../../lib/auth/admin-auth');
const rbacEngine = require('../../../../../../lib/engines/rbac');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const admin = authenticateAdmin(request);
    const sessions = await rbacEngine.getActiveSessions(admin.id, admin.sessionId);

    return NextResponse.json({
      success: true,
      sessions,
      currentSessionId: admin.sessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'SESSION_EXPIRED') {
      return NextResponse.json(
        {
          success: false,
          error: { code: error.code, message: error.message || 'Admin authentication required.' },
        },
        { status: 401 }
      );
    }

    console.error('[API ERROR] GET /api/v1/admin/auth/sessions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SESSIONS_FETCH_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const admin = authenticateAdmin(request);
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const result = await rbacEngine.terminateOtherSessions(admin.id, admin.sessionId, { ip, userAgent });

    return NextResponse.json({
      success: true,
      message: result.message,
      terminatedCount: result.terminatedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'SESSION_EXPIRED') {
      return NextResponse.json(
        {
          success: false,
          error: { code: error.code, message: error.message || 'Admin authentication required.' },
        },
        { status: 401 }
      );
    }

    console.error('[API ERROR] DELETE /api/v1/admin/auth/sessions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SESSIONS_TERMINATION_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
