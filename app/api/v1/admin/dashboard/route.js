/**
 * Admin Executive Dashboard API Endpoint
 * GET /api/v1/admin/dashboard
 * Traceability: AP-02 — Executive Dashboard Specification
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../lib/auth/admin-auth');
const adminDashboardEngine = require('../../../../../lib/engines/admin-dashboard');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);

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

    console.error('[API ERROR] GET /api/v1/admin/dashboard:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DASHBOARD_FETCH_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
