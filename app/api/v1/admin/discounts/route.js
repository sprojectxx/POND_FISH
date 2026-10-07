/**
 * Admin Discounts API
 * GET  /api/v1/admin/discounts - List all discount campaigns
 * POST /api/v1/admin/discounts - Create new discount campaign
 * Traceability: ADMIN-07 (Discounts)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../lib/auth/admin-auth');
const discountEngine = require('../../../../../lib/engines/discount');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);
    const discounts = await discountEngine.listDiscounts();

    return NextResponse.json({
      success: true,
      count: discounts.length,
      discounts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'DISCOUNTS_FETCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await authenticateAdminAsync(request);
    const body = await request.json().catch(() => ({}));
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    const newDiscount = await discountEngine.createDiscount(body, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Discount campaign created successfully.',
        discount: newDiscount,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'DISCOUNT_CREATE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
