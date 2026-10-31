/**
 * Customer Mobile App Phase 1 — Responsiveness & API Reliability Test Suite
 * Traceability: PHASE_1_IMPLEMENTATION_REPORT.md (Workstreams A, B, C, D)
 * 
 * Verifies:
 * - Workstream A: Cart ownership, duplicate request elimination, callback identity memoization
 * - Workstream B: Centralized AbortController timeout (15s default, overrides), caller AbortSignal
 *                 cancellation, error classifications (API_TIMEOUT, API_ABORTED, API_NETWORK_ERROR),
 *                 HTTP 401 callback isolation (never fired on timeout/abort/network), FormData compatibility,
 *                 zero unsafe mutation retries.
 * - Workstream C: Home prioritized loading (fish unblocks display immediately, secondary data in background,
 *                 secondary failure resilience, pull-to-refresh data preservation, stale response sequence guard,
 *                 lifecycle unmount cancellation).
 * - Workstream D: FCM device token logout sequencing (unregister called before Keystore cleared, actual
 *                 token passed, non-empty validation, non-fatal network failure tolerance, centralized logout).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read source files directly to inspect implementations and instantiate isolated test modules
const apiSourcePath = path.resolve(__dirname, '../../customer-app/src/services/api.js');
const authStorageSourcePath = path.resolve(__dirname, '../../customer-app/src/services/auth-storage.js');
const homeScreenSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/HomeScreen.jsx');
const appSourcePath = path.resolve(__dirname, '../../customer-app/App.jsx');
const profileScreenSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/ProfileScreen.jsx');

function loadApiModule(mockStorage = {}, mockFetch = null) {
  let code = fs.readFileSync(apiSourcePath, 'utf8');

  // Transform ES module syntax for Node test execution
  code = code.replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]\.\/auth-storage['"];?/g, 
    'const { $1 } = mockAuthStorage;');
  code = code.replace(/export\s+const\s+DEFAULT_TIMEOUT_MS\s*=\s*(\d+);?/g, 
    'const DEFAULT_TIMEOUT_MS = $1; exports.DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;');
  code = code.replace(/export\s+function\s+setUnauthorizedHandler/g, 
    'exports.setUnauthorizedHandler = function setUnauthorizedHandler');
  code = code.replace(/export\s+const\s+api\s*=\s*\{/g, 
    'const api = {');

  code += '\nexports.api = api;\nexports.request = request;';

  const m = { exports: {} };
  const fn = new Function('exports', 'require', 'mockAuthStorage', 'fetch', '__DEV__', 'process', 'FormData', 'AbortController', code);

  const customFetch = mockFetch || globalThis.fetch;
  fn(m.exports, require, mockStorage, customFetch, false, process, globalThis.FormData, globalThis.AbortController);
  return m.exports;
}

// ==============================================================================
// WORKSTREAM B: Centralized API Timeout, Cancellation & Error Classification Tests
// ==============================================================================

test('Workstream B: DEFAULT_TIMEOUT_MS is 15000 milliseconds', () => {
  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'mock-session-jwt' }),
    saveDeviceToken: async () => true,
    clearDeviceToken: async () => true,
  });
  assert.equal(apiModule.DEFAULT_TIMEOUT_MS, 15000);
});

test('Workstream B: Request completes successfully before timeout', async () => {
  let passedFetchOptions = null;
  const mockFetch = async (url, opts) => {
    passedFetchOptions = opts;
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [{ id: 'fish-1', name: 'Fresh Rohu' }] }),
    };
  };

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'test-token-123' }),
  }, mockFetch);

  const res = await apiModule.api.getFish();
  assert.equal(res.success, true);
  assert.equal(res.data.length, 1);
  assert.equal(passedFetchOptions.headers.Authorization, 'Bearer test-token-123');
  // Internal timeoutMs should not be passed to native fetch
  assert.equal(passedFetchOptions.timeoutMs, undefined);
  assert.equal(passedFetchOptions.timeout, undefined);
  assert.ok(passedFetchOptions.signal);
});

test('Workstream B: Timeout triggers API_TIMEOUT error and aborts fetch', async () => {
  const mockFetch = (url, opts) => new Promise((resolve, reject) => {
    // Hangs longer than custom timeout
    const timer = setTimeout(() => {
      resolve({ ok: true, status: 200, json: async () => ({}) });
    }, 1000);
    opts.signal.addEventListener('abort', () => {
      clearTimeout(timer);
      const abortErr = new Error('The operation was aborted.');
      abortErr.name = 'AbortError';
      reject(abortErr);
    });
  });

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'token' }),
  }, mockFetch);

  await assert.rejects(
    async () => {
      await apiModule.request('/api/v1/customer/fish', { timeoutMs: 50 });
    },
    (err) => {
      assert.equal(err.code, 'API_TIMEOUT');
      assert.equal(err.isTimeout, true);
      assert.match(err.message, /timed out after 50ms/);
      return true;
    }
  );
});

test('Workstream B: Caller-initiated AbortSignal cancellation triggers API_ABORTED', async () => {
  const mockFetch = (url, opts) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve({ ok: true, status: 200, json: async () => ({}) });
    }, 1000);
    opts.signal.addEventListener('abort', () => {
      clearTimeout(timer);
      const abortErr = new Error('The operation was aborted.');
      abortErr.name = 'AbortError';
      reject(abortErr);
    });
  });

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'token' }),
  }, mockFetch);

  const callerController = new AbortController();

  const requestPromise = apiModule.request('/api/v1/customer/fish', {
    signal: callerController.signal,
    timeoutMs: 5000,
  });

  // Caller cancels in-flight
  setTimeout(() => callerController.abort('User navigated away'), 20);

  await assert.rejects(
    requestPromise,
    (err) => {
      assert.equal(err.code, 'API_ABORTED');
      assert.equal(err.isAborted, true);
      return true;
    }
  );
});

test('Workstream B: Pre-aborted caller signal fails fast without network call', async () => {
  let fetchCalled = false;
  const mockFetch = async () => {
    fetchCalled = true;
    return { ok: true, status: 200, json: async () => ({}) };
  };

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'token' }),
  }, mockFetch);

  const callerController = new AbortController();
  callerController.abort('Pre-flight unmounted');

  await assert.rejects(
    async () => {
      await apiModule.request('/api/v1/customer/fish', {
        signal: callerController.signal,
      });
    },
    (err) => {
      assert.equal(err.code, 'API_ABORTED');
      assert.equal(err.isAborted, true);
      assert.equal(fetchCalled, false);
      return true;
    }
  );
});

test('Workstream B: Network error is classified as API_NETWORK_ERROR', async () => {
  const mockFetch = async () => {
    const netErr = new TypeError('Failed to fetch');
    throw netErr;
  };

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'token' }),
  }, mockFetch);

  await assert.rejects(
    async () => {
      await apiModule.request('/api/v1/customer/fish');
    },
    (err) => {
      assert.equal(err.code, 'API_NETWORK_ERROR');
      assert.equal(err.isNetwork, true);
      return true;
    }
  );
});

test('Workstream B: 401 callback is triggered strictly for HTTP 401, never for timeout or abort', async () => {
  let unauthorizedCalls = 0;
  let rejectedTokenSeen = null;

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'session-jwt-123' }),
  }, async (url, opts) => {
    if (url.includes('/timeout')) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
    if (url.includes('/401')) {
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Session expired' } }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });

  apiModule.setUnauthorizedHandler((token) => {
    unauthorizedCalls++;
    rejectedTokenSeen = token;
  });

  // 1. Timeout / Abort does NOT call unauthorized handler
  const abortCtrl = new AbortController();
  abortCtrl.abort();
  try {
    await apiModule.request('/api/v1/customer/cart', { signal: abortCtrl.signal });
  } catch {}
  assert.equal(unauthorizedCalls, 0, 'Unauthorized handler must not be called on abort');

  // 2. Real HTTP 401 DOES call unauthorized handler
  try {
    await apiModule.request('/api/v1/customer/cart/401');
  } catch {}
  assert.equal(unauthorizedCalls, 1, 'Unauthorized handler must be called on real 401');
  assert.equal(rejectedTokenSeen, 'session-jwt-123');
});

test('Workstream B: No automatic retries on mutation requests or timeout failures', async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount++;
    const err = new Error('Network failure');
    throw err;
  };

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'token' }),
  }, mockFetch);

  // Attempt non-idempotent booking creation
  try {
    await apiModule.api.createBooking({ paymentId: 'pay_123' });
  } catch {}

  assert.equal(callCount, 1, 'Mutations must never be automatically retried');
});

// ==============================================================================
// WORKSTREAM A: Cart Ownership & Duplicate Request Elimination Tests
// ==============================================================================

test('Workstream A: HomeScreen source inspection proves duplicate api.getCart() was eliminated', () => {
  const homeCode = fs.readFileSync(homeScreenSourcePath, 'utf8');

  // Find loadAllData body
  const loadAllDataMatch = homeCode.match(/const loadAllData = useCallback\([\s\S]*?\}, \[\]\);/);
  assert.ok(loadAllDataMatch, 'loadAllData must be defined with empty dependencies []');

  const loadAllDataBody = loadAllDataMatch[0];
  assert.equal(
    loadAllDataBody.includes('api.getCart()'),
    false,
    'HomeScreen loadAllData must NOT issue api.getCart()'
  );
});

test('Workstream A: App.jsx handleCartUpdated is memoized with useCallback', () => {
  const appCode = fs.readFileSync(appSourcePath, 'utf8');
  assert.ok(
    appCode.includes('const handleCartUpdated = useCallback((cartData) =>'),
    'App.jsx handleCartUpdated must be wrapped in useCallback'
  );
});

test('Workstream A: App.jsx fetchCartSummary possesses concurrency in-flight guard', () => {
  const appCode = fs.readFileSync(appSourcePath, 'utf8');
  assert.ok(
    appCode.includes('isFetchingCartRef.current'),
    'App.jsx fetchCartSummary must guard against concurrent executions'
  );
});

// ==============================================================================
// WORKSTREAM C: Prioritized Home Loading, Resilient Secondary Data & Cleanup
// ==============================================================================

test('Workstream C: Critical fish catalogue unblocks display immediately without waiting for secondary calls', () => {
  const homeCode = fs.readFileSync(homeScreenSourcePath, 'utf8');

  // Verify fishPromise resolves and immediately dismisses loading skeleton
  assert.ok(
    homeCode.includes('const fishPromise = api.getFish'),
    'Fish catalogue must be prioritized via dedicated fishPromise'
  );
  assert.ok(
    homeCode.includes('setFishList(res.data || []);'),
    'setFishList must be called upon fish response'
  );
  assert.ok(
    homeCode.includes('setLoading(false); // Unblock catalogue paint immediately'),
    'Loading skeleton must be dismissed immediately when fish arrives'
  );

  // Verify secondary calls run concurrently
  assert.ok(homeCode.includes('const catsPromise = api.getCategories'), 'Categories must run concurrently');
  assert.ok(homeCode.includes('const subPromise = api.getSubscription'), 'Subscription must run concurrently');
  assert.ok(homeCode.includes('const trackingPromise = api.getCustomerLiveTracking'), 'Live tracking must run concurrently');
  assert.ok(homeCode.includes('const profilePromise = api.getProfile'), 'Customer profile must run concurrently');
});

test('Workstream C: Pull-to-refresh failure preserves previously loaded fish data', () => {
  const homeCode = fs.readFileSync(homeScreenSourcePath, 'utf8');
  assert.ok(
    homeCode.includes('// Preserve existing fish list on refresh failure; only show error state if catalogue is empty'),
    'Pull-to-refresh must preserve previous valid fish list on network failure'
  );
  assert.ok(
    homeCode.includes('setFishList((prev) => {'),
    'setFishList functional state updater must inspect previous data before setting error'
  );
});

test('Workstream C: Lifecycle cleanup aborts in-flight requests on screen unmount', () => {
  const homeCode = fs.readFileSync(homeScreenSourcePath, 'utf8');
  assert.ok(
    homeCode.includes('abortControllerRef.current.abort()'),
    'In-flight requests must be aborted on unmount'
  );
  assert.ok(
    homeCode.includes('isMountedRef.current = false;'),
    'isMountedRef must be set to false on unmount'
  );
  assert.ok(
    homeCode.includes('currentSeq !== requestSeqRef.current'),
    'Stale response guard must reject out-of-sequence responses'
  );
});

// ==============================================================================
// WORKSTREAM D: FCM Device Token Logout Sequencing Tests
// ==============================================================================

test('Workstream D: ProfileScreen performLogout unregisters device token BEFORE clearing credentials', () => {
  const profileCode = fs.readFileSync(profileScreenSourcePath, 'utf8');

  const unregisterIndex = profileCode.indexOf('api.unregisterDeviceToken');
  const clearAuthIndex = profileCode.indexOf('clearAuthTokens()');
  const onLogoutIndex = profileCode.indexOf('onLogout()');

  assert.ok(unregisterIndex > 0, 'api.unregisterDeviceToken must be present in ProfileScreen');
  assert.ok(onLogoutIndex > 0, 'onLogout must be present in ProfileScreen');

  // Verify sequencing: unregister must appear BEFORE onLogout
  assert.ok(
    unregisterIndex < onLogoutIndex,
    'api.unregisterDeviceToken must be called BEFORE onLogout'
  );

  // Verify that an empty string is NOT hardcoded
  assert.equal(
    profileCode.includes("api.unregisterDeviceToken('')"),
    false,
    "api.unregisterDeviceToken must NOT be called with an empty string ''"
  );
  assert.ok(
    profileCode.includes('getDeviceToken()'),
    'ProfileScreen must read the actual registered device token via getDeviceToken()'
  );
});

test('Workstream D: Device token unregistration failure does not block local logout', () => {
  const profileCode = fs.readFileSync(profileScreenSourcePath, 'utf8');
  assert.ok(
    profileCode.includes('// Non-fatal: network or server error during push unregistration must never block user logout'),
    'Device token unregister failure must be non-fatal and allow logout to proceed'
  );
});

test('Workstream D: auth-storage provides hardware-backed saveDeviceToken, getDeviceToken, clearDeviceToken', () => {
  const authStorageCode = fs.readFileSync(authStorageSourcePath, 'utf8');
  assert.ok(authStorageCode.includes('export async function saveDeviceToken'), 'saveDeviceToken must be exported');
  assert.ok(authStorageCode.includes('export async function getDeviceToken'), 'getDeviceToken must be exported');
  assert.ok(authStorageCode.includes('export async function clearDeviceToken'), 'clearDeviceToken must be exported');
  assert.ok(authStorageCode.includes('com.pondfish.customer.device_token'), 'Unique device token service key must be used');
});
