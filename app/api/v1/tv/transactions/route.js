/**
 * TV Transactions Feed Endpoint
 * GET /api/v1/tv/transactions
 * Traceability: PondFish Transaction TV Spec (Sec 67)
 * Returns display-safe active business-day successful transactions for the Shop Transaction TV Portal.
 */

import { NextResponse } from 'next/server';
const { getTodayTVFeed } = require('../../../../../lib/engines/tv-feed');

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
    console.error('[API ERROR] GET /api/v1/tv/transactions:', error.message);
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
