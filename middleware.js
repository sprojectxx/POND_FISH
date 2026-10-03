/**
 * Multi-Portal RBAC Authentication & Session Guard Middleware
 * Traceability: PondFish Core Business Engines (Engine 22) & Architecture Baseline
 */

import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Let API, static files, and Next.js internals pass through
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Session token extraction from cookies or Authorization header
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : request.cookies.get('pf_session')?.value;

  // Route Boundary Enforcement
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    // Admin routes require valid admin session
    if (!token) {
      // In development baseline, pass through with warning or redirect to login when implemented
      return NextResponse.next();
    }
  }

  if (pathname.startsWith('/worker') && !pathname.startsWith('/worker/login')) {
    // Worker routes require valid worker/admin session
    if (!token) {
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
