/**
 * Admin Audit Trail API Endpoint
 * GET /api/v1/admin/audit
 * Traceability: AP-19 — Audit Trail Specification (Sections 164–168)
 * Read-only interface. Strictly immutable.
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../lib/auth/admin-auth');
const auditEngine = require('../../../../../lib/engines/audit');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    authenticateAdmin(request);

    const { searchParams } = new URL(request.url);
    const actorType = searchParams.get('actorType') || null;
    const entityType = searchParams.get('entityType') || null;
    const action = searchParams.get('action') || null;
    const search = searchParams.get('search') || null;
    const from = searchParams.get('from') || null;
    const to = searchParams.get('to') || null;
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '50';

    const result = await auditEngine.getAuditLogs({
      actorType,
      entityType,
      action,
      search,
      from,
      to,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    console.error('[API ERROR] GET /api/v1/admin/audit:', error);
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_AUDIT_LOGS_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
