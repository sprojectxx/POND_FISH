/**
 * Admin Start Journey Endpoint
 * POST /api/v1/admin/gps/journeys/[id]/start
 * Traceability: PondFish Master PRD v2 (Section 22.1) & Admin Portal Spec (ADMIN-14 Section 123)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../../lib/auth/admin-auth');
const gpsTrackingEngine = require('../../../../../../../../lib/engines/gps-tracking');

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    await authenticateAdminAsync(request);

    const { id } = params;
    const started = await gpsTrackingEngine.startJourney(id);

    return NextResponse.json({
      success: true,
      data: started,
      message: 'Journey started successfully. GPS monitoring activated.',
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

    if (error.code === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Journey not found.' } },
        { status: 404 }
      );
    }

    if (error.code === 'INVALID_JOURNEY_STATE') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JOURNEY_STATE', message: error.message } },
        { status: 400 }
      );
    }

    console.error('[API ERROR] POST /api/v1/admin/gps/journeys/[id]/start:', error.message);
    return NextResponse.json(
      { success: false, error: { code: 'START_JOURNEY_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
