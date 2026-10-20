/**
 * Public Fish Catalogue Endpoint
 * GET /api/v1/public/fish
 * Traceability: PondFish API Specification (Section 10)
 */

import { NextResponse } from 'next/server';
const { getPublicCatalogue } = require('../../../../../lib/engines/catalogue');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Native Vanilla JS query validation & extraction
    const categoryId = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    
    let onlineBookable;
    if (searchParams.has('online_bookable')) {
      onlineBookable = searchParams.get('online_bookable') === 'true';
    }

    let available;
    if (searchParams.has('available')) {
      available = searchParams.get('available') === 'true';
    }

    // Call domain business engine
    const items = await getPublicCatalogue({
      categoryId,
      search,
      onlineBookable,
      available,
    });

    return NextResponse.json({
      success: true,
      data: items,
      total: items.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/v1/public/fish:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CATALOGUE_FETCH_FAILED',
          message: 'Unable to retrieve fish catalogue at this time. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}
