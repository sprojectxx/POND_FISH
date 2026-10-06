/**
 * Engine 22: Multi-Portal RBAC Authentication & Session Engine
 * Traceability: 
 * - PondFish Core Business Engines Specification v1 (Sections 5 & 22)
 * - PondFish Master PRD v2 (Section 26: Security & Privacy)
 * - PondFish Page-By-Page UI Specification Admin Portal (ADMIN-01, ADMIN-21, ADMIN-22, ADMIN-23)
 * Full orchestration for Admin authentication, cryptographic JWT issuance,
 * persistent session lifecycle registry in PostgreSQL settings table,
 * rate limiting / brute-force lockout, current-password re-authentication,
 * and security audit logging.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const adminRepository = require('../db/repositories/adminRepository');
const auditEngine = require('./audit');
const { query } = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'pondfish-customer-session-secret-key-2026';
const ADMIN_TOKEN_EXPIRY = '12h';
const ADMIN_TOKEN_EXPIRY_MS = 12 * 60 * 60 * 1000;
const SESSION_SETTING_KEY = 'admin_active_sessions';

// In-memory rate limiting state: sliding window lockout for failed login attempts
// Map of key -> { count: number, lockedUntil: number, lastAttempt: number }
const loginAttemptsMap = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if identifier (IP or email) is currently rate-limited
 * @param {string} identifier
 */
function checkRateLimit(identifier) {
  if (!identifier) return;
  const now = Date.now();
  const entry = loginAttemptsMap.get(identifier);
  if (entry && entry.lockedUntil > now) {
    const remainingSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    const err = new Error(`Too many failed attempts. Please wait ${remainingSeconds} seconds and try again.`);
    err.code = 'RATE_LIMIT_EXCEEDED';
    err.status = 429;
    err.remainingSeconds = remainingSeconds;
    throw err;
  }
}

/**
 * Record a failed login attempt for rate limiting
 * @param {string} identifier
 */
function recordFailedAttempt(identifier) {
  if (!identifier) return;
  const now = Date.now();
  let entry = loginAttemptsMap.get(identifier);
  if (!entry || now - entry.lastAttempt > LOCKOUT_WINDOW_MS) {
    entry = { count: 1, lockedUntil: 0, lastAttempt: now };
  } else {
    entry.count += 1;
    entry.lastAttempt = now;
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_WINDOW_MS;
    }
  }
  loginAttemptsMap.set(identifier, entry);
}

/**
 * Reset failed login attempts on successful login
 * @param {string} identifier
 */
function resetFailedAttempts(identifier) {
  if (identifier) {
    loginAttemptsMap.delete(identifier);
  }
}

/**
 * Load persistent admin session registry from PostgreSQL settings table
 * @returns {Promise<Record<string, object>>}
 */
async function loadSessionRegistry() {
  try {
    const res = await query('SELECT value FROM settings WHERE key = $1 LIMIT 1;', [SESSION_SETTING_KEY]);
    if (res.rows.length === 0 || !res.rows[0].value) {
      return {};
    }
    const registry = JSON.parse(res.rows[0].value);
    // Prune expired sessions
    const now = Date.now();
    const activeRegistry = {};
    for (const [sid, session] of Object.entries(registry)) {
      if (session.expiresAt && session.expiresAt > now) {
        activeRegistry[sid] = session;
      }
    }
    return activeRegistry;
  } catch (err) {
    console.warn('[RBAC Engine] Warning: Failed to load session registry, initializing empty:', err.message);
    return {};
  }
}

/**
 * Save persistent admin session registry to PostgreSQL settings table
 * @param {Record<string, object>} registry
 */
async function saveSessionRegistry(registry) {
  try {
    const serialized = JSON.stringify(registry);
    await query(`
      INSERT INTO settings (id, key, value, updated_at)
      VALUES (gen_random_uuid(), $1, $2, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW();
    `, [SESSION_SETTING_KEY, serialized]);
  } catch (err) {
    console.error('[RBAC Engine] Error saving session registry:', err.message);
  }
}

/**
 * Authenticate admin with email and password
 * Enforces rate limiting, bcrypt verification, session registry, and audit logging.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} [params.ip]
 * @param {string} [params.userAgent]
 * @returns {Promise<{ token: string, admin: object, sessionId: string }>}
 */
async function loginAdmin({ email, password, ip = 'unknown', userAgent = 'unknown' }) {
  if (!email || !password) {
    const err = new Error('Email and password are required.');
    err.code = 'INVALID_INPUT';
    err.status = 400;
    throw err;
  }

  const cleanedEmail = String(email).trim().toLowerCase();
  const rateLimitKey = `${ip}:${cleanedEmail}`;

  // 1. Check rate limit
  checkRateLimit(rateLimitKey);

  // 2. Lookup admin in authoritative database
  const admin = await adminRepository.findAdminByEmail(cleanedEmail);
  if (!admin) {
    recordFailedAttempt(rateLimitKey);
    await auditEngine.recordAuditLog({
      actorType: 'SYSTEM',
      actorId: 'system',
      action: 'ADMIN_LOGIN_FAILURE',
      entityType: 'ADMIN',
      entityId: cleanedEmail,
      payload: { reason: 'ACCOUNT_NOT_FOUND', ip, userAgent: userAgent.substring(0, 150) },
    }).catch(() => {});

    const err = new Error('Invalid email or password.');
    err.code = 'INVALID_CREDENTIALS';
    err.status = 401;
    throw err;
  }

  // 3. Verify password hash using bcrypt
  const isValid = adminRepository.verifyPassword(password, admin.password_hash);
  if (!isValid) {
    recordFailedAttempt(rateLimitKey);
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: 'ADMIN_LOGIN_FAILURE',
      entityType: 'ADMIN',
      entityId: admin.id,
      payload: { reason: 'PASSWORD_MISMATCH', ip, userAgent: userAgent.substring(0, 150) },
    }).catch(() => {});

    const err = new Error('Invalid email or password.');
    err.code = 'INVALID_CREDENTIALS';
    err.status = 401;
    throw err;
  }

  // 4. Successful login: reset rate limiter
  resetFailedAttempts(rateLimitKey);

  // 5. Generate unique session ID and JWT
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + ADMIN_TOKEN_EXPIRY_MS;

  const payload = {
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    role: 'ADMIN',
    is_super_admin: Boolean(admin.is_super_admin),
    sessionId,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: ADMIN_TOKEN_EXPIRY });

  // 6. Register session in persistent PostgreSQL settings registry
  const registry = await loadSessionRegistry();
  registry[sessionId] = {
    sessionId,
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    role: 'ADMIN',
    is_super_admin: Boolean(admin.is_super_admin),
    ip,
    userAgent: userAgent.substring(0, 150),
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
  };
  await saveSessionRegistry(registry);

  // 7. Update last login timestamp on admin row
  await adminRepository.touchAdminUpdated(admin.id).catch(() => {});

  // 8. Record audit event
  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId: admin.id,
    action: 'ADMIN_LOGIN_SUCCESS',
    entityType: 'ADMIN',
    entityId: admin.id,
    payload: { sessionId, ip, userAgent: userAgent.substring(0, 150) },
  }).catch(() => {});

  return {
    token,
    sessionId,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: 'ADMIN',
      is_super_admin: Boolean(admin.is_super_admin),
      createdAt: admin.created_at,
      updatedAt: admin.updated_at,
    },
  };
}

/**
 * Verify admin session token with cryptographic and registry validation
 * @param {string} token
 * @returns {Promise<object>} Decoded token payload
 */
async function verifyAdminSession(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Admin session token is required.');
    err.code = 'UNAUTHORIZED';
    err.status = 401;
    throw err;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (jwtErr) {
    const err = new Error(jwtErr.name === 'TokenExpiredError' ? 'Your session has expired. Please sign in again.' : 'Invalid session token.');
    err.code = jwtErr.name === 'TokenExpiredError' ? 'SESSION_EXPIRED' : 'UNAUTHORIZED';
    err.status = 401;
    throw err;
  }

  if (!decoded || (decoded.role !== 'ADMIN' && !decoded.is_super_admin)) {
    const err = new Error('Forbidden: Administrative privileges required.');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  const adminId = decoded.adminId || decoded.id;
  const sessionId = decoded.sessionId;

  // If a sessionId was issued, verify that it has not been revoked in the session registry
  if (sessionId) {
    const registry = await loadSessionRegistry();
    const session = registry[sessionId];
    if (!session) {
      const err = new Error('Session has been invalidated or logged out. Please sign in again.');
      err.code = 'SESSION_EXPIRED';
      err.status = 401;
      throw err;
    }
  }

  // Verify admin account is still valid in database
  const admin = await adminRepository.findAdminById(adminId);
  if (!admin) {
    const err = new Error('Administrator account no longer exists.');
    err.code = 'UNAUTHORIZED';
    err.status = 401;
    throw err;
  }

  // Invalidate tokens issued prior to a password change
  if (admin.updated_at && decoded.iat) {
    const adminUpdatedSec = Math.floor(new Date(admin.updated_at).getTime() / 1000);
    if (decoded.iat < adminUpdatedSec - 10) { // 10s leeway for clock skew
      const err = new Error('Security credentials recently updated. Please sign in again.');
      err.code = 'SESSION_EXPIRED';
      err.status = 401;
      throw err;
    }
  }

  return {
    id: admin.id,
    adminId: admin.id,
    name: admin.name,
    email: admin.email,
    role: 'ADMIN',
    is_super_admin: Boolean(admin.is_super_admin),
    sessionId,
    iat: decoded.iat,
    exp: decoded.exp,
  };
}

/**
 * Invalidate admin session on logout
 * @param {string} token
 * @param {object} [context]
 */
async function logoutAdmin(token, { ip = 'unknown', userAgent = 'unknown' } = {}) {
  let decoded = null;
  try {
    decoded = jwt.decode(token);
  } catch {}

  const adminId = decoded ? (decoded.adminId || decoded.id) : null;
  const sessionId = decoded ? decoded.sessionId : null;

  if (sessionId) {
    const registry = await loadSessionRegistry();
    if (registry[sessionId]) {
      delete registry[sessionId];
      await saveSessionRegistry(registry);
    }
  }

  if (adminId) {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId: adminId,
      action: 'ADMIN_LOGOUT',
      entityType: 'ADMIN',
      entityId: adminId,
      payload: { sessionId, ip, userAgent: userAgent.substring(0, 150) },
    }).catch(() => {});
  }

  return { success: true, message: 'Logged out successfully.' };
}

/**
 * Retrieve admin profile details along with recent security footprint
 * @param {string} adminId
 * @returns {Promise<object>}
 */
async function getAdminProfile(adminId) {
  const admin = await adminRepository.findAdminById(adminId);
  if (!admin) {
    const err = new Error('Admin profile not found.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Fetch recent security action footprint from audit logs
  let recentAudit = [];
  try {
    const auditRes = await query(`
      SELECT id, action, entity_type, entity_id, payload, timestamp
      FROM audit_logs
      WHERE actor_id = $1 OR action LIKE 'ADMIN_%'
      ORDER BY timestamp DESC
      LIMIT 10;
    `, [adminId]);
    recentAudit = auditRes.rows;
  } catch (err) {
    console.warn('[RBAC Engine] Failed to fetch audit footprint:', err.message);
  }

  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: 'ADMIN',
    is_super_admin: Boolean(admin.is_super_admin),
    status: 'ACTIVE',
    createdAt: admin.created_at,
    updatedAt: admin.updated_at,
    securityFootprint: recentAudit,
  };
}

/**
 * Change administrator password
 * Enforces current-password verification, strength checks, hash generation,
 * session invalidation, and audit logging.
 * @param {string} adminId
 * @param {object} params
 * @param {string} params.currentPassword
 * @param {string} params.newPassword
 * @param {string} params.confirmPassword
 * @param {string} [params.currentSessionId]
 * @param {string} [params.ip]
 * @param {string} [params.userAgent]
 */
async function changeAdminPassword(adminId, { currentPassword, newPassword, confirmPassword, currentSessionId, ip = 'unknown', userAgent = 'unknown' }) {
  if (!currentPassword || !newPassword || !confirmPassword) {
    const err = new Error('All password fields are required.');
    err.code = 'INVALID_INPUT';
    err.status = 400;
    throw err;
  }

  if (newPassword !== confirmPassword) {
    const err = new Error('New password and confirmation do not match.');
    err.code = 'PASSWORD_MISMATCH';
    err.status = 400;
    throw err;
  }

  if (newPassword.length < 8) {
    const err = new Error('New password must be at least 8 characters long.');
    err.code = 'WEAK_PASSWORD';
    err.status = 400;
    throw err;
  }

  const admin = await adminRepository.findAdminById(adminId);
  if (!admin) {
    const err = new Error('Administrator not found.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Verify current password
  const isCurrentValid = adminRepository.verifyPassword(currentPassword, admin.password_hash);
  if (!isCurrentValid) {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: 'ADMIN_PASSWORD_CHANGE_FAILED',
      entityType: 'ADMIN',
      entityId: admin.id,
      payload: { reason: 'CURRENT_PASSWORD_MISMATCH', ip, userAgent: userAgent.substring(0, 150) },
    }).catch(() => {});

    const err = new Error('Current password is incorrect.');
    err.code = 'INVALID_CURRENT_PASSWORD';
    err.status = 401;
    throw err;
  }

  // Hash new password using bcrypt
  const newHash = await adminRepository.hashPassword(newPassword);

  // Update in database
  const updatedAdmin = await adminRepository.updateAdminPassword(adminId, newHash);

  // Invalidate all other sessions in registry, retaining only the current one if specified
  const registry = await loadSessionRegistry();
  for (const [sid, sess] of Object.entries(registry)) {
    if (sess.adminId === adminId && sid !== currentSessionId) {
      delete registry[sid];
    }
  }
  await saveSessionRegistry(registry);

  // Record audit log
  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId: admin.id,
    action: 'ADMIN_PASSWORD_CHANGED',
    entityType: 'ADMIN',
    entityId: admin.id,
    payload: { ip, userAgent: userAgent.substring(0, 150) },
  }).catch(() => {});

  return {
    success: true,
    message: 'Password updated successfully.',
    updatedAt: updatedAdmin.updated_at,
  };
}

/**
 * Retrieve active sessions list for administrator
 * @param {string} adminId
 * @param {string} currentSessionId
 */
async function getActiveSessions(adminId, currentSessionId) {
  const registry = await loadSessionRegistry();
  const sessions = [];

  for (const [sid, sess] of Object.entries(registry)) {
    if (sess.adminId === adminId) {
      sessions.push({
        sessionId: sid,
        email: sess.email,
        name: sess.name,
        ip: sess.ip,
        userAgent: sess.userAgent,
        createdAt: sess.createdAt,
        expiresAt: sess.expiresAt,
        isCurrent: sid === currentSessionId,
      });
    }
  }

  // Sort: current session first, then newest
  sessions.sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0) || b.createdAt - a.createdAt);

  return sessions;
}

/**
 * Terminate all sessions except the current active session
 * @param {string} adminId
 * @param {string} currentSessionId
 * @param {object} [context]
 */
async function terminateOtherSessions(adminId, currentSessionId, { ip = 'unknown', userAgent = 'unknown' } = {}) {
  const registry = await loadSessionRegistry();
  let terminatedCount = 0;

  for (const [sid, sess] of Object.entries(registry)) {
    if (sess.adminId === adminId && sid !== currentSessionId) {
      delete registry[sid];
      terminatedCount += 1;
    }
  }

  await saveSessionRegistry(registry);

  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId: adminId,
    action: 'ADMIN_SESSIONS_REVOKED',
    entityType: 'ADMIN',
    entityId: adminId,
    payload: { currentSessionId, terminatedCount, ip, userAgent: userAgent.substring(0, 150) },
  }).catch(() => {});

  return {
    success: true,
    terminatedCount,
    message: `Terminated ${terminatedCount} other active session(s).`,
  };
}

module.exports = {
  name: 'RBACEngine',
  loginAdmin,
  verifyAdminSession,
  logoutAdmin,
  getAdminProfile,
  changeAdminPassword,
  getActiveSessions,
  terminateOtherSessions,
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
};
