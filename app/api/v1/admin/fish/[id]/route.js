/**
 * Admin Fish Details & Mutations API
 * GET    /api/v1/admin/fish/[id] - Get fish details
 * PATCH  /api/v1/admin/fish/[id] - Update fish fields & availability
 * DELETE /api/v1/admin/fish/[id] - Delete fish
 * Traceability: ADMIN-05 (Fish Management)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const adminCrudEngine = require('../../../../../../lib/engines/admin-crud');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await authenticateAdminAsync(request);
    const { id } = params;

    const fish = await adminCrudEngine.getFish(id);
    if (!fish) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FISH_NOT_FOUND',
            message: 'Fish record not found.',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      fish,
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

export async function PATCH(request, { params }) {
  try {
    const admin = await authenticateAdminAsync(request);
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    const updatedFish = await adminCrudEngine.updateFish(id, body, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Fish record updated successfully.',
      fish: updatedFish,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'FISH_UPDATE_ERROR',
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

    await adminCrudEngine.deleteFish(id, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Fish record removed successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'FISH_DELETE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
