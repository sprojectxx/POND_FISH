/**
 * Admin Reports API Endpoint
 * GET /api/v1/admin/reports
 * Traceability: AP-18 — Reports & Exports Specification
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../lib/auth/admin-auth');
const reportingEngine = require('../../../../../lib/engines/reporting');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    authenticateAdmin(request);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'revenue';
    const period = searchParams.get('period') || 'this_month';
    const from = searchParams.get('from') || null;
    const to = searchParams.get('to') || null;
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '50';

    const report = await reportingEngine.generateReport({
      type,
      period,
      from,
      to,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    if (error.code === 'INVALID_REPORT_TYPE') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REPORT_TYPE', message: error.message } },
        { status: 400 }
      );
    }

    console.error('[API ERROR] GET /api/v1/admin/reports:', error);
    return NextResponse.json(
      { success: false, error: { code: 'REPORT_GENERATION_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
