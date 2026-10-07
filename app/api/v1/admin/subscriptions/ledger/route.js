/**
 * Admin Customer Subscription Credit Movement Ledger API
 * GET /api/v1/admin/subscriptions/ledger?customerId=... - Traceable movements with opening/closing balances
 * Traceability: ADMIN-09 (Subscription Credit Ledger)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const customerSubscriptionEngine = require('../../../../../../lib/engines/customer-subscription');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);
    const { searchParams } = new URL(request.url);

    const customerId = searchParams.get('customerId');
    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CUSTOMER_ID_REQUIRED',
            message: 'customerId query parameter is required.',
          },
        },
        { status: 400 }
      );
    }

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await customerSubscriptionEngine.getCustomerSubscriptionLedger(customerId, {
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result.entries,
      total: result.total,
      limit,
      offset,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'LEDGER_FETCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}
