/**
 * Admin Fish Management API
 * GET  /api/v1/admin/fish - List all fish with inventory and category details
 * POST /api/v1/admin/fish - Create new fish
 * Traceability: ADMIN-05 (Fish Management)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../lib/auth/admin-auth');
const adminCrudEngine = require('../../../../../lib/engines/admin-crud');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);
    const { searchParams } = new URL(request.url);

    const categoryId = searchParams.get('categoryId') || undefined;
    const search = searchParams.get('search') || undefined;
    const onlineBookableParam = searchParams.get('onlineBookable');
    const availableParam = searchParams.get('available');
    const freshnessState = searchParams.get('freshnessState') || undefined;

    const filters = {
      categoryId,
      search,
      onlineBookable: onlineBookableParam !== null ? onlineBookableParam === 'true' : undefined,
      available: availableParam !== null ? availableParam === 'true' : undefined,
      freshnessState,
    };

    const fishList = await adminCrudEngine.listFish(filters);

    return NextResponse.json({
      success: true,
      count: fishList.length,
      fish: fishList,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'FISH_FETCH_ERROR',
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

    const newFish = await adminCrudEngine.createFish(body, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Fish created successfully.',
        fish: newFish,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'FISH_CREATE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
