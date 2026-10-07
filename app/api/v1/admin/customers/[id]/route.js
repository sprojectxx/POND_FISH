/**
 * Admin Customer Details API
 * GET /api/v1/admin/customers/[id] - Get customer profile, subscriptions, bookings, and transactions
 * Traceability: ADMIN-10 (Customer Details Modal / Drawer)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const customerEngine = require('../../../../../../lib/engines/customer');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await authenticateAdminAsync(request);
    const { id } = params;

    const data = await customerEngine.getCustomerDetailsForAdmin(id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'CUSTOMER_FETCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}
