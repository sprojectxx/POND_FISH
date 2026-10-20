/**
 * Worker Logout Endpoint
 * POST /api/v1/worker/auth/logout
 * Traceability: PondFish Worker Portal Spec (WP-01)
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'Worker logged out successfully.',
    timestamp: new Date().toISOString(),
  });
}
