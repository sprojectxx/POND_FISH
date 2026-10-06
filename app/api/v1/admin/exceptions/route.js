/**
 * Admin Operational Exceptions Center API Endpoint
 * GET /api/v1/admin/exceptions
 * POST /api/v1/admin/exceptions
 * Traceability: AP-20 — Operational Exceptions Specification
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../lib/auth/admin-auth');
const exceptionsEngine = require('../../../../../lib/engines/exceptions');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    authenticateAdmin(request);

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
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
        { status: 401 }
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
    const admin = authenticateAdmin(request);

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
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    console.error('[API ERROR] POST /api/v1/admin/exceptions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'RESOLUTION_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
