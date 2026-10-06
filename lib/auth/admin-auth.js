/**
 * Admin Authentication & Authorization Guard
 * Traceability: PondFish System Technical Architecture v1 (Section 13) & Admin Portal Spec
 * Verifies admin session tokens or administrative API keys. Zero unapproved auth frameworks.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pondfish-customer-session-secret-key-2026';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET || 'pondfish-admin-key-2026';
const CRON_SECRET = process.env.CRON_SECRET || 'pondfish-internal-secret-2026';

/**
 * Extracts Bearer token or session cookie from incoming request
 * @param {Request} request
 * @returns {string|null}
 */
function extractToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // Check cookie fallback if present
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }

  return null;
}

/**
 * Authenticates incoming administrative requests synchronously
 * @param {Request} request
 * @returns {object} Authenticated admin identity
 */
function authenticateAdmin(request) {
  // 1. Check administrative API key header (internal / automated background ops)
  const adminKey = request.headers.get('x-admin-key');
  if (adminKey && adminKey === ADMIN_SECRET_KEY) {
    return {
      id: 'admin-system',
      name: 'System Administrator',
      email: 'system@pondfish.in',
      role: 'ADMIN',
      is_super_admin: true,
      authMethod: 'API_KEY',
    };
  }

  // 2. Check internal secret header
  const internalSecret = request.headers.get('x-internal-secret');
  if (internalSecret && internalSecret === CRON_SECRET) {
    return {
      id: 'internal-service',
      name: 'Internal Service Admin',
      email: 'cron@pondfish.in',
      role: 'ADMIN',
      is_super_admin: true,
      authMethod: 'INTERNAL_SECRET',
    };
  }

  // 3. Check Bearer JWT token
  const token = extractToken(request);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
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
 * Authenticates incoming administrative request with asynchronous session-registry check
 * @param {Request} request
 * @returns {Promise<object>}
 */
async function authenticateAdminAsync(request) {
  // Check fast path API key first
  const adminKey = request.headers.get('x-admin-key');
  if (adminKey && adminKey === ADMIN_SECRET_KEY) {
    return {
      id: 'admin-system',
      name: 'System Administrator',
      email: 'system@pondfish.in',
      role: 'ADMIN',
      is_super_admin: true,
      authMethod: 'API_KEY',
    };
  }

  const token = extractToken(request);
  if (!token) {
    const err = new Error('UNAUTHORIZED_ADMIN');
    err.code = 'UNAUTHORIZED';
    err.status = 401;
    throw err;
  }

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
};
