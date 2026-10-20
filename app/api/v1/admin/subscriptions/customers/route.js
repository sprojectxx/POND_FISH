/**
 * Admin Customer Subscription Search API
 * GET /api/v1/admin/subscriptions/customers - Search customers with subscription state
 * Traceability: ADMIN-09 (Search Customer)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const customerSubscriptionEngine = require('../../../../../../lib/engines/customer-subscription');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const customers = await customerSubscriptionEngine.searchCustomersForSubscription({
      search,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      count: customers.length,
      customers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'CUSTOMERS_SEARCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}
