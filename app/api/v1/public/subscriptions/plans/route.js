/**
 * Public Active Subscription Plans Endpoint
 * GET /api/v1/public/subscriptions/plans
 * Traceability: PondFish PRD v2 (Section PW-04) & Design System UI/UX Spec (PW-04)
 * Returns active subscription plans directly from authoritative PostgreSQL database.
 */

import { NextResponse } from 'next/server';
const { getActivePlans } = require('../../../../../../lib/engines/subscription-plan');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const plans = await getActivePlans();

    return NextResponse.json({
      success: true,
      data: plans,
      count: plans.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/v1/public/subscriptions/plans:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SUBSCRIPTION_PLANS_FETCH_FAILED',
          message: 'Unable to retrieve subscription plans at this time.',
        },
      },
      { status: 500 }
    );
  }
}
