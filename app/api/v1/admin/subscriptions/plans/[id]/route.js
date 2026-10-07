/**
 * Admin Subscription Plan Detail & Mutation API
 * PATCH /api/v1/admin/subscriptions/plans/[id] - Update subscription plan or toggle active status
 * Traceability: ADMIN-08 (Subscription Plans)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../lib/auth/admin-auth');
const customerSubscriptionEngine = require('../../../../../../../lib/engines/customer-subscription');

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
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
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    // If request is purely toggling active status
    if (Object.keys(body).length === 1 && body.active !== undefined) {
      const updatedPlan = await customerSubscriptionEngine.togglePlanActiveByAdmin(id, body.active, {
        actorId: admin.id,
        ip,
      });

      return NextResponse.json({
        success: true,
        message: `Plan ${body.active ? 'activated' : 'deactivated'} successfully.`,
        plan: updatedPlan,
        timestamp: new Date().toISOString(),
      });
    }

    // General plan update
    const updatedPlan = await customerSubscriptionEngine.updatePlanByAdmin(id, body, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription plan updated successfully.',
      plan: updatedPlan,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'PLAN_UPDATE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
