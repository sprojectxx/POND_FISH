/**
 * Automated Verification Suite: Customer App Phase 3B.2
 * Splash Screen & First-Content Loading Optimization
 * 
 * Verifies:
 * Suite 1: [Production Unit Tests] Startup Session Orchestrator (orchestrateStartupSession)
 *   - 1.1: Valid authenticated session with complete profile transitions to HOME with customer & token
 *   - 1.2: Valid authenticated session with incomplete profile transitions to PROFILE_COMPLETION
 *   - 1.3: No stored credentials transitions to PHONE_AUTH without backend API call
 *   - 1.4: HTTP 401 calls clearAuthTokens with the exact rejected stored.token
 *   - 1.5: HTTP 401: clearAuthTokens returning true permits safe transition to PHONE_AUTH
 *   - 1.6: HTTP 401 Race Protection: clearAuthTokens returning false aborts transition to PHONE_AUTH
 *   - 1.7: HTTP 401 Storage Error: thrown storage-clear exception does not navigate to PHONE_AUTH
 *   - 1.8: HTTP 401 Unmount Safety: component unmount while token-clear is pending prevents navigation
 *   - 1.9: Session validation failure (network/server error) preserves credentials and exposes retry
 *   - 1.10: Slow session validation completes safely without premature resolution
 *   - 1.11: Repeated startup trigger protection prevents concurrent duplicate checks
 *   - 1.12: Component unmount while storage read or API call is pending prevents state/navigation
 * Suite 2: [Production Unit Tests] Navigation Guard & Onboarding Gate (resolveNavigationDecision)
 *   - 2.1: Navigation guard blocks unauthenticated navigation to authenticated screens
 *   - 2.2: Onboarding gate redirects incomplete profiles to PROFILE_COMPLETION
 *   - 2.3: Explicit auth transition with completed profile resolves to HOME
 *   - 2.4: MARKETPLACE alias route resolves to HOME
 * Suite 3: [Static Source Checks] Production Code Structure Invariants
 *   - 3.1: SplashScreen.jsx does not contain artificial setTimeout delays
 *   - 3.2: SplashScreen.jsx imports and utilizes orchestrateStartupSession
 *   - 3.3: startup-session.js exports orchestrateStartupSession
 *   - 3.4: App.jsx imports and delegates to resolveNavigationDecision
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

// Paths for static code inspection
const splashScreenPath = path.resolve(__dirname, '../../customer-app/src/screens/SplashScreen.jsx');
const startupSessionPath = path.resolve(__dirname, '../../customer-app/src/utils/startup-session.js');
const navigationGuardPath = path.resolve(__dirname, '../../customer-app/src/utils/navigation-guard.js');
const appSourcePath = path.resolve(__dirname, '../../customer-app/App.jsx');

describe('Customer App Phase 3B.2 Verification Suite', () => {
  const splashCode = fs.readFileSync(splashScreenPath, 'utf8');
  const startupCode = fs.readFileSync(startupSessionPath, 'utf8');
  const appCode = fs.readFileSync(appSourcePath, 'utf8');

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

    test('1.4: HTTP 401 calls clearAuthTokens with the exact rejected stored.token', async () => {
      let expectedTokenPassed = null;
      const rejectedToken = 'expired-jwt-token-789';

      await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: rejectedToken }),
        clearAuthTokens: async (token) => {
          expectedTokenPassed = token;
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

      assert.equal(expectedTokenPassed, rejectedToken, 'clearAuthTokens must be invoked with the exact rejected stored.token');
    });

    test('1.5: HTTP 401: clearAuthTokens returning true permits safe transition to PHONE_AUTH', async () => {
      let navigatedTo = null;
      const rejectedToken = 'valid-expired-token';

      const result = await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: rejectedToken }),
        clearAuthTokens: async (token) => {
          assert.equal(token, rejectedToken);
          return true; // Token safely cleared
        },
        apiClient: {
          getProfile: async () => {
            const err = new Error('Unauthorized');
            err.status = 401;
            throw err;
          },
        },
        onNavigate: (screen) => { navigatedTo = screen; },
        setError: () => {},
        isCheckingRef: { current: false },
        isMountedRef: { current: true },
      });

      assert.equal(navigatedTo, 'PHONE_AUTH');
      assert.equal(result.destination, 'PHONE_AUTH');
      assert.equal(result.cleared, true);
    });

    test('1.6: HTTP 401 Race Protection: clearAuthTokens returning false aborts transition to PHONE_AUTH', async () => {
      let navigatedTo = null;
      let errorMsg = null;
      const isCheckingRef = { current: false };
      const staleToken = 'stale-token-during-login-race';

      const result = await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: staleToken }),
        clearAuthTokens: async () => {
          // Emulate auth-storage detecting stored token changed before clear
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

    test('1.7: HTTP 401 Storage Error: thrown storage-clear exception does not navigate to PHONE_AUTH', async () => {
      let navigatedTo = null;
      let errorMsg = null;
      const isCheckingRef = { current: false };

      const result = await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: 'token-with-keystore-glitch' }),
        clearAuthTokens: async () => {
          throw new Error('Keystore access failed');
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
      assert.equal(isCheckingRef.current, false, 'isCheckingRef must be reset for recoverable retry');
    });

    test('1.8: HTTP 401 Unmount Safety: component unmount while token-clear is pending prevents navigation', async () => {
      let navigatedTo = null;
      let errorMsg = null;
      const isMountedRef = { current: true };

      const promise = orchestrateStartupSession({
        getAuthTokens: async () => ({ token: 'token-unmount-race' }),
        clearAuthTokens: async () => {
          await new Promise((r) => setTimeout(r, 30));
          // Component unmounts during asynchronous clearAuthTokens execution
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

    test('1.9: Session validation failure (network/server error) preserves credentials and exposes retry', async () => {
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

    test('1.10: Slow session validation completes safely without premature resolution', async () => {
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

    test('1.11: Repeated startup trigger protection prevents concurrent duplicate checks', async () => {
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

    test('1.12: Component unmount while storage read is pending prevents navigation and state updates', async () => {
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
  // SUITE 2: [Production Unit Tests] Navigation Guard & Onboarding Gate
  // =========================================================================
  describe('Suite 2: [Production Unit Tests] Navigation Guard & Onboarding Gate', () => {
    test('2.1: Navigation guard blocks unauthenticated navigation to authenticated screens', () => {
      const decision = resolveNavigationDecision(
        { currentScreen: 'SPLASH', isAuthenticated: false, isProfileComplete: false },
        'HOME'
      );
      assert.equal(decision.blocked, true, 'Unauthenticated attempt to HOME must be blocked');
      assert.equal(decision.nextScreen, 'SPLASH');
    });

    test('2.2: Onboarding gate redirects incomplete profiles to PROFILE_COMPLETION', () => {
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

    test('2.3: Explicit auth transition with completed profile resolves to HOME', () => {
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

    test('2.4: MARKETPLACE alias route resolves to HOME', () => {
      const decision = resolveNavigationDecision(
        { currentScreen: 'HOME', isAuthenticated: true, isProfileComplete: true },
        'MARKETPLACE'
      );
      assert.equal(decision.blocked, false);
      assert.equal(decision.nextScreen, 'HOME', 'MARKETPLACE must resolve to HOME');
    });
  });

  // =========================================================================
  // SUITE 3: [Static Source Checks] Production Code Structure Invariants
  // =========================================================================
  describe('Suite 3: [Static Source Checks] Production Code Structure Invariants', () => {
    test('3.1: [Static Source Check] SplashScreen.jsx does not contain artificial setTimeout delays', () => {
      assert.equal(
        splashCode.includes('setTimeout'),
        false,
        'SplashScreen.jsx must NOT contain setTimeout or artificial delays'
      );
    });

    test('3.2: [Static Source Check] SplashScreen.jsx imports and utilizes orchestrateStartupSession', () => {
      assert.ok(
        splashCode.includes("from '../utils/startup-session'"),
        'SplashScreen.jsx must import orchestrateStartupSession'
      );
      assert.ok(
        splashCode.includes('orchestrateStartupSession({'),
        'SplashScreen.jsx must call orchestrateStartupSession'
      );
    });

    test('3.3: [Static Source Check] startup-session.js exports orchestrateStartupSession', () => {
      assert.ok(
        startupCode.includes('orchestrateStartupSession'),
        'startup-session.js must define orchestrateStartupSession'
      );
      assert.ok(
        startupCode.includes('module.exports = {'),
        'startup-session.js must export orchestrateStartupSession via module.exports'
      );
    });

    test('3.4: [Static Source Check] App.jsx imports and delegates to resolveNavigationDecision', () => {
      assert.ok(
        appCode.includes("from './src/utils/navigation-guard'"),
        'App.jsx must import resolveNavigationDecision from navigation-guard'
      );
      assert.ok(
        appCode.includes('resolveNavigationDecision('),
        'App.jsx must delegate to resolveNavigationDecision'
      );
    });
  });
});
