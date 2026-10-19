/**
 * Admin GPS Position Telemetry Ingestion Endpoint
 * POST /api/v1/admin/gps/journeys/[id]/positions
 * Traceability: PondFish Integration Specification (Section 9.4), Master PRD v2 (Section 22.3, 22.4)
 * Ingests genuine GPS coordinates from hardware/webhook/admin telemetry.
 * Automatically detects geofenced arrival and enforces post-arrival tracking closure.
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../../lib/auth/admin-auth');
const gpsTrackingEngine = require('../../../../../../../../lib/engines/gps-tracking');

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    await authenticateAdminAsync(request, { allowApiKey: true });

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { latitude, longitude, speed, heading, recordedAt } = body;

    const result = await gpsTrackingEngine.ingestPosition(id, {
      latitude,
      longitude,
      speed,
      heading,
      recordedAt: recordedAt || new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: result.arrived
          ? 'GPS position recorded. Truck is inside store geofence (ARRIVED).'
          : 'GPS position recorded successfully.',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
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

    if (error.code === 'VALIDATION_FAILED') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    console.error('[API ERROR] POST /api/v1/admin/gps/journeys/[id]/positions:', error.message);
    return NextResponse.json(
      { success: false, error: { code: 'INGEST_POSITION_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
