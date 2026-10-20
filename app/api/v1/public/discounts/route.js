/**
 * Public Active Discounts Endpoint
 * GET /api/v1/public/discounts
 * Traceability: PondFish API Specification (Section 10)
 */

import { NextResponse } from 'next/server';
const { getActiveOffers } = require('../../../../../lib/engines/catalogue');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const discounts = await getActiveOffers();

    return NextResponse.json({
      success: true,
      data: discounts,
      total: discounts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/v1/public/discounts:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DISCOUNTS_FETCH_FAILED',
          message: 'Unable to retrieve active promotions at this time.',
        },
      },
      { status: 500 }
    );
  }
}
