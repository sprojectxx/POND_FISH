/**
 * Multi-Portal RBAC Authentication & Session Guard Middleware
 * Traceability: PondFish Core Business Engines (Engine 22) & Architecture Baseline
 */

import { NextResponse } from 'next/server.js';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Let static files, Next.js internals, and public assets pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Session token extraction from cookies or Authorization header
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const adminCookie = request.cookies.get('admin_session')?.value;
  const workerCookie = request.cookies.get('worker_session')?.value || request.cookies.get('pf_session')?.value;

  const adminToken = adminCookie || bearerToken;
  const workerToken = workerCookie || bearerToken || adminCookie;

  // 1. Admin API Route Guard
  if (pathname.startsWith('/api/v1/admin')) {
    // Whitelist explicitly public admin endpoints
    if (pathname === '/api/v1/admin/auth/login') {
      return NextResponse.next();
    }

    // Check for internal secrets or background scheduler tokens
    const hasInternalHeader = Boolean(request.headers.get('x-internal-secret') || request.headers.get('x-admin-key'));

    if (!adminToken && !hasInternalHeader) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Admin authentication required.',
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // Let other API routes pass through to their respective route handlers
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 2. Admin Page Route Guard
  if (pathname.startsWith('/admin')) {
    const isLoginPage = pathname === '/admin/login' || pathname.startsWith('/admin/login/');

    if (isLoginPage) {
      // If already authenticated, redirect away from login page to dashboard
      if (adminToken) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.next();
    }

    // All other /admin routes require an active admin session
    if (!adminToken) {
      const redirectUrl = new URL('/admin/login', request.url);
      const search = request.nextUrl.search || '';
      redirectUrl.searchParams.set('redirect', `${pathname}${search}`);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  }

  // 3. Worker Page Route Guard
  if (pathname.startsWith('/worker')) {
    const isWorkerLogin = pathname === '/worker/login' || pathname.startsWith('/worker/login/');

    if (isWorkerLogin) {
      if (workerToken) {
        return NextResponse.redirect(new URL('/worker', request.url));
      }
      return NextResponse.next();
    }

    if (!workerToken) {
      const redirectUrl = new URL('/worker/login', request.url);
      const search = request.nextUrl.search || '';
      redirectUrl.searchParams.set('redirect', `${pathname}${search}`);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

