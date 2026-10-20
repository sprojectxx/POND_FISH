/**
 * Admin Single Worker API
 * GET /api/v1/admin/workers/[id] - Get worker details
 * PATCH /api/v1/admin/workers/[id] - Update worker details (name, mobile, active status)
 * Traceability: ADMIN-11 (Worker Edit & Status Management)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const workerEngine = require('../../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await authenticateAdminAsync(request);
    const { id } = params;

    const worker = await workerEngine.getWorkerDetailsForAdmin(id);

    return NextResponse.json({
      success: true,
      worker,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'WORKER_FETCH_ERROR',
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
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    const updated = await workerEngine.updateWorkerByAdmin(id, body, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json({
      success: true,
      worker: updated,
      message: 'Worker updated successfully.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'WORKER_UPDATE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
