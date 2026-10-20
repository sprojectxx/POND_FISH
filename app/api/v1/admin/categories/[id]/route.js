/**
 * Admin Category Mutations API
 * PATCH  /api/v1/admin/categories/[id] - Update category
 * DELETE /api/v1/admin/categories/[id] - Delete category
 * Traceability: ADMIN-06 (Category Management)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const adminCrudEngine = require('../../../../../../lib/engines/admin-crud');

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  try {
    const admin = await authenticateAdminAsync(request);
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    const updatedCategory = await adminCrudEngine.updateCategory(id, body, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Category updated successfully.',
      category: updatedCategory,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'CATEGORY_UPDATE_ERROR',
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

    await adminCrudEngine.deleteCategory(id, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'CATEGORY_DELETE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
