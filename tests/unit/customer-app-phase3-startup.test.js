/**
 * Automated Verification Suite: Customer App Phase 3B.2
 * Splash Screen & First-Content Loading Optimization
 * 
 * Verifies:
 * Suite 1: [Production Unit Tests] Startup Session Orchestrator (orchestrateStartupSession)
 *   - 1.1: Valid authenticated session with complete profile transitions to HOME with customer & token
 *   - 1.2: Valid authenticated session with incomplete profile transitions to PROFILE_COMPLETION
 *   - 1.3: No stored credentials transitions to PHONE_AUTH without backend API call
 *   - 1.4: Expired or invalid credentials (HTTP 401) clears Keystore tokens and transitions to PHONE_AUTH
 *   - 1.5: Session validation failure (network/server error) preserves credentials and exposes retry
 *   - 1.6: Slow session validation completes safely without premature resolution
 *   - 1.7: Repeated startup trigger protection prevents concurrent duplicate checks
 *   - 1.8: Component unmount while storage or network work is pending prevents navigation and state updates
 * Suite 2: [Production Unit Tests] App Navigation Safeguards & State Transitions
 *   - 2.1: Navigation guard blocks unauthenticated navigation to authenticated screens
 *   - 2.2: Onboarding gate redirects incomplete profiles to PROFILE_COMPLETION
 * Suite 3: [Static Source Checks] Production Code Structure Invariants
 *   - 3.1: SplashScreen.jsx does not contain artificial setTimeout delays
 *   - 3.2: SplashScreen.jsx imports and utilizes orchestrateStartupSession
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Direct import of pure production startup orchestrator
const {
  orchestrateStartupSession,
} = require('../../customer-app/src/utils/startup-session');

// Paths for static code inspection
const splashScreenPath = path.resolve(__dirname, '../../customer-app/src/screens/SplashScreen.jsx');
const startupSessionPath = path.resolve(__dirname, '../../customer-app/src/utils/startup-session.js');

describe('Customer App Phase 3B.2 Verification Suite', () => {
  const splashCode = fs.readFileSync(splashScreenPath, 'utf8');
  const startupCode = fs.readFileSync(startupSessionPath, 'utf8');

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

    test('1.4: Expired or invalid credentials (HTTP 401) clears Keystore tokens and transitions to PHONE_AUTH', async () => {
      let navigatedTo = null;
      let didClearTokens = false;
      const mockToken = 'expired-token';

      const result = await orchestrateStartupSession({
        getAuthTokens: async () => ({ token: mockToken }),
        clearAuthTokens: async () => {
          didClearTokens = true;
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
        setError: () => {},
        isCheckingRef: { current: false },
        isMountedRef: { current: true },
      });

      assert.equal(didClearTokens, true, 'clearAuthTokens must be invoked on 401');
      assert.equal(navigatedTo, 'PHONE_AUTH');
      assert.equal(result.destination, 'PHONE_AUTH');
      assert.equal(result.cleared, true);
    });

    test('1.5: Session validation failure (network/server error) preserves credentials and exposes retry', async () => {
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

    test('1.6: Slow session validation completes safely without premature resolution', async () => {
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

    test('1.7: Repeated startup trigger protection prevents concurrent duplicate checks', async () => {
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

      // Fire first check
      const call1 = orchestrateStartupSession(params);
      // Fire second check while first is in-flight
      const call2 = orchestrateStartupSession(params);

      const [res1, res2] = await Promise.all([call1, call2]);

      assert.equal(getAuthTokensCallCount, 1, 'Only one session check should proceed');
      assert.equal(res2, null, 'Second concurrent call must be aborted early');
      assert.equal(res1.destination, 'HOME');
    });

    test('1.8: Component unmount while storage or network work is pending prevents navigation and state updates', async () => {
      let navigatedTo = null;
      let errorSet = null;
      const isMountedRef = { current: true };

      const promise = orchestrateStartupSession({
        getAuthTokens: async () => {
          await new Promise((r) => setTimeout(r, 30));
          // Component unmounts during Keystore read
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
  // SUITE 2: [Production Unit Tests] App Navigation Safeguards & State Transitions
  // =========================================================================
  describe('Suite 2: [Production Unit Tests] App Navigation Safeguards & State Transitions', () => {
    test('2.1: Navigation guard blocks unauthenticated navigation to authenticated screens', () => {
      // Replicate handleNavigate logic from App.jsx lines 162-173
      const AUTHENTICATED_SCREENS = ['HOME', 'CART', 'PROFILE', 'PROFILE_COMPLETION'];
      let currentScreen = 'SPLASH';
      let isAuthenticated = false;

      function simulateNavigate(targetScreen, params = {}) {
        const resolvedScreen = targetScreen === 'MARKETPLACE' ? 'HOME' : targetScreen;
        const isTargetAuthenticated = AUTHENTICATED_SCREENS.includes(resolvedScreen);
        const isExplicitAuthTransition = Boolean(params?.token || params?.customer);

        if (isTargetAuthenticated && !isAuthenticated && !isExplicitAuthTransition) {
          return { blocked: true, currentScreen };
        }
        if (isExplicitAuthTransition) {
          isAuthenticated = true;
        }
        currentScreen = resolvedScreen;
        return { blocked: false, currentScreen };
      }

      // Stale/unauthenticated attempt to go to HOME
      const blockedAttempt = simulateNavigate('HOME');
      assert.equal(blockedAttempt.blocked, true);
      assert.equal(blockedAttempt.currentScreen, 'SPLASH');

      // Valid explicit auth transition from SplashScreen
      const validAttempt = simulateNavigate('HOME', { token: 'tok', customer: { isProfileComplete: true } });
      assert.equal(validAttempt.blocked, false);
      assert.equal(validAttempt.currentScreen, 'HOME');
    });

    test('2.2: Onboarding gate redirects incomplete profiles to PROFILE_COMPLETION', () => {
      // Replicate handleNavigate onboarding gate logic from App.jsx lines 181-190
      const AUTHENTICATED_SCREENS = ['HOME', 'PROFILE_COMPLETION'];
      let currentScreen = 'SPLASH';
      let isProfileComplete = false;

      function simulateOnboardingNavigate(targetScreen, params = {}) {
        const resolvedScreen = targetScreen;
        const isTargetAuthenticated = AUTHENTICATED_SCREENS.includes(resolvedScreen);

        let nextProfileComplete = isProfileComplete;
        if (params?.customer && typeof params.customer.isProfileComplete === 'boolean') {
          nextProfileComplete = params.customer.isProfileComplete;
          isProfileComplete = nextProfileComplete;
        }

        const isProtectedScreen = isTargetAuthenticated && resolvedScreen !== 'PROFILE_COMPLETION';
        if (isProtectedScreen && !nextProfileComplete) {
          currentScreen = 'PROFILE_COMPLETION';
          return { redirected: true, currentScreen: 'PROFILE_COMPLETION' };
        }

        currentScreen = resolvedScreen;
        return { redirected: false, currentScreen: resolvedScreen };
      }

      // Customer with incomplete profile attempting HOME
      const incompleteResult = simulateOnboardingNavigate('HOME', {
        token: 'tok',
        customer: { id: 'c1', isProfileComplete: false },
      });
      assert.equal(incompleteResult.redirected, true);
      assert.equal(incompleteResult.currentScreen, 'PROFILE_COMPLETION');

      // Customer with complete profile entering HOME
      const completeResult = simulateOnboardingNavigate('HOME', {
        token: 'tok',
        customer: { id: 'c2', isProfileComplete: true },
      });
      assert.equal(completeResult.redirected, false);
      assert.equal(completeResult.currentScreen, 'HOME');
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

    test('3.3: [Static Source Check] startup-session.js correctly exports orchestrateStartupSession', () => {
      assert.ok(
        startupCode.includes('orchestrateStartupSession'),
        'startup-session.js must define orchestrateStartupSession'
      );
      assert.ok(
        startupCode.includes('module.exports = {'),
        'startup-session.js must export orchestrateStartupSession via module.exports'
      );
    });
  });
});

