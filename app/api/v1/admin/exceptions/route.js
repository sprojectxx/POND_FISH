/**
 * Admin Operational Exceptions Center API Endpoint
 * GET /api/v1/admin/exceptions
 * POST /api/v1/admin/exceptions
 * Traceability: AP-20 — Operational Exceptions Specification
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../lib/auth/admin-auth');
const exceptionsEngine = require('../../../../../lib/engines/exceptions');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || null;
    const severity = searchParams.get('severity') || null;

    const exceptions = await exceptionsEngine.listOperationalExceptions({ category, severity });

    return NextResponse.json({
      success: true,
      data: exceptions,
      count: exceptions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'SESSION_EXPIRED') {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message || 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    if (error.code === 'FORBIDDEN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: error.message || 'Administrative privileges required.' } },
        { status: 403 }
      );
    }

    console.error('[API ERROR] GET /api/v1/admin/exceptions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_EXCEPTIONS_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await authenticateAdminAsync(request);

    const body = await request.json().catch(() => ({}));
    const { actionType, entityId, reason } = body;

    if (!actionType || !entityId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'actionType and entityId are required.' } },
        { status: 400 }
      );
    }

    const result = await exceptionsEngine.resolveException({
      actionType,
      entityId,
      reason: reason || 'Admin resolved exception through Exceptions Center',
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Operational exception resolved successfully and recorded in audit trail.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'SESSION_EXPIRED') {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message || 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    if (error.code === 'FORBIDDEN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: error.message || 'Administrative privileges required.' } },
        { status: 403 }
      );
    }

    console.error('[API ERROR] POST /api/v1/admin/exceptions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'RESOLUTION_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
