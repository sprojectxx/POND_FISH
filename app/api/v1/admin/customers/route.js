/**
 * Admin Customers API
 * GET /api/v1/admin/customers - List all customers with metrics & status
 * Traceability: ADMIN-10 (Customer List)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../lib/auth/admin-auth');
const customerEngine = require('../../../../../lib/engines/customer');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || undefined;
    const hasSubParam = searchParams.get('hasSubscription');
    const hasSubscription = hasSubParam !== null ? hasSubParam === 'true' : undefined;

    const customers = await customerEngine.listCustomersForAdmin({
      search,
      hasSubscription,
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
          code: error.code || 'CUSTOMERS_FETCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}
