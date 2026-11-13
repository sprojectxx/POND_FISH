/**
 * Worker Session Verification Endpoint
 * GET /api/v1/worker/auth/me
 * Traceability: PondFish Worker Portal Spec (WP-01)
 * Retrieves current authenticated worker profile.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionAsync, extractWorkerToken } = require('../../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const token = extractWorkerToken(request);
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Worker authentication session or token is required.',
          },
        },
        { status: 401 }
      );
    }

    const session = await verifyWorkerSessionAsync(token);
    const worker = session.worker;

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
    if (error.code === 'WORKER_ACCOUNT_DISABLED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WORKER_ACCOUNT_DISABLED',
            message: error.message || 'Your worker account is disabled. Contact your administrator.',
          },
        },
        { status: 403 }
      );
    }

    if (error.code === 'FORBIDDEN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message || 'Forbidden: Worker role required.',
          },
        },
        { status: 403 }
      );
    }

    if (error.code === 'UNAUTHORIZED' || error.code === 'SESSION_EXPIRED' || error.code === 'SESSION_REVOKED' || error.code === 'WORKER_NOT_FOUND') {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: error.code || 'UNAUTHORIZED',
            message: error.message || 'Valid worker authorization is required.',
          },
        },
        { status: 401 }
      );
      // Explicitly purge revoked worker cookie
      response.cookies.set('worker_session', '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      response.cookies.set('pf_session', '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      return response;
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
