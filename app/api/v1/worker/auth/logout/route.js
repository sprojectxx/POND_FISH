/**
 * Worker Logout Endpoint
 * POST /api/v1/worker/auth/logout
 * Traceability: PondFish Worker Portal Spec (WP-01)
 */

import { NextResponse } from 'next/server';
const { logoutWorker, extractWorkerToken } = require('../../../../../../lib/engines/worker');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const token = extractWorkerToken(request);
    if (token) {
      await logoutWorker(token);
    }

    const response = NextResponse.json({
      success: true,
      message: 'Worker logged out and session revoked successfully.',
      timestamp: new Date().toISOString(),
    });

    // Invalidate and clear the session cookie
    response.cookies.set('worker_session', '', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('[API ERROR] POST /api/v1/worker/auth/logout:', error.message);
    const response = NextResponse.json(
      {
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Unable to revoke worker session reliably due to a server error.',
        },
      },
      { status: 500 }
    );
    response.cookies.set('worker_session', '', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
    });
    return response;
  }
}
