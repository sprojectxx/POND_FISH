/**
 * Admin GPS Journeys Collection Endpoint
 * GET /api/v1/admin/gps/journeys
 * POST /api/v1/admin/gps/journeys
 * Traceability: PondFish Master PRD v2 (Section 22) & Admin Portal Spec (ADMIN-14)
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../../lib/auth/admin-auth');
const gpsTrackingEngine = require('../../../../../../lib/engines/gps-tracking');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    authenticateAdmin(request);

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const status = searchParams.get('status') || null;

    const journeys = await gpsTrackingEngine.listJourneys({ limit, offset, status });

    return NextResponse.json({
      success: true,
      data: journeys,
      count: journeys.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    console.error('[API ERROR] GET /api/v1/admin/gps/journeys:', error.message);
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_JOURNEYS_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    authenticateAdmin(request);

    const body = await request.json().catch(() => ({}));
    const { truckNumber, driverName, origin, destination, fishManifest } = body;

    const journey = await gpsTrackingEngine.createJourney({
      truckNumber,
      driverName,
      origin,
      destination,
      fishManifest,
    });

    return NextResponse.json(
      {
        success: true,
        data: journey,
        message: 'GPS journey created successfully in DRAFT state.',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    if (error.code === 'VALIDATION_FAILED') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    console.error('[API ERROR] POST /api/v1/admin/gps/journeys:', error.message);
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_JOURNEY_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
