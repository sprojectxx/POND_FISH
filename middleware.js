/**
 * Multi-Portal RBAC Authentication & Session Guard Middleware
 * Traceability: PondFish Core Business Engines (Engine 22) & Architecture Baseline
 */

import crypto from 'crypto';
import { NextResponse } from 'next/server.js';

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
 * Verify JWT signature, expiry, and payload integrity synchronously
 * @param {string} token
 * @returns {object|null}
 */
function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null; // Expired token
    }
    const secret = getJwtSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (expectedSig.length !== sigB64.length) return null;
    let match = 0;
    for (let i = 0; i < expectedSig.length; i++) {
      match |= expectedSig.charCodeAt(i) ^ sigB64.charCodeAt(i);
    }
    return match === 0 ? payload : null;
  } catch {
    return null;
  }
}

export function middleware(request) {
  const rawPathname = request.nextUrl.pathname;
  // Normalize path: decode URI components, collapse consecutive slashes, and strip trailing slash
  let pathname = rawPathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    // Malformed percent-encoding is an invalid HTTP request; fail closed with 400
    if (rawPathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MALFORMED_URI_ENCODING',
            message: 'Malformed URI percent-encoding in request path.',
          },
        },
        { status: 400 }
      );
    }
    return new NextResponse('Bad Request: Malformed URI encoding', { status: 400 });
  }

  pathname = pathname.replace(/\/{2,}/g, '/');
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '');
  }

  // Let static files, Next.js internals, and public assets pass through
  const isProtectedPath = pathname.startsWith('/admin') || pathname.startsWith('/worker') || pathname.startsWith('/api');
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    (!isProtectedPath && pathname.includes('.'))
  ) {
    return NextResponse.next();
  }

  // Session token extraction from cookies or Authorization header
  const authHeader = request.headers.get('authorization');
  const bearerToken = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7).trim() : null;
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

    const adminPayload = verifyJwt(adminToken);
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

  // 1b. Worker API Route Guard
  if (pathname.startsWith('/api/v1/worker')) {
    // Whitelist explicitly public worker endpoints
    if (pathname === '/api/v1/worker/auth/login' || pathname === '/api/v1/worker/auth/logout') {
      return NextResponse.next();
    }

    if (!workerToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Worker authentication required.',
          },
        },
        { status: 401 }
      );
    }

    const workerPayload = verifyJwt(workerToken);
    if (!workerPayload || workerPayload.role !== 'WORKER') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Worker privileges required.',
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
    const adminPayload = verifyJwt(adminToken);
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
    const workerPayload = verifyJwt(workerToken);
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

