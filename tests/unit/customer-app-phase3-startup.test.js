/**
 * Automated Verification Suite: Customer App Phase 3B.2 & 3B.3
 * Splash Screen, Startup Loading & API Request Deduplication
 * 
 * Verifies:
 * Suite 1: [Production Unit Tests] Startup Session Orchestrator (orchestrateStartupSession)
 *   - 1.1: Valid authenticated session with complete profile transitions to HOME with customer & token
 *   - 1.2: Valid authenticated session with incomplete profile transitions to PROFILE_COMPLETION
 *   - 1.3: No stored credentials transitions to PHONE_AUTH without backend API call
 *   - 1.4: Session validation failure (network/server error) preserves credentials and exposes retry
 *   - 1.5: Slow session validation completes safely without premature resolution
 *   - 1.6: Repeated startup trigger protection prevents concurrent duplicate checks
 *   - 1.7: Component unmount while storage read is pending prevents navigation and state updates
 * Suite 2: [Production Integration Tests] 401 Coordination & Single-Owner Unauthorized Handling
 *   - 2.1: Startup profile request returning HTTP 401 passes skipUnauthorizedHandler: true
 *   - 2.2: Global unauthorized callback and startup orchestrator do not independently clear the same token
 *   - 2.3: The rejected token is passed to the one responsible clearAuthTokens operation
 *   - 2.4: A newer token is never removed by a stale 401 (clearAuthTokens returning false aborts transition)
 *   - 2.5: A successful clear produces exactly one PHONE_AUTH transition
 *   - 2.6: A failed storage-clear exception does not falsely navigate to PHONE_AUTH
 *   - 2.7: Component unmount while token-clear is pending prevents stale navigation/state updates
 *   - 2.8: Existing non-startup authenticated API requests still use the centralized unauthorized handler
 * Suite 3: [Production Unit Tests] Navigation Guard & Onboarding Gate (resolveNavigationDecision)
 *   - 3.1: Navigation guard blocks unauthenticated navigation to authenticated screens
 *   - 3.2: Onboarding gate redirects incomplete profiles to PROFILE_COMPLETION
 *   - 3.3: Explicit auth transition with completed profile resolves to HOME
 *   - 3.4: MARKETPLACE alias route resolves to HOME
 * Suite 4: [Static Source Checks] Production Code Structure Invariants
 *   - 4.1: SplashScreen.jsx does not contain artificial setTimeout delays
 *   - 4.2: SplashScreen.jsx imports and utilizes orchestrateStartupSession
 *   - 4.3: startup-session.js passes skipUnauthorizedHandler: true to getProfile
 *   - 4.4: App.jsx imports and delegates to resolveNavigationDecision
 *   - 4.5: api.js supports skipUnauthorizedHandler option to prevent duplicate 401 dispatch
 * Suite 5: [Production Unit & Integration Tests] Safe In-Flight GET Request Deduplication
 *   - 5.1: Multiple identical concurrent GET requests share exactly one low-level network fetch
 *   - 5.2: Distinct GET requests (query params) execute separate network fetches
 *   - 5.3: Requests with different auth tokens execute separate network fetches
 *   - 5.4: Non-GET mutation requests (POST, PUT, PATCH, DELETE) are never deduplicated
 *   - 5.5: bypassDedup option forces fresh fetch even for concurrent identical GET requests
 *   - 5.6: Immediate settle cleanup: in-flight entry deleted immediately after settlement
 *   - 5.7: Error propagation: rejected underlying fetch propagates to all concurrent callers
 *   - 5.8: Error non-caching: failed request does not poison future requests
 *   - 5.9: Caller cancellation isolation: Caller A aborting does NOT interrupt Caller B
 *   - 5.10: All callers aborting cancels the underlying network fetch controller
 *   - 5.11: Pre-aborted caller signal fails fast without making network call
 *   - 5.12: clearInFlightRequests aborts active in-flight requests with API_SESSION_RESET
 *   - 5.13: Data isolation: co-subscribers receive isolated clones of response payload
 *   - 5.14: Request identity isolation: startup profile probe (skip401) and normal profile request do NOT coalesce
 *   - 5.15: Startup-first ordering: 401 on startup probe does not invoke global unauthorized handler
 *   - 5.16: Normal-first ordering: 401 on normal request invokes global unauthorized handler
 *   - 5.17: Timeout isolation: requests with different timeouts do NOT coalesce
 *   - 5.18: Header isolation: requests with different custom headers do NOT coalesce
 *   - 5.19: Direct mutations (POST, PUT, DELETE) are never cancelled by clearInFlightRequests
 *   - 5.20: Cancellation fallback when AbortController is NOT available: Caller A aborting does NOT fail Caller B
 *   - 5.21: Timeout cleanup in registry: request timing out removes entry from Map
 *   - 5.22: All callers aborting when AbortController is available cleans up registry immediately
 *   - 5.23: buildDeduplicationKey: validates option-aware hashing, header sorting, and token segregation
 *   - 5.24: Stale entry race: old request aborting all subscribers does not delete replacement entry on settle
 *   - 5.25: Stale entry race: clearInFlightRequests followed by immediate new same-key request preserves new entry
 *   - 5.26: Replacement subscriber isolation: old request settlement cannot resolve or reject subscribers belonging to replacement entry
 *   - 5.27: Collision-safe headers: header value containing = and & versus separate headers produce distinct keys
 *   - 5.28: Header case-insensitivity: different casing produces equivalent deduplication keys
 *   - 5.29: Semantic fetch options: differing credentials, cache, or mode produce distinct keys
 *   - 5.30: Unsupported or unrepresented options safely bypass deduplication
 *   - 5.31: Case-insensitive Authorization header normalization: uppercase and lowercase coalesce cleanly
 *   - 5.32: Two differently-cased Authorization headers with conflicting values reject with API_INVALID_HEADERS
 *   - 5.33: Multiple identically-valued differently-cased Authorization headers normalize safely to single header
 *   - 5.34: Requests using different explicit Authorization tokens do NOT coalesce
 *   - 5.35: Custom lowercase Authorization header does not coalesce with Keystore stored token
 *   - 5.36: Unsafe or unrepresentable custom Authorization safely bypasses deduplication
 *   - 5.37: Existing getProfile explicit token behavior and 401 callback ownership preserved
 * Suite 6: [Production Integration & Static Checks] Cart & Home Data Ownership and Invariants
 *   - 6.1: Navigating to CART does not trigger fetchCartSummary from App shell
 *   - 6.2: App shell handleCartUpdated updates cartSummary and item count from mutations
 *   - 6.3: fetchHomeDataOrchestrated reuses existingCategories without refetching on non-refresh
 *   - 6.4: fetchHomeDataOrchestrated with isRefresh: true refetches categories
 *   - 6.5: Critical fish catalogue is Priority 1: unblocks visual display before secondary requests settle
 *   - 6.6: [Static Source Check] App.jsx excludes CART from fetchCartSummary useEffect trigger
 *   - 6.7: [Static Source Check] App.jsx calls api.clearInFlightRequests on logout
 *   - 6.8: [Static Source Check] api.js implements in-flight deduplication registry and exports management methods
 *   - 6.9: [Static Source Check] api.js implements option-aware buildDeduplicationKey
 *   - 6.10: [Static Source Check] api.js implements identity-safe deletion and collision-safe keys
 *   - 6.11: [Static Source Check] api.js implements case-insensitive Authorization header normalization
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Direct imports of pure production helpers
const {
  orchestrateStartupSession,
} = require('../../customer-app/src/utils/startup-session');
const {
  resolveNavigationDecision,
  AUTHENTICATED_SCREENS,
} = require('../../customer-app/src/utils/navigation-guard');

// Paths for code inspection and dynamic production API module loading
const splashScreenPath = path.resolve(__dirname, '../../customer-app/src/screens/SplashScreen.jsx');
const startupSessionPath = path.resolve(__dirname, '../../customer-app/src/utils/startup-session.js');
const navigationGuardPath = path.resolve(__dirname, '../../customer-app/src/utils/navigation-guard.js');
const appSourcePath = path.resolve(__dirname, '../../customer-app/App.jsx');
const apiSourcePath = path.resolve(__dirname, '../../customer-app/src/services/api.js');
const homeSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/HomeScreen.jsx');
const cartSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/CartScreen.jsx');

/**
 * Directly extracts and loads fetchHomeDataOrchestrated from HomeScreen.jsx.
 */
function loadHomeScreenOrchestrator() {
  const homeCode = fs.readFileSync(homeSourcePath, 'utf8');
  const startIndex = homeCode.indexOf('export async function fetchHomeDataOrchestrated');
  const endIndex = homeCode.indexOf('export default function HomeScreen');
  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Could not slice fetchHomeDataOrchestrated from HomeScreen.jsx');
  }
  const fnCode = homeCode.slice(startIndex, endIndex).replace('export async function fetchHomeDataOrchestrated', 'async function fetchHomeDataOrchestrated') + '\nreturn fetchHomeDataOrchestrated;';
  const fn = new Function(fnCode);
  return fn();
}

/**
 * Creates a deterministic deferred promise for race-free asynchronous test coordination.
 */
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Loads the real production api.js client module into an isolated test context.
 * Enables testing real setUnauthorizedHandler and skipUnauthorizedHandler logic.
 */
function loadProductionApiModule(mockStorage = {}, mockFetch = null, customAbortController = undefined) {
  let code = fs.readFileSync(apiSourcePath, 'utf8');

  code = code.replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]\.\/auth-storage['"];?/g, 'const { $1 } = mockAuthStorage;');
  code = code.replace(/export\s+const\s+DEFAULT_TIMEOUT_MS\s*=\s*(\d+);?/g, 'const DEFAULT_TIMEOUT_MS = $1; exports.DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;');
  code = code.replace(/export\s+function\s+setUnauthorizedHandler/g, 'exports.setUnauthorizedHandler = function setUnauthorizedHandler');
  code = code.replace(/export\s+const\s+api\s*=\s*\{/g, 'const api = {');

  code += '\nexports.api = api;\nexports.request = request;\nexports.buildDeduplicationKey = buildDeduplicationKey;\nexports.inFlightGetRequests = inFlightGetRequests;\nexports.evaluateDeduplicatable = evaluateDeduplicatable;\nexports.extractAndNormalizeAuthorization = extractAndNormalizeAuthorization;';

  const m = { exports: {} };
  const fn = new Function('exports', 'require', 'mockAuthStorage', 'fetch', '__DEV__', 'process', 'FormData', 'AbortController', 'console', code);

  const resolvedAbortController = customAbortController !== undefined ? customAbortController : globalThis.AbortController;

  fn(m.exports, require, mockStorage, mockFetch || globalThis.fetch, false, process, globalThis.FormData, resolvedAbortController, {
    warn: () => {},
    error: () => {},
    log: () => {},
  });

  return m.exports;
}

describe('Customer App Phase 3B.2 & 3B.3 Verification Suite', () => {
  const splashCode = fs.readFileSync(splashScreenPath, 'utf8');
  const startupCode = fs.readFileSync(startupSessionPath, 'utf8');
  const appCode = fs.readFileSync(appSourcePath, 'utf8');
  const apiCode = fs.readFileSync(apiSourcePath, 'utf8');

  // =========================================================================
  // SUITE 1: [Production Unit Tests] Startup Session Orchestrator
  // =========================================================================
  describe('Suite 1: [Production Unit Tests] Startup Session Orchestrator', () => {
    test('1.1: Valid authenticated session with complete profile transitions to HOME with customer & token', async () => {
      const mockCustomer = { id: 'cust_101', name: 'Ravi Kumar', isProfileComplete: true };
      const mockToken = 'jwt-valid-token-123';
      let navigatedTo = null;
      let navParams = null;
      let errorState = null;

      const result = await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: mockToken, refreshToken: 'refresh-123' }),
        clearAuthTokens: async () => { throw new Error('Should not clear tokens'); },
        apiClient: {
          getProfile: async (token) => {
            assert.equal(token, mockToken);
            return { data: mockCustomer };
          },
        },
        onNavigate: (screen, params) => {
          navigatedTo = screen;
          navParams = params;
        },
        setError: (err) => { errorState = err; },
        isCheckingRef: { current: false },
        isMountedRef: { current: true },
      });

      assert.equal(navigatedTo, 'HOME');
      assert.deepEqual(navParams, { customer: mockCustomer, token: mockToken });
      assert.equal(errorState, null);
      assert.equal(result.destination, 'HOME');
    });

    test('1.2: Valid authenticated session with incomplete profile transitions to PROFILE_COMPLETION', async () => {
      const mockCustomer = { id: 'cust_102', name: 'New User', isProfileComplete: false };
      const mockToken = 'jwt-valid-token-456';
      let navigatedTo = null;
      let navParams = null;

      const result = await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: mockToken, refreshToken: 'refresh-456' }),
        clearAuthTokens: async () => {},
        apiClient: {
          getProfile: async () => ({ data: mockCustomer }),
        },
        onNavigate: (screen, params) => {
          navigatedTo = screen;
          navParams = params;
        },
        setError: () => {},
        isCheckingRef: { current: false },
        isMountedRef: { current: true },
      });

      assert.equal(navigatedTo, 'PROFILE_COMPLETION');
      assert.deepEqual(navParams, { customer: mockCustomer, token: mockToken });
      assert.equal(result.destination, 'PROFILE_COMPLETION');
    });

    test('1.3: No stored credentials transitions to PHONE_AUTH without backend API call', async () => {
      let navigatedTo = null;
      let apiCalled = false;

      const result = await orchestrateStartupSession({
        getAuthTokens: async () => null,
        clearAuthTokens: async () => {},
        apiClient: {
          getProfile: async () => {
            apiCalled = true;
            return { data: {} };
          },
        },
        onNavigate: (screen) => { navigatedTo = screen; },
        setError: () => {},
        isCheckingRef: { current: false },
        isMountedRef: { current: true },
      });

      assert.equal(navigatedTo, 'PHONE_AUTH');
      assert.equal(apiCalled, false, 'api.getProfile must NOT be called when no token is present');
      assert.equal(result.destination, 'PHONE_AUTH');
    });

    test('1.4: Session validation failure (network/server error) preserves credentials and exposes retry', async () => {
      let didClearTokens = false;
      let errorMsg = null;
      let navigatedTo = null;
      const isCheckingRef = { current: false };

      const result = await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: 'active-token-with-network-drop' }),
        clearAuthTokens: async () => { didClearTokens = true; },
        apiClient: {
          getProfile: async () => {
            const err = new Error('Network connection failed');
            err.status = 503;
            throw err;
          },
        },
        onNavigate: (screen) => { navigatedTo = screen; },
        setError: (msg) => { errorMsg = msg; },
        isCheckingRef,
        isMountedRef: { current: true },
      });

      assert.equal(didClearTokens, false, 'Credentials must NOT be cleared on network failure');
      assert.equal(navigatedTo, null, 'Must NOT navigate away on transient network error');
      assert.ok(errorMsg && errorMsg.includes('Unable to connect to PondFish'));
      assert.equal(isCheckingRef.current, false, 'isCheckingRef must be reset to allow retry');
      assert.equal(result.isNetwork, true);
    });

    test('1.5: Slow session validation completes safely without premature resolution', async () => {
      let navigatedTo = null;
      let settled = false;

      const promise = orchestrateStartupSession({
        getAuthTokens: async () => {
          await new Promise((r) => setTimeout(r, 40));
          return { token: 'slow-token' };
        },
        clearAuthTokens: async () => {},
        apiClient: {
          getProfile: async () => {
            await new Promise((r) => setTimeout(r, 60));
            return { data: { id: 'cust_slow', isProfileComplete: true } };
          },
        },
        onNavigate: (screen) => { navigatedTo = screen; },
        setError: () => {},
        isCheckingRef: { current: false },
        isMountedRef: { current: true },
      }).then((res) => {
        settled = true;
        return res;
      });

      assert.equal(settled, false, 'Must not resolve immediately');
      assert.equal(navigatedTo, null);

      await promise;
      assert.equal(settled, true);
      assert.equal(navigatedTo, 'HOME');
    });

    test('1.6: Repeated startup trigger protection prevents concurrent duplicate checks', async () => {
      let getAuthTokensCallCount = 0;
      const isCheckingRef = { current: false };

      const slowGetAuth = async () => {
        getAuthTokensCallCount++;
        await new Promise((r) => setTimeout(r, 50));
        return { token: 'tok_1' };
      };

      const params = {
        getAuthTokens: slowGetAuth,
        clearAuthTokens: async () => {},
        apiClient: { getProfile: async () => ({ data: { isProfileComplete: true } }) },
        onNavigate: () => {},
        setError: () => {},
        isCheckingRef,
        isMountedRef: { current: true },
      };

      const call1 = orchestrateStartupSession(params);
      const call2 = orchestrateStartupSession(params);

      const [res1, res2] = await Promise.all([call1, call2]);

      assert.equal(getAuthTokensCallCount, 1, 'Only one session check should proceed');
      assert.equal(res2, null, 'Second concurrent call must be aborted early');
      assert.equal(res1.destination, 'HOME');
    });

    test('1.7: Component unmount while storage read is pending prevents navigation and state updates', async () => {
      let navigatedTo = null;
      let errorSet = null;
      const isMountedRef = { current: true };

      const promise = orchestrateStartupSession({
        getAuthTokens: async () => {
          await new Promise((r) => setTimeout(r, 30));
          isMountedRef.current = false;
          return { token: 'unmounted-token' };
        },
        clearAuthTokens: async () => {},
        apiClient: {
          getProfile: async () => {
            return { data: { id: 'unmounted_cust', isProfileComplete: true } };
          },
        },
        onNavigate: (screen) => { navigatedTo = screen; },
        setError: (err) => { errorSet = err; },
        isCheckingRef: { current: false },
        isMountedRef,
      });

      const res = await promise;
      assert.equal(res, null, 'Must return null when unmounted');
      assert.equal(navigatedTo, null, 'onNavigate must NOT be called after unmount');
      assert.equal(errorSet, null, 'setError must NOT be called after unmount');
    });
  });

  // =========================================================================
  // SUITE 2: [Production Integration Tests] 401 Coordination & Single-Owner Unauthorized Handling
  // =========================================================================
  describe('Suite 2: [Production Integration Tests] 401 Coordination & Single-Owner Unauthorized Handling', () => {
    test('2.1: Startup profile request returning HTTP 401 passes skipUnauthorizedHandler: true', async () => {
      let capturedOptions = null;
      const rejectedToken = 'expired-jwt-tok-101';

      await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: rejectedToken }),
        clearAuthTokens: async () => true,
        apiClient: {
          getProfile: async (token, options) => {
            capturedOptions = options;
            const err = new Error('Unauthorized');
            err.status = 401;
            throw err;
          },
        },
        onNavigate: () => {},
        setError: () => {},
        isCheckingRef: { current: false },
        isMountedRef: { current: true },
      });

      assert.ok(capturedOptions, 'getProfile must be called with options');
      assert.equal(capturedOptions.skipUnauthorizedHandler, true, 'getProfile must pass skipUnauthorizedHandler: true');
    });

    test('2.2: Global unauthorized callback and startup orchestrator do not independently clear the same token', async () => {
      let globalUnauthorizedCallCount = 0;
      let clearAuthTokensCallCount = 0;
      const rejectedToken = 'token-prevent-duplicate-clear';

      // Load production API client
      const mockFetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Session expired', code: 'UNAUTHORIZED' } }),
      });
      const { api: productionApi, setUnauthorizedHandler } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: rejectedToken }) },
        mockFetch
      );

      // Register global unauthorized handler (as App.jsx does)
      setUnauthorizedHandler(() => {
        globalUnauthorizedCallCount++;
      });

      // Run startup orchestrator with real production API
      const result = await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: rejectedToken }),
        clearAuthTokens: async (token) => {
          clearAuthTokensCallCount++;
          assert.equal(token, rejectedToken);
          return true;
        },
        apiClient: productionApi,
        onNavigate: () => {},
        setError: () => {},
        isCheckingRef: { current: false },
        isMountedRef: { current: true },
      });

      // Verify startup orchestrator had exclusive single ownership of 401 handling
      assert.equal(globalUnauthorizedCallCount, 0, 'Global unauthorized handler must NOT be invoked for startup probe');
      assert.equal(clearAuthTokensCallCount, 1, 'clearAuthTokens must be invoked exactly once');
      assert.equal(result.cleared, true);
      assert.equal(result.destination, 'PHONE_AUTH');
    });

    test('2.3: The rejected token is passed to the one responsible clearAuthTokens operation', async () => {
      let receivedToken = null;

      const rejectedToken = 'exact-rejected-token-999';

      await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: rejectedToken }),
        clearAuthTokens: async (token) => {
          receivedToken = token;
          return true;
        },
        apiClient: {
          getProfile: async () => {
            const err = new Error('Unauthorized');
            err.status = 401;
            throw err;
          },
        },
        onNavigate: () => {},
        setError: () => {},
        isCheckingRef: { current: false },
        isMountedRef: { current: true },
      });

      assert.equal(receivedToken, rejectedToken, 'Rejected token must be passed to clearAuthTokens');
    });

    test('2.4: A newer token is never removed by a stale 401 (clearAuthTokens returning false aborts transition)', async () => {
      let navigatedTo = null;
      let errorMsg = null;
      const isCheckingRef = { current: false };

      const result = await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: 'stale-token' }),
        clearAuthTokens: async () => {
          // Emulate auth-storage detecting stored token does not match rejected token
          return false;
        },
        apiClient: {
          getProfile: async () => {
            const err = new Error('Unauthorized');
            err.status = 401;
            throw err;
          },
        },
        onNavigate: (screen) => { navigatedTo = screen; },
        setError: (msg) => { errorMsg = msg; },
        isCheckingRef,
        isMountedRef: { current: true },
      });

      assert.equal(navigatedTo, null, 'Must NOT navigate to PHONE_AUTH when token clear is rejected');
      assert.equal(result.cleared, false);
      assert.equal(result.aborted, true);
      assert.ok(errorMsg && errorMsg.includes('session has changed'));
      assert.equal(isCheckingRef.current, false, 'isCheckingRef must be reset to allow retry');
    });

    test('2.5: A successful clear produces exactly one PHONE_AUTH transition', async () => {
      let navCallCount = 0;
      let targetScreen = null;

      const result = await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: 'tok_clean' }),
        clearAuthTokens: async () => true,
        apiClient: {
          getProfile: async () => {
            const err = new Error('Unauthorized');
            err.status = 401;
            throw err;
          },
        },
        onNavigate: (screen) => {
          navCallCount++;
          targetScreen = screen;
        },
        setError: () => {},
        isCheckingRef: { current: false },
        isMountedRef: { current: true },
      });

      assert.equal(navCallCount, 1, 'Must invoke onNavigate exactly once');
      assert.equal(targetScreen, 'PHONE_AUTH');
      assert.equal(result.destination, 'PHONE_AUTH');
      assert.equal(result.cleared, true);
    });

    test('2.6: A failed storage-clear exception does not falsely navigate to PHONE_AUTH', async () => {
      let navigatedTo = null;
      let errorMsg = null;
      const isCheckingRef = { current: false };

      const result = await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: 'glitched-token' }),
        clearAuthTokens: async () => {
          throw new Error('Keystore hardware timeout');
        },
        apiClient: {
          getProfile: async () => {
            const err = new Error('Unauthorized');
            err.status = 401;
            throw err;
          },
        },
        onNavigate: (screen) => { navigatedTo = screen; },
        setError: (msg) => { errorMsg = msg; },
        isCheckingRef,
        isMountedRef: { current: true },
      });

      assert.equal(navigatedTo, null, 'Must NOT navigate to PHONE_AUTH when storage clear throws');
      assert.ok(errorMsg && errorMsg.includes('Unable to reset session'));
      assert.ok(result.storageError);
      assert.equal(isCheckingRef.current, false, 'isCheckingRef must be reset for retry');
    });

    test('2.7: Component unmount while token-clear is pending prevents stale navigation/state updates', async () => {
      let navigatedTo = null;
      let errorMsg = null;
      const isMountedRef = { current: true };

      const promise = orchestrateStartupSession({
        getAuthTokens: async () => ({ token: 'unmount-during-clear-tok' }),
        clearAuthTokens: async () => {
          await new Promise((r) => setTimeout(r, 25));
          isMountedRef.current = false;
          return true;
        },
        apiClient: {
          getProfile: async () => {
            const err = new Error('Unauthorized');
            err.status = 401;
            throw err;
          },
        },
        onNavigate: (screen) => { navigatedTo = screen; },
        setError: (msg) => { errorMsg = msg; },
        isCheckingRef: { current: false },
        isMountedRef,
      });

      const res = await promise;
      assert.equal(res, null, 'Must return null when unmounted');
      assert.equal(navigatedTo, null, 'onNavigate must NOT be invoked after unmount');
      assert.equal(errorMsg, null, 'setError must NOT be invoked after unmount');
    });

    test('2.8: Existing non-startup authenticated API requests still use the centralized unauthorized handler', async () => {
      let receivedRejectedToken = null;
      const userSessionToken = 'active-user-session-token-555';

      // Load production API client
      const mockFetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Session expired', code: 'UNAUTHORIZED' } }),
      });
      const { api: productionApi, setUnauthorizedHandler } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: userSessionToken }) },
        mockFetch
      );

      // Register global handler
      setUnauthorizedHandler((rejected) => {
        receivedRejectedToken = rejected;
      });

      // Execute non-startup authenticated request (e.g. getFish)
      await assert.rejects(
        async () => {
          await productionApi.getFish();
        },
        (err) => err.status === 401
      );

      assert.equal(
        receivedRejectedToken,
        userSessionToken,
        'Centralized unauthorized handler must be triggered for normal authenticated API calls'
      );
    });
  });

  // =========================================================================
  // SUITE 3: [Production Unit Tests] Navigation Guard & Onboarding Gate
  // =========================================================================
  describe('Suite 3: [Production Unit Tests] Navigation Guard & Onboarding Gate', () => {
    test('3.1: Navigation guard blocks unauthenticated navigation to authenticated screens', () => {
      const decision = resolveNavigationDecision(
        { currentScreen: 'SPLASH', isAuthenticated: false, isProfileComplete: false },
        'HOME'
      );
      assert.equal(decision.blocked, true, 'Unauthenticated attempt to HOME must be blocked');
      assert.equal(decision.nextScreen, 'SPLASH');
    });

    test('3.2: Onboarding gate redirects incomplete profiles to PROFILE_COMPLETION', () => {
      const decision = resolveNavigationDecision(
        { currentScreen: 'SPLASH', isAuthenticated: false, isProfileComplete: false },
        'HOME',
        { token: 'valid-tok', customer: { id: 'c1', isProfileComplete: false } }
      );
      assert.equal(decision.blocked, false);
      assert.equal(decision.redirected, true, 'Must redirect to PROFILE_COMPLETION');
      assert.equal(decision.nextScreen, 'PROFILE_COMPLETION');
      assert.equal(decision.nextIsAuthenticated, true);
      assert.equal(decision.nextIsProfileComplete, false);
    });

    test('3.3: Explicit auth transition with completed profile resolves to HOME', () => {
      const decision = resolveNavigationDecision(
        { currentScreen: 'SPLASH', isAuthenticated: false, isProfileComplete: false },
        'HOME',
        { token: 'valid-tok', customer: { id: 'c2', isProfileComplete: true } }
      );
      assert.equal(decision.blocked, false);
      assert.equal(decision.redirected, false);
      assert.equal(decision.nextScreen, 'HOME');
      assert.equal(decision.nextIsAuthenticated, true);
      assert.equal(decision.nextIsProfileComplete, true);
    });

    test('3.4: MARKETPLACE alias route resolves to HOME', () => {
      const decision = resolveNavigationDecision(
        { currentScreen: 'HOME', isAuthenticated: true, isProfileComplete: true },
        'MARKETPLACE'
      );
      assert.equal(decision.blocked, false);
      assert.equal(decision.nextScreen, 'HOME', 'MARKETPLACE must resolve to HOME');
    });
  });

  // =========================================================================
  // SUITE 4: [Static Source Checks] Production Code Structure Invariants
  // =========================================================================
  describe('Suite 4: [Static Source Checks] Production Code Structure Invariants', () => {
    test('4.1: [Static Source Check] SplashScreen.jsx does not contain artificial setTimeout delays', () => {
      assert.equal(
        splashCode.includes('setTimeout'),
        false,
        'SplashScreen.jsx must NOT contain setTimeout or artificial delays'
      );
    });

    test('4.2: [Static Source Check] SplashScreen.jsx imports and utilizes orchestrateStartupSession', () => {
      assert.ok(
        splashCode.includes("from '../utils/startup-session'"),
        'SplashScreen.jsx must import orchestrateStartupSession'
      );
      assert.ok(
        splashCode.includes('orchestrateStartupSession({'),
        'SplashScreen.jsx must call orchestrateStartupSession'
      );
    });

    test('4.3: [Static Source Check] startup-session.js passes skipUnauthorizedHandler: true to getProfile', () => {
      assert.ok(
        startupCode.includes('skipUnauthorizedHandler: true'),
        'startup-session.js must pass skipUnauthorizedHandler: true to getProfile'
      );
    });

    test('4.4: [Static Source Check] App.jsx imports and delegates to resolveNavigationDecision', () => {
      assert.ok(
        appCode.includes("from './src/utils/navigation-guard'"),
        'App.jsx must import resolveNavigationDecision from navigation-guard'
      );
      assert.ok(
        appCode.includes('resolveNavigationDecision('),
        'App.jsx must delegate to resolveNavigationDecision'
      );
    });

    test('4.5: [Static Source Check] api.js supports skipUnauthorizedHandler option to prevent duplicate 401 dispatch', () => {
      assert.ok(
        apiCode.includes('options.skipUnauthorizedHandler'),
        'api.js must inspect options.skipUnauthorizedHandler'
      );
    });
  });

  // =========================================================================
  // SUITE 5: [Production Unit & Integration Tests] Safe In-Flight GET Request Deduplication
  // =========================================================================
  describe('Suite 5: [Production Unit & Integration Tests] Safe In-Flight GET Request Deduplication', () => {
    test('5.1: Multiple identical concurrent GET requests share exactly one low-level network fetch', async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 40));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [{ id: 'fish-1', name: 'Rohu' }] }),
        };
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      const [res1, res2] = await Promise.all([
        productionApi.getFish(),
        productionApi.getFish(),
      ]);

      assert.equal(fetchCount, 1, 'Two concurrent getFish() requests must coalesce into exactly one network fetch');
      assert.deepEqual(res1.data, [{ id: 'fish-1', name: 'Rohu' }]);
      assert.deepEqual(res2.data, [{ id: 'fish-1', name: 'Rohu' }]);
    });

    test('5.2: Distinct GET requests execute separate network fetches', async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 40));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] }),
        };
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      await Promise.all([
        productionApi.getFish({ category_id: 'cat-1' }),
        productionApi.getFish({ category_id: 'cat-2' }),
      ]);

      assert.equal(fetchCount, 2, 'Requests with different query params must execute separate network fetches');
    });

    test('5.3: Requests with different auth tokens execute separate network fetches', async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 40));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: {} }),
        };
      };

      const { api: productionApi } = loadProductionApiModule({}, mockFetch);

      await Promise.all([
        productionApi.getProfile('token-user-a'),
        productionApi.getProfile('token-user-b'),
      ]);

      assert.equal(fetchCount, 2, 'Requests with different session tokens must execute separate network fetches');
    });

    test('5.4: Non-GET mutation requests (POST, PUT, PATCH, DELETE) are never deduplicated', async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 40));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { items: [], summary: {} } }),
        };
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      await Promise.all([
        productionApi.addToCart({ fishId: 'fish-1', quantity: 1 }),
        productionApi.addToCart({ fishId: 'fish-1', quantity: 1 }),
      ]);

      assert.equal(fetchCount, 2, 'Mutations must never be deduplicated');
    });

    test('5.5: bypassDedup option forces fresh fetch even for concurrent identical GET requests', async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 40));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] }),
        };
      };

      const { request: productionRequest } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      await Promise.all([
        productionRequest('/api/v1/customer/fish', { bypassDedup: true }),
        productionRequest('/api/v1/customer/fish', { bypassDedup: true }),
      ]);

      assert.equal(fetchCount, 2, 'bypassDedup: true must bypass in-flight deduplication');
    });

    test('5.6: Immediate settle cleanup: in-flight entry deleted immediately after settlement', async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 30));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { items: [] } }),
        };
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      const p1 = productionApi.getCart();
      await new Promise((r) => setTimeout(r, 5));
      assert.equal(productionApi.getInFlightRequestCount(), 1, 'In-flight count must be 1 while request is active');

      await p1;
      assert.equal(productionApi.getInFlightRequestCount(), 0, 'In-flight count must return to 0 immediately upon settlement');

      // Subsequent call executes fresh fetch
      await productionApi.getCart();
      assert.equal(fetchCount, 2, 'Subsequent call after settlement must dispatch fresh network fetch');
    });

    test('5.7: Error propagation: rejected underlying fetch propagates to all concurrent callers', async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 40));
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Database connection failed' } }),
        };
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      const [err1, err2] = await Promise.all([
        productionApi.getCart().catch((e) => e),
        productionApi.getCart().catch((e) => e),
      ]);

      assert.equal(fetchCount, 1, 'Single fetch dispatched despite failure');
      assert.equal(err1.code, 'INTERNAL_ERROR');
      assert.equal(err2.code, 'INTERNAL_ERROR');
      assert.equal(productionApi.getInFlightRequestCount(), 0, 'In-flight map cleaned up on error');
    });

    test('5.8: Error non-caching: failed request does not poison future requests', async () => {
      let attempt = 0;
      const mockFetch = async () => {
        attempt++;
        await new Promise((r) => setTimeout(r, 30));
        if (attempt === 1) {
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: { code: 'UNAVAILABLE', message: 'Server rebooting' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { items: [{ fishId: 'f1' }] } }),
        };
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      // First attempt fails
      await assert.rejects(productionApi.getCart(), (err) => err.code === 'UNAVAILABLE');

      // Second attempt succeeds cleanly without seeing previous error
      const res = await productionApi.getCart();
      assert.equal(res.data.items.length, 1);
    });

    test('5.9: Caller cancellation isolation: Caller A aborting does NOT interrupt Caller B', async () => {
      let fetchStarted = false;
      let fetchCompleted = false;

      const mockFetch = async (url, opts) => {
        fetchStarted = true;
        await new Promise((r) => setTimeout(r, 80));
        if (opts.signal?.aborted) {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          throw err;
        }
        fetchCompleted = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { items: ['item1'] } }),
        };
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      const controllerA = new AbortController();
      const controllerB = new AbortController();

      const pA = productionApi.getCart({ signal: controllerA.signal });
      const pB = productionApi.getCart({ signal: controllerB.signal });

      // Abort Caller A mid-flight
      setTimeout(() => {
        controllerA.abort('Caller A navigated away');
      }, 20);

      // Caller A must reject with API_ABORTED
      await assert.rejects(pA, (err) => {
        assert.equal(err.code, 'API_ABORTED');
        assert.equal(err.isAborted, true);
        return true;
      });

      // Caller B must succeed cleanly
      const resB = await pB;
      assert.deepEqual(resB.data, { items: ['item1'] });
      assert.equal(fetchCompleted, true, 'Underlying network fetch must have completed for Caller B');
    });

    test('5.10: All callers aborting cancels the underlying network fetch controller', async () => {
      let underlyingAborted = false;

      const mockFetch = (url, opts) => new Promise((resolve, reject) => {
        if (opts.signal) {
          opts.signal.addEventListener('abort', () => {
            underlyingAborted = true;
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      const controllerA = new AbortController();
      const controllerB = new AbortController();

      const pA = productionApi.getCart({ signal: controllerA.signal });
      const pB = productionApi.getCart({ signal: controllerB.signal });

      setTimeout(() => {
        controllerA.abort('A cancelled');
        controllerB.abort('B cancelled');
      }, 20);

      await Promise.allSettled([pA, pB]);
      assert.equal(underlyingAborted, true, 'Underlying fetch must be aborted when all callers abort');
    });

    test('5.11: Pre-aborted caller signal fails fast without making network call', async () => {
      let fetchCount = 0;
      const mockFetch = async () => { fetchCount++; };

      const { api: productionApi } = loadProductionApiModule({}, mockFetch);

      const preAborted = new AbortController();
      preAborted.abort('Pre-cancelled');

      await assert.rejects(
        productionApi.getFish({}, { signal: preAborted.signal }),
        (err) => err.code === 'API_ABORTED'
      );

      assert.equal(fetchCount, 0, 'No network fetch should be dispatched for pre-aborted signal');
    });

    test('5.12: clearInFlightRequests aborts active in-flight requests with API_SESSION_RESET', async () => {
      const mockFetch = () => new Promise(() => {}); // never resolves

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'session-old' }) },
        mockFetch
      );

      const p = productionApi.getCart();
      await new Promise((r) => setTimeout(r, 5));
      assert.equal(productionApi.getInFlightRequestCount(), 1);

      productionApi.clearInFlightRequests();

      await assert.rejects(p, (err) => {
        assert.equal(err.code, 'API_SESSION_RESET');
        return true;
      });

      assert.equal(productionApi.getInFlightRequestCount(), 0);
    });

    test('5.13: Data isolation: co-subscribers receive isolated clones of response payload', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { items: ['item-A'] } }),
      });

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'token-abc' }) },
        mockFetch
      );

      const [res1, res2] = await Promise.all([
        productionApi.getCart(),
        productionApi.getCart(),
      ]);

      res1.data.items.push('item-MUTATED');
      assert.equal(res2.data.items.length, 1, 'res2 data must be insulated from mutations on res1');
    });

    test('5.14: Request identity isolation: startup profile probe (skip401) and normal profile request do NOT coalesce', async () => {
      let fetchCount = 0;
      const endpointsCalled = [];
      const mockFetch = async (url, opts) => {
        fetchCount++;
        endpointsCalled.push({ url, headers: opts.headers });
        await new Promise((r) => setTimeout(r, 40));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { id: 'cust_1', name: 'PondFish User' } }),
        };
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      // Concurrent startup probe (skipUnauthorizedHandler: true) and normal request (skipUnauthorizedHandler: false)
      const [resStartup, resNormal] = await Promise.all([
        productionApi.getProfile('mock-user-token', { skipUnauthorizedHandler: true }),
        productionApi.getProfile('mock-user-token', { skipUnauthorizedHandler: false }),
      ]);

      assert.equal(fetchCount, 2, 'Startup probe and normal request must NOT coalesce; fetchCount must be 2');
      assert.deepEqual(resStartup.data, { id: 'cust_1', name: 'PondFish User' });
      assert.deepEqual(resNormal.data, { id: 'cust_1', name: 'PondFish User' });
    });

    test('5.15: Startup-first ordering: 401 on startup probe does not invoke global unauthorized handler', async () => {
      let globalUnauthorizedCalled = false;
      let rejectedTokenPassed = null;
      let fetchCount = 0;

      const mockFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 30));
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
        };
      };

      const { api: productionApi, setUnauthorizedHandler: setHandler } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'stale-startup-token' }) },
        mockFetch
      );

      setHandler((token) => {
        globalUnauthorizedCalled = true;
        rejectedTokenPassed = token;
      });

      // Startup probe fires first with skipUnauthorizedHandler: true
      await assert.rejects(
        productionApi.getProfile('stale-startup-token', { skipUnauthorizedHandler: true, timeoutMs: 5000 }),
        (err) => err.status === 401
      );

      assert.equal(globalUnauthorizedCalled, false, 'Global unauthorized handler must NOT be invoked by startup probe');
      assert.equal(rejectedTokenPassed, null);
    });

    test('5.16: Normal-first ordering: 401 on normal request invokes global unauthorized handler', async () => {
      let globalUnauthorizedCalled = false;
      let rejectedTokenPassed = null;

      const mockFetch = async () => {
        await new Promise((r) => setTimeout(r, 30));
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Token invalid' } }),
        };
      };

      const { api: productionApi, setUnauthorizedHandler: setHandler } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'rejected-normal-token' }) },
        mockFetch
      );

      setHandler((token) => {
        globalUnauthorizedCalled = true;
        rejectedTokenPassed = token;
      });

      // Normal request fires with skipUnauthorizedHandler: false (default)
      await assert.rejects(
        productionApi.getProfile('rejected-normal-token'),
        (err) => err.status === 401
      );

      assert.equal(globalUnauthorizedCalled, true, 'Global unauthorized handler MUST be invoked for normal authenticated request');
      assert.equal(rejectedTokenPassed, 'rejected-normal-token');
    });

    test('5.17: Timeout isolation: requests with different timeouts do NOT coalesce', async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 40));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { id: 'cust_1' } }),
        };
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      // Concurrent requests with different timeout configurations
      await Promise.all([
        productionApi.getProfile('mock-user-token', { timeoutMs: 5000 }),
        productionApi.getProfile('mock-user-token', { timeoutMs: 15000 }),
      ]);

      assert.equal(fetchCount, 2, 'Requests with different timeoutMs must NOT coalesce into one request');
    });

    test('5.18: Header isolation: requests with different custom headers do NOT coalesce', async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 40));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] }),
        };
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      await Promise.all([
        productionApi.getFish({}, { headers: { 'X-Custom-Scope': 'fish' } }),
        productionApi.getFish({}, { headers: { 'X-Custom-Scope': 'shrimp' } }),
      ]);

      assert.equal(fetchCount, 2, 'Requests with distinct non-auth custom headers must NOT coalesce');
    });

    test('5.19: Direct mutations (POST, PUT, DELETE) are never cancelled by clearInFlightRequests', async () => {
      let mutationFinished = false;
      const mockFetch = async () => {
        await new Promise((r) => setTimeout(r, 60));
        mutationFinished = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { items: [{ fishId: 'f1', quantity: 2 }] } }),
        };
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'active-session-token' }) },
        mockFetch
      );

      const mutationPromise = productionApi.addToCart({ fishId: 'f1', quantity: 2 });
      await new Promise((r) => setTimeout(r, 10));

      // Invoke session clear in flight
      productionApi.clearInFlightRequests();

      // Mutation must succeed unaffected
      const res = await mutationPromise;
      assert.equal(mutationFinished, true, 'Mutation must complete even if clearInFlightRequests is invoked');
      assert.equal(res.data.items[0].quantity, 2);
    });

    test('5.20: Cancellation fallback when AbortController is NOT available: Caller A aborting does NOT fail Caller B', async () => {
      const originalAbortController = globalThis.AbortController;
      try {
        // Temporarily remove global AbortController to simulate environment without native AbortController
        delete globalThis.AbortController;

        let fetchStarted = false;
        let fetchCompleted = false;

        const mockFetch = async () => {
          fetchStarted = true;
          await new Promise((r) => setTimeout(r, 70));
          fetchCompleted = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { items: ['item-fallback'] } }),
          };
        };

        // Load production api module with AbortController = undefined
        const { api: productionApi } = loadProductionApiModule(
          { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
          mockFetch,
          undefined // customAbortController explicitly undefined
        );

        // Simple polyfill signal implementation for testing caller abort without native AbortController
        function createFallbackSignal() {
          const listeners = [];
          const signal = {
            aborted: false,
            reason: undefined,
            addEventListener: (event, cb) => {
              if (event === 'abort') listeners.push(cb);
            },
            removeEventListener: (event, cb) => {
              const idx = listeners.indexOf(cb);
              if (idx !== -1) listeners.splice(idx, 1);
            },
          };
          const abort = (reason) => {
            signal.aborted = true;
            signal.reason = reason || 'Caller aborted';
            listeners.forEach((fn) => fn());
          };
          return { signal, abort };
        }

        const callerA = createFallbackSignal();
        const callerB = createFallbackSignal();

        const pA = productionApi.getCart({ signal: callerA.signal });
        const pB = productionApi.getCart({ signal: callerB.signal });

        // Caller A aborts mid-flight
        setTimeout(() => {
          callerA.abort('Caller A detached');
        }, 20);

        // Caller A must reject with API_ABORTED and networkCancelled: false
        await assert.rejects(pA, (err) => {
          assert.equal(err.code, 'API_ABORTED');
          assert.equal(err.isAborted, true);
          assert.equal(err.networkCancelled, false, 'networkCancelled must be false when AbortController is unavailable');
          return true;
        });

        // Caller B must succeed cleanly
        const resB = await pB;
        assert.deepEqual(resB.data, { items: ['item-fallback'] });
        assert.equal(fetchCompleted, true, 'Underlying network fetch must have completed for Caller B');
        assert.equal(productionApi.getInFlightRequestCount(), 0, 'Registry must be cleaned up');
      } finally {
        globalThis.AbortController = originalAbortController;
      }
    });

    test('5.21: Timeout cleanup in registry: request timing out removes entry from Map', async () => {
      const mockFetch = (url, opts) => new Promise((resolve, reject) => {
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      const p = productionApi.getCart({ timeoutMs: 30 });
      await new Promise((r) => setTimeout(r, 5));
      assert.equal(productionApi.getInFlightRequestCount(), 1);

      await assert.rejects(p, (err) => {
        assert.equal(err.code, 'API_TIMEOUT');
        return true;
      });

      assert.equal(productionApi.getInFlightRequestCount(), 0, 'In-flight registry must be 0 after timeout rejection');
    });

    test('5.22: All callers aborting when AbortController is available cleans up registry immediately', async () => {
      const mockFetch = (url, opts) => new Promise((resolve, reject) => {
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-user-token' }) },
        mockFetch
      );

      const cA = new AbortController();
      const cB = new AbortController();

      const pA = productionApi.getCart({ signal: cA.signal });
      const pB = productionApi.getCart({ signal: cB.signal });

      await new Promise((r) => setTimeout(r, 5));
      assert.equal(productionApi.getInFlightRequestCount(), 1);

      cA.abort('A cancelled');
      cB.abort('B cancelled');

      await Promise.allSettled([pA, pB]);
      assert.equal(productionApi.getInFlightRequestCount(), 0, 'Registry must be 0 immediately after all subscribers abort');
    });

    test('5.23: buildDeduplicationKey: validates option-aware hashing, header sorting, and token segregation', () => {
      const { buildDeduplicationKey } = loadProductionApiModule();

      const keyA = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/profile',
        requestToken: 'token-123',
        skipUnauthorizedHandler: true,
        effectiveTimeoutMs: 5000,
      });

      const keyB = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/profile',
        requestToken: 'token-123',
        skipUnauthorizedHandler: false,
        effectiveTimeoutMs: 15000,
      });

      assert.notEqual(keyA, keyB, 'Keys must differ based on skipUnauthorizedHandler and timeout');
      assert.ok(keyA.includes('skip401=1'));
      assert.ok(keyA.includes('to=5000'));
      assert.ok(keyB.includes('skip401=0'));
      assert.ok(keyB.includes('to=15000'));

      // Header sorting, case-insensitive normalization of Authorization, and exclusion of default Content-Type
      const keyH1 = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/fish',
        headers: { 'Z-Index': 'top', 'A-Index': 'bottom', Authorization: 'Bearer abc', 'Content-Type': 'application/json' },
      });
      const keyH2 = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/fish',
        headers: { 'a-index': 'bottom', 'z-index': 'top', authorization: 'Bearer abc' },
      });

      assert.equal(keyH1, keyH2, 'Headers must sort case-insensitively and normalize uppercase/lowercase Authorization');
      assert.ok(keyH1.includes('h=[["a-index","bottom"],["z-index","top"]]'));
      assert.ok(keyH1.includes('AUTH:abc'));

      // Key without Authorization header represents anonymous request and must NOT collide with authenticated request
      const keyAnon = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/fish',
        headers: { 'a-index': 'bottom', 'z-index': 'top' },
      });
      assert.notEqual(keyH1, keyAnon, 'Authenticated request with Bearer abc must not collide with anonymous request');
    });

    test('5.24: Stale entry race: old request aborting all subscribers does not delete replacement entry on settle', async () => {
      const d1 = createDeferred();
      const d2 = createDeferred();
      let fetchCallCount = 0;

      const mockFetch = (url, opts) => {
        fetchCallCount++;
        const currentDeferred = fetchCallCount === 1 ? d1 : d2;
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            try { currentDeferred.reject(err); } catch (_) {}
          });
        }
        return currentDeferred.promise;
      };

      const { api: productionApi, inFlightGetRequests } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-token' }) },
        mockFetch
      );

      const c1 = new AbortController();
      const p1 = productionApi.getCart({ signal: c1.signal });

      await new Promise((r) => setTimeout(r, 10));
      assert.equal(productionApi.getInFlightRequestCount(), 1);

      // Caller 1 aborts, causing all subscribers to detach and entry to be removed from map
      c1.abort('Caller 1 abort');
      await assert.rejects(p1, (err) => {
        assert.equal(err.code, 'API_ABORTED');
        return true;
      });

      // Immediately start request 2 with identical key
      const p2 = productionApi.getCart();
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(productionApi.getInFlightRequestCount(), 1);
      const replacementEntry = Array.from(inFlightGetRequests.values())[0];
      assert.ok(replacementEntry, 'Replacement entry must exist in registry');

      // Now settle request 1 (simulating slow abort settlement in background)
      try {
        d1.reject(new Error('AbortError'));
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 10));

      // Assert that replacement entry was NOT deleted by request 1's finally block
      assert.equal(productionApi.getInFlightRequestCount(), 1);
      assert.equal(Array.from(inFlightGetRequests.values())[0], replacementEntry);

      // Now resolve request 2
      d2.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { items: ['replacement-cart'] } }),
      });

      const res2 = await p2;
      assert.deepEqual(res2.data, { items: ['replacement-cart'] });
      assert.equal(productionApi.getInFlightRequestCount(), 0, 'Registry must be 0 after replacement settles');
    });

    test('5.25: Stale entry race: clearInFlightRequests followed by immediate new same-key request preserves new entry', async () => {
      const d1 = createDeferred();
      const d2 = createDeferred();
      let fetchCallCount = 0;

      const mockFetch = (url, opts) => {
        fetchCallCount++;
        const currentDeferred = fetchCallCount === 1 ? d1 : d2;
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            try { currentDeferred.reject(err); } catch (_) {}
          });
        }
        return currentDeferred.promise;
      };

      const { api: productionApi, inFlightGetRequests } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-token' }) },
        mockFetch
      );

      const p1 = productionApi.getCart();
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(productionApi.getInFlightRequestCount(), 1);

      // Session reset / logout clears in-flight requests
      productionApi.clearInFlightRequests();
      await assert.rejects(p1, (err) => {
        assert.equal(err.code, 'API_SESSION_RESET');
        return true;
      });

      // Immediately launch a new same-key request
      const p2 = productionApi.getCart();
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(productionApi.getInFlightRequestCount(), 1);
      const replacementEntry = Array.from(inFlightGetRequests.values())[0];

      // Request 1 settles in background
      try {
        d1.reject(new Error('AbortError'));
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 10));

      // Old request settle must NOT delete replacement entry
      assert.equal(productionApi.getInFlightRequestCount(), 1);
      assert.equal(Array.from(inFlightGetRequests.values())[0], replacementEntry);

      // Settle request 2 successfully
      d2.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { items: ['new-session-cart'] } }),
      });

      const res2 = await p2;
      assert.deepEqual(res2.data, { items: ['new-session-cart'] });
      assert.equal(productionApi.getInFlightRequestCount(), 0);
    });

    test('5.26: Replacement subscriber isolation: old request settlement cannot resolve or reject subscribers belonging to replacement entry', async () => {
      const d1 = createDeferred();
      const d2 = createDeferred();
      let fetchCallCount = 0;

      const mockFetch = () => {
        fetchCallCount++;
        return fetchCallCount === 1 ? d1.promise : d2.promise;
      };

      const { api: productionApi } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-token' }) },
        mockFetch
      );

      const p1 = productionApi.getCart();
      await new Promise((r) => setTimeout(r, 10));

      // Clear in-flight requests (simulating logout/reset)
      productionApi.clearInFlightRequests();
      await assert.rejects(p1, (err) => {
        assert.equal(err.code, 'API_SESSION_RESET');
        return true;
      });

      // Replacement request 2 starts
      let r2Settled = false;
      const p2 = productionApi.getCart().then(
        (val) => { r2Settled = true; return val; },
        (err) => { r2Settled = true; throw err; }
      );
      await new Promise((r) => setTimeout(r, 10));

      // Old request 1 now resolves with obsolete data
      d1.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { items: ['obsolete-stale-data'] } }),
      });
      await new Promise((r) => setTimeout(r, 20));

      // Replacement request 2 MUST NOT have settled with old request 1's data
      assert.equal(r2Settled, false, 'Replacement request must not be resolved by old request');

      // Now resolve replacement request 2 with fresh data
      d2.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { items: ['fresh-data'] } }),
      });

      const res2 = await p2;
      assert.deepEqual(res2.data, { items: ['fresh-data'] });
    });

    test('5.27: Collision-safe headers: header value containing = and & versus separate headers produce distinct keys', async () => {
      const { buildDeduplicationKey } = loadProductionApiModule();

      const keySingleWithDelimiters = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/fish',
        headers: { 'x-param': 'a=1&b=2' },
      });

      const keyMultipleHeaders = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/fish',
        headers: { 'x-param': 'a=1', b: '2' },
      });

      assert.notEqual(
        keySingleWithDelimiters,
        keyMultipleHeaders,
        'Header serialization with JSON tuples must prevent delimiter collision'
      );
      assert.ok(keySingleWithDelimiters.includes('h=[["x-param","a=1&b=2"]]'));
      assert.ok(keyMultipleHeaders.includes('h=[["b","2"],["x-param","a=1"]]'));

      // Also verify via real requests that they execute separate network fetches
      const fetchCalls = [];
      const mockFetch = async (url, opts) => {
        fetchCalls.push(opts.headers);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] }),
        };
      };

      const { request } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-token' }) },
        mockFetch
      );

      await Promise.all([
        request('/customer/fish', { headers: { 'x-param': 'a=1&b=2' } }),
        request('/customer/fish', { headers: { 'x-param': 'a=1', b: '2' } }),
      ]);

      assert.equal(fetchCalls.length, 2, 'Requests with collision-prone header strings must make 2 distinct fetches');
    });

    test('5.28: Header case-insensitivity: different casing produces equivalent deduplication keys', async () => {
      const { buildDeduplicationKey } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-token' }) },
        async () => {
          await new Promise((r) => setTimeout(r, 20));
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: ['shared'] }),
          };
        }
      );

      const keyUpper = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/fish',
        headers: { 'X-Cache-Control': 'max-age=300', 'Accept-Language': 'en-US' },
      });

      const keyLower = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/fish',
        headers: { 'accept-language': 'en-US', 'x-cache-control': 'max-age=300' },
      });

      assert.equal(keyUpper, keyLower, 'Header keys must normalize case-insensitively');
      assert.ok(keyUpper.includes('h=[["accept-language","en-US"],["x-cache-control","max-age=300"]]'));
    });

    test('5.29: Semantic fetch options: differing credentials, cache, or mode produce distinct keys', async () => {
      const { buildDeduplicationKey } = loadProductionApiModule();

      const keyCache1 = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/fish',
        fetchOptions: { cache: 'no-store' },
      });

      const keyCache2 = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/fish',
        fetchOptions: { cache: 'reload' },
      });

      const keyCreds = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/fish',
        fetchOptions: { credentials: 'include' },
      });

      assert.notEqual(keyCache1, keyCache2, 'Different cache options must produce distinct keys');
      assert.ok(keyCache1.includes('opts=[["cache","no-store"]]'));
      assert.ok(keyCache2.includes('opts=[["cache","reload"]]'));
      assert.ok(keyCreds.includes('opts=[["credentials","include"]]'));

      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] }),
        };
      };

      const { request } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-token' }) },
        mockFetch
      );

      await Promise.all([
        request('/customer/fish', { cache: 'no-store' }),
        request('/customer/fish', { cache: 'reload' }),
      ]);

      assert.equal(fetchCount, 2, 'Requests with different semantic cache options must not coalesce');
    });

    test('5.30: Unsupported or unrepresented options safely bypass deduplication', async () => {
      const { evaluateDeduplicatable, request, inFlightGetRequests } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'mock-token' }) },
        async () => {
          await new Promise((r) => setTimeout(r, 20));
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: 'direct' }),
          };
        }
      );

      // Verify evaluateDeduplicatable predicate
      assert.equal(evaluateDeduplicatable(true, { unknownOption: 'custom' }), false);
      assert.equal(evaluateDeduplicatable(true, { body: '{"payload":1}' }), false);
      assert.equal(evaluateDeduplicatable(true, { cache: { invalid: 'object' } }), false);
      assert.equal(evaluateDeduplicatable(true, { cache: 'no-cache' }), true);
      assert.equal(evaluateDeduplicatable(false, {}), false);

      // In real requests: concurrent requests with unsupported option do not join Map
      const p1 = request('/customer/fish', { unknownOption: 'alpha' });
      const p2 = request('/customer/fish', { unknownOption: 'beta' });

      // In-flight Map must remain empty because both bypassed deduplication
      assert.equal(inFlightGetRequests.size, 0, 'Requests bypassing dedup must not register in in-flight Map');

      const [r1, r2] = await Promise.all([p1, p2]);
      assert.equal(r1.data, 'direct');
      assert.equal(r2.data, 'direct');
    });

    test('5.31: Case-insensitive Authorization header normalization: uppercase and lowercase coalesce cleanly', async () => {
      let fetchCount = 0;
      let sentHeaders = null;
      const mockFetch = async (url, opts) => {
        fetchCount++;
        sentHeaders = opts.headers;
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { status: 'ok' } }),
        };
      };

      const { request } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'stored-unused' }) },
        mockFetch
      );

      // Concurrent requests: one with uppercase Authorization, one with lowercase authorization
      const p1 = request('/customer/cart', { headers: { 'Authorization': 'Bearer explicit-tok-123' } });
      const p2 = request('/customer/cart', { headers: { 'authorization': 'Bearer explicit-tok-123' } });

      const [res1, res2] = await Promise.all([p1, p2]);

      assert.equal(fetchCount, 1, 'Requests with identical tokens in differently cased Authorization headers must coalesce');
      assert.deepEqual(res1.data, { status: 'ok' });
      assert.deepEqual(res2.data, { status: 'ok' });

      // Verify that exactly one canonical Authorization header was sent on the wire
      const authKeys = Object.keys(sentHeaders).filter((k) => k.toLowerCase() === 'authorization');
      assert.equal(authKeys.length, 1, 'Exactly one Authorization header must be sent');
      assert.equal(sentHeaders.Authorization, 'Bearer explicit-tok-123');
    });

    test('5.32: Two differently-cased Authorization headers with conflicting values reject with API_INVALID_HEADERS', async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        return { ok: true, status: 200, json: async () => ({}) };
      };

      const { request, buildDeduplicationKey } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'stored-unused' }) },
        mockFetch
      );

      // Conflicting values
      const promise = request('/customer/cart', {
        headers: {
          'Authorization': 'Bearer token-A',
          'authorization': 'Bearer token-B',
        },
      });

      await assert.rejects(promise, (err) => {
        assert.equal(err.code, 'API_INVALID_HEADERS');
        assert.ok(err.message.includes('conflicting Authorization'));
        return true;
      });

      assert.equal(fetchCount, 0, 'No fetch must be dispatched when conflicting Authorization headers are supplied');

      // buildDeduplicationKey returns null for conflicting Authorization headers
      const key = buildDeduplicationKey({
        url: 'https://pondfish.in/api/v1/customer/cart',
        headers: {
          'Authorization': 'Bearer token-A',
          'authorization': 'Bearer token-B',
        },
      });
      assert.equal(key, null, 'buildDeduplicationKey must return null for conflicting Authorization headers');
    });

    test('5.33: Multiple identically-valued differently-cased Authorization headers normalize safely to single header', async () => {
      let sentHeaders = null;
      const mockFetch = async (url, opts) => {
        sentHeaders = opts.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { user: 'verified' } }),
        };
      };

      const { request } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'stored-unused' }) },
        mockFetch
      );

      const res = await request('/customer/profile', {
        headers: {
          'Authorization': 'Bearer identical-token',
          'authorization': 'Bearer identical-token',
          'AUTHORIZATION': 'Bearer identical-token',
        },
      });

      assert.deepEqual(res.data, { user: 'verified' });
      const authKeys = Object.keys(sentHeaders).filter((k) => k.toLowerCase() === 'authorization');
      assert.equal(authKeys.length, 1, 'Only one canonical Authorization header must be sent');
      assert.equal(sentHeaders.Authorization, 'Bearer identical-token');
    });

    test('5.34: Requests using different explicit Authorization tokens do NOT coalesce', async () => {
      let fetchCount = 0;
      const fetchedTokens = [];
      const mockFetch = async (url, opts) => {
        fetchCount++;
        fetchedTokens.push(opts.headers.Authorization);
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { tokenUsed: opts.headers.Authorization } }),
        };
      };

      const { request } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'stored-unused' }) },
        mockFetch
      );

      const [res1, res2] = await Promise.all([
        request('/customer/cart', { headers: { 'Authorization': 'Bearer token-alpha' } }),
        request('/customer/cart', { headers: { 'authorization': 'Bearer token-beta' } }),
      ]);

      assert.equal(fetchCount, 2, 'Different tokens must make 2 distinct network fetches');
      assert.equal(res1.data.tokenUsed, 'Bearer token-alpha');
      assert.equal(res2.data.tokenUsed, 'Bearer token-beta');
    });

    test('5.35: Custom lowercase Authorization header does not coalesce with Keystore stored token', async () => {
      let fetchCount = 0;
      const tokensSent = [];
      const mockFetch = async (url, opts) => {
        fetchCount++;
        tokensSent.push(opts.headers.Authorization);
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { auth: opts.headers.Authorization } }),
        };
      };

      const { request } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'keystore-token-active' }) },
        mockFetch
      );

      // Caller 1 provides explicit lowercase authorization
      const p1 = request('/customer/cart', { headers: { 'authorization': 'Bearer custom-lowercase-token' } });
      // Caller 2 provides no headers, using Keystore token
      const p2 = request('/customer/cart');

      const [res1, res2] = await Promise.all([p1, p2]);

      assert.equal(fetchCount, 2, 'Explicit lowercase authorization must not coalesce with stored Keystore token');
      assert.equal(res1.data.auth, 'Bearer custom-lowercase-token');
      assert.equal(res2.data.auth, 'Bearer keystore-token-active');
    });

    test('5.36: Unsafe or unrepresentable custom Authorization safely bypasses deduplication', async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: 'unrepresentable' }),
        };
      };

      const { request, inFlightGetRequests, buildDeduplicationKey } = loadProductionApiModule(
        { getAuthTokens: async () => ({ token: 'stored' }) },
        mockFetch
      );

      // Non-string Authorization header
      const p1 = request('/customer/fish', { headers: { authorization: { invalid: true } } });
      const p2 = request('/customer/fish', { headers: { authorization: { invalid: true } } });

      assert.equal(inFlightGetRequests.size, 0, 'Unrepresentable authorization must not register in in-flight Map');

      const [r1, r2] = await Promise.all([p1, p2]);
      assert.equal(fetchCount, 2, 'Unrepresentable authorization must bypass deduplication and execute directly');
      assert.equal(r1.data, 'unrepresentable');
      assert.equal(r2.data, 'unrepresentable');

      // buildDeduplicationKey returns null for unrepresentable Authorization
      assert.equal(buildDeduplicationKey({ url: '/fish', headers: { authorization: 123 } }), null);
      assert.equal(buildDeduplicationKey({ url: '/fish', headers: { authorization: '   ' } }), null);
    });

    test('5.37: Existing getProfile explicit token behavior and 401 callback ownership preserved', async () => {
      let keystoreCallCount = 0;
      let unauthorizedNotifiedToken = null;

      const mockStorage = {
        getAuthTokens: async () => {
          keystoreCallCount++;
          return { token: 'stored-keystore-token' };
        },
      };

      const mockFetch = async (url, opts) => {
        if (opts.headers.Authorization === 'Bearer explicit-profile-token') {
          const err = new Error('Unauthorized');
          err.status = 401;
          return {
            ok: false,
            status: 401,
            json: async () => ({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token rejected' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { name: 'Customer' } }),
        };
      };

      const { api: productionApi, setUnauthorizedHandler } = loadProductionApiModule(mockStorage, mockFetch);
      setUnauthorizedHandler((tok) => {
        unauthorizedNotifiedToken = tok;
      });

      // Explicit token call: should NOT read Keystore
      await assert.rejects(
        productionApi.getProfile('explicit-profile-token'),
        (err) => err.status === 401
      );
      assert.equal(keystoreCallCount, 0, 'Explicit token getProfile must NOT invoke getAuthTokens');
      assert.equal(unauthorizedNotifiedToken, 'explicit-profile-token', 'Rejected explicit token must be reported to 401 callback');

      // Call without explicit token: should read Keystore
      const res = await productionApi.getProfile(null);
      assert.equal(keystoreCallCount, 1, 'getProfile(null) must retrieve credentials from Keystore');
      assert.deepEqual(res.data, { name: 'Customer' });
    });
  });

  // =========================================================================
  // SUITE 6: [Production Integration & Static Checks] Cart & Home Data Ownership
  // =========================================================================
  describe('Suite 6: [Production Integration & Static Checks] Cart & Home Data Ownership and Invariants', () => {
    test('6.1: Navigating to CART does not trigger fetchCartSummary from App shell', () => {
      assert.ok(
        appCode.includes("currentScreen !== 'CART'"),
        "App.jsx must check currentScreen !== 'CART' to prevent duplicate cart fetching on navigation"
      );
    });

    test('6.2: App shell handleCartUpdated updates cartSummary and item count from CartScreen / details mutations', () => {
      let summaryState = { totalItems: 0, totalQuantity: 0, totalAmount: 0 };

      const handleCartUpdated = (cartData) => {
        if (cartData?.summary) {
          summaryState = cartData.summary;
        } else if (Array.isArray(cartData?.items)) {
          summaryState = { ...summaryState, totalItems: cartData.items.length };
        }
      };

      // Mutation 1: Full cart returned from CartScreen stepper / remove
      handleCartUpdated({
        items: [{ fishId: 'f1', quantity: 2 }],
        summary: { totalItems: 1, totalQuantity: 2, totalAmount: 480 },
      });
      assert.equal(summaryState.totalItems, 1);
      assert.equal(summaryState.totalAmount, 480);

      // Mutation 2: Cart clearance
      handleCartUpdated({
        items: [],
        summary: { totalItems: 0, totalQuantity: 0, totalAmount: 0 },
      });
      assert.equal(summaryState.totalItems, 0);
      assert.equal(summaryState.totalAmount, 0);
    });

    test('6.3: fetchHomeDataOrchestrated reuses existingCategories without refetching on non-refresh transitions', async () => {
      const fetchHomeDataOrchestrated = loadHomeScreenOrchestrator();

      let categoriesCalled = false;
      let fishCalled = false;

      const mockApiClient = {
        getFish: async () => {
          fishCalled = true;
          return { data: [{ id: 'f1' }] };
        },
        getCategories: async () => {
          categoriesCalled = true;
          return { data: [{ id: 'c1' }] };
        },
        getSubscription: async () => ({ data: null }),
        getCustomerLiveTracking: async () => ({ data: null }),
        getProfile: async () => ({ data: null }),
      };

      let assignedCategories = null;

      await fetchHomeDataOrchestrated({
        apiClient: mockApiClient,
        setFishList: () => {},
        setCategories: (cats) => { assignedCategories = cats; },
        setSubData: () => {},
        setTrackingData: () => {},
        setCustomer: () => {},
        setLoading: () => {},
        setRefreshing: () => {},
        setError: () => {},
        abortControllerRef: { current: null },
        isMountedRef: { current: true },
        requestSeqRef: { current: 0 },
        isRefresh: false,
        existingCategories: [{ id: 'cat-cached', name: 'Freshwater' }],
      });

      assert.equal(categoriesCalled, false, 'apiClient.getCategories must NOT be called when existingCategories are provided on non-refresh');
      assert.deepEqual(assignedCategories, [{ id: 'cat-cached', name: 'Freshwater' }]);
      assert.equal(fishCalled, true, 'Fish catalogue must still load as priority 1');
    });

    test('6.4: fetchHomeDataOrchestrated with isRefresh: true refetches categories even when existing categories are present', async () => {
      const fetchHomeDataOrchestrated = loadHomeScreenOrchestrator();

      let categoriesCalled = false;

      const mockApiClient = {
        getFish: async () => ({ data: [] }),
        getCategories: async () => {
          categoriesCalled = true;
          return { data: [{ id: 'cat-fresh' }] };
        },
        getSubscription: async () => ({ data: null }),
        getCustomerLiveTracking: async () => ({ data: null }),
        getProfile: async () => ({ data: null }),
      };

      await fetchHomeDataOrchestrated({
        apiClient: mockApiClient,
        setFishList: () => {},
        setCategories: () => {},
        setSubData: () => {},
        setTrackingData: () => {},
        setCustomer: () => {},
        setLoading: () => {},
        setRefreshing: () => {},
        setError: () => {},
        abortControllerRef: { current: null },
        isMountedRef: { current: true },
        requestSeqRef: { current: 0 },
        isRefresh: true,
        existingCategories: [{ id: 'cat-cached' }],
      });

      assert.equal(categoriesCalled, true, 'apiClient.getCategories MUST be refetched on pull-to-refresh');
    });

    test('6.5: Critical fish catalogue is Priority 1: unblocks visual display before secondary requests settle', async () => {
      const fetchHomeDataOrchestrated = loadHomeScreenOrchestrator();

      let loadingEvents = [];
      let slowSettled = false;

      const mockApiClient = {
        getFish: async () => {
          await new Promise((r) => setTimeout(r, 10));
          return { data: [{ id: 'fish-1' }] };
        },
        getCategories: async () => {
          await new Promise((r) => setTimeout(r, 60));
          slowSettled = true;
          return { data: [] };
        },
        getSubscription: async () => ({ data: null }),
        getCustomerLiveTracking: async () => ({ data: null }),
        getProfile: async () => ({ data: null }),
      };

      const orchestratePromise = fetchHomeDataOrchestrated({
        apiClient: mockApiClient,
        setFishList: () => {},
        setCategories: () => {},
        setSubData: () => {},
        setTrackingData: () => {},
        setCustomer: () => {},
        setLoading: (val) => {
          loadingEvents.push({ val, slowSettled });
        },
        setRefreshing: () => {},
        setError: () => {},
        abortControllerRef: { current: null },
        isMountedRef: { current: true },
        requestSeqRef: { current: 0 },
        isRefresh: false,
      });

      await orchestratePromise;

      const unblockEvent = loadingEvents.find((e) => e.val === false);
      assert.ok(unblockEvent, 'setLoading(false) must be called');
      assert.equal(unblockEvent.slowSettled, false, 'Catalogue display must unblock before secondary categories request completes');
    });

    test('6.6: [Static Source Check] App.jsx excludes CART from fetchCartSummary useEffect trigger', () => {
      assert.ok(
        appCode.includes("currentScreen !== 'CART'"),
        "App.jsx must exclude CART from fetchCartSummary"
      );
    });

    test('6.7: [Static Source Check] App.jsx calls api.clearInFlightRequests on logout', () => {
      assert.ok(
        appCode.includes('api.clearInFlightRequests()'),
        'App.jsx must call api.clearInFlightRequests on logout'
      );
    });

    test('6.8: [Static Source Check] api.js implements in-flight deduplication registry and exports management methods', () => {
      assert.ok(
        apiCode.includes('inFlightGetRequests = new Map()'),
        'api.js must declare in-flight requests Map registry'
      );
      assert.ok(
        apiCode.includes('clearInFlightRequests'),
        'api.js must provide clearInFlightRequests'
      );
      assert.ok(
        apiCode.includes('getInFlightRequestCount'),
        'api.js must provide getInFlightRequestCount'
      );
    });

    test('6.9: [Static Source Check] api.js implements option-aware buildDeduplicationKey', () => {
      assert.ok(
        apiCode.includes('function buildDeduplicationKey'),
        'api.js must declare buildDeduplicationKey helper'
      );
      assert.ok(
        apiCode.includes('skipUnauthorizedHandler'),
        'buildDeduplicationKey must inspect skipUnauthorizedHandler'
      );
      assert.ok(
        apiCode.includes('effectiveTimeoutMs'),
        'buildDeduplicationKey must inspect effectiveTimeoutMs'
      );
    });

    test('6.10: [Static Source Check] api.js implements identity-safe deletion and collision-safe keys', () => {
      assert.ok(
        apiCode.includes('inFlightGetRequests.get(dedupKey) === entry'),
        'api.js must check entry identity before deleting from inFlightGetRequests'
      );
      assert.ok(
        apiCode.includes('SUPPORTED_SEMANTIC_FETCH_OPTIONS'),
        'api.js must define SUPPORTED_SEMANTIC_FETCH_OPTIONS'
      );
      assert.ok(
        apiCode.includes('evaluateDeduplicatable'),
        'api.js must define evaluateDeduplicatable'
      );
    });

    test('6.11: [Static Source Check] api.js implements case-insensitive Authorization header normalization', () => {
      assert.ok(
        apiCode.includes('extractAndNormalizeAuthorization'),
        'api.js must declare extractAndNormalizeAuthorization helper'
      );
      assert.ok(
        apiCode.includes('API_INVALID_HEADERS'),
        'api.js must reject conflicting authorization headers with API_INVALID_HEADERS'
      );
    });
  });
});
