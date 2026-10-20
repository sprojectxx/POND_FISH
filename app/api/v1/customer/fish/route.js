/**
 * Customer Fish Catalogue Listing Endpoint
 * GET /api/v1/customer/fish
 * Traceability: PondFish API Specification (Section 12) & Customer Portal PRD (CP-03)
 * Supports filters: category_id, search, online_bookable, availability, discount
 * Reuses the shared Catalogue Business Engine. Zero business logic duplication.
 */

import { NextResponse } from 'next/server';
const { getPublicCatalogue } = require('../../../../../lib/engines/catalogue');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const categoryId = searchParams.get('category_id') || searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;

    let onlineBookable;
    if (searchParams.has('online_bookable')) {
      onlineBookable = searchParams.get('online_bookable') === 'true';
    }

    let available;
    if (searchParams.has('availability')) {
      available = searchParams.get('availability') === 'true';
    } else if (searchParams.has('available')) {
      available = searchParams.get('available') === 'true';
    }

    const items = await getPublicCatalogue({
      categoryId,
      search,
      onlineBookable,
      available,
    });

    // Optional discount filter
    let filteredItems = items;
    if (searchParams.get('discount') === 'true') {
      filteredItems = items.filter((item) => item.pricing && item.pricing.hasDiscount);
    }

    return NextResponse.json({
      success: true,
      data: filteredItems,
      total: filteredItems.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/v1/customer/fish:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CUSTOMER_FISH_FETCH_FAILED',
          message: 'Unable to retrieve fish catalogue at this time. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}
