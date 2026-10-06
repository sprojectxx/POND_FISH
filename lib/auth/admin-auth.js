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
 * Authenticates incoming administrative requests
 * @param {Request} request
 * @returns {object} Authenticated admin identity
 */
function authenticateAdmin(request) {
  // 1. Check administrative API key header
  const adminKey = request.headers.get('x-admin-key');
  if (adminKey && adminKey === ADMIN_SECRET_KEY) {
    return {
      id: 'admin-system',
      name: 'System Administrator',
      role: 'ADMIN',
    };
  }

  // 2. Check internal secret header
  const internalSecret = request.headers.get('x-internal-secret');
  if (internalSecret && internalSecret === CRON_SECRET) {
    return {
      id: 'internal-service',
      name: 'Internal Service Admin',
      role: 'ADMIN',
    };
  }

  // 3. Check Bearer JWT token
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && (decoded.role === 'ADMIN' || decoded.is_super_admin === true)) {
        return {
          id: decoded.adminId || decoded.id,
          name: decoded.name || 'Administrator',
          role: 'ADMIN',
        };
      }
    } catch (e) {
      // Invalid token
    }
  }

  const err = new Error('UNAUTHORIZED_ADMIN');
  err.code = 'UNAUTHORIZED';
  err.status = 401;
  throw err;
}

module.exports = {
  authenticateAdmin,
};
