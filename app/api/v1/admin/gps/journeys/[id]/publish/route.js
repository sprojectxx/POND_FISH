/**
 * Admin Journey Customer Publication Gate Endpoint
 * POST /api/v1/admin/gps/journeys/[id]/publish
 * Traceability: PondFish Master PRD v2 (Section 22.2) & Admin Portal Spec (ADMIN-14 Section 124)
 * Allows administrator to explicitly publish or unpublish journey tracking to customers.
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../../lib/auth/admin-auth');
const gpsTrackingEngine = require('../../../../../../../../lib/engines/gps-tracking');

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const admin = await authenticateAdminAsync(request);

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const published = body.published !== undefined ? Boolean(body.published) : true;

    const updated = await gpsTrackingEngine.setCustomerPublication(id, published, admin.id);

    return NextResponse.json({
      success: true,
      data: updated,
      message: published
        ? 'Journey tracking published to customer mobile app.'
        : 'Journey tracking unpublished from customer view.',
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

    console.error('[API ERROR] POST /api/v1/admin/gps/journeys/[id]/publish:', error.message);
    return NextResponse.json(
      { success: false, error: { code: 'PUBLISH_JOURNEY_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
