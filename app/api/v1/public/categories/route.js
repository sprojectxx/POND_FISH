/**
 * Public Active Categories Endpoint
 * GET /api/v1/public/categories
 * Traceability: PondFish API Specification (Section 10)
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
      total: categories.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/v1/public/categories:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CATEGORIES_FETCH_FAILED',
          message: 'Unable to retrieve categories at this time.',
        },
      },
      { status: 500 }
    );
  }
}
