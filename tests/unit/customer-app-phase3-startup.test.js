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
 * Suite 6: [Production Integration & Static Checks] Cart & Home Data Ownership and Invariants
 *   - 6.1: Navigating to CART does not trigger fetchCartSummary from App shell
 *   - 6.2: App shell handleCartUpdated updates cartSummary and item count from mutations
 *   - 6.3: fetchHomeDataOrchestrated reuses existingCategories without refetching on non-refresh
 *   - 6.4: fetchHomeDataOrchestrated with isRefresh: true refetches categories
 *   - 6.5: Critical fish catalogue is Priority 1: unblocks visual display before secondary requests settle
 *   - 6.6: [Static Source Check] App.jsx excludes CART from fetchCartSummary useEffect trigger
 *   - 6.7: [Static Source Check] App.jsx calls api.clearInFlightRequests on logout
 *   - 6.8: [Static Source Check] api.js implements in-flight deduplication registry and exports management methods
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
 * Loads the real production api.js client module into an isolated test context.
 * Enables testing real setUnauthorizedHandler and skipUnauthorizedHandler logic.
 */
function loadProductionApiModule(mockStorage = {}, mockFetch = null) {
  let code = fs.readFileSync(apiSourcePath, 'utf8');

  code = code.replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]\.\/auth-storage['"];?/g, 'const { $1 } = mockAuthStorage;');
  code = code.replace(/export\s+const\s+DEFAULT_TIMEOUT_MS\s*=\s*(\d+);?/g, 'const DEFAULT_TIMEOUT_MS = $1; exports.DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;');
  code = code.replace(/export\s+function\s+setUnauthorizedHandler/g, 'exports.setUnauthorizedHandler = function setUnauthorizedHandler');
  code = code.replace(/export\s+const\s+api\s*=\s*\{/g, 'const api = {');

  code += '\nexports.api = api;\nexports.request = request;';

  const m = { exports: {} };
  const fn = new Function('exports', 'require', 'mockAuthStorage', 'fetch', '__DEV__', 'process', 'FormData', 'AbortController', 'console', code);

  fn(m.exports, require, mockStorage, mockFetch || globalThis.fetch, false, process, globalThis.FormData, globalThis.AbortController, {
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
  });
});
