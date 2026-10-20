/**
 * Admin Subscription Plans API
 * GET  /api/v1/admin/subscriptions/plans - List all subscription plans with subscriber metrics
 * POST /api/v1/admin/subscriptions/plans - Create a new subscription plan
 * Traceability: ADMIN-08 (Subscription Plans)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const customerSubscriptionEngine = require('../../../../../../lib/engines/customer-subscription');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);

    const plans = await customerSubscriptionEngine.listPlansForAdmin();

    return NextResponse.json({
      success: true,
      count: plans.length,
      plans,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'PLANS_FETCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await authenticateAdminAsync(request);
    const body = await request.json().catch(() => ({}));
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    const newPlan = await customerSubscriptionEngine.createPlanByAdmin(body, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Subscription plan created successfully.',
        plan: newPlan,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'PLAN_CREATE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
