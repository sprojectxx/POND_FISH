/**
 * Admin GPS Journey Detail Endpoint
 * GET /api/v1/admin/gps/journeys/[id]
 * Traceability: PondFish Master PRD v2 (Section 22) & Admin Portal Spec (ADMIN-14)
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../../../lib/auth/admin-auth');
const gpsTrackingEngine = require('../../../../../../../lib/engines/gps-tracking');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    authenticateAdmin(request);

    const { id } = params;
    const view = await gpsTrackingEngine.getAdminJourneyView(id);

    return NextResponse.json({
      success: true,
      data: view,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    if (error.code === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Journey not found.' } },
        { status: 404 }
      );
    }

    console.error('[API ERROR] GET /api/v1/admin/gps/journeys/[id]:', error.message);
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_JOURNEY_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
