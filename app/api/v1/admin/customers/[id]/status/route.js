/**
 * Admin Customer Status API
 * PATCH /api/v1/admin/customers/[id]/status - Update customer blocked status
 * Traceability: ADMIN-10 (Block / Reactivate Customer)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../lib/auth/admin-auth');
const customerEngine = require('../../../../../../../lib/engines/customer');

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  try {
    const admin = await authenticateAdminAsync(request);
    const { id } = params;

    const body = await request.json().catch(() => ({}));
    if (typeof body.blocked !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS_PAYLOAD',
            message: 'Field "blocked" (boolean) is required.',
          },
        },
        { status: 400 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const result = await customerEngine.setCustomerStatus(
      id,
      { blocked: body.blocked },
      { actorId: admin.id, ip }
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'CUSTOMER_STATUS_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}
