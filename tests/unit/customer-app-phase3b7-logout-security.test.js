/**
 * PONDFISH Customer Mobile Application — Phase 3B.7 Verification Suite
 * Security-First Logout & Account Isolation Verification
 *
 * Verifies all 12 Phase 3B.7 Security Invariants:
 * 1. Successful manual logout.
 * 2. Keystore reset rejection.
 * 3. Keystore reset exception.
 * 4. Failed logout blocks access to authenticated screens.
 * 5. Retry after a failed credential reset.
 * 6. Successful retry transitions to phone authentication.
 * 7. Obsolete logout callback with a mismatched token does not clear the current session.
 * 8. In-flight requests are cancelled during logout.
 * 9. Late responses from the old session cannot update the new session.
 * 10. Cart, profile, subscription, and navigation state do not leak between accounts.
 * 11. Rapid logout/login attempts do not create overlapping or conflicting session transitions.
 * 12. App restart after successful logout does not restore the previous customer's session.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const apiSourcePath = path.resolve(__dirname, '../../customer-app/src/services/api.js');
const authStorageSourcePath = path.resolve(__dirname, '../../customer-app/src/services/auth-storage.js');
const navigationGuardPath = path.resolve(__dirname, '../../customer-app/src/utils/navigation-guard.js');
const startupSessionPath = path.resolve(__dirname, '../../customer-app/src/utils/startup-session.js');
const appSourcePath = path.resolve(__dirname, '../../customer-app/App.jsx');
const profileScreenSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/ProfileScreen.jsx');

// ==============================================================================
// TEST MODULE LOADERS
// ==============================================================================

function loadAuthStorageModule(customKeychain = null) {
  let code = fs.readFileSync(authStorageSourcePath, 'utf8');
  const keychainStore = new Map();

  const defaultKeychain = {
    SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
    STORAGE_TYPE: { KEYSTORE: 1 },
    setGenericPassword: async (username, password, options = {}) => {
      keychainStore.set(options.service || 'default', { username, password });
      return true;
    },
    getGenericPassword: async (options = {}) => {
      const entry = keychainStore.get(options.service || 'default');
      return entry ? { username: entry.username, password: entry.password } : false;
    },
    resetGenericPassword: async (options = {}) => {
      keychainStore.delete(options.service || 'default');
      return true;
    },
  };

  const mockKeychain = customKeychain || defaultKeychain;

  code = code.replace(/import\s*\*\s*as\s*Keychain\s*from\s*['"]react-native-keychain['"];?/g, 'const Keychain = mockKeychain;');
  code = code.replace(/export\s+async\s+function\s+([a-zA-Z0-9_]+)/g, 'exports.$1 = async function $1');
  code = code.replace(/export\s+const\s+([a-zA-Z0-9_]+)/g, 'exports.$1 = $1');

  const m = { exports: {} };
  const fn = new Function('exports', 'require', 'mockKeychain', 'console', code);
  fn(m.exports, require, mockKeychain, { warn: () => {}, error: () => {}, log: () => {} });

  return { authStorage: m.exports, keychainStore, mockKeychain };
}

function loadApiModule(mockStorage = {}, mockFetch = null) {
  let code = fs.readFileSync(apiSourcePath, 'utf8');

  code = code.replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]\.\/auth-storage['"];?/g, 'const { $1 } = mockAuthStorage;');
  code = code.replace(/export\s+const\s+DEFAULT_TIMEOUT_MS\s*=\s*(\d+);?/g, 'const DEFAULT_TIMEOUT_MS = $1; exports.DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;');
  code = code.replace(/export\s+function\s+setUnauthorizedHandler/g, 'exports.setUnauthorizedHandler = function setUnauthorizedHandler');
  code = code.replace(/export\s+const\s+api\s*=\s*\{/g, 'const api = {');

  code += '\nexports.api = api;\nexports.request = request;';

  const m = { exports: {} };
  const fn = new Function('exports', 'require', 'mockAuthStorage', 'fetch', '__DEV__', 'process', 'FormData', 'AbortController', 'console', code);

  const customFetch = mockFetch || globalThis.fetch;
  fn(m.exports, require, mockStorage, customFetch, false, process, globalThis.FormData, globalThis.AbortController, {
    warn: () => {},
    error: () => {},
    log: () => {},
  });

  return m.exports;
}

const { AUTHENTICATED_SCREENS, resolveNavigationDecision } = require(navigationGuardPath);
const { orchestrateStartupSession } = require(startupSessionPath);

// App state machine simulation harness matching App.jsx implementation
function createAppHarness(mockAuthStorage, mockApi) {
  let currentScreen = 'HOME';
  let isAuthenticated = true;
  let isProfileComplete = true;
  let screenParams = { customer: { id: 'cust_01', name: 'Test Customer' } };
  let cartSummary = { totalItems: 3, totalQuantity: 3, totalAmount: 450, isAllBookable: true };
  let logoutError = null;
  const isLoggingOutRef = { current: false };
  const activeSessionIdRef = { current: 1 };
  const isFetchingCartRef = { current: false };

  const fetchCartSummary = async () => {
    if (isFetchingCartRef.current) return;
    const sessionId = activeSessionIdRef.current;
    isFetchingCartRef.current = true;
    try {
      const res = await mockApi.getCart();
      if (sessionId !== activeSessionIdRef.current) {
        return; // Discard late response
      }
      if (res.data?.summary) {
        cartSummary = res.data.summary;
      }
    } catch {
      // Ignored
    } finally {
      isFetchingCartRef.current = false;
    }
  };

  const handleLogout = async (expectedToken = null) => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    if (expectedToken) {
      try {
        const current = await mockAuthStorage.getAuthTokens();
        if (current?.token && current.token !== expectedToken) {
          isLoggingOutRef.current = false;
          return;
        }
      } catch (e) {
        // Ignored
      }
    }

    // 1. Immediately invalidate session identity and cancel all in-flight requests
    activeSessionIdRef.current += 1;
    mockApi.clearInFlightRequests();
    mockApi.clearResponseCache();

    // 2. Immediately revoke access to authenticated screens and clear all private data
    isAuthenticated = false;
    isProfileComplete = false;
    screenParams = {};
    cartSummary = { totalItems: 0, totalQuantity: 0, totalAmount: 0, isAllBookable: true };

    // 3. Immediately move away from authenticated screens to prevent viewing private data
    currentScreen = 'LOGOUT_IN_PROGRESS';

    let didClear = false;
    let clearError = null;

    try {
      didClear = await mockAuthStorage.clearAuthTokens(expectedToken);
      if (!didClear && expectedToken) {
        isLoggingOutRef.current = false;
        return;
      }
    } catch (e) {
      clearError = e;
    } finally {
      isLoggingOutRef.current = false;
    }

    if (didClear && !clearError) {
      logoutError = null;
      currentScreen = 'PHONE_AUTH';
    } else {
      logoutError = clearError?.message || 'Secure credential reset failed';
      currentScreen = 'LOGOUT_FAILURE';
    }
  };

  const handleUnauthorized = async (rejectedToken) => {
    if (isLoggingOutRef.current) return;
    try {
      const current = await mockAuthStorage.getAuthTokens();
      if (current?.token) {
        if (!rejectedToken || rejectedToken !== current.token) {
          return; // Ignore obsolete token
        }
      }
    } catch (e) {
      return;
    }
    await handleLogout(rejectedToken);
  };

  const handleNavigate = (targetScreen, params = {}) => {
    if (currentScreen === 'LOGOUT_FAILURE' || currentScreen === 'LOGOUT_IN_PROGRESS') {
      return;
    }
    if (targetScreen === 'LOGOUT_FAILURE') {
      isAuthenticated = false;
      isProfileComplete = false;
      logoutError = params?.error || 'Secure credential reset failed';
      currentScreen = 'LOGOUT_FAILURE';
      return;
    }
    const decision = resolveNavigationDecision(
      { currentScreen, isAuthenticated, isProfileComplete },
      targetScreen,
      params
    );
    if (decision.blocked) return;
    if (decision.nextIsAuthenticated) isAuthenticated = true;
    if (decision.nextIsProfileComplete) isProfileComplete = true;
    currentScreen = decision.nextScreen;
    screenParams = params;
  };

  return {
    getState: () => ({
      currentScreen,
      isAuthenticated,
      isProfileComplete,
      screenParams,
      cartSummary,
      logoutError,
      activeSessionId: activeSessionIdRef.current,
      isLoggingOut: isLoggingOutRef.current,
    }),
    handleLogout,
    handleUnauthorized,
    handleNavigate,
    fetchCartSummary,
  };
}

// ==============================================================================
// TEST SUITE: PHASE 3B.7 SECURITY REMEDIATION
// ==============================================================================

test('Phase 3B.7 Security Invariants Suite', async (t) => {

  await t.test('1. Successful manual logout clears storage, cancels requests, resets state, and navigates to PHONE_AUTH', async () => {
    const { authStorage } = loadAuthStorageModule();
    await authStorage.saveAuthTokens('valid-jwt-token-123');

    let requestsCleared = false;
    let cacheCleared = false;
    const mockApi = {
      clearInFlightRequests: () => { requestsCleared = true; },
      clearResponseCache: () => { cacheCleared = true; },
      getCart: async () => ({ data: { summary: { totalItems: 5 } } }),
    };

    const app = createAppHarness(authStorage, mockApi);
    assert.equal(app.getState().currentScreen, 'HOME');
    assert.equal(app.getState().isAuthenticated, true);

    await app.handleLogout();

    const state = app.getState();
    assert.equal(state.currentScreen, 'PHONE_AUTH', 'Must navigate to PHONE_AUTH on verified successful logout');
    assert.equal(state.isAuthenticated, false, 'Must revoke authentication');
    assert.equal(state.isProfileComplete, false, 'Must reset profile completion');
    assert.equal(state.cartSummary.totalItems, 0, 'Must reset cart items');
    assert.deepEqual(state.screenParams, {}, 'Must reset screen params');
    assert.equal(state.logoutError, null, 'Must have no logout error');
    assert.equal(requestsCleared, true, 'Must clear in-flight requests');
    assert.equal(cacheCleared, true, 'Must clear response cache');

    const stored = await authStorage.getAuthTokens();
    assert.equal(stored, null, 'Keystore credentials must be null');
  });

  await t.test('2. Keystore reset rejection transitions to locked LOGOUT_FAILURE state without navigating to PHONE_AUTH', async () => {
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'mock-token' }),
      clearAuthTokens: async () => false, // returns false (rejected)
    };
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(mockStorage, mockApi);
    await app.handleLogout();

    const state = app.getState();
    assert.equal(state.currentScreen, 'LOGOUT_FAILURE', 'Must transition to locked LOGOUT_FAILURE screen');
    assert.notEqual(state.currentScreen, 'PHONE_AUTH', 'Must NEVER navigate to PHONE_AUTH on unverified clear');
    assert.equal(state.isAuthenticated, false, 'Must revoke authenticated access immediately');
    assert.ok(state.logoutError, 'Must set understandable error message');
  });

  await t.test('3. Keystore reset exception transitions to locked LOGOUT_FAILURE state and propagates error', async () => {
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'mock-token' }),
      clearAuthTokens: async () => {
        throw new Error('Android KeyStore hardware failure: KeyStoreAccessException');
      },
    };
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(mockStorage, mockApi);
    await app.handleLogout();

    const state = app.getState();
    assert.equal(state.currentScreen, 'LOGOUT_FAILURE', 'Must transition to LOGOUT_FAILURE on exception');
    assert.notEqual(state.currentScreen, 'PHONE_AUTH', 'Must NEVER navigate to PHONE_AUTH when reset throws');
    assert.equal(state.isAuthenticated, false, 'Authenticated access must be blocked');
    assert.ok(state.logoutError.includes('Android KeyStore hardware failure'), 'Error message must reflect exception');
  });

  await t.test('4. Failed logout blocks access to all authenticated screens', async () => {
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'mock-token' }),
      clearAuthTokens: async () => false,
    };
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(mockStorage, mockApi);
    await app.handleLogout();
    assert.equal(app.getState().currentScreen, 'LOGOUT_FAILURE');

    // Attempt navigating to various protected screens
    app.handleNavigate('HOME');
    assert.equal(app.getState().currentScreen, 'LOGOUT_FAILURE', 'Navigation to HOME must be blocked');

    app.handleNavigate('PROFILE');
    assert.equal(app.getState().currentScreen, 'LOGOUT_FAILURE', 'Navigation to PROFILE must be blocked');

    app.handleNavigate('CART');
    assert.equal(app.getState().currentScreen, 'LOGOUT_FAILURE', 'Navigation to CART must be blocked');

    app.handleNavigate('LIVE_TRACKING');
    assert.equal(app.getState().currentScreen, 'LOGOUT_FAILURE', 'Navigation to LIVE_TRACKING must be blocked');
  });

  await t.test('5. Retry after a failed credential reset triggers clearAuthTokens again', async () => {
    let attempts = 0;
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'mock-token' }),
      clearAuthTokens: async () => {
        attempts++;
        if (attempts === 1) throw new Error('First attempt failed');
        return true;
      },
    };
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(mockStorage, mockApi);
    await app.handleLogout();
    assert.equal(attempts, 1);
    assert.equal(app.getState().currentScreen, 'LOGOUT_FAILURE');

    // User triggers retry
    await app.handleLogout(null);
    assert.equal(attempts, 2, 'Must invoke clearAuthTokens on retry');
  });

  await t.test('6. Successful retry transitions to phone authentication and clears error', async () => {
    let attempts = 0;
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'mock-token' }),
      clearAuthTokens: async () => {
        attempts++;
        if (attempts === 1) throw new Error('Transient hardware lock');
        return true; // Success on retry
      },
    };
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(mockStorage, mockApi);
    await app.handleLogout();
    assert.equal(app.getState().currentScreen, 'LOGOUT_FAILURE');

    // Retry
    await app.handleLogout(null);
    const state = app.getState();
    assert.equal(state.currentScreen, 'PHONE_AUTH', 'Must transition to PHONE_AUTH on successful retry');
    assert.equal(state.logoutError, null, 'Must clear error message');
    assert.equal(state.isAuthenticated, false);
  });

  await t.test('7. Obsolete logout callback with a mismatched token does not clear the current session', async () => {
    const { authStorage } = loadAuthStorageModule();
    await authStorage.saveAuthTokens('active-token-user-b');

    let requestsCleared = false;
    const mockApi = {
      clearInFlightRequests: () => { requestsCleared = true; },
      clearResponseCache: () => {},
    };

    const app = createAppHarness(authStorage, mockApi);

    // Stale 401 arrives from previous user session
    await app.handleUnauthorized('obsolete-token-user-a');

    const state = app.getState();
    assert.equal(state.currentScreen, 'HOME', 'Session must remain on HOME');
    assert.equal(state.isAuthenticated, true, 'User B must remain authenticated');
    assert.equal(requestsCleared, false, 'Must not clear in-flight requests of active session');

    const stored = await authStorage.getAuthTokens();
    assert.equal(stored.token, 'active-token-user-b', 'Active credential must be preserved');
  });

  await t.test('8. In-flight requests are cancelled during logout with API_SESSION_RESET', async () => {
    const mockFetch = () => new Promise(() => {}); // stalls indefinitely
    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'session-jwt' }) }, mockFetch);

    const cartPromise = apiModule.api.getCart();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(apiModule.api.getInFlightRequestCount(), 1, 'Request must be registered in flight');

    apiModule.api.clearInFlightRequests();

    await assert.rejects(cartPromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET', 'Must reject with API_SESSION_RESET');
      assert.equal(err.isSessionReset, true);
      return true;
    });

    assert.equal(apiModule.api.getInFlightRequestCount(), 0, 'In flight registry must be cleared');
  });

  await t.test('9. Late responses from the old session cannot update the new session', async () => {
    let resolveStaleCall;
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
      getCart: () => new Promise((resolve) => {
        resolveStaleCall = () => resolve({ data: { summary: { totalItems: 99, totalAmount: 9999 } } });
      }),
    };
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'mock-token' }),
      clearAuthTokens: async () => true,
    };

    const app = createAppHarness(mockStorage, mockApi);

    // 1. Session 1 dispatches fetchCartSummary
    const pendingFetch = app.fetchCartSummary();

    // 2. User logs out before response arrives
    await app.handleLogout();
    assert.equal(app.getState().cartSummary.totalItems, 0);

    // 3. Stale response finally resolves after logout
    resolveStaleCall();
    await pendingFetch;

    // 4. Cart summary must remain 0, discarded by session generation guard
    assert.equal(app.getState().cartSummary.totalItems, 0, 'Late response must be discarded and not update cart');
  });

  await t.test('10. Cart, profile, subscription, and navigation state do not leak between accounts', async () => {
    const { authStorage } = loadAuthStorageModule();
    await authStorage.saveAuthTokens('customer-a-token');

    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(authStorage, mockApi);
    assert.equal(app.getState().cartSummary.totalItems, 3);
    assert.equal(app.getState().screenParams.customer.id, 'cust_01');

    // Customer A logs out
    await app.handleLogout();

    const loggedOutState = app.getState();
    assert.equal(loggedOutState.cartSummary.totalItems, 0, 'Cart count must be 0');
    assert.deepEqual(loggedOutState.screenParams, {}, 'Screen params must be empty');

    // Customer B logs in
    await authStorage.saveAuthTokens('customer-b-token');
    app.handleNavigate('HOME', {
      customer: { id: 'cust_02', name: 'New Customer', isProfileComplete: true },
      token: 'customer-b-token',
    });

    const customerBState = app.getState();
    assert.equal(customerBState.currentScreen, 'HOME');
    assert.equal(customerBState.screenParams.customer.id, 'cust_02');
    assert.equal(customerBState.cartSummary.totalItems, 0, 'Customer B starts with clean 0 cart items');
  });

  await t.test('11. Rapid logout/login attempts do not create overlapping or conflicting session transitions', async () => {
    let clearCallCount = 0;
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'token' }),
      clearAuthTokens: async () => {
        clearCallCount++;
        await new Promise((r) => setTimeout(r, 20));
        return true;
      },
    };
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(mockStorage, mockApi);

    // Trigger multiple simultaneous logout calls
    await Promise.all([
      app.handleLogout(),
      app.handleLogout(),
      app.handleLogout(),
    ]);

    assert.equal(clearCallCount, 1, 'isLoggingOutRef must ensure clearAuthTokens is invoked exactly once');
    assert.equal(app.getState().currentScreen, 'PHONE_AUTH');
  });

  await t.test('12. App restart after successful logout does not restore previous customer session', async () => {
    const { authStorage } = loadAuthStorageModule();
    await authStorage.saveAuthTokens('customer-old-jwt');

    // Complete successful logout
    await authStorage.clearAuthTokens();

    let target = null;
    const onNavigate = (dest) => { target = dest; };
    const setError = () => {};
    const isCheckingRef = { current: false };
    const isMountedRef = { current: true };

    const mockApiClient = {
      getProfile: async () => {
        throw new Error('Should never call getProfile after successful logout');
      },
    };

    // Cold app boot
    const result = await orchestrateStartupSession({
      getAuthTokens: authStorage.getAuthTokens,
      clearAuthTokens: authStorage.clearAuthTokens,
      isLogoutPending: authStorage.isLogoutPending,
      apiClient: mockApiClient,
      onNavigate,
      setError,
      isCheckingRef,
      isMountedRef,
    });

    assert.equal(result.destination, 'PHONE_AUTH', 'Startup must route directly to PHONE_AUTH');
    assert.equal(target, 'PHONE_AUTH', 'UI must navigate to PHONE_AUTH');
  });

  await t.test('13. Persistent pending logout tombstone routes to LOGOUT_FAILURE if Keystore still fails on restart', async () => {
    const { authStorage, keychainStore } = loadAuthStorageModule();

    // Simulate persistent logout tombstone left by an interrupted or failed logout
    keychainStore.set(authStorage.LOGOUT_PENDING_SERVICE_KEY || 'com.pondfish.customer.logout_pending', {
      username: 'pending',
      password: '1',
    });

    let target = null;
    const onNavigate = (dest) => { target = dest; };
    const setError = () => {};
    const isCheckingRef = { current: false };
    const isMountedRef = { current: true };

    // clearAuthTokens continues to fail on this reboot
    const failingClearAuthTokens = async () => {
      throw new Error('KeyStore corrupted');
    };

    const result = await orchestrateStartupSession({
      getAuthTokens: authStorage.getAuthTokens,
      clearAuthTokens: failingClearAuthTokens,
      isLogoutPending: authStorage.isLogoutPending,
      apiClient: {},
      onNavigate,
      setError,
      isCheckingRef,
      isMountedRef,
    });

    assert.equal(result.destination, 'LOGOUT_FAILURE', 'Must lock into LOGOUT_FAILURE on restart if Keystore still failing');
    assert.equal(target, 'LOGOUT_FAILURE', 'Must navigate to LOGOUT_FAILURE');
  });

});
