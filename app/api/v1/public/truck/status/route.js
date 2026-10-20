/**
 * Public Truck Replenishment Status Endpoint
 * GET /api/v1/public/truck/status
 * Traceability: PondFish Master PRD v2 (Section 22) & Public UI Spec
 * Exposes customer-safe delivery status for active replenishment truck journeys.
 * Does not require customer login; strictly enforces customer publication gate and post-arrival window.
 */

import { NextResponse } from 'next/server';
const gpsTrackingEngine = require('../../../../../../lib/engines/gps-tracking');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const liveData = await gpsTrackingEngine.getCustomerLiveTracking();

    return NextResponse.json({
      success: true,
      data: liveData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/v1/public/truck/status:', error.message);
    return NextResponse.json(
      {
        success: false,
        data: {
          active: false,
          message: 'Unable to retrieve live delivery tracking at this time.',
        },
      },
      { status: 200 }
    );
  }
}
