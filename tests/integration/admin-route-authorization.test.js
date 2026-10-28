/**
 * Behavior-Focused Admin Route Authorization Integration Test Suite
 * Traceability:
 * - PondFish Master PRD v2 (Section 26: Security & Privacy)
 * - Engine 22: Multi-Portal RBAC Authentication & Session Engine
 * - Post-483fc50 Admin Authorization Gap Audit (Scope 4)
 * 
 * Invokes ACTUAL Next.js API route handlers and middleware directly using
 * synthetic requests, controlled test doubles, and isolated in-memory state.
 * ZERO production database mutation, ZERO real payment triggers, ZERO live external calls.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// 1. Establish isolated testing secrets
const TEST_JWT_SECRET = 'pondfish-test-suite-auth-jwt-secret-2026';
const TEST_ADMIN_SECRET = 'pondfish-test-suite-admin-telemetry-secret-2026';
const TEST_CRON_SECRET = 'pondfish-test-suite-cron-scheduler-secret-2026';

process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.ADMIN_SECRET = TEST_ADMIN_SECRET;
process.env.CRON_SECRET = TEST_CRON_SECRET;
process.env.INTERNAL_SYSTEM_SECRET = TEST_CRON_SECRET;
process.env.NODE_ENV = 'test';

// 2. Set up controlled in-memory doubles for database persistence
const mockAdmins = {
  'admin-uuid-1': {
    id: 'admin-uuid-1',
    name: 'Super Administrator',
    email: 'superadmin@pondfish.in',
    role: 'ADMIN',
    is_super_admin: true,
  },
  'admin-uuid-2': {
    id: 'admin-uuid-2',
    name: 'Standard Operations Admin',
    email: 'ops@pondfish.in',
    role: 'ADMIN',
    is_super_admin: false,
  },
};

let mockSessionRegistry = {};

const pool = require('../../lib/db/pool');
pool.query = async (text, params) => {
  const queryStr = typeof text === 'string' ? text : text?.text || '';
  if (queryStr.includes('SELECT value FROM settings WHERE key = $1')) {
    const key = params?.[0];
    if (key === 'admin_active_sessions') {
      return { rows: [{ value: JSON.stringify(mockSessionRegistry) }] };
    }
  }
  return { rows: [] };
};

pool.withTransaction = async (callback) => {
  const mockClient = {
    query: async (text, params) => {
      const queryStr = typeof text === 'string' ? text : text?.text || '';
      if (queryStr.includes('SELECT value FROM settings WHERE key = $1 FOR UPDATE')) {
        return { rows: [{ value: JSON.stringify(mockSessionRegistry) }] };
      }
      if (queryStr.includes('UPDATE settings')) {
        mockSessionRegistry = JSON.parse(params?.[1] || '{}');
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  return await callback(mockClient);
};

const adminRepository = require('../../lib/db/repositories/adminRepository');
adminRepository.findAdminById = async (id) => {
  return mockAdmins[id] || null;
};
adminRepository.findAdminByEmail = async (email) => {
  return Object.values(mockAdmins).find((a) => a.email.toLowerCase() === String(email).toLowerCase()) || null;
};
adminRepository.touchAdminUpdated = async () => {};

// 3. Stub downstream engines to return predictable, harmless synthetic responses
const adminDashboardEngine = require('../../lib/engines/admin-dashboard');
adminDashboardEngine.getDashboardMetrics = async () => ({
  revenue: 125000,
  ordersCount: 42,
  activeWorkers: 5,
});

const businessSettingsEngine = require('../../lib/engines/business-settings');
businessSettingsEngine.getAllSettings = async () => ({
  delivery_fee: 40,
  tax_rate: 5,
});
businessSettingsEngine.updateSetting = async (key, value) => ({
  key,
  value,
  updated_at: new Date().toISOString(),
});

const gpsTrackingEngine = require('../../lib/engines/gps-tracking');
gpsTrackingEngine.ingestPosition = async (id, data) => ({
  journeyId: id,
  latitude: data.latitude,
  longitude: data.longitude,
  arrived: false,
});

const notificationsEngine = require('../../lib/engines/notifications');
notificationsEngine.processDueScheduledBroadcasts = async () => ({
  processedCount: 2,
  results: [{ id: 'bcast-1', status: 'SENT' }, { id: 'bcast-2', status: 'SENT' }],
});

const auditEngine = require('../../lib/engines/audit');
auditEngine.getAuditLogs = async () => ({
  total: 1,
  logs: [{ id: 'audit-1', action: 'TEST_ACTION' }],
});
auditEngine.recordAuditLog = async () => {};

// 4. In-memory dynamic loader for route files to test ACTUAL handler code directly
function loadRoute(relPath) {
  const fullPath = path.resolve(__dirname, relPath);
  let code = fs.readFileSync(fullPath, 'utf8');

  // Convert ES import/export into CommonJS execution for direct Node testing
  code = code.replace(/import\s*\{\s*NextResponse\s*\}\s*from\s*['"]next\/server(\.js)?['"];?/g, 'const { NextResponse } = require("next/server");');
  code = code.replace(/import\s*\{\s*([a-zA-Z0-9_,\s]+)\s*\}\s*from\s*['"]([^'"]+)['"];?/g, 'const { $1 } = require("$2");');
  code = code.replace(/export\s+const\s+dynamic\s*=\s*['"][^'"]+['"];?/g, '');
  code = code.replace(/export\s+async\s+function\s+([a-zA-Z0-9_]+)/g, 'exports.$1 = async function $1');

  const m = { exports: {} };
  const customRequire = (specifier) => {
    if (specifier.startsWith('.')) {
      return require(path.resolve(path.dirname(fullPath), specifier));
    }
    return require(specifier);
  };

  const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', code);
  fn(customRequire, m, m.exports, fullPath, path.dirname(fullPath));
  return m.exports;
}

// 5. Import Middleware and Target API Route Handlers
const { middleware } = require('../../middleware');
const { GET: dashboardGet } = loadRoute('../../app/api/v1/admin/dashboard/route.js');
const { GET: settingsGet, PATCH: settingsPatch } = loadRoute('../../app/api/v1/admin/settings/route.js');
const { GET: sessionsGet, DELETE: sessionsDelete } = loadRoute('../../app/api/v1/admin/auth/sessions/route.js');
const { GET: meGet } = loadRoute('../../app/api/v1/admin/auth/me/route.js');
const { POST: changePasswordPost } = loadRoute('../../app/api/v1/admin/auth/change-password/route.js');
const { POST: positionsPost } = loadRoute('../../app/api/v1/admin/gps/journeys/[id]/positions/route.js');
const { POST: processScheduledPost } = loadRoute('../../app/api/v1/admin/notifications/process-scheduled/route.js');
const { GET: auditGet } = loadRoute('../../app/api/v1/admin/audit/route.js');
const { POST: logoutPost } = loadRoute('../../app/api/v1/admin/auth/logout/route.js');

/**
 * Synthetic mock NextRequest / Request factory
 */
function createMockRequest({ pathname = '/api/v1/admin/dashboard', cookies = {}, headers = {}, method = 'GET', body = null } = {}) {
  const url = new URL(`http://localhost:3000${pathname}`);
  const headerMap = new Map();
  Object.entries(headers).forEach(([k, v]) => headerMap.set(k.toLowerCase(), String(v)));

  const req = {
    method,
    url: url.toString(),
    nextUrl: url,
    headers: {
      get: (key) => headerMap.get(key.toLowerCase()) || null,
    },
    cookies: {
      get: (name) => (cookies[name] !== undefined ? { name, value: cookies[name] } : undefined),
    },
    json: async () => (body !== null ? body : {}),
  };
  return req;
}

/**
 * Helper to generate a valid registered session
 */
function createActiveSession({ adminId = 'admin-uuid-1', role = 'ADMIN', is_super_admin = true } = {}) {
  const sessionId = 'sess-' + Math.random().toString(36).substring(2);
  const now = Date.now();
  const token = jwt.sign(
    {
      adminId,
      email: mockAdmins[adminId]?.email || 'test@pondfish.in',
      name: mockAdmins[adminId]?.name || 'Test Admin',
      role,
      is_super_admin,
      sessionId,
    },
    TEST_JWT_SECRET,
    { expiresIn: '12h' }
  );

  mockSessionRegistry[sessionId] = {
    sessionId,
    adminId,
    email: mockAdmins[adminId]?.email || 'test@pondfish.in',
    role,
    is_super_admin,
    createdAt: now,
    expiresAt: now + 12 * 60 * 60 * 1000,
    lastSeenAt: now,
  };

  return { token, sessionId };
}

console.log('=== PONDFISH ADMIN ROUTE AUTHORIZATION BEHAVIOR INTEGRATION TESTS ===\n');

async function runTests() {
  let passed = 0;

  // ---------------------------------------------------------------------------
  // Test 1: No credentials at all
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 1] Unauthenticated requests rejected at both middleware and route handler...');

    const endpoints = [
      { handler: dashboardGet, path: '/api/v1/admin/dashboard', method: 'GET' },
      { handler: settingsGet, path: '/api/v1/admin/settings', method: 'GET' },
      { handler: auditGet, path: '/api/v1/admin/audit', method: 'GET' },
      { handler: meGet, path: '/api/v1/admin/auth/me', method: 'GET' },
      { handler: (req) => sessionsDelete(req), path: '/api/v1/admin/auth/sessions', method: 'DELETE' },
      { handler: (req) => positionsPost(req, { params: { id: 'j-1' } }), path: '/api/v1/admin/gps/journeys/j-1/positions', method: 'POST' },
    ];

    for (const ep of endpoints) {
      const req = createMockRequest({ pathname: ep.path, method: ep.method });
      
      // Check middleware response
      const midRes = await middleware(req);
      assert.strictEqual(midRes.status, 401, `Middleware must return 401 for unauthenticated ${ep.path}`);
      const midData = await midRes.json();
      assert.strictEqual(midData.success, false);
      assert.strictEqual(midData.error.code, 'UNAUTHORIZED');

      // Check route handler response independently
      const res = await ep.handler(req);
      assert.strictEqual(res.status, 401, `Handler must return 401 for unauthenticated ${ep.path}`);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    }

    passed++;
    console.log('  ✓ Verified 6 endpoints independently fail closed with 401 UNAUTHORIZED when no credentials provided');
  }

  // ---------------------------------------------------------------------------
  // Test 2: Random / malformed cookie
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 2] Malformed or random garbage cookie rejected by route handlers...');

    const malformedReq = createMockRequest({
      pathname: '/api/v1/admin/dashboard',
      cookies: { admin_session: 'not.a.valid.jwt.cookie.garbage' },
    });

    const res = await dashboardGet(malformedReq);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'UNAUTHORIZED');

    passed++;
    console.log('  ✓ Malformed session cookie rejected with 401 UNAUTHORIZED');
  }

  // ---------------------------------------------------------------------------
  // Test 3: Correctly signed but expired token
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 3] Expired token fails closed at route handler with SESSION_EXPIRED...');

    const expiredToken = jwt.sign(
      {
        adminId: 'admin-uuid-1',
        email: 'admin@pondfish.in',
        role: 'ADMIN',
        sessionId: 'expired-sess-1',
        exp: Math.floor(Date.now() / 1000) - 300, // expired 5 minutes ago
      },
      TEST_JWT_SECRET
    );

    const req = createMockRequest({
      pathname: '/api/v1/admin/dashboard',
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    const res = await dashboardGet(req);
    assert.strictEqual(res.status, 401, 'Expired token must return 401');
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'SESSION_EXPIRED');

    passed++;
    console.log('  ✓ Expired token rejected with 401 SESSION_EXPIRED');
  }

  // ---------------------------------------------------------------------------
  // Test 4: Wrong signing secret
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 4] Token signed with unauthorized/attacker secret rejected...');

    const forgedToken = jwt.sign(
      {
        adminId: 'admin-uuid-1',
        email: 'admin@pondfish.in',
        role: 'ADMIN',
        is_super_admin: true,
        sessionId: 'forged-sess-1',
      },
      'attacker-forged-secret-key-12345678',
      { expiresIn: '12h' }
    );

    const req = createMockRequest({
      pathname: '/api/v1/admin/settings',
      cookies: { admin_session: forgedToken },
    });

    const res = await settingsGet(req);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'UNAUTHORIZED');

    passed++;
    console.log('  ✓ Forged signing secret rejected with 401 UNAUTHORIZED');
  }

  // ---------------------------------------------------------------------------
  // Test 5: Correctly signed token with non-admin role (CUSTOMER / WORKER)
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 5] Non-admin roles (CUSTOMER / WORKER) rejected from admin endpoints...');

    const customerToken = jwt.sign(
      { customerId: 'cust-uuid-1', role: 'CUSTOMER' },
      TEST_JWT_SECRET,
      { expiresIn: '12h' }
    );

    const workerToken = jwt.sign(
      { workerId: 'worker-uuid-1', role: 'WORKER' },
      TEST_JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Customer attempt on admin dashboard
    const custReq = createMockRequest({
      pathname: '/api/v1/admin/dashboard',
      cookies: { admin_session: customerToken },
    });
    const custRes = await dashboardGet(custReq);
    assert.strictEqual(custRes.status, 403, 'Customer role must be forbidden on admin route');
    const custData = await custRes.json();
    assert.strictEqual(custData.error.code, 'FORBIDDEN');

    // Worker attempt on admin settings
    const workerReq = createMockRequest({
      pathname: '/api/v1/admin/settings',
      headers: { authorization: `Bearer ${workerToken}` },
    });
    const workerRes = await settingsGet(workerReq);
    assert.strictEqual(workerRes.status, 403, 'Worker role must be forbidden on admin route');
    const workerData = await workerRes.json();
    assert.strictEqual(workerData.error.code, 'FORBIDDEN');

    passed++;
    console.log('  ✓ Cross-role forging attempts strictly rejected with 403 FORBIDDEN');
  }

  // ---------------------------------------------------------------------------
  // Test 6: Revoked or missing session-registry entry (PostgreSQL session state)
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 6] Cryptographically valid JWT whose session is absent in registry rejected...');

    const missingSessionId = 'session-not-in-db-12345';
    const unregToken = jwt.sign(
      {
        adminId: 'admin-uuid-1',
        email: 'superadmin@pondfish.in',
        role: 'ADMIN',
        is_super_admin: true,
        sessionId: missingSessionId,
      },
      TEST_JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Ensure session registry does NOT contain missingSessionId
    delete mockSessionRegistry[missingSessionId];

    const req = createMockRequest({
      pathname: '/api/v1/admin/dashboard',
      cookies: { admin_session: unregToken },
    });

    const res = await dashboardGet(req);
    assert.strictEqual(res.status, 401, 'Unregistered / revoked session must be rejected with 401');
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'SESSION_EXPIRED');

    passed++;
    console.log('  ✓ Unregistered/revoked session in registry rejected with 401 SESSION_EXPIRED');
  }

  // ---------------------------------------------------------------------------
  // Test 7: Arbitrary non-empty x-admin-key and x-internal-secret headers
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 7] Arbitrary machine secrets cannot bypass middleware or handlers...');

    // Arbitrary key against standard admin route (settings)
    const arbReq = createMockRequest({
      pathname: '/api/v1/admin/settings',
      headers: { 'x-admin-key': 'arbitrary-attacker-value-999' },
    });

    // 1. Middleware early guard must reject (not a telemetry/scheduler endpoint, no adminToken)
    const midRes = await middleware(arbReq);
    assert.strictEqual(midRes.status, 401, 'Middleware must reject arbitrary x-admin-key on general admin route');
    const midData = await midRes.json();
    assert.strictEqual(midData.error.code, 'UNAUTHORIZED');

    // 2. Handler must independently reject
    const res = await settingsGet(arbReq);
    assert.strictEqual(res.status, 401, 'Handler must reject arbitrary x-admin-key on general admin route');
    const data = await res.json();
    assert.strictEqual(data.error.code, 'UNAUTHORIZED');

    // Arbitrary internal secret against sessions delete
    const arbInternalReq = createMockRequest({
      pathname: '/api/v1/admin/auth/sessions',
      method: 'DELETE',
      headers: { 'x-internal-secret': 'arbitrary-cron-key' },
    });
    const midRes2 = await middleware(arbInternalReq);
    assert.strictEqual(midRes2.status, 401);
    const res2 = await sessionsDelete(arbInternalReq);
    assert.strictEqual(res2.status, 401);

    passed++;
    console.log('  ✓ Arbitrary machine secrets blocked at both middleware boundary and API handlers');
  }

  // ---------------------------------------------------------------------------
  // Test 8: Authorized internal secrets against explicit machine endpoints
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 8] Legitimate internal credentials accepted strictly at explicitly designated endpoints...');

    // 1. Telemetry endpoint with valid ADMIN_SECRET
    const validTelemetryReq = createMockRequest({
      pathname: '/api/v1/admin/gps/journeys/journey-101/positions',
      method: 'POST',
      headers: { 'x-admin-key': TEST_ADMIN_SECRET },
      body: { latitude: 12.9716, longitude: 77.5946, speed: 45 },
    });

    const midTelemetry = await middleware(validTelemetryReq);
    assert.strictEqual(midTelemetry.status, 200, 'Middleware permits valid telemetry key pass-through');
    const posRes = await positionsPost(validTelemetryReq, { params: { id: 'journey-101' } });
    assert.strictEqual(posRes.status, 201, 'Telemetry endpoint accepts configured x-admin-key');
    const posData = await posRes.json();
    assert.strictEqual(posData.success, true);

    // 2. Scheduler endpoint with valid CRON_SECRET
    const validSchedulerReq = createMockRequest({
      pathname: '/api/v1/admin/notifications/process-scheduled',
      method: 'POST',
      headers: { 'x-internal-secret': TEST_CRON_SECRET },
    });

    const midSched = await middleware(validSchedulerReq);
    assert.strictEqual(midSched.status, 200, 'Middleware permits valid scheduler secret pass-through');
    const schedRes = await processScheduledPost(validSchedulerReq);
    assert.strictEqual(schedRes.status, 200, 'Scheduler endpoint accepts configured x-internal-secret');
    const schedData = await schedRes.json();
    assert.strictEqual(schedData.success, true);
    assert.strictEqual(schedData.processedCount, 2);

    // 3. BUT the exact same valid ADMIN_SECRET sent to human admin endpoint MUST BE REJECTED
    const crossAccessReq = createMockRequest({
      pathname: '/api/v1/admin/settings',
      headers: { 'x-admin-key': TEST_ADMIN_SECRET },
    });
    const crossMid = await middleware(crossAccessReq);
    assert.strictEqual(crossMid.status, 401, 'Middleware blocks telemetry key on human admin routes');
    const crossRes = await settingsGet(crossAccessReq);
    assert.strictEqual(crossRes.status, 401, 'Human admin handler rejects telemetry key');

    passed++;
    console.log('  ✓ Machine credentials accepted ONLY at designated endpoints; general super-admin bypass impossible');
  }

  // ---------------------------------------------------------------------------
  // Test 9: Logout followed by reuse of the old session
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 9] Reusing a session after logout fails closed...');

    // 1. Create and verify active session
    const { token, sessionId } = createActiveSession({ adminId: 'admin-uuid-1' });
    assert.ok(mockSessionRegistry[sessionId], 'Session must be active in registry');

    const authReq = createMockRequest({
      pathname: '/api/v1/admin/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });
    const beforeLogoutRes = await dashboardGet(authReq);
    assert.strictEqual(beforeLogoutRes.status, 200, 'Active session accesses dashboard');

    // 2. Perform logout
    const logoutReq = createMockRequest({
      pathname: '/api/v1/admin/auth/logout',
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    const logoutRes = await logoutPost(logoutReq);
    assert.strictEqual(logoutRes.status, 200);

    // Verify session was removed from registry
    assert.strictEqual(mockSessionRegistry[sessionId], undefined, 'Logout must remove session from registry');

    // 3. Attempt to reuse old token
    const reuseReq = createMockRequest({
      pathname: '/api/v1/admin/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });
    const afterLogoutRes = await dashboardGet(reuseReq);
    assert.strictEqual(afterLogoutRes.status, 401, 'Logged out session must be rejected with 401');
    const afterData = await afterLogoutRes.json();
    assert.strictEqual(afterData.error.code, 'SESSION_EXPIRED');

    passed++;
    console.log('  ✓ Post-logout token reuse immediately fails closed with 401 SESSION_EXPIRED');
  }

  // ---------------------------------------------------------------------------
  // Test 10: Terminating other sessions revokes them immediately
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 10] Session revocation terminates targeted sessions while preserving current session...');

    const sess1 = createActiveSession({ adminId: 'admin-uuid-1' });
    const sess2 = createActiveSession({ adminId: 'admin-uuid-1' });

    // Both can access
    const req1 = createMockRequest({ pathname: '/api/v1/admin/dashboard', headers: { authorization: `Bearer ${sess1.token}` } });
    const req2 = createMockRequest({ pathname: '/api/v1/admin/dashboard', headers: { authorization: `Bearer ${sess2.token}` } });
    assert.strictEqual((await dashboardGet(req1)).status, 200);
    assert.strictEqual((await dashboardGet(req2)).status, 200);

    // sess1 terminates other sessions
    const deleteReq = createMockRequest({
      pathname: '/api/v1/admin/auth/sessions',
      method: 'DELETE',
      headers: { authorization: `Bearer ${sess1.token}` },
    });
    const delRes = await sessionsDelete(deleteReq);
    assert.strictEqual(delRes.status, 200);

    // sess1 still active
    const postDelReq1 = createMockRequest({ pathname: '/api/v1/admin/dashboard', headers: { authorization: `Bearer ${sess1.token}` } });
    assert.strictEqual((await dashboardGet(postDelReq1)).status, 200);

    // sess2 now revoked!
    const postDelReq2 = createMockRequest({ pathname: '/api/v1/admin/dashboard', headers: { authorization: `Bearer ${sess2.token}` } });
    const revokedRes = await dashboardGet(postDelReq2);
    assert.strictEqual(revokedRes.status, 401);
    const revokedData = await revokedRes.json();
    assert.strictEqual(revokedData.error.code, 'SESSION_EXPIRED');

    passed++;
    console.log('  ✓ Terminated session revoked from registry and rejected with 401 on next call');
  }

  // ---------------------------------------------------------------------------
  // Test 11: Normal valid admin operations across multiple resources
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 11] Legitimate administrative sessions succeed with 200/201 across endpoints...');

    const { token } = createActiveSession({ adminId: 'admin-uuid-1' });

    // 1. Dashboard metrics
    const dashRes = await dashboardGet(createMockRequest({
      pathname: '/api/v1/admin/dashboard',
      headers: { authorization: `Bearer ${token}` },
    }));
    assert.strictEqual(dashRes.status, 200);
    const dashData = await dashRes.json();
    assert.strictEqual(dashData.data.ordersCount, 42);

    // 2. Settings fetch
    const setRes = await settingsGet(createMockRequest({
      pathname: '/api/v1/admin/settings',
      headers: { authorization: `Bearer ${token}` },
    }));
    assert.strictEqual(setRes.status, 200);
    const setData = await setRes.json();
    assert.strictEqual(setData.data.delivery_fee, 40);

    // 3. Settings update
    const patchRes = await settingsPatch(createMockRequest({
      pathname: '/api/v1/admin/settings',
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}` },
      body: { key: 'delivery_fee', value: 50, reason: 'Updated for seasonal rate change' },
    }));
    assert.strictEqual(patchRes.status, 200);

    // 4. Audit trail fetch
    const auditRes = await auditGet(createMockRequest({
      pathname: '/api/v1/admin/audit',
      headers: { authorization: `Bearer ${token}` },
    }));
    assert.strictEqual(auditRes.status, 200);

    passed++;
    console.log('  ✓ All legitimate admin operations successfully executed and verified');
  }

  // ---------------------------------------------------------------------------
  // Test 12: Production fail-closed when secrets are absent
  // ---------------------------------------------------------------------------
  {
    console.log('[Test 12] Production fail-closed behavior when secrets are missing...');

    const oldEnv = process.env.NODE_ENV;
    const oldJwt = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      const { getJwtSecret } = require('../../lib/auth/admin-auth');
      assert.throws(
        () => getJwtSecret(),
        /FATAL SECURITY ERROR: JWT_SECRET environment variable is missing/,
        'getJwtSecret must throw fatal error in production when JWT_SECRET is missing'
      );
    } finally {
      process.env.NODE_ENV = oldEnv;
      process.env.JWT_SECRET = oldJwt;
    }

    passed++;
    console.log('  ✓ Production environment strictly fails closed when secrets are missing');
  }

  console.log(`\n================================================================`);
  console.log(`ALL ${passed} INTEGRATION BEHAVIOR TESTS PASSED WITH ZERO FAILURES`);
  console.log(`================================================================\n`);
}

runTests().catch((err) => {
  console.error('FATAL TEST SUITE FAILURE:', err);
  process.exit(1);
});
