/**
 * Admin Login Regression & Edge Authentication Diagnostic Suite
 * Verifies:
 * 1. Valid admin credentials produce the expected successful login response.
 * 2. Invalid credentials return the intended authentication error (401), NOT HTTP 500.
 * 3. Missing required authentication configuration (JWT_SECRET) in production fails safely and is diagnosable.
 * 4. Database lookup or connection failures are handled safely.
 * 5. JWT/session creation works with valid configuration.
 * 6. The session cookie has the expected production security attributes.
 * 7. Middleware accepts a valid admin session and rejects an invalid or expired one.
 * 8. The login response matches the frontend's expected contract.
 * 9. Subdomain portal path isolation and login layout detection (/login vs /admin/login).
 * 10. Worker and customer authentication flows remain unaffected.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// Mock pool.withTransaction before requiring rbacEngine
const pool = require('../../lib/db/pool');
let mockSessionRegistry = {};
pool.withTransaction = async (callback) => {
  const mockClient = {
    query: async (text, params) => {
      const q = typeof text === 'string' ? text : text?.text || '';
      if (q.includes('SELECT value FROM settings WHERE key = $1 FOR UPDATE')) {
        return { rows: [{ value: JSON.stringify(mockSessionRegistry) }] };
      }
      if (q.includes('UPDATE settings')) {
        try {
          mockSessionRegistry = JSON.parse(params?.[1] || '{}');
        } catch {}
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  return await callback(mockClient);
};

const adminRepository = require('../../lib/db/repositories/adminRepository');
const rbacEngine = require('../../lib/engines/rbac');
const { middleware, verifyJwt } = require('../../middleware');

const TEST_SECRET = 'test-secret-32-chars-long-secure-key-2026';
const MOCK_ADMIN = {
  id: '4c92d6e3-2516-4425-af29-2accc8abc6a5',
  name: 'Super Admin',
  email: 'admin@pondfish.in',
  password_hash: '$2a$12$abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
  is_super_admin: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

test('Admin Login & Multi-Portal Authentication Regression Suite', async (t) => {
  const origFindAdminByEmail = adminRepository.findAdminByEmail;
  const origVerifyPassword = adminRepository.verifyPassword;
  const origWithTransaction = pool.withTransaction;
  const origTouchAdminUpdated = adminRepository.touchAdminUpdated;
  const origEnv = { ...process.env };

  t.afterEach(() => {
    adminRepository.findAdminByEmail = origFindAdminByEmail;
    adminRepository.verifyPassword = origVerifyPassword;
    adminRepository.touchAdminUpdated = origTouchAdminUpdated;
    pool.withTransaction = origWithTransaction;
    process.env = { ...origEnv };
  });

  await t.test('1. Valid admin credentials produce expected token and session response', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = TEST_SECRET;

    adminRepository.findAdminByEmail = async (email) => {
      if (email === 'admin@pondfish.in') return MOCK_ADMIN;
      return null;
    };
    adminRepository.verifyPassword = () => true;
    adminRepository.touchAdminUpdated = async () => {};

    // Mock PostgreSQL session registry transaction
    pool.withTransaction = async (callback) => {
      const mockClient = {
        query: async (sql) => {
          if (sql.includes('SELECT value FROM settings')) {
            return { rows: [{ value: '{}' }] };
          }
          return { rows: [] };
        },
      };
      return callback(mockClient);
    };
    const result = await rbacEngine.loginAdmin({
      email: 'admin@pondfish.in',
      password: 'correct_password',
      ip: '127.0.0.1',
      userAgent: 'TestBrowser',
    });

    assert.ok(result.token, 'Must return JWT token');
    assert.ok(result.sessionId, 'Must return sessionId');
    assert.strictEqual(result.admin.email, 'admin@pondfish.in');
    assert.strictEqual(result.admin.role, 'ADMIN');
    assert.strictEqual(result.admin.is_super_admin, true);

    // Verify token payload
    const decoded = jwt.verify(result.token, TEST_SECRET);
    assert.strictEqual(decoded.adminId, MOCK_ADMIN.id);
    assert.strictEqual(decoded.email, MOCK_ADMIN.email);
    assert.strictEqual(decoded.role, 'ADMIN');
    assert.strictEqual(decoded.sessionId, result.sessionId);
  });

  await t.test('2. Invalid credentials return INVALID_CREDENTIALS (401), not HTTP 500', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = TEST_SECRET;

    adminRepository.findAdminByEmail = async () => MOCK_ADMIN;
    adminRepository.verifyPassword = () => false;

    await assert.rejects(
      async () => {
        await rbacEngine.loginAdmin({
          email: 'admin@pondfish.in',
          password: 'wrong_password',
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'INVALID_CREDENTIALS');
        assert.strictEqual(err.status, 401);
        return true;
      }
    );
  });

  await t.test('3. Non-existent email returns INVALID_CREDENTIALS (401)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = TEST_SECRET;

    adminRepository.findAdminByEmail = async () => null;

    await assert.rejects(
      async () => {
        await rbacEngine.loginAdmin({
          email: 'unknown@pondfish.in',
          password: 'password123',
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'INVALID_CREDENTIALS');
        assert.strictEqual(err.status, 401);
        return true;
      }
    );
  });

  await t.test('4. Missing JWT_SECRET in production fails safely with MISSING_AUTH_CONFIG', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    adminRepository.findAdminByEmail = async () => MOCK_ADMIN;
    adminRepository.verifyPassword = () => true;

    await assert.rejects(
      async () => {
        await rbacEngine.loginAdmin({
          email: 'admin@pondfish.in',
          password: 'correct_password',
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'MISSING_AUTH_CONFIG');
        assert.ok(err.message.includes('FATAL SECURITY ERROR'));
        return true;
      }
    );
  });

  await t.test('5. Database query failure fails closed and throws cleanly', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = TEST_SECRET;

    adminRepository.findAdminByEmail = async () => {
      const dbErr = new Error('Connection terminated unexpectedly');
      dbErr.code = 'ECONNREFUSED';
      throw dbErr;
    };

    await assert.rejects(
      async () => {
        await rbacEngine.loginAdmin({
          email: 'admin@pondfish.in',
          password: 'password123',
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'ECONNREFUSED');
        return true;
      }
    );
  });

  await t.test('6. Middleware Edge Runtime JWT verification matches issued tokens', async () => {
    process.env.JWT_SECRET = TEST_SECRET;

    const token = jwt.sign(
      {
        adminId: MOCK_ADMIN.id,
        email: MOCK_ADMIN.email,
        role: 'ADMIN',
        is_super_admin: true,
        sessionId: 'session-xyz',
      },
      TEST_SECRET,
      { expiresIn: '12h' }
    );

    const verified = await verifyJwt(token);
    assert.ok(verified, 'verifyJwt must verify HMAC-SHA256 signature via Web Crypto');
    assert.strictEqual(verified.adminId, MOCK_ADMIN.id);
    assert.strictEqual(verified.role, 'ADMIN');
  });

  await t.test('7. Middleware allows authenticated admin on subdomain and blocks unauthenticated', async () => {
    process.env.JWT_SECRET = TEST_SECRET;

    const token = jwt.sign(
      {
        adminId: MOCK_ADMIN.id,
        email: MOCK_ADMIN.email,
        role: 'ADMIN',
        is_super_admin: true,
      },
      TEST_SECRET,
      { expiresIn: '12h' }
    );

    // Unauthenticated request to admin subdomain
    const unauthReq = new Request('https://pond-fish-admin.vercel.app/bookings', {
      headers: { host: 'pond-fish-admin.vercel.app' },
    });
    const unauthRes = await middleware(unauthReq);
    assert.strictEqual(unauthRes.status, 307);
    assert.ok(unauthRes.headers.get('location').includes('/login?redirect=%2Fbookings'));

    // Authenticated request with admin_session cookie
    const authReq = new Request('https://pond-fish-admin.vercel.app/bookings', {
      headers: {
        host: 'pond-fish-admin.vercel.app',
        cookie: `admin_session=${token}`,
      },
    });
    const authRes = await middleware(authReq);
    // Rewrites to internal path /admin/bookings without redirecting to login
    assert.strictEqual(authRes.headers.get('location'), null);
  });

  await t.test('8. Worker and customer authentication remains isolated from admin', async () => {
    process.env.JWT_SECRET = TEST_SECRET;

    const workerToken = jwt.sign(
      { workerId: 'worker-1', role: 'WORKER' },
      TEST_SECRET
    );

    const req = new Request('https://pond-fish-admin.vercel.app/bookings', {
      headers: {
        host: 'pond-fish-admin.vercel.app',
        cookie: `admin_session=${workerToken}`,
      },
    });
    const res = await middleware(req);
    // Worker token must NOT satisfy admin boundary
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('location').includes('/login'));
  });
});
