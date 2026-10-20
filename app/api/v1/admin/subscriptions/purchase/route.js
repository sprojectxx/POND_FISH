/**
 * Admin Customer Subscription Purchase API
 * POST /api/v1/admin/subscriptions/purchase - Admin-assisted subscription purchase
 * Traceability: ADMIN-09 (Add Subscription to Customer, Payment Sources: CASH & RAZORPAY)
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

    const {
      customerId,
      planId,
      paymentSource,
      confirmedByAdmin,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = body;

    const result = await customerSubscriptionEngine.adminPurchaseSubscription(
      {
        customerId,
        planId,
        paymentSource,
        confirmedByAdmin,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        idempotencyKey,
      },
      {
        actorId: admin.id,
        ip,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Subscription successfully purchased and activated.',
      data: {
        subscription: result.subscription,
        ledger: result.ledgerEntry,
        payment: result.payment,
        plan: result.plan,
        previousCredit: result.previousCredit,
        resultingBalance: result.ledgerEntry.resulting_balance,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'PURCHASE_FAILED',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
