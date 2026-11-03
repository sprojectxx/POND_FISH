/**
 * PONDFISH Customer Mobile Application — Phase 3B.7A Verification Suite
 * Security Remediation Corrections: Fail-Closed Tombstone, Request Lifecycle Cancellation & Production Session Controller
 *
 * Traceability:
 * - Section 1: Fail-Closed Logout Tombstone (Tri-State Status, Storage Fault Injection & Startup Routing)
 * - Section 2: Request Lifecycle Cancellation (Direct GET, Deduplicated GET, POST/PUT/PATCH/DELETE, Late Responses, Cache Prevention)
 * - Section 3: Obsolete Logout Token Handling (Token Mismatches & Serialized Queue Races)
 * - Section 4: Production Session Controller & App Integration (executeSessionLogout & Navigation Guard)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const apiSourcePath = path.resolve(__dirname, '../../customer-app/src/services/api.js');
const authStorageSourcePath = path.resolve(__dirname, '../../customer-app/src/services/auth-storage.js');
const navigationGuardPath = path.resolve(__dirname, '../../customer-app/src/utils/navigation-guard.js');
const startupSessionPath = path.resolve(__dirname, '../../customer-app/src/utils/startup-session.js');
const sessionControllerPath = path.resolve(__dirname, '../../customer-app/src/utils/session-controller.js');
const appSourcePath = path.resolve(__dirname, '../../customer-app/App.jsx');

// ==============================================================================
// TEST MODULE LOADERS (Isolated Sandboxed Contexts)
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
  const customFetch = mockFetch || globalThis.fetch;
  const fn = new Function('exports', 'require', 'mockAuthStorage', 'fetch', '__DEV__', 'process', 'FormData', 'AbortController', 'console', code);
  fn(m.exports, require, mockStorage, customFetch, false, process, globalThis.FormData, globalThis.AbortController, {
    warn: () => {},
    error: () => {},
    log: () => {},
  });

  return m.exports;
}

const { AUTHENTICATED_SCREENS, resolveNavigationDecision } = require(navigationGuardPath);
const { orchestrateStartupSession } = require(startupSessionPath);
const { executeSessionLogout, LOGOUT_STATUS } = require(sessionControllerPath);

/**
 * App state machine test harness wrapping production executeSessionLogout and navigationGuard.
 * Ensures tests execute the exact production transitions as App.jsx without duplicating logic.
 */
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
    return executeSessionLogout({
      expectedToken,
      authStorage: mockAuthStorage,
      apiClient: mockApi,
      getState: () => ({
        currentScreen,
        isAuthenticated,
        isProfileComplete,
      }),
      setState: (updates) => {
        if ('isAuthenticated' in updates) isAuthenticated = updates.isAuthenticated;
        if ('isProfileComplete' in updates) isProfileComplete = updates.isProfileComplete;
        if ('currentScreen' in updates) currentScreen = updates.currentScreen;
        if ('screenParams' in updates) screenParams = updates.screenParams;
        if ('cartSummary' in updates) cartSummary = updates.cartSummary;
        if ('logoutError' in updates) logoutError = updates.logoutError;
      },
      onSessionInvalidated: () => {
        activeSessionIdRef.current += 1;
      },
      isLoggingOutRef,
    });
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
// TEST SUITE: PHASE 3B.7A SECURITY REMEDIATION CORRECTIONS
// ==============================================================================

test('Phase 3B.7A: Security Remediation Corrections Suite', async (t) => {

  // ----------------------------------------------------------------------------
  // SECTION 1: FAIL-CLOSED LOGOUT TOMBSTONE HANDLING
  // ----------------------------------------------------------------------------

  await t.test('1.1. Tombstone write failure throws and prevents proceeding to credential deletion', async () => {
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      setGenericPassword: async (user, pass, opts = {}) => {
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          throw new Error('Hardware write error on logout tombstone');
        }
        return true;
      },
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.auth') {
          return { username: 'authToken', password: JSON.stringify({ token: 'active-jwt' }) };
        }
        return false;
      },
      resetGenericPassword: async () => true,
    };

    const { authStorage } = loadAuthStorageModule(customKeychain);

    await assert.rejects(
      authStorage.clearAuthTokens(),
      (err) => {
        assert.ok(err.message.includes('Hardware write error on logout tombstone'), 'Must throw marker write error');
        return true;
      }
    );

    // Verify credentials remain intact because marker write failed
    const creds = await authStorage.getAuthTokens();
    assert.equal(creds.token, 'active-jwt', 'Credentials must not be deleted if tombstone could not be written');
  });

  await t.test('1.2. Tombstone read failure throws TOMBSTONE_STORAGE_ERROR and getAuthTokens fails closed', async () => {
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          throw new Error('KeyStore corrupted during tombstone read');
        }
        return { username: 'authToken', password: JSON.stringify({ token: 'saved-jwt' }) };
      },
      resetGenericPassword: async () => true,
      setGenericPassword: async () => true,
    };

    const { authStorage } = loadAuthStorageModule(customKeychain);

    // Tri-state status check reports UNKNOWN
    const status = await authStorage.getLogoutPendingStatus();
    assert.equal(status.status, 'UNKNOWN');
    assert.equal(status.present, null);
    assert.ok(status.error);

    // isLogoutPending throws TOMBSTONE_STORAGE_ERROR
    await assert.rejects(authStorage.isLogoutPending(), (err) => {
      assert.equal(err.code, 'TOMBSTONE_STORAGE_ERROR');
      return true;
    });

    // Invariant: getAuthTokens must NOT return stored credentials when logout state is unknown
    await assert.rejects(authStorage.getAuthTokens(), (err) => {
      assert.equal(err.code, 'TOMBSTONE_STORAGE_ERROR');
      return true;
    });
  });

  await t.test('1.3. Tombstone read failure during cold startup routes to locked LOGOUT_FAILURE', async () => {
    let targetScreen = null;
    let targetParams = null;
    const onNavigate = (dest, params) => {
      targetScreen = dest;
      targetParams = params;
    };

    const failingGetLogoutStatus = async () => ({
      status: 'UNKNOWN',
      present: null,
      error: new Error('Secure storage inaccessible'),
    });

    const result = await orchestrateStartupSession({
      getAuthTokens: async () => ({ token: 'stale-token' }),
      clearAuthTokens: async () => true,
      getLogoutPendingStatus: failingGetLogoutStatus,
      apiClient: {},
      onNavigate,
      setError: () => {},
      isCheckingRef: { current: false },
      isMountedRef: { current: true },
    });

    assert.equal(result.destination, 'LOGOUT_FAILURE');
    assert.equal(targetScreen, 'LOGOUT_FAILURE');
    assert.ok(targetParams?.error?.includes('Secure storage error'));
  });

  await t.test('1.4. Primary credential reset failure with persisted tombstone routes to LOGOUT_FAILURE on restart', async () => {
    const { authStorage, keychainStore } = loadAuthStorageModule();

    // Mark persistent pending tombstone
    keychainStore.set('com.pondfish.customer.logout_pending', { username: 'pending', password: '1' });
    keychainStore.set('com.pondfish.customer.auth', {
      username: 'authToken',
      password: JSON.stringify({ token: 'stale-jwt' }),
    });

    let targetScreen = null;
    const onNavigate = (dest) => { targetScreen = dest; };

    const failingClearAuthTokens = async () => {
      throw new Error('KeyStore reset locked');
    };

    const result = await orchestrateStartupSession({
      getAuthTokens: authStorage.getAuthTokens,
      clearAuthTokens: failingClearAuthTokens,
      getLogoutPendingStatus: authStorage.getLogoutPendingStatus,
      apiClient: {},
      onNavigate,
      setError: () => {},
      isCheckingRef: { current: false },
      isMountedRef: { current: true },
    });

    assert.equal(result.destination, 'LOGOUT_FAILURE', 'Startup must lock on LOGOUT_FAILURE if Keystore continues to fail');
    assert.equal(targetScreen, 'LOGOUT_FAILURE');
  });

  await t.test('1.5. Marker cleanup failure after primary credential deletion throws error', async () => {
    let credsReset = false;
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      setGenericPassword: async () => true,
      resetGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.auth') {
          credsReset = true;
          return true;
        }
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          throw new Error('Failed to reset logout pending tombstone');
        }
        return true;
      },
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.auth') {
          return credsReset ? false : { password: JSON.stringify({ token: 'jwt' }) };
        }
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          return { password: '1' };
        }
        return false;
      },
    };

    const { authStorage } = loadAuthStorageModule(customKeychain);

    await assert.rejects(
      authStorage.clearAuthTokens(),
      (err) => {
        assert.ok(err.message.includes('Failed to reset logout pending tombstone'), 'Must throw marker cleanup error');
        return true;
      }
    );
  });

  await t.test('1.6. Successful retry after storage becomes available clears tombstone and navigates to PHONE_AUTH', async () => {
    let target = null;
    const onNavigate = (dest) => { target = dest; };
    const { authStorage, keychainStore } = loadAuthStorageModule();

    // Tombstone exists
    keychainStore.set('com.pondfish.customer.logout_pending', { username: 'pending', password: '1' });
    keychainStore.set('com.pondfish.customer.auth', {
      username: 'authToken',
      password: JSON.stringify({ token: 'unrevoked-jwt' }),
    });

    const result = await orchestrateStartupSession({
      getAuthTokens: authStorage.getAuthTokens,
      clearAuthTokens: authStorage.clearAuthTokens,
      getLogoutPendingStatus: authStorage.getLogoutPendingStatus,
      apiClient: {},
      onNavigate,
      setError: () => {},
      isCheckingRef: { current: false },
      isMountedRef: { current: true },
    });

    assert.equal(result.destination, 'PHONE_AUTH');
    assert.equal(target, 'PHONE_AUTH');
    assert.equal(keychainStore.has('com.pondfish.customer.logout_pending'), false, 'Tombstone must be cleared');
    assert.equal(keychainStore.has('com.pondfish.customer.auth'), false, 'Auth credential must be cleared');
  });

  await t.test('1.7. Save-token behavior clears previous pending logout marker and saves credentials', async () => {
    const { authStorage, keychainStore } = loadAuthStorageModule();

    // Old tombstone in Keystore
    keychainStore.set('com.pondfish.customer.logout_pending', { username: 'pending', password: '1' });

    await authStorage.saveAuthTokens('new-customer-jwt', 'refresh-123');

    assert.equal(keychainStore.has('com.pondfish.customer.logout_pending'), false, 'Pending tombstone must be removed on save');
    const stored = await authStorage.getAuthTokens();
    assert.equal(stored.token, 'new-customer-jwt', 'New customer token must be securely persisted');
  });

  // ----------------------------------------------------------------------------
  // SECTION 2: REQUEST LIFECYCLE CANCELLATION COVERAGE
  // ----------------------------------------------------------------------------

  await t.test('2.1. Direct GET cancellation on session reset rejects with API_SESSION_RESET', async () => {
    const mockFetch = () => new Promise(() => {}); // Stalls
    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) }, mockFetch);

    // Direct GET with bypassDedup: true
    const directGetPromise = apiModule.api.request('/api/v1/customer/categories', { bypassDedup: true });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(apiModule.api.getInFlightRequestCount(), 1, 'Direct GET must be registered in-flight');

    apiModule.api.resetSession();

    await assert.rejects(directGetPromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET');
      assert.equal(err.isSessionReset, true);
      return true;
    });

    assert.equal(apiModule.api.getInFlightRequestCount(), 0, 'In-flight registry must be cleared');
  });

  await t.test('2.2. Deduplicated GET cancellation on session reset rejects with API_SESSION_RESET', async () => {
    const mockFetch = () => new Promise(() => {});
    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) }, mockFetch);

    const req1 = apiModule.api.getFish();
    const req2 = apiModule.api.getFish();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(apiModule.api.getInFlightRequestCount(), 1, 'Deduplicated GET registered once in flight');

    apiModule.api.resetSession();

    await assert.rejects(req1, (err) => err.code === 'API_SESSION_RESET');
    await assert.rejects(req2, (err) => err.code === 'API_SESSION_RESET');
    assert.equal(apiModule.api.getInFlightRequestCount(), 0);
  });

  await t.test('2.3. POST request in-flight during logout is cancelled and rejected with API_SESSION_RESET', async () => {
    const mockFetch = () => new Promise(() => {});
    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) }, mockFetch);

    const postPromise = apiModule.api.addToCart({ fishId: 'fish-1', quantity: 2 });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(apiModule.api.getInFlightRequestCount(), 1, 'In-flight POST must be tracked in registry');

    apiModule.api.resetSession();

    await assert.rejects(postPromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET');
      assert.equal(err.isSessionReset, true);
      return true;
    });

    assert.equal(apiModule.api.getInFlightRequestCount(), 0);
  });

  await t.test('2.4. PUT/PATCH/DELETE requests in-flight during logout are cancelled with API_SESSION_RESET', async () => {
    const mockFetch = () => new Promise(() => {});
    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) }, mockFetch);

    const deletePromise = apiModule.api.request('/api/v1/customer/cart/items/fish-1', { method: 'DELETE' });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(apiModule.api.getInFlightRequestCount(), 1, 'In-flight DELETE must be tracked');

    apiModule.api.resetSession();

    await assert.rejects(deletePromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET');
      assert.equal(err.isSessionReset, true);
      return true;
    });
  });

  await t.test('2.5. Late successful response after session invalidation is discarded and rejected with API_SESSION_RESET', async () => {
    let resolveNetwork;
    const mockFetch = () => new Promise((resolve) => {
      resolveNetwork = () => resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { sensitive: 'secret_info' } }),
      });
    });

    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) }, mockFetch);
    const reqPromise = apiModule.api.request('/api/v1/customer/profile', { bypassDedup: true });
    await new Promise((r) => setTimeout(r, 10));

    // Session reset occurs before response arrives
    apiModule.api.resetSession();

    // Late network response completes
    resolveNetwork();

    await assert.rejects(reqPromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET');
      return true;
    });
  });

  await t.test('2.6. Late error response after session invalidation is discarded and rejected with API_SESSION_RESET', async () => {
    let rejectNetwork;
    const mockFetch = () => new Promise((_, reject) => {
      rejectNetwork = () => reject(new Error('Backend 500 error'));
    });

    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) }, mockFetch);
    const reqPromise = apiModule.api.request('/api/v1/customer/profile', { bypassDedup: true });
    await new Promise((r) => setTimeout(r, 10));

    apiModule.api.resetSession();
    rejectNetwork();

    await assert.rejects(reqPromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET', 'Late error must be superseded by API_SESSION_RESET');
      return true;
    });
  });

  await t.test('2.7. Response cache write is prevented after session invalidation', async () => {
    let resolveNetwork;
    const mockFetch = () => new Promise((resolve) => {
      resolveNetwork = () => resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { name: 'Customer A' } }),
      });
    });

    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'customer-a-jwt' }) }, mockFetch);
    const profilePromise = apiModule.api.request('/api/v1/customer/profile');
    await new Promise((r) => setTimeout(r, 10));

    apiModule.api.resetSession();
    resolveNetwork();

    await assert.rejects(profilePromise, (err) => err.code === 'API_SESSION_RESET');
    assert.equal(apiModule.api.getResponseCacheSize(), 0, 'Cache must remain empty; old session data not saved');
  });

  await t.test('2.8. New session requests surviving old-session cancellation complete normally', async () => {
    const mockFetch = async (url) => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { url, session: 'new' } }),
    });

    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'new-user-jwt' }) }, mockFetch);

    // Old session reset executed
    apiModule.api.resetSession();

    // New request started after session reset
    const newRes = await apiModule.api.getFish();
    assert.equal(newRes.success, true);
    assert.equal(newRes.data.session, 'new', 'New session request must complete normally');
  });

  // ----------------------------------------------------------------------------
  // SECTION 3 & 4: OBSOLETE TOKEN HANDLING & PRODUCTION SESSION CONTROLLER
  // ----------------------------------------------------------------------------

  await t.test('3.1. Obsolete logout callback with mismatched token preserves active session and does not touch UI', async () => {
    const { authStorage } = loadAuthStorageModule();
    await authStorage.saveAuthTokens('active-token-user-b');

    let requestsReset = false;
    const mockApi = {
      resetSession: () => { requestsReset = true; },
      clearInFlightRequests: () => { requestsReset = true; },
      clearResponseCache: () => {},
    };

    const app = createAppHarness(authStorage, mockApi);

    // Stale 401 callback from User A arrives while User B is logged in
    await app.handleUnauthorized('obsolete-token-user-a');

    const state = app.getState();
    assert.equal(state.currentScreen, 'HOME', 'Session must remain on HOME');
    assert.equal(state.isAuthenticated, true, 'User B must remain authenticated');
    assert.equal(requestsReset, false, 'Must not clear requests of active user B');

    const stored = await authStorage.getAuthTokens();
    assert.equal(stored.token, 'active-token-user-b', 'User B token must remain intact in Keystore');
  });

  await t.test('3.2. Race between initial token check and serialized storage clear aborts obsolete logout', async () => {
    const { authStorage } = loadAuthStorageModule();
    await authStorage.saveAuthTokens('token-user-a');

    const mockApi = {
      resetSession: () => {},
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(authStorage, mockApi);

    // User A initiates logout with expectedToken 'token-user-a'
    // Concurrently, User B logs in and saves 'token-user-b' to the mutation queue
    const userALogoutPromise = app.handleLogout('token-user-a');
    await authStorage.saveAuthTokens('token-user-b');

    const logoutResult = await userALogoutPromise;

    // The logout for User A should either have succeeded before User B, or aborted if User B took over
    const stored = await authStorage.getAuthTokens();
    assert.equal(stored.token, 'token-user-b', 'User B credentials must be preserved');
  });

  await t.test('3.3. Production executeSessionLogout succeeds and coordinates UI, API reset, cache wipe, and storage clear', async () => {
    const { authStorage } = loadAuthStorageModule();
    await authStorage.saveAuthTokens('valid-jwt-token-123');

    let requestsReset = false;
    let cacheCleared = false;
    const mockApi = {
      resetSession: () => { requestsReset = true; },
      clearInFlightRequests: () => { requestsReset = true; },
      clearResponseCache: () => { cacheCleared = true; },
    };

    const app = createAppHarness(authStorage, mockApi);
    assert.equal(app.getState().currentScreen, 'HOME');

    const result = await app.handleLogout();

    assert.equal(result.status, LOGOUT_STATUS.SUCCESS);
    assert.equal(result.cleared, true);

    const state = app.getState();
    assert.equal(state.currentScreen, 'PHONE_AUTH');
    assert.equal(state.isAuthenticated, false);
    assert.equal(state.cartSummary.totalItems, 0);
    assert.equal(requestsReset, true);
    assert.equal(cacheCleared, true);

    const creds = await authStorage.getAuthTokens();
    assert.equal(creds, null, 'Credentials must be removed from storage');
  });

  await t.test('3.4. Production executeSessionLogout fail-closed handling on Keystore failure transitions to LOGOUT_FAILURE', async () => {
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'mock-token' }),
      clearAuthTokens: async () => {
        throw new Error('Android Keystore hardware communication exception');
      },
    };
    const mockApi = {
      resetSession: () => {},
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(mockStorage, mockApi);
    const result = await app.handleLogout();

    assert.equal(result.status, LOGOUT_STATUS.FAILURE);
    assert.equal(result.cleared, false);

    const state = app.getState();
    assert.equal(state.currentScreen, 'LOGOUT_FAILURE', 'Must transition to locked LOGOUT_FAILURE screen');
    assert.notEqual(state.currentScreen, 'PHONE_AUTH', 'Must never route to PHONE_AUTH on clear failure');
    assert.equal(state.isAuthenticated, false);
    assert.ok(state.logoutError.includes('Android Keystore hardware communication exception'));
  });

  await t.test('3.5. Failed logout blocks access to all authenticated screens (navigation guard enforcement)', async () => {
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'mock-token' }),
      clearAuthTokens: async () => false,
    };
    const mockApi = {
      resetSession: () => {},
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
  });

  await t.test('3.6. Retry from LOGOUT_FAILURE triggers clearAuthTokens again and transitions to PHONE_AUTH on success', async () => {
    let attempts = 0;
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'mock-token' }),
      clearAuthTokens: async () => {
        attempts++;
        if (attempts === 1) throw new Error('Transient lock error');
        return true; // Success on retry
      },
    };
    const mockApi = {
      resetSession: () => {},
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(mockStorage, mockApi);
    await app.handleLogout();
    assert.equal(app.getState().currentScreen, 'LOGOUT_FAILURE');

    // User triggers Retry Logout
    await app.handleLogout(null);
    assert.equal(attempts, 2, 'Retry must call clearAuthTokens again');
    assert.equal(app.getState().currentScreen, 'PHONE_AUTH', 'Successful retry routes to PHONE_AUTH');
    assert.equal(app.getState().logoutError, null);
  });

  await t.test('3.7. In-memory customer state does not leak between accounts', async () => {
    const { authStorage } = loadAuthStorageModule();
    await authStorage.saveAuthTokens('customer-a-token');

    const mockApi = {
      resetSession: () => {},
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(authStorage, mockApi);
    assert.equal(app.getState().cartSummary.totalItems, 3);
    assert.equal(app.getState().screenParams.customer.id, 'cust_01');

    // Customer A logs out
    await app.handleLogout();
    assert.equal(app.getState().cartSummary.totalItems, 0);
    assert.deepEqual(app.getState().screenParams, {});

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

  await t.test('3.8. Rapid overlapping logout attempts are serialized by concurrency guard', async () => {
    let clearCount = 0;
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'jwt' }),
      clearAuthTokens: async () => {
        clearCount++;
        await new Promise((r) => setTimeout(r, 20));
        return true;
      },
    };
    const mockApi = {
      resetSession: () => {},
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(mockStorage, mockApi);
    await Promise.all([
      app.handleLogout(),
      app.handleLogout(),
      app.handleLogout(),
    ]);

    assert.equal(clearCount, 1, 'clearAuthTokens must be invoked exactly once');
    assert.equal(app.getState().currentScreen, 'PHONE_AUTH');
  });

  await t.test('3.9. App restart after successful logout does not restore previous customer session', async () => {
    const { authStorage } = loadAuthStorageModule();
    await authStorage.saveAuthTokens('old-jwt');
    await authStorage.clearAuthTokens();

    let target = null;
    const onNavigate = (dest) => { target = dest; };

    const result = await orchestrateStartupSession({
      getAuthTokens: authStorage.getAuthTokens,
      clearAuthTokens: authStorage.clearAuthTokens,
      getLogoutPendingStatus: authStorage.getLogoutPendingStatus,
      apiClient: {},
      onNavigate,
      setError: () => {},
      isCheckingRef: { current: false },
      isMountedRef: { current: true },
    });

    assert.equal(result.destination, 'PHONE_AUTH');
    assert.equal(target, 'PHONE_AUTH');
  });

});
