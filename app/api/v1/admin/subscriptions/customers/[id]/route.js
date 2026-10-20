/**
 * Admin Customer Subscription Details API
 * GET /api/v1/admin/subscriptions/customers/[id] - Get comprehensive subscription profile for customer
 * Traceability: ADMIN-09 (Current Subscription Summary, Expiry, History, Usage, Restoration)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../lib/auth/admin-auth');
const customerSubscriptionEngine = require('../../../../../../../lib/engines/customer-subscription');

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
            code: 'CUSTOMER_ID_REQUIRED',
            message: 'Customer ID parameter is required.',
          },
        },
        { status: 400 }
      );
    }

    const details = await customerSubscriptionEngine.getCustomerSubscriptionDetails(id);

    return NextResponse.json({
      success: true,
      data: details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'CUSTOMER_SUBSCRIPTION_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}
