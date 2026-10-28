/**
 * Multi-Portal RBAC Authentication & Session Guard Middleware
 * Traceability: PondFish Core Business Engines (Engine 22) & Architecture Baseline
 */

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
 * Safely decode a base64url string into a Uint8Array across Edge, Node, and browser runtimes
 * @param {string} base64Url
 * @returns {Uint8Array}
 */
function base64UrlToUint8Array(base64Url) {
  if (typeof base64Url !== 'string') return new Uint8Array(0);
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binaryStr = atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Safely decode a base64url JSON object
 * @param {string} base64Url
 * @returns {object|null}
 */
function parseBase64UrlJson(base64Url) {
  try {
    const bytes = base64UrlToUint8Array(base64Url);
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Verify JWT signature, expiry, and payload integrity using Web Crypto API.
 * Fully compatible with Next.js Edge Runtime, Node.js 18+, and standard browsers.
 * @param {string} token
 * @returns {Promise<object|null>}
 */
export async function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  try {
    // 1. Strict header validation: enforce HS256 algorithm and optional JWT type
    const header = parseBase64UrlJson(headerB64);
    if (!header || typeof header !== 'object') return null;
    if (header.alg !== 'HS256') return null;
    if (header.typ && header.typ.toUpperCase() !== 'JWT') return null;

    // 2. Strict payload validation: parse payload and check claims
    const payload = parseBase64UrlJson(payloadB64);
    if (!payload || typeof payload !== 'object') return null;

    const nowSec = Math.floor(Date.now() / 1000);

    // Expiration check (exp claim)
    if (typeof payload.exp === 'number' && nowSec >= payload.exp) {
      return null;
    }

    // Not Before check (nbf claim)
    if (typeof payload.nbf === 'number' && nowSec < payload.nbf) {
      return null;
    }

    // 3. Authoritative cryptographic signature verification via Web Crypto API (HMAC-SHA256)
    const secret = getJwtSecret();
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const subtleCrypto = globalThis.crypto?.subtle;
    if (!subtleCrypto) {
      throw new Error('Web Crypto API (crypto.subtle) is unavailable in current runtime.');
    }

    const key = await subtleCrypto.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataToVerify = encoder.encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlToUint8Array(sigB64);

    const isValid = await subtleCrypto.verify(
      'HMAC',
      key,
      signatureBytes,
      dataToVerify
    );

    if (!isValid) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const urlObj = request.nextUrl || new URL(request.url);
  const rawPathname = urlObj.pathname;
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

  // Host & Subdomain Detection
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0].toLowerCase();

  let portalPrefix = null;
  if (hostname.startsWith('admin.')) {
    portalPrefix = '/admin';
  } else if (hostname.startsWith('worker.')) {
    portalPrefix = '/worker';
  } else if (hostname.startsWith('tv.')) {
    portalPrefix = '/tv';
  }

  // Determine internal target pathname for route guards and rewriting
  let internalPathname = pathname;
  let isSubdomain = false;
  if (portalPrefix && !pathname.startsWith('/api')) {
    isSubdomain = true;
    if (!pathname.startsWith(portalPrefix)) {
      internalPathname = `${portalPrefix}${pathname === '/' ? '' : pathname}`;
    }
  }

  // Session token extraction from cookies or Authorization header
  const authHeader = request.headers?.get ? request.headers.get('authorization') : null;
  const bearerToken = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7).trim() : null;
  const adminCookie = request.cookies?.get ? request.cookies.get('admin_session')?.value : null;
  const workerCookie = request.cookies?.get ? (request.cookies.get('worker_session')?.value || request.cookies.get('pf_session')?.value) : null;

  const adminToken = adminCookie || bearerToken;
  const workerToken = workerCookie || bearerToken; // Worker token MUST never inherit adminCookie

  // 1. Admin API Route Guard
  if (internalPathname.startsWith('/api/v1/admin')) {
    // Whitelist explicitly public admin endpoints
    if (internalPathname === '/api/v1/admin/auth/login') {
      return NextResponse.next();
    }

    // Specific background scheduler & telemetry endpoints that support server-side secret validation
    const isSchedulerEndpoint = internalPathname === '/api/v1/admin/notifications/process-scheduled';
    const isTelemetryEndpoint = /^\/api\/v1\/admin\/gps\/journeys\/[^/]+\/positions$/.test(internalPathname);

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

  // 1b. Worker API Route Guard
  if (internalPathname.startsWith('/api/v1/worker')) {
    // Whitelist explicitly public worker endpoints
    if (internalPathname === '/api/v1/worker/auth/login' || internalPathname === '/api/v1/worker/auth/logout') {
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

    const workerPayload = await verifyJwt(workerToken);
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
  if (internalPathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 2. Admin Page Route Guard
  if (internalPathname.startsWith('/admin')) {
    const isLoginPage = internalPathname === '/admin/login' || internalPathname.startsWith('/admin/login/');
    const adminPayload = await verifyJwt(adminToken);
    const isValidAdmin = Boolean(adminPayload && (adminPayload.role === 'ADMIN' || adminPayload.is_super_admin));

    if (isLoginPage) {
      if (isValidAdmin) {
        return NextResponse.redirect(new URL(isSubdomain ? '/' : '/admin', request.url));
      }
      if (isSubdomain && pathname !== internalPathname) {
        return NextResponse.rewrite(new URL(internalPathname, request.url));
      }
      return NextResponse.next();
    }

    if (!isValidAdmin) {
      const redirectUrl = new URL(isSubdomain ? '/login' : '/admin/login', request.url);
      const search = urlObj.search || '';
      redirectUrl.searchParams.set('redirect', `${pathname}${search}`);
      return NextResponse.redirect(redirectUrl);
    }

    if (isSubdomain && pathname !== internalPathname) {
      return NextResponse.rewrite(new URL(internalPathname, request.url));
    }

    return NextResponse.next();
  }

  // 3. Worker Page Route Guard
  if (internalPathname.startsWith('/worker')) {
    const isWorkerLogin = internalPathname === '/worker/login' || internalPathname.startsWith('/worker/login/');
    const workerPayload = await verifyJwt(workerToken);
    const isValidWorker = Boolean(workerPayload && workerPayload.role === 'WORKER');

    if (isWorkerLogin) {
      if (isValidWorker) {
        return NextResponse.redirect(new URL(isSubdomain ? '/' : '/worker', request.url));
      }
      if (isSubdomain && pathname !== internalPathname) {
        return NextResponse.rewrite(new URL(internalPathname, request.url));
      }
      return NextResponse.next();
    }

    if (!isValidWorker) {
      const redirectUrl = new URL(isSubdomain ? '/login' : '/worker/login', request.url);
      const search = urlObj.search || '';
      redirectUrl.searchParams.set('redirect', `${pathname}${search}`);
      return NextResponse.redirect(redirectUrl);
    }

    if (isSubdomain && pathname !== internalPathname) {
      return NextResponse.rewrite(new URL(internalPathname, request.url));
    }

    return NextResponse.next();
  }

  // 4. TV Page Route (Public/Display Portal)
  if (internalPathname.startsWith('/tv')) {
    if (isSubdomain && pathname !== internalPathname) {
      return NextResponse.rewrite(new URL(internalPathname, request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
