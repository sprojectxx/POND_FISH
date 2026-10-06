/**
 * Admin Executive Dashboard API Endpoint
 * GET /api/v1/admin/dashboard
 * Traceability: AP-02 — Executive Dashboard Specification
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../lib/auth/admin-auth');
const adminDashboardEngine = require('../../../../../lib/engines/admin-dashboard');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    authenticateAdmin(request);

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';
    const from = searchParams.get('from') || null;
    const to = searchParams.get('to') || null;

    const data = await adminDashboardEngine.getDashboardMetrics({ period, from, to });

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    console.error('[API ERROR] GET /api/v1/admin/dashboard:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DASHBOARD_FETCH_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
