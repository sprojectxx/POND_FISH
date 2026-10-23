/**
 * PondFish Post-UI Integration Bug, API Contract, Workflow & Security Test Suite
 * Traceability:
 * - Worker Authentication, Token Issuance, Invalidation & Revocation
 * - Admin Navigation, Middleware Guard, and Role Boundary Enforcement
 * - Removal of Hardcoded Data & Public Truck/Discount API Contracts
 * - Booking Contract & Parameter Consistency
 * - Realtime Native Architecture & Absence of Dummy Supabase Fallbacks
 *
 * Isolated synthetic tests. Zero database mutation.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { middleware } = require('../../middleware');
const {
  generateWorkerSessionToken,
  verifyWorkerSessionToken,
  verifyWorkerSessionAsync,
  logoutWorker,
  extractWorkerToken,
  loadWorkerSessionRegistry,
  mutateWorkerSessionRegistry,
} = require('../../lib/engines/worker');
const workerRepository = require('../../lib/db/repositories/workerRepository');
const gpsTrackingEngine = require('../../lib/engines/gps-tracking');
const gpsRepository = require('../../lib/db/repositories/gpsRepository');
const db = require('../../lib/db/pool');

console.log('=== PONDFISH POST-UI INTEGRATION AUDIT TEST SUITE ===\n');

// Capture initial environment to guarantee test isolation and full teardown
const savedInitialEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
  ALLOW_TEST_SESSION_FALLBACK: process.env.ALLOW_TEST_SESSION_FALLBACK,
};

// Guarantee synthetic audit tests NEVER connect to or mutate any configured database
delete process.env.DATABASE_URL;

let passed = 0;
const TEST_JWT_SECRET = 'pondfish-test-suite-secure-jwt-secret-key-2026';
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.NODE_ENV = 'test';
process.env.ALLOW_TEST_SESSION_FALLBACK = 'true';

function createMockRequest({ pathname = '/', cookies = {}, headers = {}, method = 'GET', search = '' } = {}) {
  const url = new URL(`http://localhost:3000${pathname}${search}`);
  const headerMap = new Map();
  Object.entries(headers).forEach(([k, v]) => headerMap.set(k.toLowerCase(), v));

  return {
    method,
    url: url.toString(),
    nextUrl: url,
    headers: {
      get: (key) => headerMap.get(key.toLowerCase()) || null,
    },
    cookies: {
      get: (name) => (cookies[name] !== undefined ? { name, value: cookies[name] } : undefined),
    },
  };
}

async function runAuditTests() {
  console.log('[Test Group 1] Worker Authentication, Session Lifecycle & Server-side Invalidation');

{
  // Test 1.1: Token Generation and Verification
  const worker = { id: 'worker-uuid-test-01', name: 'Ravi Kumar', mobile: '9876543210', active: true };
  const sessionId = 'session-worker-test-01';
  const token = generateWorkerSessionToken(worker, sessionId);

  assert.ok(token, 'Token must be generated');
  const decoded = verifyWorkerSessionToken(token);
  assert.strictEqual(decoded.workerId, worker.id);
  assert.strictEqual(decoded.role, 'WORKER');
  assert.strictEqual(decoded.sessionId, sessionId);
  passed++;
  console.log('  ✓ 1.1 Worker session token contains workerId, role: WORKER, and unique sessionId');

  // Test 1.2: extractWorkerToken handles both cookies and Bearer headers
  const reqWithCookie = createMockRequest({ pathname: '/worker', cookies: { worker_session: token } });
  assert.strictEqual(extractWorkerToken(reqWithCookie), token);

  const reqWithHeader = createMockRequest({
    pathname: '/api/v1/worker/bookings/today',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.strictEqual(extractWorkerToken(reqWithHeader), token);

  const reqEmpty = createMockRequest({ pathname: '/worker' });
  assert.strictEqual(extractWorkerToken(reqEmpty), null);
  passed++;
  console.log('  ✓ 1.2 extractWorkerToken extracts credentials from worker_session cookie and Bearer header');

  // Test 1.3: Middleware permits navigation with worker_session cookie
  const midRes = middleware(reqWithCookie);
  assert.strictEqual(midRes.headers.get('location'), null, 'Authenticated worker should access /worker without redirect');
  passed++;
  console.log('  ✓ 1.3 Next.js middleware smoothly approves /worker access with valid worker_session cookie');

  // Test 1.4: Middleware redirects unauthenticated user from /worker to /worker/login
  const unauthMidRes = middleware(reqEmpty);
  assert.ok(unauthMidRes.headers.get('location')?.includes('/worker/login'), 'Unauthenticated user must be redirected');
  passed++;
  console.log('  ✓ 1.4 Middleware strictly redirects unauthenticated visits away from /worker');

  // Test 1.5: Server-side Invalidation (logoutWorker)
  const logoutRes = await logoutWorker(token);
  assert.strictEqual(logoutRes.success, true);

  // Subsequent token verification must fail closed
  let tokenReusedError = null;
  try {
    verifyWorkerSessionToken(token);
  } catch (err) {
    tokenReusedError = err;
  }
  assert.ok(tokenReusedError, 'Revoked token must be rejected');
  assert.strictEqual(tokenReusedError.code, 'SESSION_REVOKED');
  assert.strictEqual(tokenReusedError.status, 401);
  passed++;
  console.log('  ✓ 1.5 Calling logoutWorker immediately invalidates session server-side; reused token fails with SESSION_REVOKED (401)');
}

// ---------------------------------------------------------------------------
// 2. Disabled Account Enforcement
// ---------------------------------------------------------------------------
console.log('\n[Test Group 2] Disabled Worker Account Enforcement');
{
  const disabledWorkerId = 'worker-uuid-disabled-99';
  const origFind = workerRepository.findWorkerById;

  try {
    // Mock repository response
    workerRepository.findWorkerById = async (id) => {
      if (id === disabledWorkerId) {
        return { id: disabledWorkerId, name: 'Inactive Staff', mobile: '9123456789', active: false };
      }
      return null;
    };

    const sessionId = 'session-disabled-test';
    const token = generateWorkerSessionToken({ id: disabledWorkerId, name: 'Inactive Staff' }, sessionId);

    let disabledError = null;
    try {
      await verifyWorkerSessionAsync(token);
    } catch (err) {
      disabledError = err;
    }

    assert.ok(disabledError, 'Disabled account must throw');
    assert.strictEqual(disabledError.code, 'WORKER_ACCOUNT_DISABLED');
    assert.strictEqual(disabledError.status, 403);
    passed++;
    console.log('  ✓ 2.1 verifyWorkerSessionAsync strictly rejects disabled worker accounts with status 403');
  } finally {
    // Restore repository
    workerRepository.findWorkerById = origFind;
  }
}

// ---------------------------------------------------------------------------
// 3. Admin and Worker Role Isolation
// ---------------------------------------------------------------------------
console.log('\n[Test Group 3] Cross-Portal Role Boundary Isolation');
{
  const workerToken = jwt.sign({ workerId: 'worker-01', role: 'WORKER' }, TEST_JWT_SECRET);
  const adminToken = jwt.sign({ adminId: 'admin-01', role: 'ADMIN' }, TEST_JWT_SECRET);

  // Worker trying to access /admin
  const workerAtAdminReq = createMockRequest({ pathname: '/admin', cookies: { worker_session: workerToken } });
  const workerAtAdminRes = middleware(workerAtAdminReq);
  assert.ok(workerAtAdminRes.headers.get('location')?.includes('/admin/login'), 'Worker token must not access /admin');

  // Admin token cannot be used to bypass worker login via worker_session
  const fakeWorkerReq = createMockRequest({ pathname: '/worker', cookies: { worker_session: adminToken } });
  const fakeWorkerRes = middleware(fakeWorkerReq);
  assert.ok(fakeWorkerRes.headers.get('location')?.includes('/worker/login'), 'Admin token cannot masquerade as worker');

  passed++;
  console.log('  ✓ 3.1 Strict cryptographic isolation prevents token crossover between admin and worker portals');
}

// ---------------------------------------------------------------------------
// 4. Removal of Fake Data & Public Truck/Discount API Contracts
// ---------------------------------------------------------------------------
console.log('\n[Test Group 4] Public API Truthfulness & Fake Data Elimination');
{
  // Test 4.1: Customer Live Tracking Contract
  const origGetJourney = gpsRepository.getActiveCustomerJourney;
  try {
    gpsRepository.getActiveCustomerJourney = async () => null;
    const trackingData = await gpsTrackingEngine.getCustomerLiveTracking();

    assert.strictEqual(typeof trackingData.active, 'boolean');
    assert.strictEqual(trackingData.active, false);
    // Ensure no sensitive driver internals are leaked to public
    assert.strictEqual(trackingData.driverMobile, undefined);
    assert.strictEqual(trackingData.licensePlate, undefined);
    passed++;
    console.log('  ✓ 4.1 gpsTrackingEngine.getCustomerLiveTracking conforms to customer-safe public telemetry schema');
  } finally {
    gpsRepository.getActiveCustomerJourney = origGetJourney;
  }

  // Test 4.2: Verify unapproved lib/supabase-client.js is deleted
  const supabaseClientPath = path.join(__dirname, '../../lib/supabase-client.js');
  const supabaseExists = fs.existsSync(supabaseClientPath);
  assert.strictEqual(supabaseExists, false, 'lib/supabase-client.js with dummy keys must be deleted');
  passed++;
  console.log('  ✓ 4.2 Unapproved lib/supabase-client.js placeholder file successfully removed from codebase');
}

// ---------------------------------------------------------------------------
// 5. Booking Links & Parameter Standardization
// ---------------------------------------------------------------------------
console.log('\n[Test Group 5] Booking Parameter & URL Standardization');
{
  // Verify FishCard and FishAvailability use fishId
  const fishCardFile = fs.readFileSync(path.join(__dirname, '../../app/(public)/components/FishCard.jsx'), 'utf8');
  assert.ok(fishCardFile.includes('href={`/booking?fishId=${fish.id}`}'), 'FishCard must use fishId param');
  assert.ok(!fishCardFile.includes('href={`/booking?fish_id='), 'FishCard must not use deprecated fish_id');

  const fishAvailFile = fs.readFileSync(path.join(__dirname, '../../app/(public)/components/FishAvailability.jsx'), 'utf8');
  assert.ok(fishAvailFile.includes('href={`/booking?fishId=${fish.id}`}'), 'FishAvailability must use fishId param');
  assert.ok(!fishAvailFile.includes('|| 260'), 'Hardcoded fallback price || 260 must be removed');

  const bookingPageFile = fs.readFileSync(path.join(__dirname, '../../app/(public)/booking/page.jsx'), 'utf8');
  assert.ok(bookingPageFile.includes("searchParams") && bookingPageFile.includes("'fishId'"), 'Booking page must consume fishId query parameter');

  passed++;
  console.log('  ✓ 5.1 Booking links standardized to fishId and hardcoded || 260 fallback price removed');
}

// ---------------------------------------------------------------------------
// 6. Native Realtime Architecture Verification
// ---------------------------------------------------------------------------
console.log('\n[Test Group 6] Native Realtime WebSocket Architecture');
{
  const tvPageFile = fs.readFileSync(path.join(__dirname, '../../app/(tv)/tv/page.jsx'), 'utf8');
  assert.ok(!tvPageFile.includes('supabase'), 'TV page must not import or use supabase realtime');
  assert.ok(tvPageFile.includes('/api/v1/realtime'), 'TV page must connect to native /api/v1/realtime WebSocket');

  const journeysPageFile = fs.readFileSync(path.join(__dirname, '../../app/(admin)/admin/journeys/page.jsx'), 'utf8');
  assert.ok(!journeysPageFile.includes('supabase'), 'Journeys page must not import or use supabase realtime');
  assert.ok(journeysPageFile.includes('/api/v1/realtime'), 'Journeys page must connect to native /api/v1/realtime WebSocket');

  passed++;
  console.log('  ✓ 6.1 TV and Admin Journeys live pages use native WebSocket endpoint with zero Supabase dependencies');
}

// ---------------------------------------------------------------------------
// 7. Worker Login Scoped Token Exposure & HttpOnly Cookie Verification
// ---------------------------------------------------------------------------
console.log('\n[Test Group 7] Worker Login Token Concealment & Scoped API Response');
{
  function loadRoute(relPath) {
    const fullPath = path.resolve(__dirname, relPath);
    let code = fs.readFileSync(fullPath, 'utf8');
    code = code.replace(/import\s*\{\s*NextResponse\s*\}\s*from\s*['"]next\/server(\.js)?['"];?/g, 'const { NextResponse } = require("next/server");');
    code = code.replace(/import\s*\{\s*([a-zA-Z0-9_,\s]+)\s*\}\s*from\s*['"]([^'"]+)['"];?/g, 'const { $1 } = require("$2");');
    code = code.replace(/export\s+const\s+dynamic\s*=\s*['"][^'"]+['"];?/g, '');
    code = code.replace(/export\s+async\s+function\s+([a-zA-Z0-9_]+)/g, 'exports.$1 = async function $1');
    const m = { exports: {} };
    const customRequire = (specifier) => {
      if (specifier.startsWith('.')) return require(path.resolve(path.dirname(fullPath), specifier));
      return require(specifier);
    };
    const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', code);
    fn(customRequire, m, m.exports, fullPath, path.dirname(fullPath));
    return m.exports;
  }

  const loginRoute = loadRoute('../../app/api/v1/worker/auth/login/route.js');

  const origFindByMobile = workerRepository.findWorkerByMobile;
  const origVerifyPw = workerRepository.verifyPassword;

  try {
    workerRepository.findWorkerByMobile = async (mobile) => ({
      id: 'worker-login-audit-1',
      name: 'Suresh Staff',
      mobile_number: mobile,
      active: true,
      password_hash: 'mock-hash',
    });
    workerRepository.verifyPassword = () => true;

    // 7.1 Standard Browser Login: MUST NOT return token in response body
    const browserReq = createMockRequest({
      pathname: '/api/v1/worker/auth/login',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    browserReq.json = async () => ({ mobileNumber: '9876543210', password: 'ValidPassword123' });

    const browserRes = await loginRoute.POST(browserReq);
    assert.strictEqual(browserRes.status, 200);
    const browserBody = await browserRes.json();
    assert.strictEqual(browserBody.success, true);
    assert.ok(browserBody.data.worker, 'Worker profile must be returned');
    assert.ok(browserBody.data.sessionId, 'SessionId must be returned');
    assert.strictEqual(browserBody.data.token, undefined, 'Session token MUST NOT be returned in JSON payload for browser clients');

    const setCookieHeader = browserRes.cookies.get('worker_session');
    assert.ok(setCookieHeader, 'worker_session cookie must be set');
    assert.strictEqual(setCookieHeader.httpOnly, true, 'worker_session cookie must be HttpOnly');

    // 7.2 Adversarial & Token-Request Flags/Headers MUST NEVER Disclose Bearer Token
    // Attempt 1: body returnToken: true
    const tokenFlagReq = createMockRequest({
      pathname: '/api/v1/worker/auth/login',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    tokenFlagReq.json = async () => ({ mobileNumber: '9876543210', password: 'ValidPassword123', returnToken: true });
    const tokenFlagRes = await loginRoute.POST(tokenFlagReq);
    assert.strictEqual(tokenFlagRes.status, 200);
    const tokenFlagBody = await tokenFlagRes.json();
    assert.strictEqual(tokenFlagBody.data.token, undefined, 'returnToken flag must never disclose bearer token');

    // Attempt 2: body clientType: 'api'
    const clientTypeReq = createMockRequest({
      pathname: '/api/v1/worker/auth/login',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    clientTypeReq.json = async () => ({ mobileNumber: '9876543210', password: 'ValidPassword123', clientType: 'api' });
    const clientTypeRes = await loginRoute.POST(clientTypeReq);
    assert.strictEqual(clientTypeRes.status, 200);
    const clientTypeBody = await clientTypeRes.json();
    assert.strictEqual(clientTypeBody.data.token, undefined, 'clientType body field must never disclose bearer token');

    // Attempt 3: header x-client-type: api
    const headerApiReq = createMockRequest({
      pathname: '/api/v1/worker/auth/login',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client-type': 'api' },
    });
    headerApiReq.json = async () => ({ mobileNumber: '9876543210', password: 'ValidPassword123' });
    const headerApiRes = await loginRoute.POST(headerApiReq);
    assert.strictEqual(headerApiRes.status, 200);
    const headerApiBody = await headerApiRes.json();
    assert.strictEqual(headerApiBody.data.token, undefined, 'x-client-type header must never disclose bearer token');

    // Attempt 4: header x-auth-mode: token
    const headerAuthModeReq = createMockRequest({
      pathname: '/api/v1/worker/auth/login',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-auth-mode': 'token' },
    });
    headerAuthModeReq.json = async () => ({ mobileNumber: '9876543210', password: 'ValidPassword123' });
    const headerAuthModeRes = await loginRoute.POST(headerAuthModeReq);
    assert.strictEqual(headerAuthModeRes.status, 200);
    const headerAuthModeBody = await headerAuthModeRes.json();
    assert.strictEqual(headerAuthModeBody.data.token, undefined, 'x-auth-mode header must never disclose bearer token');

    // Attempt 5: Combined headers and body flags
    const combinedReq = createMockRequest({
      pathname: '/api/v1/worker/auth/login',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client-type': 'api', 'x-auth-mode': 'token' },
    });
    combinedReq.json = async () => ({ mobileNumber: '9876543210', password: 'ValidPassword123', returnToken: true, clientType: 'api' });
    const combinedRes = await loginRoute.POST(combinedReq);
    assert.strictEqual(combinedRes.status, 200);
    const combinedBody = await combinedRes.json();
    assert.strictEqual(combinedBody.data.token, undefined, 'Combined flags must never disclose bearer token');
    assert.ok(combinedRes.cookies.get('worker_session'), 'HttpOnly session cookie must be set');

    passed++;
    console.log('  ✓ 7.1 Browser worker login strictly conceals token; all token-request flags and caller-supplied headers rejected');
  } finally {
    workerRepository.findWorkerByMobile = origFindByMobile;
    workerRepository.verifyPassword = origVerifyPw;
  }
}

// ---------------------------------------------------------------------------
// 8. Hardened In-Memory Session Fallback (Accidental NODE_ENV=test Protection)
// ---------------------------------------------------------------------------
console.log('\n[Test Group 8] In-Memory Session Fallback Guard Hardening');
{
  const origNodeEnv = process.env.NODE_ENV;
  const origAllowFallback = process.env.ALLOW_TEST_SESSION_FALLBACK;
  const origDbUrl = process.env.DATABASE_URL;

  try {
    // Explicitly isolate from any database URL to exercise the no-database fallback guard path
    delete process.env.DATABASE_URL;

    // 8.1 Accidental NODE_ENV=test in deployed environment (without ALLOW_TEST_SESSION_FALLBACK)
    delete process.env.ALLOW_TEST_SESSION_FALLBACK;
    process.env.NODE_ENV = 'test';
    let missingGuardErr = null;
    try {
      await loadWorkerSessionRegistry();
    } catch (err) {
      missingGuardErr = err;
    }
    assert.ok(missingGuardErr, 'Accidental NODE_ENV=test without explicit guard must fail closed');
    assert.strictEqual(missingGuardErr.code, 'SESSION_REGISTRY_UNAVAILABLE');
    assert.strictEqual(missingGuardErr.status, 500);

    // 8.2 Production runtime strictly rejects in-memory fallback even if guard was set
    process.env.ALLOW_TEST_SESSION_FALLBACK = 'true';
    process.env.NODE_ENV = 'production';
    let prodErr = null;
    try {
      await loadWorkerSessionRegistry();
    } catch (err) {
      prodErr = err;
    }
    assert.ok(prodErr, 'Production environment must strictly reject in-memory session registry');
    assert.strictEqual(prodErr.code, 'SESSION_REGISTRY_UNAVAILABLE');
    assert.strictEqual(prodErr.status, 500);

    // 8.3 Development runtime strictly rejects in-memory fallback even if guard was set
    process.env.ALLOW_TEST_SESSION_FALLBACK = 'true';
    process.env.NODE_ENV = 'development';
    let devErr = null;
    try {
      await loadWorkerSessionRegistry();
    } catch (err) {
      devErr = err;
    }
    assert.ok(devErr, 'Development environment must strictly reject in-memory session registry');
    assert.strictEqual(devErr.code, 'SESSION_REGISTRY_UNAVAILABLE');
    assert.strictEqual(devErr.status, 500);

    passed++;
    console.log('  ✓ 8.1 In-memory session fallback strictly fails closed in production, development, and unflagged test environments');
  } finally {
    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
    else delete process.env.NODE_ENV;
    if (origAllowFallback !== undefined) process.env.ALLOW_TEST_SESSION_FALLBACK = origAllowFallback;
    else delete process.env.ALLOW_TEST_SESSION_FALLBACK;
    if (origDbUrl !== undefined) process.env.DATABASE_URL = origDbUrl;
    else delete process.env.DATABASE_URL;
  }
}

// ---------------------------------------------------------------------------
// 9. Middleware Malformed URI & Path Traversal Normalization
// ---------------------------------------------------------------------------
console.log('\n[Test Group 9] Middleware Malformed Percent-Encoding & Path Edge Cases');
{
  // 9.1 Malformed percent-encoding must fail closed with 400 Bad Request
  const malformedReq = createMockRequest({ pathname: '/api/v1/%E0%A4%A/worker/bookings' });
  const malformedRes = middleware(malformedReq);
  assert.strictEqual(malformedRes.status, 400, 'Malformed percent-encoding must return 400');
  const malformedBody = await malformedRes.json();
  assert.strictEqual(malformedBody.error.code, 'MALFORMED_URI_ENCODING');

  // 9.2 Consecutive slashes normalized without bypassing route guards
  const consecutiveSlashReq = createMockRequest({ pathname: '/api/v1//worker///bookings/today//' });
  const consecutiveRes = middleware(consecutiveSlashReq);
  assert.strictEqual(consecutiveRes.status, 401, 'Consecutive slashes must be normalized and blocked if unauthenticated');

  passed++;
  console.log('  ✓ 9.1 Malformed URI percent-encoding rejected with 400; consecutive and trailing slashes normalized');
}

// ---------------------------------------------------------------------------
// 10. Worker Logout Revocation Failure Contract & Cookie Preservation
// ---------------------------------------------------------------------------
console.log('\n[Test Group 10] Worker Logout Server Revocation Failure Contract');
{
  function loadRoute(relPath) {
    const fullPath = path.resolve(__dirname, relPath);
    let code = fs.readFileSync(fullPath, 'utf8');
    code = code.replace(/import\s*\{\s*NextResponse\s*\}\s*from\s*['"]next\/server(\.js)?['"];?/g, 'const { NextResponse } = require("next/server");');
    code = code.replace(/import\s*\{\s*([a-zA-Z0-9_,\s]+)\s*\}\s*from\s*['"]([^'"]+)['"];?/g, 'const { $1 } = require("$2");');
    code = code.replace(/export\s+const\s+dynamic\s*=\s*['"][^'"]+['"];?/g, '');
    code = code.replace(/export\s+async\s+function\s+([a-zA-Z0-9_]+)/g, 'exports.$1 = async function $1');
    const m = { exports: {} };
    const customRequire = (specifier) => {
      if (specifier.startsWith('.')) return require(path.resolve(path.dirname(fullPath), specifier));
      return require(specifier);
    };
    const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', code);
    fn(customRequire, m, m.exports, fullPath, path.dirname(fullPath));
    return m.exports;
  }

  const logoutRoute = loadRoute('../../app/api/v1/worker/auth/logout/route.js');
  const workerEngine = require('../../lib/engines/worker');

  // 10.1 Durable Revocation Failure (500): Cookie MUST NOT be cleared
  const origDbUrl = process.env.DATABASE_URL;
  const origWithTx = db.withTransaction;
  const token = workerEngine.generateWorkerSessionToken({ id: 'w-fail-log', name: 'Staff' }, 'sess-fail-logout');

  try {
    process.env.DATABASE_URL = 'mock://isolated-test-revocation-failure';
    db.withTransaction = async () => {
      const err = new Error('Database transaction failed during session deletion');
      err.code = 'TRANSACTION_FAILURE';
      throw err;
    };

    const failedLogoutReq = createMockRequest({
      pathname: '/api/v1/worker/auth/logout',
      method: 'POST',
      cookies: { worker_session: token },
    });

    const failedLogoutRes = await logoutRoute.POST(failedLogoutReq);

    assert.strictEqual(failedLogoutRes.status, 500, 'Logout route must return 500 on revocation failure');
    const failedLogoutBody = await failedLogoutRes.json();
    assert.strictEqual(failedLogoutBody.success, false);
    assert.strictEqual(failedLogoutBody.error.code, 'LOGOUT_FAILED');
    assert.strictEqual(
      failedLogoutRes.cookies.get('worker_session'),
      undefined,
      'Session cookie MUST NOT be cleared when server-side revocation fails (avoids false success and preserves retry credentials)'
    );
  } finally {
    db.withTransaction = origWithTx;
    if (origDbUrl !== undefined) process.env.DATABASE_URL = origDbUrl;
    else delete process.env.DATABASE_URL;
  }

  // 10.2 Confirmed Server-Side Revocation (200): Cookie is invalidated
  const successfulLogoutReq = createMockRequest({
    pathname: '/api/v1/worker/auth/logout',
    method: 'POST',
    cookies: { worker_session: token },
  });

  const successfulLogoutRes = await logoutRoute.POST(successfulLogoutReq);
  assert.strictEqual(successfulLogoutRes.status, 200, 'Logout route must return 200 on confirmed revocation');
  const successfulLogoutBody = await successfulLogoutRes.json();
  assert.strictEqual(successfulLogoutBody.success, true);
  const clearedCookie = successfulLogoutRes.cookies.get('worker_session');
  assert.ok(clearedCookie, 'Cookie must be targeted for expiration upon confirmed revocation');
  assert.strictEqual(clearedCookie.maxAge, 0, 'Cookie maxAge must be 0 to expire upon confirmed revocation');

  passed++;
  console.log('  ✓ 10.1 Logout revocation failure returns 500 without clearing cookie; confirmed revocation invalidates cookie');
}

// ---------------------------------------------------------------------------
// 11. Worker Session Registry Fail-Closed Verification
// ---------------------------------------------------------------------------
console.log('\n[Test Group 11] Worker Session Registry Fail-Closed Verification (Empty Registry, Absent Session, Read Failure)');
{
  const activeWorker = { id: 'worker-reg-audit-01', name: 'Kavitha Staff', mobile: '9876543210', active: true };
  const origFind = workerRepository.findWorkerById;
  workerRepository.findWorkerById = async (id) => {
    if (id === activeWorker.id) return activeWorker;
    return null;
  };

  try {
    // 11.1 A validly signed token whose session ID is present in a non-empty registry is accepted
    const validSessionId = 'session-present-11-1';
    const validToken = generateWorkerSessionToken(activeWorker, validSessionId);
    await mutateWorkerSessionRegistry((reg) => {
      reg[validSessionId] = {
        workerId: activeWorker.id,
        name: activeWorker.name,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
    });

    const verifiedSession = await verifyWorkerSessionAsync(validToken);
    assert.strictEqual(verifiedSession.workerId, activeWorker.id);
    assert.strictEqual(verifiedSession.sessionId, validSessionId);
    assert.strictEqual(verifiedSession.worker.active, true);
    passed++;
    console.log('  ✓ 11.1 Validly signed token present in non-empty session registry is accepted for active worker');

    // 11.2 A validly signed token whose session ID is absent from a non-empty registry is rejected
    const absentSessionId = 'session-absent-11-2';
    const absentToken = generateWorkerSessionToken(activeWorker, absentSessionId);

    let absentErr = null;
    try {
      await verifyWorkerSessionAsync(absentToken);
    } catch (err) {
      absentErr = err;
    }
    assert.ok(absentErr, 'Absent session ID in non-empty registry must throw');
    assert.strictEqual(absentErr.code, 'SESSION_EXPIRED');
    assert.strictEqual(absentErr.status, 401);
    passed++;
    console.log('  ✓ 11.2 Validly signed token absent from non-empty session registry is rejected with 401 SESSION_EXPIRED');

    // 11.3 A validly signed token whose session ID is absent from an empty registry is rejected
    await mutateWorkerSessionRegistry((reg) => {
      for (const k of Object.keys(reg)) delete reg[k];
    });
    const emptyReg = await loadWorkerSessionRegistry();
    assert.strictEqual(Object.keys(emptyReg).length, 0, 'Registry must be verified empty');

    let emptyRegistryErr = null;
    try {
      await verifyWorkerSessionAsync(validToken);
    } catch (err) {
      emptyRegistryErr = err;
    }
    assert.ok(emptyRegistryErr, 'Token verified against empty session registry must strictly fail closed');
    assert.strictEqual(emptyRegistryErr.code, 'SESSION_EXPIRED');
    assert.strictEqual(emptyRegistryErr.status, 401);
    passed++;
    console.log('  ✓ 11.3 Validly signed token absent from empty registry is strictly rejected with 401 (fail closed)');

    // 11.4 Revoking the only registered session leaves an empty registry, and the old token is rejected afterward
    const soloSessionId = 'session-solo-11-4';
    const soloToken = generateWorkerSessionToken(activeWorker, soloSessionId);
    await mutateWorkerSessionRegistry((reg) => {
      reg[soloSessionId] = {
        workerId: activeWorker.id,
        name: activeWorker.name,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
    });

    // Verify it is accepted while sole session in registry
    const preRevoke = await verifyWorkerSessionAsync(soloToken);
    assert.strictEqual(preRevoke.sessionId, soloSessionId);

    // Revoke the only registered session
    const soloLogoutRes = await logoutWorker(soloToken);
    assert.strictEqual(soloLogoutRes.success, true);

    // Verify registry is now completely empty
    const postRevokeReg = await loadWorkerSessionRegistry();
    assert.strictEqual(Object.keys(postRevokeReg).length, 0, 'Revoking sole session must leave registry empty');

    // The old token MUST be rejected afterward
    let postRevokeErr = null;
    try {
      await verifyWorkerSessionAsync(soloToken);
    } catch (err) {
      postRevokeErr = err;
    }
    assert.ok(postRevokeErr, 'Token must be rejected after revocation leaves empty registry');
    assert.strictEqual(postRevokeErr.status, 401);
    assert.ok(postRevokeErr.code === 'SESSION_REVOKED' || postRevokeErr.code === 'SESSION_EXPIRED');
    passed++;
    console.log('  ✓ 11.4 Revoking the only registered session leaves an empty registry and rejects subsequent access');

    // 11.5 Registry/database read failure produces a fail-closed error, not successful authentication
    const origDbUrl = process.env.DATABASE_URL;
    const origQuery = db.query;
    let readFailErr = null;
    try {
      process.env.DATABASE_URL = 'mock://isolated-test-db-read-failure';
      db.query = async () => {
        const queryErr = new Error('Database read failure: query timeout');
        queryErr.code = 'ETIMEDOUT';
        throw queryErr;
      };

      await verifyWorkerSessionAsync(validToken);
    } catch (err) {
      readFailErr = err;
    } finally {
      db.query = origQuery;
      if (origDbUrl !== undefined) process.env.DATABASE_URL = origDbUrl;
      else delete process.env.DATABASE_URL;
    }

    assert.ok(readFailErr, 'Simulated database read failure must throw error');
    assert.strictEqual(readFailErr.code, 'SESSION_REGISTRY_UNAVAILABLE');
    assert.strictEqual(readFailErr.status, 500);
    passed++;
    console.log('  ✓ 11.5 Simulated database query read failure strictly produces fail-closed 500 error (SESSION_REGISTRY_UNAVAILABLE), never authenticating worker');

    // 11.6 Intentional test-only fallback works ONLY under explicit allowed configuration
    const origNodeEnv = process.env.NODE_ENV;
    const origAllowFallback = process.env.ALLOW_TEST_SESSION_FALLBACK;
    const origFallbackDbUrl = process.env.DATABASE_URL;
    try {
      // Guarantee no-database configuration path
      delete process.env.DATABASE_URL;

      // Positive case: Allowed under NODE_ENV=test and ALLOW_TEST_SESSION_FALLBACK='true'
      process.env.NODE_ENV = 'test';
      process.env.ALLOW_TEST_SESSION_FALLBACK = 'true';
      const allowedReg = await loadWorkerSessionRegistry();
      assert.strictEqual(typeof allowedReg, 'object', 'Fallback registry must return object in permitted test environment');

      // Negative case 1: Missing fallback flag in test environment fails closed
      delete process.env.ALLOW_TEST_SESSION_FALLBACK;
      let missingFlagErr = null;
      try {
        await loadWorkerSessionRegistry();
      } catch (err) {
        missingFlagErr = err;
      }
      assert.ok(missingFlagErr, 'Missing test fallback flag must fail closed');
      assert.strictEqual(missingFlagErr.code, 'SESSION_REGISTRY_UNAVAILABLE');
      assert.strictEqual(missingFlagErr.status, 500);

      let mutateMissingFlagErr = null;
      try {
        await mutateWorkerSessionRegistry((reg) => {});
      } catch (err) {
        mutateMissingFlagErr = err;
      }
      assert.ok(mutateMissingFlagErr, 'Mutating without fallback flag must fail closed');
      assert.strictEqual(mutateMissingFlagErr.code, 'SESSION_REGISTRY_UNAVAILABLE');
      assert.strictEqual(mutateMissingFlagErr.status, 500);

      // Negative case 2: Production runtime strictly fails closed even with fallback flag set
      process.env.ALLOW_TEST_SESSION_FALLBACK = 'true';
      process.env.NODE_ENV = 'production';
      let prodFallbackErr = null;
      try {
        await loadWorkerSessionRegistry();
      } catch (err) {
        prodFallbackErr = err;
      }
      assert.ok(prodFallbackErr, 'Production runtime must strictly fail closed');
      assert.strictEqual(prodFallbackErr.code, 'SESSION_REGISTRY_UNAVAILABLE');
      assert.strictEqual(prodFallbackErr.status, 500);

      // Negative case 3: Development runtime strictly fails closed even with fallback flag set
      process.env.NODE_ENV = 'development';
      let devFallbackErr = null;
      try {
        await loadWorkerSessionRegistry();
      } catch (err) {
        devFallbackErr = err;
      }
      assert.ok(devFallbackErr, 'Development runtime must strictly fail closed');
      assert.strictEqual(devFallbackErr.code, 'SESSION_REGISTRY_UNAVAILABLE');
      assert.strictEqual(devFallbackErr.status, 500);

      passed++;
      console.log('  ✓ 11.6 Test-only in-memory fallback works strictly under explicit ALLOW_TEST_SESSION_FALLBACK=true in test environment, failing closed in all other runtime configurations');
    } finally {
      if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
      else delete process.env.NODE_ENV;
      if (origAllowFallback !== undefined) process.env.ALLOW_TEST_SESSION_FALLBACK = origAllowFallback;
      else delete process.env.ALLOW_TEST_SESSION_FALLBACK;
      if (origFallbackDbUrl !== undefined) process.env.DATABASE_URL = origFallbackDbUrl;
      else delete process.env.DATABASE_URL;
    }

  } finally {
    workerRepository.findWorkerById = origFind;
  }
}

  console.log('\n======================================================');
  console.log(`Results: ${passed} post-UI integration audit test assertions passed successfully.`);
  console.log('======================================================\n');
}

runAuditTests()
  .catch((err) => {
    console.error('\n[AUDIT TEST SUITE ERROR]', err);
    process.exitCode = 1;
  })
  .finally(() => {
    // Restore initial environment unconditionally
    if (savedInitialEnv.DATABASE_URL !== undefined) {
      process.env.DATABASE_URL = savedInitialEnv.DATABASE_URL;
    } else {
      delete process.env.DATABASE_URL;
    }
    if (savedInitialEnv.NODE_ENV !== undefined) {
      process.env.NODE_ENV = savedInitialEnv.NODE_ENV;
    } else {
      delete process.env.NODE_ENV;
    }
    if (savedInitialEnv.JWT_SECRET !== undefined) {
      process.env.JWT_SECRET = savedInitialEnv.JWT_SECRET;
    } else {
      delete process.env.JWT_SECRET;
    }
    if (savedInitialEnv.ALLOW_TEST_SESSION_FALLBACK !== undefined) {
      process.env.ALLOW_TEST_SESSION_FALLBACK = savedInitialEnv.ALLOW_TEST_SESSION_FALLBACK;
    } else {
      delete process.env.ALLOW_TEST_SESSION_FALLBACK;
    }
  });
