/**
 * Public Fish Details Endpoint
 * GET /api/v1/public/fish/[id]
 * Traceability: PondFish API Specification (Section 10)
 */

import { NextResponse } from 'next/server';
const { getFishDetails } = require('../../../../../../lib/engines/catalogue');
const { isValidUUID } = require('../../../../../../lib/validators/common');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FISH_ID',
            message: 'A valid fish identifier must be provided.',
          },
        },
        { status: 400 }
      );
    }

    const item = await getFishDetails(id);

    if (!item) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FISH_NOT_FOUND',
            message: 'The requested fish was not found in the catalogue.',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: item,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[API ERROR] GET /api/v1/public/fish/${params?.id}:`, error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FISH_DETAILS_FAILED',
          message: 'Unable to retrieve fish details at this time.',
        },
      },
      { status: 500 }
    );
  }
}
