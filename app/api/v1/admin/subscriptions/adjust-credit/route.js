/**
 * Admin Customer Subscription Credit Adjustment API
 * POST /api/v1/admin/subscriptions/adjust-credit - Manual credit adjustment with mandatory reason
 * Traceability: ADMIN-09 (Manual Credit Adjustment)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const customerSubscriptionEngine = require('../../../../../../lib/engines/customer-subscription');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const admin = await authenticateAdminAsync(request);
    const body = await request.json().catch(() => ({}));
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const idempotencyKey = request.headers.get('x-idempotency-key') || body.idempotencyKey;

    const { customerId, amount, direction, reason } = body;

    const result = await customerSubscriptionEngine.adminAdjustCustomerCredit(
      {
        customerId,
        amount,
        direction,
        reason,
        idempotencyKey,
      },
      {
        actorId: admin.id,
        ip,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Subscription credit adjusted successfully.',
      data: {
        subscriptionId: result.subscriptionId,
        customerId: result.customerId,
        previousBalance: result.previousBalance,
        adjustmentAmount: result.adjustmentAmount,
        direction: result.direction,
        resultingBalance: result.resultingBalance,
        reason: result.reason,
        ledger: result.ledgerEntry,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'CREDIT_ADJUSTMENT_FAILED',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
