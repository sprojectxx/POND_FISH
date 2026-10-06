/**
 * Admin Close Customer Tracking Endpoint
 * POST /api/v1/admin/gps/journeys/[id]/close-tracking
 * Traceability: PondFish Master PRD v2 (Section 22.5) & Admin Portal Spec (ADMIN-14 Section 129)
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../../../../lib/auth/admin-auth');
const gpsTrackingEngine = require('../../../../../../../../lib/engines/gps-tracking');

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    authenticateAdmin(request);

    const { id } = params;
    const closed = await gpsTrackingEngine.closeCustomerTracking(id);

    return NextResponse.json({
      success: true,
      data: closed,
      message: 'Customer tracking closed for this journey.',
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

    console.error('[API ERROR] POST /api/v1/admin/gps/journeys/[id]/close-tracking:', error.message);
    return NextResponse.json(
      { success: false, error: { code: 'CLOSE_TRACKING_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
