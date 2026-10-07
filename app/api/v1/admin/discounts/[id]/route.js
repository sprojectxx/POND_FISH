/**
 * Admin Discount Detail & Mutations API
 * GET    /api/v1/admin/discounts/[id] - Get discount detail
 * PATCH  /api/v1/admin/discounts/[id] - Update discount
 * DELETE /api/v1/admin/discounts/[id] - Delete discount
 * Traceability: ADMIN-07 (Discounts)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const discountEngine = require('../../../../../../lib/engines/discount');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await authenticateAdminAsync(request);
    const { id } = params;

    const discount = await discountEngine.getDiscount(id);
    if (!discount) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DISCOUNT_NOT_FOUND',
            message: 'Discount campaign not found.',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      discount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'DISCOUNT_FETCH_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const admin = await authenticateAdminAsync(request);
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    const updatedDiscount = await discountEngine.updateDiscount(id, body, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Discount campaign updated successfully.',
      discount: updatedDiscount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'DISCOUNT_UPDATE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const admin = await authenticateAdminAsync(request);
    const { id } = params;
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    await discountEngine.deleteDiscount(id, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Discount campaign removed successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'DISCOUNT_DELETE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
