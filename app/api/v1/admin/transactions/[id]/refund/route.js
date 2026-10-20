/**
 * Admin Transaction Refund & Restoration API
 * POST /api/v1/admin/transactions/[id]/refund
 * Traceability: ADMIN-13 (Sections 107, 116), Core Business Engines Spec (Section 21)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../lib/auth/admin-auth');
const transactionEngine = require('../../../../../../../lib/engines/transaction');

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const admin = await authenticateAdminAsync(request);
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;

    const body = await request.json().catch(() => ({}));
    const { reason, notes } = body;

    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const result = await transactionEngine.adminRefundTransaction(
      {
        transactionId: id,
        reason,
        notes,
      },
      {
        actorId: admin.id,
        ip,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Transaction refunded successfully. Stock returned to inventory and customer subscription benefits restored.',
      transaction: result.transaction,
      restoration: result.restoration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'TRANSACTION_REFUND_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
