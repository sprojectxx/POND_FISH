/**
 * PONDFISH Customer Mobile Application — Phase 3B.7B Verification Suite
 * Security Remediation Corrections: Strict Keychain Verification, Async Auth Race Closure,
 * Complete HTTP-Method Regression, Production Session Controller & Actual App.jsx Integration
 *
 * Traceability:
 * - Section 1: Strict Keychain Verification & Fault Injection (Boolean Returns, Malformed Tombstones, Deletion Verification)
 * - Section 2: Async Authentication Lookup Race & HTTP-Method Regression (Deterministic Deferred Tests & POST/PUT/PATCH/DELETE/GET)
 * - Section 3: Production Session Controller & Account Isolation (executeSessionLogout, Concurrency Guard & Invariant Enforcement)
 * - Section 4: Actual App.jsx Integration Coverage (Babel-Transformed Production App Component Execution)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Configure resolution paths for React Native dependencies
process.env.NODE_PATH = [path.resolve(__dirname, '../../node_modules'), path.resolve(__dirname, '../../customer-app/node_modules')].join(path.delimiter);
require('module').Module._initPaths();

const apiSourcePath = path.resolve(__dirname, '../../customer-app/src/services/api.js');
const authStorageSourcePath = path.resolve(__dirname, '../../customer-app/src/services/auth-storage.js');
const navigationGuardPath = path.resolve(__dirname, '../../customer-app/src/utils/navigation-guard.js');
const startupSessionPath = path.resolve(__dirname, '../../customer-app/src/utils/startup-session.js');
const sessionControllerPath = path.resolve(__dirname, '../../customer-app/src/utils/session-controller.js');
const appSourcePath = path.resolve(__dirname, '../../customer-app/App.jsx');

// Helper to create deterministic deferred promises
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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
          return { status: LOGOUT_STATUS.ABORTED_OBSOLETE, cleared: false };
        }
      }
    } catch (e) {
      return;
    }
    return handleLogout(rejectedToken);
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

/**
 * Loads and evaluates the actual production App.jsx component via Babel transformation.
 * This harness is a synchronous headless hook runner simulating React hook dispatching
 * (useState, useRef, useCallback, useEffect) and React Native UI stubs, connecting directly
 * to production App state, hook slots, and screen props without running a native React Native bridge
 * or full Fiber reconciler.
 */
function loadTransformedApp(mockDependencies = {}) {
  const babel = require('@babel/core');
  const code = fs.readFileSync(appSourcePath, 'utf8');
  const preset = require.resolve('metro-react-native-babel-preset');
  const transformed = babel.transformSync(code, {
    presets: [preset],
    configFile: false,
    babelrc: false,
    filename: 'App.jsx',
  }).code;

  let capturedUnauthorizedHandler = null;
  const renderedScreens = [];
  const capturedScreenProps = {};

  const stateValues = [];
  const stateSetters = [];
  const refValues = [];
  let isExecuting = false;

  let stateCursor = 0;
  let refCursor = 0;

  let appInstance = null;

  function runRender() {
    stateCursor = 0;
    refCursor = 0;
    renderedScreens.length = 0;
    if (appInstance) {
      return appInstance();
    }
  }

  const customRequire = (id) => {
    if (id.startsWith('@babel/runtime')) {
      return require(id);
    }
    if (id === 'react') {
      return {
        useState: (initial) => {
          const idx = stateCursor++;
          if (stateValues.length <= idx) {
            stateValues[idx] = typeof initial === 'function' ? initial() : initial;
            stateSetters[idx] = (updater) => {
              const nextVal = typeof updater === 'function' ? updater(stateValues[idx]) : updater;
              stateValues[idx] = nextVal;
              if (!isExecuting) {
                isExecuting = true;
                try {
                  runRender();
                } finally {
                  isExecuting = false;
                }
              }
            };
          }
          return [stateValues[idx], stateSetters[idx]];
        },
        useRef: (initial) => {
          const idx = refCursor++;
          if (refValues.length <= idx) {
            refValues[idx] = { current: initial };
          }
          return refValues[idx];
        },
        useCallback: (fn, _deps) => fn,
        useMemo: (fn, _deps) => fn(),
        useEffect: (fn, _deps) => {
          try {
            fn();
          } catch (_) {}
        },
        createElement: (comp, props, ...children) => {
          if (typeof comp === 'function') {
            return comp(props);
          }
          return { type: comp, props, children };
        },
      };
    }
    if (id === 'react/jsx-runtime') {
      return {
        jsx: (comp, props) => {
          if (typeof comp === 'function') {
            return comp(props);
          }
          return { type: comp, props };
        },
        jsxs: (comp, props) => {
          if (typeof comp === 'function') {
            return comp(props);
          }
          return { type: comp, props };
        },
        Fragment: ({ children }) => children,
      };
    }
    if (id === 'react-native') {
      return {
        StyleSheet: { create: (obj) => obj },
        BackHandler: { addEventListener: () => ({ remove: () => {} }), exitApp: () => {} },
        StatusBar: () => null,
        SafeAreaView: (props) => props?.children || null,
        View: (props) => props?.children || null,
        Text: (props) => props?.children || null,
        ActivityIndicator: () => null,
        TouchableOpacity: (props) => {
          if (props?.accessibilityLabel === 'Retry Secure Logout') {
            capturedScreenProps['LOGOUT_FAILURE'] = { onRetry: props.onPress };
          }
          return props?.children || null;
        },
      };
    }
    if (id === './src/utils/session-controller') return require(sessionControllerPath);
    if (id === './src/utils/navigation-guard') return require(navigationGuardPath);
    if (id === './src/theme/colors') return { colors: {} };
    if (id.startsWith('./src/screens/')) {
      const screenName = path.basename(id, path.extname(id));
      return function MockScreen(props) {
        renderedScreens.push(screenName);
        capturedScreenProps[screenName] = props;
        return null;
      };
    }
    if (id === './src/services/api') {
      return {
        api: mockDependencies.api || {
          clearInFlightRequests: () => {},
          clearResponseCache: () => {},
          resetSession: () => {},
          getCart: async () => ({ data: { summary: { totalItems: 0 } } }),
        },
        setUnauthorizedHandler: (h) => { capturedUnauthorizedHandler = h; },
      };
    }
    if (id === './src/services/auth-storage') {
      return mockDependencies.authStorage || {
        getAuthTokens: async () => ({ token: 'default-jwt' }),
        clearAuthTokens: async () => true,
      };
    }
    return {};
  };

  const vm = require('vm');
  const moduleObj = { exports: {} };
  const context = vm.createContext({
    require: customRequire,
    module: moduleObj,
    exports: moduleObj.exports,
    console,
    process,
    global: {},
  });

  vm.runInContext(transformed, context);
  appInstance = moduleObj.exports.default;

  // Run initial render to mount App
  isExecuting = true;
  try {
    runRender();
  } finally {
    isExecuting = false;
  }

  return {
    App: appInstance,
    getRenderedScreens: () => [...renderedScreens],
    getCapturedScreenProps: () => capturedScreenProps,
    getScreenProps: (name) => capturedScreenProps[name],
    getUnauthorizedHandler: () => capturedUnauthorizedHandler,
    getCurrentScreen: () => stateValues[0],
    getCartSummary: () => stateValues[5],
    getLogoutError: () => stateValues[4],
    getActiveSessionId: () => refValues[1]?.current,
    render: runRender,
  };
}

// ==============================================================================
// TEST SUITE: PHASE 3B.7B SECURITY REMEDIATION CORRECTIONS
// ==============================================================================

test('Phase 3B.7B: Final Logout Security Corrections Suite', async (t) => {

  // ----------------------------------------------------------------------------
  // SECTION 1: STRICT KEYCHAIN VERIFICATION & FAULT INJECTION
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

    const status = await authStorage.getLogoutPendingStatus();
    assert.equal(status.status, 'UNKNOWN');
    assert.equal(status.present, null);
    assert.ok(status.error);

    await assert.rejects(authStorage.isLogoutPending(), (err) => {
      assert.equal(err.code, 'TOMBSTONE_STORAGE_ERROR');
      return true;
    });

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

    keychainStore.set('com.pondfish.customer.logout_pending', { username: 'pending', password: '1' });

    await authStorage.saveAuthTokens('new-customer-jwt', 'refresh-123');

    assert.equal(keychainStore.has('com.pondfish.customer.logout_pending'), false, 'Pending tombstone must be removed on save');
    const stored = await authStorage.getAuthTokens();
    assert.equal(stored.token, 'new-customer-jwt', 'New customer token must be securely persisted');
  });

  await t.test('1.8. Keychain.setGenericPassword returning false when writing tombstone throws and aborts reset', async () => {
    let primaryResetCalled = false;
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      setGenericPassword: async (u, p, opts = {}) => {
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          return false; // Hardware failure returned boolean false
        }
        return true;
      },
      resetGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.auth') {
          primaryResetCalled = true;
        }
        return true;
      },
      getGenericPassword: async () => false,
    };

    const { authStorage } = loadAuthStorageModule(customKeychain);

    await assert.rejects(
      authStorage.clearAuthTokens(),
      (err) => {
        assert.ok(err.message.includes('returned false') || err.message.includes('Failed to write logout pending tombstone'));
        return true;
      }
    );

    assert.equal(primaryResetCalled, false, 'Primary credentials must not be reset if tombstone write returned false');
  });

  await t.test('1.9. Keychain.resetGenericPassword returning false on primary credential reset throws', async () => {
    let tombstoneCleaned = false;
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      setGenericPassword: async () => true,
      resetGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.auth') {
          return false; // Primary reset failed with boolean false
        }
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          tombstoneCleaned = true;
          return true;
        }
        return true;
      },
      getGenericPassword: async (opts = {}) => {
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
        assert.ok(err.message.includes('returned false') || err.message.includes('Failed to reset primary authentication credentials'));
        return true;
      }
    );

    assert.equal(tombstoneCleaned, false, 'Tombstone must not be cleared if primary credential reset returned false');
  });

  await t.test('1.10. Keychain.resetGenericPassword returning false when clearing tombstone throws', async () => {
    let authResetCalled = false;
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      setGenericPassword: async () => true,
      resetGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.auth') {
          authResetCalled = true;
          return true;
        }
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          return false; // Tombstone reset returned false
        }
        return true;
      },
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.auth') {
          return false; // Credentials absent
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
        assert.ok(err.message.includes('returned false') || err.message.includes('Failed to clear logout tombstone marker'));
        return true;
      }
    );

    assert.equal(authResetCalled, true);
  });

  await t.test('1.11. Primary credential deletion read-back verification failure throws error', async () => {
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      setGenericPassword: async () => true,
      resetGenericPassword: async () => true,
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          return { password: '1' };
        }
        if (opts.service === 'com.pondfish.customer.auth') {
          // Read back reveals credentials still exist despite reset call
          return { username: 'authToken', password: JSON.stringify({ token: 'undeleted-token' }) };
        }
        return false;
      },
    };

    const { authStorage } = loadAuthStorageModule(customKeychain);

    await assert.rejects(
      authStorage.clearAuthTokens(),
      (err) => {
        assert.ok(err.message.includes('Primary authentication credential could not be cleared'));
        return true;
      }
    );
  });

  await t.test('1.12. Tombstone deletion read-back verification failure throws error', async () => {
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      setGenericPassword: async () => true,
      resetGenericPassword: async () => true,
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.auth') {
          return false; // Auth cleared
        }
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          // Marker still present on read-back
          return { password: '1' };
        }
        return false;
      },
    };

    const { authStorage } = loadAuthStorageModule(customKeychain);

    await assert.rejects(
      authStorage.clearAuthTokens(),
      (err) => {
        assert.ok(err.message.includes('Logout tombstone marker could not be confirmed absent'));
        return true;
      }
    );
  });

  await t.test('1.13. saveAuthTokens throws if tombstone reset returns false and prevents saving', async () => {
    let authSaved = false;
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      resetGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          return false; // Reset returned false
        }
        return true;
      },
      setGenericPassword: async (u, p, opts = {}) => {
        if (opts.service === 'com.pondfish.customer.auth') {
          authSaved = true;
        }
        return true;
      },
      getGenericPassword: async () => false,
    };

    const { authStorage } = loadAuthStorageModule(customKeychain);

    await assert.rejects(
      authStorage.saveAuthTokens('new-token'),
      (err) => {
        assert.ok(err.message.includes('returned false') || err.message.includes('Failed to reset logout pending marker'));
        return true;
      }
    );

    assert.equal(authSaved, false, 'Credentials must not be written if clearing tombstone returned false');
  });

  await t.test('1.14. saveAuthTokens throws if old tombstone is confirmed PRESENT or UNKNOWN', async () => {
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      resetGenericPassword: async () => true,
      setGenericPassword: async () => true,
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          return { password: '1' }; // Tombstone still present
        }
        return false;
      },
    };

    const { authStorage } = loadAuthStorageModule(customKeychain);

    await assert.rejects(
      authStorage.saveAuthTokens('new-token'),
      (err) => {
        assert.ok(err.message.includes('old tombstone is not confirmed absent'));
        return true;
      }
    );
  });

  await t.test('1.15. saveAuthTokens throws if Keychain.setGenericPassword returns false', async () => {
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      resetGenericPassword: async () => true,
      getGenericPassword: async () => false,
      setGenericPassword: async (u, p, opts = {}) => {
        if (opts.service === 'com.pondfish.customer.auth') {
          return false; // Set returned false
        }
        return true;
      },
    };

    const { authStorage } = loadAuthStorageModule(customKeychain);

    await assert.rejects(
      authStorage.saveAuthTokens('new-token'),
      (err) => {
        assert.ok(err.message.includes('returned false') || err.message.includes('Failed to persist authentication credentials'));
        return true;
      }
    );
  });

  await t.test('1.16. Malformed tombstone marker value treated as UNKNOWN and fails closed', async () => {
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          return { username: 'pending', password: 'corrupted_value_not_1' };
        }
        return false;
      },
    };

    const { authStorage } = loadAuthStorageModule(customKeychain);

    const status = await authStorage.getLogoutPendingStatus();
    assert.equal(status.status, 'UNKNOWN', 'Malformed tombstone must result in UNKNOWN status');
    assert.equal(status.present, null, 'Present must be null when status is UNKNOWN');
    assert.ok(status.error, 'Must provide descriptive error for malformed marker');

    await assert.rejects(authStorage.isLogoutPending(), (err) => {
      assert.equal(err.code, 'TOMBSTONE_STORAGE_ERROR');
      return true;
    });

    await assert.rejects(authStorage.getAuthTokens(), (err) => {
      assert.equal(err.code, 'TOMBSTONE_STORAGE_ERROR');
      return true;
    });
  });

  await t.test('1.17. Device-token cleanup failure does not fail primary authentication logout', async () => {
    const { authStorage, mockKeychain } = loadAuthStorageModule();
    const origReset = mockKeychain.resetGenericPassword;
    mockKeychain.resetGenericPassword = async (opts = {}) => {
      if (opts.service === 'com.pondfish.customer.device_token') {
        return false; // Device token reset failed
      }
      return origReset(opts);
    };

    const res = await authStorage.clearAuthTokens();
    assert.equal(res, true, 'Primary logout must succeed even if device-token reset failed');
  });

  await t.test('1.18. Save credentials fault injection: Token mismatch fails with redacted error and zero credential leakage', async () => {
    const expectedToken = 'SECRET_EXPECTED_TOKEN_A1B2C3D4E5';
    const storedWrongToken = 'SECRET_STORED_TOKEN_Z9Y8X7W6V5';
    const expectedRefresh = 'SECRET_EXPECTED_REFRESH_112233';
    const storedRefresh = 'SECRET_STORED_REFRESH_998877';

    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      resetGenericPassword: async () => true,
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.logout_pending') {
          return false;
        }
        if (opts.service === 'com.pondfish.customer.auth') {
          return { username: 'authToken', password: JSON.stringify({ token: storedWrongToken, refreshToken: storedRefresh }) };
        }
        return false;
      },
      setGenericPassword: async () => true,
    };

    const capturedLogs = [];
    const origWarn = console.warn;
    const origError = console.error;
    const origLog = console.log;
    console.warn = (...args) => capturedLogs.push(args.join(' '));
    console.error = (...args) => capturedLogs.push(args.join(' '));
    console.log = (...args) => capturedLogs.push(args.join(' '));

    const { authStorage } = loadAuthStorageModule(customKeychain);

    try {
      await assert.rejects(
        authStorage.saveAuthTokens(expectedToken, expectedRefresh),
        (err) => {
          // 1. Error identifies the failed field safely
          assert.equal(err.message, 'Credential verification failed: token mismatch');
          // 2. Error does not contain expected or actual token values
          assert.equal(err.message.includes(expectedToken), false, 'Error message must not contain expected token');
          assert.equal(err.message.includes(storedWrongToken), false, 'Error message must not contain stored token');
          // 3. Error does not contain refresh token values
          assert.equal(err.message.includes(expectedRefresh), false, 'Error message must not contain expected refresh token');
          assert.equal(err.message.includes(storedRefresh), false, 'Error message must not contain stored refresh token');
          return true;
        }
      );

      // 4. Assert zero console leakage
      const allLogs = capturedLogs.join('\n');
      assert.equal(allLogs.includes(expectedToken), false, 'Console output must not contain expected token');
      assert.equal(allLogs.includes(storedWrongToken), false, 'Console output must not contain stored token');
      assert.equal(allLogs.includes(expectedRefresh), false, 'Console output must not contain expected refresh token');
      assert.equal(allLogs.includes(storedRefresh), false, 'Console output must not contain stored refresh token');
    } finally {
      console.warn = origWarn;
      console.error = origError;
      console.log = origLog;
    }
  });

  await t.test('1.19. Save credentials fault injection: Missing credentials fails with redacted error', async () => {
    const distinctiveToken = 'SECRET_DISTINCTIVE_TOKEN_MISSING_123';
    const distinctiveRefresh = 'SECRET_DISTINCTIVE_REFRESH_MISSING_456';

    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      resetGenericPassword: async () => true,
      getGenericPassword: async () => false, // missing credentials
      setGenericPassword: async () => true,
    };
    const { authStorage } = loadAuthStorageModule(customKeychain);

    await assert.rejects(
      authStorage.saveAuthTokens(distinctiveToken, distinctiveRefresh),
      (err) => {
        assert.equal(err.message, 'Credential verification failed: credentials missing');
        assert.equal(err.message.includes(distinctiveToken), false);
        assert.equal(err.message.includes(distinctiveRefresh), false);
        return true;
      }
    );
  });

  await t.test('1.20. Save credentials fault injection: Malformed credentials fails with redacted error', async () => {
    const distinctiveToken = 'SECRET_DISTINCTIVE_TOKEN_MALFORMED_123';
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      resetGenericPassword: async () => true,
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.logout_pending') return false;
        if (opts.service === 'com.pondfish.customer.auth') {
          return { username: 'authToken', password: 'NOT_VALID_JSON{[' };
        }
        return false;
      },
      setGenericPassword: async () => true,
    };
    const { authStorage } = loadAuthStorageModule(customKeychain);

    await assert.rejects(
      authStorage.saveAuthTokens(distinctiveToken),
      (err) => {
        assert.equal(err.message, 'Credential verification failed: stored credentials malformed');
        assert.equal(err.message.includes(distinctiveToken), false);
        return true;
      }
    );
  });

  await t.test('1.21. Save credentials fault injection: Refresh token mismatch fails with redacted error and zero credential leakage', async () => {
    const validToken = 'SECRET_TOKEN_VALID_MATCH_000';
    const expectedRefresh = 'SECRET_EXPECTED_REFRESH_TOKEN_AAA111';
    const storedWrongRefresh = 'SECRET_STORED_REFRESH_TOKEN_BBB222';

    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      resetGenericPassword: async () => true,
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.logout_pending') return false;
        if (opts.service === 'com.pondfish.customer.auth') {
          return { username: 'authToken', password: JSON.stringify({ token: validToken, refreshToken: storedWrongRefresh }) };
        }
        return false;
      },
      setGenericPassword: async () => true,
    };

    const capturedLogs = [];
    const origWarn = console.warn;
    const origError = console.error;
    const origLog = console.log;
    console.warn = (...args) => capturedLogs.push(args.join(' '));
    console.error = (...args) => capturedLogs.push(args.join(' '));
    console.log = (...args) => capturedLogs.push(args.join(' '));

    const { authStorage } = loadAuthStorageModule(customKeychain);

    try {
      await assert.rejects(
        authStorage.saveAuthTokens(validToken, expectedRefresh),
        (err) => {
          assert.equal(err.message, 'Credential verification failed: refresh token mismatch');
          assert.equal(err.message.includes(validToken), false);
          assert.equal(err.message.includes(expectedRefresh), false);
          assert.equal(err.message.includes(storedWrongRefresh), false);
          return true;
        }
      );

      const allLogs = capturedLogs.join('\n');
      assert.equal(allLogs.includes(validToken), false);
      assert.equal(allLogs.includes(expectedRefresh), false);
      assert.equal(allLogs.includes(storedWrongRefresh), false);
    } finally {
      console.warn = origWarn;
      console.error = origError;
      console.log = origLog;
    }
  });

  await t.test('1.22. Save credentials fault injection: Keystore read-back exception fails with redacted error without credential leakage', async () => {
    const distinctiveToken = 'SECRET_READBACK_THROW_TOKEN_999';
    const customKeychain = {
      SECURITY_LEVEL: { SECURE_HARDWARE: 1 },
      STORAGE_TYPE: { KEYSTORE: 1 },
      resetGenericPassword: async () => true,
      getGenericPassword: async (opts = {}) => {
        if (opts.service === 'com.pondfish.customer.logout_pending') return false;
        if (opts.service === 'com.pondfish.customer.auth') {
          throw new Error('Native Keystore hardware driver I/O failure');
        }
        return false;
      },
      setGenericPassword: async () => true,
    };
    const { authStorage } = loadAuthStorageModule(customKeychain);

    await assert.rejects(
      authStorage.saveAuthTokens(distinctiveToken),
      (err) => {
        assert.equal(err.message, 'Credential verification failed: error reading back from Keystore');
        assert.equal(err.message.includes(distinctiveToken), false);
        return true;
      }
    );
  });

  await t.test('1.23. Successful save writes credentials, reads back matching credentials, and returns true', async () => {
    const { authStorage } = loadAuthStorageModule();
    const result = await authStorage.saveAuthTokens('valid-jwt-token-999', 'valid-refresh-token-888');
    assert.equal(result, true, 'saveAuthTokens must return true when write and read-back verification succeed');
    const readBack = await authStorage.getAuthTokens();
    assert.equal(readBack.token, 'valid-jwt-token-999');
    assert.equal(readBack.refreshToken, 'valid-refresh-token-888');
  });

  // ----------------------------------------------------------------------------
  // SECTION 2: ASYNC AUTH LOOKUP RACE & HTTP-METHOD REGRESSION COVERAGE
  // ----------------------------------------------------------------------------

  await t.test('2.0. Deterministic Deferred: Async auth lookup race rejects with API_SESSION_RESET with zero network dispatch', async () => {
    const deferredAuth = createDeferred();
    let networkDispatchCount = 0;

    const mockStorage = {
      getAuthTokens: () => deferredAuth.promise,
      clearAuthTokens: async () => true,
    };

    const mockFetch = async () => {
      networkDispatchCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { status: 'ok' } }),
      };
    };

    const apiModule = loadApiModule(mockStorage, mockFetch);

    // Step 1: Start request
    const reqPromise = apiModule.api.request('/api/v1/customer/profile');

    // Step 2: Auth lookup is paused via deferredAuth.promise

    // Step 3: Reset session
    apiModule.api.resetSession();

    // Step 4: Resolve old authentication lookup with old token
    deferredAuth.resolve({ token: 'old-session-token-123' });

    // Step 5: Verify old request is rejected with API_SESSION_RESET
    await assert.rejects(reqPromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET');
      assert.equal(err.isSessionReset, true);
      return true;
    });

    // Step 6: Verify that no network request was dispatched
    assert.equal(networkDispatchCount, 0, 'Network request must NOT be dispatched for cancelled session');

    // Step 7: Start new-session request and verify that it succeeds
    const newStorage = {
      getAuthTokens: async () => ({ token: 'new-session-token-456' }),
    };
    const newApiModule = loadApiModule(newStorage, mockFetch);
    const newRes = await newApiModule.api.request('/api/v1/customer/fish');
    assert.equal(newRes.success, true);
    assert.equal(networkDispatchCount, 1, 'New session request must complete normally');
  });

  await t.test('2.1. Direct GET cancellation on session reset rejects with API_SESSION_RESET', async () => {
    const mockFetch = () => new Promise(() => {}); // Stalls
    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) }, mockFetch);

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

  await t.test('2.2. Deduplicated GET cancellation on session reset rejects all subscribers with API_SESSION_RESET', async () => {
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

  await t.test('2.3. Independent POST: In-flight registration, reset, AbortController abort, and API_SESSION_RESET rejection', async () => {
    let capturedSignal = null;
    let resolveNet;
    const mockFetch = (url, opts) => {
      capturedSignal = opts.signal;
      return new Promise((resolve) => {
        resolveNet = () => resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { orderId: 'ord_123' } }),
        });
      });
    };

    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) }, mockFetch);

    const postPromise = apiModule.api.request('/api/v1/customer/orders', {
      method: 'POST',
      body: JSON.stringify({ items: [{ fishId: 'f1', quantity: 2 }] }),
    });

    await new Promise((r) => setTimeout(r, 10));
    assert.equal(apiModule.api.getInFlightRequestCount(), 1, 'POST must be tracked in activeDirectRequests');
    assert.equal(capturedSignal?.aborted, false, 'Signal not yet aborted');

    // Invalidate session
    apiModule.api.resetSession();

    // AbortController invoked
    assert.equal(capturedSignal?.aborted, true, 'AbortController must be aborted on session reset');

    // Late network response completes
    resolveNet();

    await assert.rejects(postPromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET');
      assert.equal(err.isSessionReset, true);
      return true;
    });

    assert.equal(apiModule.api.getInFlightRequestCount(), 0);
    // Note: Client-side cancellation aborts local caller promise, but cannot roll back a mutation already committed by backend
  });

  await t.test('2.4. Independent PUT: In-flight registration, reset, AbortController abort, and API_SESSION_RESET rejection', async () => {
    let capturedSignal = null;
    let resolveNet;
    const mockFetch = (url, opts) => {
      capturedSignal = opts.signal;
      return new Promise((resolve) => {
        resolveNet = () => resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { name: 'Updated Name' } }),
        });
      });
    };

    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) }, mockFetch);

    const putPromise = apiModule.api.request('/api/v1/customer/profile', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated Name' }),
    });

    await new Promise((r) => setTimeout(r, 10));
    assert.equal(apiModule.api.getInFlightRequestCount(), 1, 'PUT must be tracked in activeDirectRequests');

    apiModule.api.resetSession();

    assert.equal(capturedSignal?.aborted, true, 'AbortController must be aborted on session reset');
    resolveNet();

    await assert.rejects(putPromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET');
      return true;
    });

    assert.equal(apiModule.api.getInFlightRequestCount(), 0);
    // Note: Client-side cancellation cannot roll back a mutation already committed by backend
  });

  await t.test('2.5. Independent PATCH: In-flight registration, reset, AbortController abort, and API_SESSION_RESET rejection', async () => {
    let capturedSignal = null;
    let resolveNet;
    const mockFetch = (url, opts) => {
      capturedSignal = opts.signal;
      return new Promise((resolve) => {
        resolveNet = () => resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { updated: true } }),
        });
      });
    };

    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) }, mockFetch);

    const patchPromise = apiModule.api.request('/api/v1/customer/cart', {
      method: 'PATCH',
      body: JSON.stringify({ itemIndex: 0, quantity: 3 }),
    });

    await new Promise((r) => setTimeout(r, 10));
    assert.equal(apiModule.api.getInFlightRequestCount(), 1, 'PATCH must be tracked in activeDirectRequests');

    apiModule.api.resetSession();

    assert.equal(capturedSignal?.aborted, true, 'AbortController must be aborted on session reset');
    resolveNet();

    await assert.rejects(patchPromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET');
      return true;
    });

    assert.equal(apiModule.api.getInFlightRequestCount(), 0);
    // Note: Client-side cancellation cannot roll back a mutation already committed by backend
  });

  await t.test('2.6. Independent DELETE: In-flight registration, reset, AbortController abort, and API_SESSION_RESET rejection', async () => {
    let capturedSignal = null;
    let resolveNet;
    const mockFetch = (url, opts) => {
      capturedSignal = opts.signal;
      return new Promise((resolve) => {
        resolveNet = () => resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { deleted: true } }),
        });
      });
    };

    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) }, mockFetch);

    const deletePromise = apiModule.api.request('/api/v1/customer/cart/items/fish-1', {
      method: 'DELETE',
    });

    await new Promise((r) => setTimeout(r, 10));
    assert.equal(apiModule.api.getInFlightRequestCount(), 1, 'DELETE must be tracked in activeDirectRequests');

    apiModule.api.resetSession();

    assert.equal(capturedSignal?.aborted, true, 'AbortController must be aborted on session reset');
    resolveNet();

    await assert.rejects(deletePromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET');
      return true;
    });

    assert.equal(apiModule.api.getInFlightRequestCount(), 0);
    // Note: Client-side cancellation cannot roll back a mutation already committed by backend
  });

  await t.test('2.7. Late successful response after session invalidation is discarded and rejected with API_SESSION_RESET', async () => {
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

    apiModule.api.resetSession();
    resolveNetwork();

    await assert.rejects(reqPromise, (err) => {
      assert.equal(err.code, 'API_SESSION_RESET');
      return true;
    });
  });

  await t.test('2.8. Late error response after session invalidation is discarded and rejected with API_SESSION_RESET', async () => {
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

  await t.test('2.9. Response cache write is prevented after session invalidation', async () => {
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

  await t.test('2.10. New session requests surviving old-session cancellation complete normally', async () => {
    const mockFetch = async (url) => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { url, session: 'new' } }),
    });

    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'new-user-jwt' }) }, mockFetch);

    apiModule.api.resetSession();

    const newRes = await apiModule.api.getFish();
    assert.equal(newRes.success, true);
  });

  // ----------------------------------------------------------------------------
  // SECTION 3: PRODUCTION SESSION CONTROLLER & ACCOUNT ISOLATION
  // ----------------------------------------------------------------------------

  await t.test('3.1. Obsolete logout callback with mismatched token preserves active session and does not touch UI', async () => {
    const { authStorage } = loadAuthStorageModule();
    await authStorage.saveAuthTokens('active-new-token-456');

    let resetCalled = false;
    let cacheCleared = false;
    const mockApi = {
      resetSession: () => { resetCalled = true; },
      clearInFlightRequests: () => { resetCalled = true; },
      clearResponseCache: () => { cacheCleared = true; },
    };

    const app = createAppHarness(authStorage, mockApi);
    assert.equal(app.getState().currentScreen, 'HOME');

    const result = await app.handleUnauthorized('stale-rejected-token-123');

    assert.equal(result?.status, LOGOUT_STATUS.ABORTED_OBSOLETE);
    assert.equal(result?.cleared, false);
    assert.equal(app.getState().currentScreen, 'HOME');
    assert.equal(app.getState().isAuthenticated, true);
    assert.equal(resetCalled, false);
    assert.equal(cacheCleared, false);

    const stored = await authStorage.getAuthTokens();
    assert.equal(stored.token, 'active-new-token-456');
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

    const userALogoutPromise = app.handleLogout('token-user-a');
    await authStorage.saveAuthTokens('token-user-b');

    const logoutResult = await userALogoutPromise;

    const stored = await authStorage.getAuthTokens();
    assert.equal(stored.token, 'token-user-b', 'User B credentials must be preserved');
  });

  await t.test('3.3. Production executeSessionLogout succeeds and coordinates UI, API reset, cache wipe, and storage clear', async () => {
    const { authStorage } = loadAuthStorageModule();
    await authStorage.saveAuthTokens('valid-jwt-token-123');

    let requestsReset = false;
    let cacheCleared = false;
    const mockApi = {
      resetSession: () => { requestsReset = true; cacheCleared = true; },
      clearInFlightRequests: () => { requestsReset = true; cacheCleared = true; },
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
        throw new Error('Hardware Keystore locked');
      },
    };
    let requestsReset = false;
    let cacheCleared = false;
    const mockApi = {
      resetSession: () => { requestsReset = true; cacheCleared = true; },
      clearInFlightRequests: () => { requestsReset = true; cacheCleared = true; },
      clearResponseCache: () => { cacheCleared = true; },
    };

    const app = createAppHarness(mockStorage, mockApi);
    assert.equal(app.getState().currentScreen, 'HOME');

    const result = await app.handleLogout();

    assert.equal(result.status, LOGOUT_STATUS.FAILURE);
    assert.equal(result.cleared, false);

    const state = app.getState();
    assert.equal(state.currentScreen, 'LOGOUT_FAILURE');
    assert.equal(state.isAuthenticated, false);
    assert.equal(state.cartSummary.totalItems, 0);
    assert.equal(requestsReset, true);
    assert.equal(cacheCleared, true);
    assert.ok(state.logoutError.includes('Hardware Keystore locked'));
  });

  await t.test('3.5. Failed logout blocks access to all authenticated screens (navigation guard enforcement)', async () => {
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'mock-token' }),
      clearAuthTokens: async () => {
        throw new Error('Persistent Keystore failure');
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

    for (const screen of AUTHENTICATED_SCREENS) {
      app.handleNavigate(screen);
      assert.equal(
        app.getState().currentScreen,
        'LOGOUT_FAILURE',
        `Navigation to ${screen} must remain blocked while in LOGOUT_FAILURE`
      );
    }
  });

  await t.test('3.6. Retry from LOGOUT_FAILURE triggers clearAuthTokens again and transitions to PHONE_AUTH on success', async () => {
    let attemptCount = 0;
    const mockStorage = {
      getAuthTokens: async () => ({ token: 'jwt' }),
      clearAuthTokens: async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Transient lock error');
        }
        return true;
      },
    };
    const mockApi = {
      resetSession: () => {},
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
    };

    const app = createAppHarness(mockStorage, mockApi);

    // First attempt fails -> locks on LOGOUT_FAILURE
    const firstResult = await app.handleLogout();
    assert.equal(firstResult.status, LOGOUT_STATUS.FAILURE);
    assert.equal(app.getState().currentScreen, 'LOGOUT_FAILURE');

    // User taps Retry -> second attempt succeeds -> PHONE_AUTH
    const secondResult = await app.handleLogout();
    assert.equal(secondResult.status, LOGOUT_STATUS.SUCCESS);
    assert.equal(secondResult.cleared, true);
    assert.equal(app.getState().currentScreen, 'PHONE_AUTH');
    assert.equal(attemptCount, 2);
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

    await app.handleLogout();
    assert.equal(app.getState().cartSummary.totalItems, 0);
    assert.deepEqual(app.getState().screenParams, {});

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

  await t.test('3.10. Single owner cache invalidation: executeSessionLogout with production API clears response cache exactly once', async () => {
    const apiModule = loadApiModule({ getAuthTokens: async () => ({ token: 'jwt' }) });

    const initialStats = apiModule.api.getResponseCacheStats();

    // 1. Success path invalidation
    const res = await executeSessionLogout({
      expectedToken: null,
      authStorage: { clearAuthTokens: async () => true },
      apiClient: apiModule.api,
      setState: () => {},
    });

    assert.equal(res.status, LOGOUT_STATUS.SUCCESS);
    const statsAfterSuccess = apiModule.api.getResponseCacheStats();
    assert.equal(statsAfterSuccess.invalidations - initialStats.invalidations, 1, 'Production cache invalidations count must increment by exactly 1 during successful logout');
    assert.equal(statsAfterSuccess.globalGeneration - initialStats.globalGeneration, 1, 'Global invalidation generation must increment by exactly 1');

    // 2. Failure path invalidation (must also clear cache exactly once and cancel requests)
    const failRes = await executeSessionLogout({
      expectedToken: null,
      authStorage: { clearAuthTokens: async () => { throw new Error('Hardware Android Keystore fatal error'); } },
      apiClient: apiModule.api,
      setState: () => {},
    });

    assert.equal(failRes.status, LOGOUT_STATUS.FAILURE);
    const statsAfterFailure = apiModule.api.getResponseCacheStats();
    assert.equal(statsAfterFailure.invalidations - initialStats.invalidations, 2, 'Cumulative invalidations must increment by exactly 2 (1 per invalidation)');
    assert.equal(statsAfterFailure.globalGeneration - initialStats.globalGeneration, 2, 'Cumulative global generation must increment by exactly 2');
  });

  // ----------------------------------------------------------------------------
  // SECTION 4: ACTUAL App.jsx PRODUCTION INTEGRATION COVERAGE
  // ----------------------------------------------------------------------------

  await t.test('4.0. Environment Boundary: Specification of UI integration test capabilities and constraints', () => {
    // What IS tested:
    // 1. Full execution of actual production App.jsx component via Babel transformation.
    // 2. Component state transitions across SPLASH -> PROFILE -> LOGOUT_IN_PROGRESS -> PHONE_AUTH / LOGOUT_FAILURE.
    // 3. Capture of actual ProfileScreen props (routeParams, onNavigate, onLogout) passed from App.jsx.
    // 4. Invocation of actual onLogout prop, executing session-controller, clearAuthTokens, and resetSession.
    // 5. Fail-closed locking in LOGOUT_FAILURE upon hardware Keystore failure and retry execution.
    // 6. In-memory cart state reset and session isolation between sequential user accounts.
    //
    // Execution Environment Boundary:
    // loadTransformedApp() is a synchronous headless hook runner with sequential slot tracking
    // for useState, useRef, useCallback, useEffect, and minimal React Native component stubs.
    // It verifies App.jsx component logic, state transitions, and callback wiring.
    //
    // What is NOT simulated:
    // 1. React 18 concurrent Fiber reconciliation, lane scheduling, and priority-based interruptible rendering.
    // 2. Native React Native Fabric / Paper UI shadow trees, yoga flexbox layout measurement, and Choreographer vsync dropped frame counts.
    // 3. Physical Android hardware Keystore secure element cryptographic operations on an ARM processor.
    assert.ok(fs.existsSync(appSourcePath), 'App.jsx production source must exist');
  });

  await t.test('4.1. Actual App.jsx: Manual logout initiated from ProfileScreen executes session controller, clears storage, and resets session', async () => {
    let storageCleared = false;
    let apiResetCalled = false;
    const mockAuthStorage = {
      getAuthTokens: async () => ({ token: 'prod-jwt-123' }),
      clearAuthTokens: async () => {
        storageCleared = true;
        return true;
      },
    };
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
      resetSession: () => { apiResetCalled = true; },
      getCart: async () => ({ data: { summary: { totalItems: 0 } } }),
    };

    const harness = loadTransformedApp({
      authStorage: mockAuthStorage,
      api: mockApi,
    });

    // 1. Initial screen is SPLASH
    assert.equal(harness.getCurrentScreen(), 'SPLASH');
    const splashProps = harness.getScreenProps('SplashScreen');
    assert.equal(typeof splashProps?.onNavigate, 'function');

    // 2. Navigate to PROFILE with authenticated user payload
    splashProps.onNavigate('PROFILE', {
      token: 'prod-jwt-123',
      customer: { id: 'cust_prod_1', isProfileComplete: true },
    });

    // App has re-rendered to PROFILE
    assert.equal(harness.getCurrentScreen(), 'PROFILE');
    const profileProps = harness.getScreenProps('ProfileScreen');
    assert.ok(profileProps, 'ProfileScreen must receive props from production App.jsx');
    assert.equal(typeof profileProps.onLogout, 'function', 'ProfileScreen must receive onLogout from production App.jsx');

    // 3. Invoke actual onLogout callback passed to ProfileScreen
    await profileProps.onLogout();

    // 4. Assert verification: session controller invoked, storage cleared, API reset, navigation to PHONE_AUTH
    assert.equal(storageCleared, true, 'Actual App.jsx onLogout must clear secure storage');
    assert.equal(apiResetCalled, true, 'Actual App.jsx onLogout must reset API session');
    assert.equal(harness.getCurrentScreen(), 'PHONE_AUTH', 'App must transition to PHONE_AUTH upon successful logout');
    assert.ok(harness.getScreenProps('PhoneAuthScreen'), 'PhoneAuthScreen must be rendered');
  });

  await t.test('4.2. Actual App.jsx: Logout triggered by genuine 401 response invokes session controller and clears session', async () => {
    let clearExpectedToken = null;
    let apiResetCalled = false;
    const mockAuthStorage = {
      getAuthTokens: async () => ({ token: 'active-token-789' }),
      clearAuthTokens: async (expected) => {
        clearExpectedToken = expected;
        return true;
      },
    };
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
      resetSession: () => { apiResetCalled = true; },
      getCart: async () => ({ data: { summary: { totalItems: 0 } } }),
    };

    const harness = loadTransformedApp({
      authStorage: mockAuthStorage,
      api: mockApi,
    });

    // Navigate to PROFILE so app is authenticated
    harness.getScreenProps('SplashScreen').onNavigate('PROFILE', {
      token: 'active-token-789',
      customer: { id: 'cust_401', isProfileComplete: true },
    });
    assert.equal(harness.getCurrentScreen(), 'PROFILE');

    const unauthHandler = harness.getUnauthorizedHandler();
    assert.equal(typeof unauthHandler, 'function');

    // Trigger 401 with matching active token
    unauthHandler('active-token-789');
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(clearExpectedToken, 'active-token-789', 'Matching 401 must pass rejected token to clearAuthTokens');
    assert.equal(apiResetCalled, true, 'Session must be reset on genuine 401');
    assert.equal(harness.getCurrentScreen(), 'PHONE_AUTH');
  });

  await t.test('4.3. Actual App.jsx: Obsolete 401 callback after new account logged in is ignored and active session preserved', async () => {
    let clearAttempted = false;
    let apiResetCalled = false;
    const mockAuthStorage = {
      getAuthTokens: async () => ({ token: 'new-account-token-999' }),
      clearAuthTokens: async () => {
        clearAttempted = true;
        return true;
      },
    };
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
      resetSession: () => { apiResetCalled = true; },
      getCart: async () => ({ data: { summary: { totalItems: 0 } } }),
    };

    const harness = loadTransformedApp({
      authStorage: mockAuthStorage,
      api: mockApi,
    });

    harness.getScreenProps('SplashScreen').onNavigate('PROFILE', {
      token: 'new-account-token-999',
      customer: { id: 'cust_new', isProfileComplete: true },
    });
    assert.equal(harness.getCurrentScreen(), 'PROFILE');

    const unauthHandler = harness.getUnauthorizedHandler();

    // Trigger obsolete 401 with superseded token
    await unauthHandler('superseded-old-token-000');

    assert.equal(clearAttempted, false, 'Obsolete 401 must NOT invoke clearAuthTokens');
    assert.equal(apiResetCalled, false, 'Obsolete 401 must NOT reset active API session');
    assert.equal(harness.getCurrentScreen(), 'PROFILE', 'Active session screen must remain undisturbed');
  });

  await t.test('4.4. Actual App.jsx: Secure-storage failure during ProfileScreen logout transitions to locked LOGOUT_FAILURE', async () => {
    const mockAuthStorage = {
      getAuthTokens: async () => ({ token: 'failing-token' }),
      clearAuthTokens: async () => {
        throw new Error('Hardware Android Keystore fatal error');
      },
    };
    let apiResetCalled = false;
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
      resetSession: () => { apiResetCalled = true; },
      getCart: async () => ({ data: { summary: { totalItems: 0 } } }),
    };

    const harness = loadTransformedApp({
      authStorage: mockAuthStorage,
      api: mockApi,
    });

    harness.getScreenProps('SplashScreen').onNavigate('PROFILE', {
      token: 'failing-token',
      customer: { id: 'cust_fail', isProfileComplete: true },
    });
    assert.equal(harness.getCurrentScreen(), 'PROFILE');

    const profileProps = harness.getScreenProps('ProfileScreen');
    await profileProps.onLogout();

    assert.equal(apiResetCalled, true, 'Fail-closed: API session reset must be executed even when storage fails');
    assert.equal(harness.getCurrentScreen(), 'LOGOUT_FAILURE', 'App must transition to LOGOUT_FAILURE on secure-storage error');
    assert.ok(harness.getLogoutError(), 'Logout error message must be set');
    assert.ok(harness.getScreenProps('LOGOUT_FAILURE'), 'LOGOUT_FAILURE UI with retry button must be rendered');

    // Verify navigation guard locks user: attempts to navigate to HOME are blocked
    harness.getScreenProps('ProfileScreen')?.onNavigate?.('HOME');
    assert.equal(harness.getCurrentScreen(), 'LOGOUT_FAILURE', 'Navigation attempts must be blocked while in LOGOUT_FAILURE');
  });

  await t.test('4.5. Actual App.jsx: Successful retry from LOGOUT_FAILURE transitions to PHONE_AUTH', async () => {
    let attempt = 0;
    const mockAuthStorage = {
      getAuthTokens: async () => ({ token: 'retry-token' }),
      clearAuthTokens: async () => {
        attempt++;
        if (attempt === 1) {
          throw new Error('Transient lock');
        }
        return true;
      },
    };
    let apiResetCount = 0;
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
      resetSession: () => { apiResetCount++; },
      getCart: async () => ({ data: { summary: { totalItems: 0 } } }),
    };

    const harness = loadTransformedApp({
      authStorage: mockAuthStorage,
      api: mockApi,
    });

    harness.getScreenProps('SplashScreen').onNavigate('PROFILE', {
      token: 'retry-token',
      customer: { id: 'cust_retry', isProfileComplete: true },
    });

    // First attempt fails
    await harness.getScreenProps('ProfileScreen').onLogout();
    assert.equal(attempt, 1);
    assert.equal(harness.getCurrentScreen(), 'LOGOUT_FAILURE');

    // Second attempt (retry button on LOGOUT_FAILURE screen) succeeds
    const failureProps = harness.getScreenProps('LOGOUT_FAILURE');
    assert.equal(typeof failureProps?.onRetry, 'function', 'LOGOUT_FAILURE screen must have onRetry callback');
    await failureProps.onRetry();

    assert.equal(attempt, 2);
    assert.equal(harness.getCurrentScreen(), 'PHONE_AUTH', 'Successful retry must transition to PHONE_AUTH');
    assert.equal(harness.getLogoutError(), null, 'Logout error must be cleared on success');
    assert.ok(apiResetCount >= 2, 'API session reset must be executed on each attempt');
  });

  await t.test('4.6. Actual App.jsx: Account data isolation resets in-memory cart and prevents leakage between accounts', async () => {
    const mockAuthStorage = {
      getAuthTokens: async () => ({ token: 'user-a' }),
      clearAuthTokens: async () => true,
    };
    const mockApi = {
      clearInFlightRequests: () => {},
      clearResponseCache: () => {},
      resetSession: () => {},
      getCart: async () => ({ data: { summary: { totalItems: 0 } } }),
    };

    const harness = loadTransformedApp({
      authStorage: mockAuthStorage,
      api: mockApi,
    });

    // 1. User A logs in and navigates to HOME
    harness.getScreenProps('SplashScreen').onNavigate('HOME', {
      token: 'user-a',
      customer: { id: 'user_a', name: 'Alice', isProfileComplete: true },
    });
    assert.equal(harness.getCurrentScreen(), 'HOME');

    // 2. User A updates cart
    harness.getScreenProps('HomeScreen').onCartUpdated({
      summary: {
        totalItems: 4,
        totalQuantity: 4,
        totalAmount: 1600,
        isAllBookable: true,
      },
    });
    assert.equal(harness.getCartSummary().totalItems, 4);

    // 3. User A navigates to PROFILE and invokes actual onLogout
    harness.getScreenProps('HomeScreen').onNavigate('PROFILE');
    assert.equal(harness.getCurrentScreen(), 'PROFILE');
    await harness.getScreenProps('ProfileScreen').onLogout();

    // Verify session terminated and cart reset in App state
    assert.equal(harness.getCurrentScreen(), 'PHONE_AUTH');
    assert.equal(harness.getCartSummary().totalItems, 0, 'Cart must be wiped on logout');

    // 4. User B logs in
    harness.getScreenProps('PhoneAuthScreen').onNavigate('HOME', {
      token: 'user-b',
      customer: { id: 'user_b', name: 'Bob', isProfileComplete: true },
    });
    assert.equal(harness.getCurrentScreen(), 'HOME');
    assert.equal(harness.getCartSummary().totalItems, 0, 'User B must not see User A cart items');
  });

  await t.test('4.7. Actual App.jsx: React 18 production smoke test via standard react and react-dom/server renderToString', () => {
    const React = require('react');
    const ReactDOMServer = require('react-dom/server');
    const babel = require('@babel/core');
    const preset = require.resolve('metro-react-native-babel-preset');

    const code = fs.readFileSync(appSourcePath, 'utf8');
    const transformed = babel.transformSync(code, {
      presets: [preset],
      configFile: false,
      babelrc: false,
      filename: 'App.jsx',
    }).code;

    const customRequire = (id) => {
      if (id.startsWith('@babel/runtime')) return require(id);
      if (id === 'react') return React;
      if (id === 'react/jsx-runtime') return require('react/jsx-runtime');
      if (id === 'react-native') {
        return {
          StyleSheet: { create: (obj) => obj },
          BackHandler: { addEventListener: () => ({ remove: () => {} }), exitApp: () => {} },
          StatusBar: () => null,
          SafeAreaView: ({ children }) => React.createElement('div', { 'data-native': 'SafeAreaView' }, children),
          View: ({ children }) => React.createElement('div', { 'data-native': 'View' }, children),
          Text: ({ children }) => React.createElement('span', { 'data-native': 'Text' }, children),
          ActivityIndicator: () => React.createElement('div', { 'data-native': 'ActivityIndicator' }),
          TouchableOpacity: ({ children, onPress }) => React.createElement('button', { onClick: onPress }, children),
        };
      }
      if (id === './src/utils/session-controller') return require(sessionControllerPath);
      if (id === './src/utils/navigation-guard') return require(navigationGuardPath);
      if (id === './src/theme/colors') return { colors: {} };
      if (id.startsWith('./src/screens/')) {
        const name = path.basename(id, path.extname(id));
        return function MockScreen(props) {
          return React.createElement('div', { 'data-screen': name });
        };
      }
      if (id === './src/services/api') {
        return {
          api: {
            clearInFlightRequests: () => {},
            clearResponseCache: () => {},
            resetSession: () => {},
            getCart: async () => ({ data: { summary: { totalItems: 0 } } }),
          },
          setUnauthorizedHandler: () => {},
        };
      }
      if (id === './src/services/auth-storage') {
        return {
          getAuthTokens: async () => ({ token: 'default-jwt' }),
          clearAuthTokens: async () => true,
        };
      }
      return {};
    };

    const vm = require('vm');
    const moduleObj = { exports: {} };
    const context = vm.createContext({
      require: customRequire,
      module: moduleObj,
      exports: moduleObj.exports,
      console,
      process,
      global: {},
    });

    vm.runInContext(transformed, context);
    const App = moduleObj.exports.default;
    assert.equal(typeof App, 'function', 'Transformed App.jsx must export a React functional component');

    // Smoke test production App.jsx inside the actual React 18 / ReactDOMServer runtime
    const html = ReactDOMServer.renderToString(React.createElement(App));
    assert.ok(html.length > 0, 'App.jsx must successfully render non-empty HTML string via ReactDOMServer');
    assert.ok(html.includes('data-screen="SplashScreen"'), 'Initial render in standard React 18 runtime must mount SplashScreen');
    assert.ok(html.includes('data-native="SafeAreaView"'), 'Root element must be rendered inside SafeAreaView container');
  });

});
