/**
 * Admin Worker Password Reset API
 * POST /api/v1/admin/workers/[id]/reset-password - Set new password for worker
 * Traceability: ADMIN-11 (Reset Worker Credentials)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../../lib/auth/admin-auth');
const workerEngine = require('../../../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const admin = await authenticateAdminAsync(request);
    const { id } = params;
    const body = await request.json().catch(() => ({}));

    if (!body.password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PASSWORD_REQUIRED',
            message: 'New password is required.',
          },
        },
        { status: 400 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const result = await workerEngine.resetWorkerPasswordByAdmin(id, body.password, {
      actorId: admin.id,
      ip,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'PASSWORD_RESET_ERROR',
          message: error.message,
        },
      },
      { status: error.status || 400 }
    );
  }
}
