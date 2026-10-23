/**
 * Admin Authentication & Authorization Guard
 * Traceability: PondFish System Technical Architecture v1 (Section 13) & Admin Portal Spec
 * Verifies admin session tokens or administrative API keys. Zero unapproved auth frameworks.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Retrieves authoritative JWT secret, enforcing fail-closed semantics in production
 * @returns {string}
 */
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
 * Constant-time string comparison to prevent timing-attack side channels
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqualStrings(a, b) {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extracts Bearer token or session cookie from incoming request
 * @param {Request} request
 * @returns {string|null}
 */
function extractToken(request) {
  if (!request) return null;

  // 1. Authorization header: Bearer <token>
  const authHeader = request.headers?.get?.('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. NextRequest cookies map
  if (request.cookies?.get) {
    const cookieVal = request.cookies.get('admin_session')?.value;
    if (cookieVal) return cookieVal.trim();
  } else if (request.cookies?.admin_session) {
    return String(request.cookies.admin_session).trim();
  }

  // 3. Raw Cookie header fallback
  const cookieHeader = request.headers?.get?.('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (match) {
    return decodeURIComponent(match[1]).trim();
  }

  return null;
}

/**
 * Retrieves authoritative Admin API key secret.
 * Enforces fail-closed: must be at least 16 characters.
 * @returns {string|null}
 */
function getAdminSecret() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length < 16) {
    return null;
  }
  return secret.trim();
}

/**
 * Authenticates incoming administrative requests synchronously (JWT signature validation only)
 * NOTE: Does not verify PostgreSQL session registry or account revocation status.
 * All protected endpoints must call `await authenticateAdminAsync(request)` instead.
 * @param {Request} request
 * @param {object} [options]
 * @param {boolean} [options.allowApiKey=false]
 * @returns {object} Authenticated admin identity
 */
function authenticateAdmin(request, { allowApiKey = false } = {}) {
  // 1. Check administrative API key header ONLY if explicitly allowed by endpoint
  if (allowApiKey) {
    const configuredAdminKey = getAdminSecret();
    const adminKey = request.headers?.get?.('x-admin-key');
    if (configuredAdminKey && adminKey && timingSafeEqualStrings(adminKey, configuredAdminKey)) {
      return {
        id: 'admin-system',
        name: 'System Telemetry / API Key',
        email: 'system@pondfish.in',
        role: 'ADMIN',
        is_super_admin: false,
        authMethod: 'API_KEY',
      };
    }
  }

  // 2. Check Bearer JWT token / admin_session cookie
  const token = extractToken(request);
  if (token) {
    try {
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret);
      if (decoded && (decoded.role === 'ADMIN' || decoded.is_super_admin === true)) {
        return {
          id: decoded.adminId || decoded.id,
          name: decoded.name || 'Administrator',
          email: decoded.email,
          role: 'ADMIN',
          is_super_admin: Boolean(decoded.is_super_admin),
          sessionId: decoded.sessionId,
          token,
          authMethod: 'JWT',
        };
      }
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        const expErr = new Error('SESSION_EXPIRED');
        expErr.code = 'SESSION_EXPIRED';
        expErr.status = 401;
        throw expErr;
      }
    }
  }

  const err = new Error('UNAUTHORIZED_ADMIN');
  err.code = 'UNAUTHORIZED';
  err.status = 401;
  throw err;
}

/**
 * Authenticates incoming administrative request with asynchronous session-registry and DB checks.
 * @param {Request} request
 * @param {object} [options]
 * @param {boolean} [options.allowApiKey=false] - Only set true on intentional server-to-server endpoints (e.g. GPS telemetry ingestion)
 * @returns {Promise<object>} Authenticated and registry-verified admin identity
 */
async function authenticateAdminAsync(request, { allowApiKey = false } = {}) {
  // 1. Check administrative API key header ONLY if explicitly allowed by endpoint
  if (allowApiKey) {
    const configuredAdminKey = getAdminSecret();
    const adminKey = request.headers?.get?.('x-admin-key');
    if (configuredAdminKey && adminKey && timingSafeEqualStrings(adminKey, configuredAdminKey)) {
      return {
        id: 'admin-system',
        name: 'System Telemetry / API Key',
        email: 'system@pondfish.in',
        role: 'ADMIN',
        is_super_admin: false,
        authMethod: 'API_KEY',
      };
    }
  }

  // 2. Extract JWT token from Authorization header or admin_session cookie
  const token = extractToken(request);
  if (!token) {
    const err = new Error('UNAUTHORIZED_ADMIN');
    err.code = 'UNAUTHORIZED';
    err.status = 401;
    throw err;
  }

  // 3. Cryptographically verify JWT and validate against PostgreSQL session registry & DB account
  const rbacEngine = require('../engines/rbac');
  const session = await rbacEngine.verifyAdminSession(token);
  return {
    ...session,
    token,
    authMethod: 'JWT_REGISTRY_VERIFIED',
  };
}

module.exports = {
  authenticateAdmin,
  authenticateAdminAsync,
  extractToken,
  getJwtSecret,
  getAdminSecret,
  timingSafeEqualStrings,
};

