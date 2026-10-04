/**
 * Customer Fish Details Endpoint
 * GET /api/v1/customer/fish/[id]
 * Traceability: PondFish API Specification (Section 12) & Customer Portal PRD (CP-04)
 * Distinguishes physical availability from online booking eligibility.
 */

import { NextResponse } from 'next/server';
const { getFishDetails } = require('../../../../../../lib/engines/catalogue');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Validate UUID format
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FISH_ID',
            message: 'Provided fish identifier is not a valid UUID format.',
          },
        },
        { status: 400 }
      );
    }

    const fish = await getFishDetails(id);

    if (!fish) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FISH_NOT_FOUND',
            message: 'Requested fish was not found in the live catalogue.',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: fish,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/v1/customer/fish/[id]:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FISH_DETAILS_FETCH_FAILED',
          message: 'Unable to retrieve fish details at this time.',
        },
      },
      { status: 500 }
    );
  }
}
