/**
 * Worker Session Verification Endpoint
 * GET /api/v1/worker/auth/me
 * Traceability: PondFish Worker Portal Spec (WP-01)
 * Retrieves current authenticated worker profile.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionToken } = require('../../../../../../lib/engines/worker');
const { findWorkerById } = require('../../../../../../lib/db/repositories/workerRepository');

export const dynamic = 'force-dynamic';

function authenticateWorkerRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('MISSING_BEARER_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const token = authHeader.substring(7).trim();
  return verifyWorkerSessionToken(token);
}

export async function GET(request) {
  try {
    const session = authenticateWorkerRequest(request);
    const worker = await findWorkerById(session.workerId);

    if (!worker) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WORKER_NOT_FOUND',
            message: 'Worker account no longer exists.',
          },
        },
        { status: 404 }
      );
    }

    if (!worker.active) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WORKER_ACCOUNT_DISABLED',
            message: 'Your worker account is disabled. Contact your administrator.',
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        worker: {
          id: worker.id,
          name: worker.name,
          mobileNumber: worker.mobile_number,
          active: worker.active,
          createdAt: worker.created_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: 'Valid worker authorization is required.',
          },
        },
        { status: error.code === 'FORBIDDEN' ? 403 : 401 }
      );
    }

    console.error('[API ERROR] GET /api/v1/worker/auth/me:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROFILE_FETCH_FAILED',
          message: 'Unable to verify worker session.',
        },
      },
      { status: 500 }
    );
  }
}
