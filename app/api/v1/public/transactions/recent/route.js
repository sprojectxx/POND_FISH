/**
 * Recent Successful Transactions Endpoint for TV Hydration & Reconnect
 * GET /api/v1/public/transactions/recent
 * Traceability: PondFish Master PRD v2 (Sec 3.5), TV Portal Spec (Sec 67, 132), Audit Sec 2.2
 * Returns display-safe active business-day successful transactions for the Shop Transaction TV Portal.
 */

import { NextResponse } from 'next/server';
const { getTodayTVFeed } = require('../../../../../../lib/engines/tv-feed');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const businessDate = searchParams.get('business_date') || null;

    const transactions = await getTodayTVFeed({
      limit,
      businessDate,
    });

    const nowIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        businessDate: businessDate || nowIST,
        count: transactions.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/v1/public/transactions/recent:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TV_FEED_FETCH_FAILED',
          message: 'Unable to retrieve recent transactions.',
        },
      },
      { status: 500 }
    );
  }
}
