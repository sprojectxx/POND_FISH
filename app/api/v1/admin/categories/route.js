/**
 * Admin Category Management API
 * GET  /api/v1/admin/categories - List all categories with fish count
 * POST /api/v1/admin/categories - Create new category
 * Traceability: ADMIN-06 (Category Management)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../lib/auth/admin-auth');
const adminCrudEngine = require('../../../../../lib/engines/admin-crud');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);
    const categories = await adminCrudEngine.listCategories();

    return NextResponse.json({
      success: true,
      count: categories.length,
      categories,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'CATEGORIES_FETCH_ERROR',
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

    const newCategory = await adminCrudEngine.createCategory(body, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Category created successfully.',
        category: newCategory,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'CATEGORY_CREATE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
