/**
 * Admin Reports CSV Export API Endpoint
 * GET /api/v1/admin/reports/export
 * Traceability: AP-18 — Reports & Exports Specification (Section 162 & 163)
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../../lib/auth/admin-auth');
const reportingEngine = require('../../../../../../lib/engines/reporting');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    authenticateAdmin(request);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'revenue';
    const period = searchParams.get('period') || 'this_month';
    const from = searchParams.get('from') || null;
    const to = searchParams.get('to') || null;

    const { csvContent, filename } = await reportingEngine.generateCsvExport({
      type,
      period,
      from,
      to,
    });

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    console.error('[API ERROR] GET /api/v1/admin/reports/export:', error);
    return NextResponse.json(
      { success: false, error: { code: 'EXPORT_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
