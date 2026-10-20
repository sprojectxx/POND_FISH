/**
 * Customer Categories Endpoint
 * GET /api/v1/customer/categories
 * Traceability: PondFish API Specification (Section 12)
 * Reuses the shared Catalogue Business Engine. Zero SQL in route handler.
 */

import { NextResponse } from 'next/server';
const { getCategories } = require('../../../../../lib/engines/catalogue');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json({
      success: true,
      data: categories,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/v1/customer/categories:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CATEGORIES_FETCH_FAILED',
          message: 'Unable to retrieve fish categories at this time.',
        },
      },
      { status: 500 }
    );
  }
}
