/**
 * Admin Subscription Plan Fish Eligibility API
 * GET /api/v1/admin/subscriptions/plans/[id]/fish - List all fish with eligibility for plan
 * PUT /api/v1/admin/subscriptions/plans/[id]/fish - Atomically update eligible fish list for plan
 * POST /api/v1/admin/subscriptions/plans/[id]/fish - Alternative alias for updating eligible fish
 * Traceability: ADMIN-08 (Subscription Plans Fish Eligibility)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../../lib/auth/admin-auth');
const customerSubscriptionEngine = require('../../../../../../../../lib/engines/customer-subscription');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await authenticateAdminAsync(request);
    const { id } = await Promise.resolve(params);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PLAN_ID_REQUIRED',
            message: 'Plan ID parameter is required.',
          },
        },
        { status: 400 }
      );
    }

    const data = await customerSubscriptionEngine.getPlanFishEligibilityByAdmin(id);

    return NextResponse.json({
      success: true,
      plan: data.plan,
      totalFishCount: data.totalCount,
      eligibleFishCount: data.eligibleCount,
      fish: data.fish,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'PLAN_FISH_FETCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const admin = await authenticateAdminAsync(request);
    const { id } = await Promise.resolve(params);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PLAN_ID_REQUIRED',
            message: 'Plan ID parameter is required.',
          },
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const fishIds = Array.isArray(body.fishIds)
      ? body.fishIds
      : Array.isArray(body.eligibleFishIds)
      ? body.eligibleFishIds
      : null;

    if (!Array.isArray(fishIds)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'Payload must contain a "fishIds" array of fish UUIDs.',
          },
        },
        { status: 400 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    const result = await customerSubscriptionEngine.updatePlanFishEligibilityByAdmin(id, fishIds, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Plan fish eligibility updated successfully.',
      plan: result.plan,
      totalFishCount: result.totalFishCount,
      eligibleFishCount: result.eligibleFishCount,
      eligibleFish: result.eligibleFish,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'PLAN_FISH_UPDATE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}

export async function POST(request, context) {
  return PUT(request, context);
}
