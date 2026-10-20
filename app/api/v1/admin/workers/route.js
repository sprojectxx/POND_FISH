/**
 * Admin Workers API
 * GET /api/v1/admin/workers - List all worker accounts with fulfillment metrics
 * POST /api/v1/admin/workers - Create new worker account
 * Traceability: ADMIN-11 (Worker Management Directory)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../lib/auth/admin-auth');
const workerEngine = require('../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateAdminAsync(request);

    const workers = await workerEngine.listWorkersForAdmin();

    return NextResponse.json({
      success: true,
      count: workers.length,
      workers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'WORKERS_FETCH_ERROR',
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
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    const worker = await workerEngine.createWorkerByAdmin(body, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json(
      {
        success: true,
        worker,
        message: 'Worker account created successfully.',
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'WORKER_CREATE_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
