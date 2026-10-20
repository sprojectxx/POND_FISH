/**
 * Multi-Portal RBAC Authentication & Session Guard Middleware
 * Traceability: PondFish Core Business Engines (Engine 22) & Architecture Baseline
 */

import { NextResponse } from 'next/server.js';

function base64UrlToUint8Array(base64Url) {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing in production.');
    }
    return 'pondfish-dev-only-secret-do-not-use-in-production';
  }
  return secret;
}

/**
 * Verify JWT signature, expiry, and payload integrity using standard Web Crypto API
 * Runs safely in all Next.js runtimes (Node.js and Edge) with zero dependencies
 * @param {string} token
 * @returns {Promise<object|null>}
 */
async function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(payloadB64)));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null; // Expired token
    }
    const secret = getJwtSecret();
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToUint8Array(sigB64);
    const isValid = await crypto.subtle.verify('HMAC', key, signature, data);
    return isValid ? payload : null;
  } catch {
    return null;
  }
}

export async function middleware(request) {
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
  const workerToken = workerCookie || bearerToken; // Worker token MUST never inherit adminCookie

  // 1. Admin API Route Guard
  if (pathname.startsWith('/api/v1/admin')) {
    // Whitelist explicitly public admin endpoints
    if (pathname === '/api/v1/admin/auth/login') {
      return NextResponse.next();
    }

    // Specific background scheduler & telemetry endpoints that support server-side secret validation
    const isSchedulerEndpoint = pathname === '/api/v1/admin/notifications/process-scheduled';
    const isTelemetryEndpoint = /^\/api\/v1\/admin\/gps\/journeys\/[^/]+\/positions$/.test(pathname);

    if (isSchedulerEndpoint) {
      const hasCronAuth = Boolean(request.headers.get('x-internal-secret') || request.headers.get('authorization'));
      if (!adminToken && !hasCronAuth) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required for scheduled broadcast processor.',
            },
          },
          { status: 401 }
        );
      }
      return NextResponse.next();
    }

    if (isTelemetryEndpoint) {
      const hasTelemetryKey = Boolean(request.headers.get('x-admin-key'));
      if (!adminToken && !hasTelemetryKey) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Admin session or telemetry API key required.',
            },
          },
          { status: 401 }
        );
      }
      return NextResponse.next();
    }

    // All standard admin routes strictly require a cryptographically valid admin session
    if (!adminToken) {
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

    const adminPayload = await verifyJwt(adminToken);
    if (!adminPayload || (adminPayload.role !== 'ADMIN' && !adminPayload.is_super_admin)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Administrative privileges required.',
          },
        },
        { status: 403 }
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
    const adminPayload = await verifyJwt(adminToken);
    const isValidAdmin = Boolean(adminPayload && (adminPayload.role === 'ADMIN' || adminPayload.is_super_admin));

    if (isLoginPage) {
      if (isValidAdmin) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.next();
    }

    if (!isValidAdmin) {
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
    const workerPayload = await verifyJwt(workerToken);
    const isValidWorker = Boolean(workerPayload && workerPayload.role === 'WORKER');

    if (isWorkerLogin) {
      if (isValidWorker) {
        return NextResponse.redirect(new URL('/worker', request.url));
      }
      return NextResponse.next();
    }

    if (!isValidWorker) {
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

