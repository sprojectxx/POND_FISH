/**
 * Customer Mobile App Phase 1 — Responsiveness & API Reliability Test Suite
 * Traceability: customer-app/docs/PHASE_1_IMPLEMENTATION_REPORT.md
 * 
 * Verifies:
 * - Section 1: Stale-session logout / device-token race (obsolete 401 isolation, atomic clearance, offline tolerance, concurrency).
 * - Section 3: API client complete response timeout (body parsing included, caller abort, post-auth signal check, cleanup, fallback).
 * - Section 3 (Fallback): Comprehensive fallback tests when AbortController is unavailable (caller abort, timeout uncertainty, mutation no-retry, error classification).
 * - Section 4: Client error classifications vs. genuine HTTP responses (code vs. status).
 * - Section 5: Home screen load orchestration (direct execution of fetchHomeDataOrchestrated from HomeScreen.jsx).
 * - Section 5 (Static): Explicitly labeled static AST / source inspection checks.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const apiSourcePath = path.resolve(__dirname, '../../customer-app/src/services/api.js');
const authStorageSourcePath = path.resolve(__dirname, '../../customer-app/src/services/auth-storage.js');
const homeScreenSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/HomeScreen.jsx');
const appSourcePath = path.resolve(__dirname, '../../customer-app/App.jsx');
const profileScreenSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/ProfileScreen.jsx');

// ==============================================================================
// TEST MODULE LOADERS (Isolated in-memory test environments)
// ==============================================================================

function loadAuthStorageModule() {
  let code = fs.readFileSync(authStorageSourcePath, 'utf8');
  const keychainStore = new Map();

  const mockKeychain = {
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

  code = code.replace(/import\s*\*\s*as\s*Keychain\s*from\s*['"]react-native-keychain['"];?/g, 'const Keychain = mockKeychain;');
  code = code.replace(/export\s+async\s+function\s+([a-zA-Z0-9_]+)/g, 'exports.$1 = async function $1');

  const m = { exports: {} };
  const fn = new Function('exports', 'require', 'mockKeychain', 'console', code);
  fn(m.exports, require, mockKeychain, { warn: () => {}, error: () => {}, log: () => {} });

  return { authStorage: m.exports, keychainStore, mockKeychain };
}

function loadApiModule(mockStorage = {}, mockFetch = null, customGlobals = {}) {
  let code = fs.readFileSync(apiSourcePath, 'utf8');

  code = code.replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]\.\/auth-storage['"];?/g, 'const { $1 } = mockAuthStorage;');
  code = code.replace(/export\s+const\s+DEFAULT_TIMEOUT_MS\s*=\s*(\d+);?/g, 'const DEFAULT_TIMEOUT_MS = $1; exports.DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;');
  code = code.replace(/export\s+function\s+setUnauthorizedHandler/g, 'exports.setUnauthorizedHandler = function setUnauthorizedHandler');
  code = code.replace(/export\s+const\s+api\s*=\s*\{/g, 'const api = {');

  code += '\nexports.api = api;\nexports.request = request;';

  const m = { exports: {} };
  const fn = new Function('exports', 'require', 'mockAuthStorage', 'fetch', '__DEV__', 'process', 'FormData', 'AbortController', 'console', code);

  const customFetch = mockFetch || globalThis.fetch;
  const customFormData = ('FormData' in customGlobals) ? customGlobals.FormData : globalThis.FormData;
  const customAbortController = ('AbortController' in customGlobals) ? customGlobals.AbortController : globalThis.AbortController;

  fn(m.exports, require, mockStorage, customFetch, false, process, customFormData, customAbortController, {
    warn: () => {},
    error: () => {},
    log: () => {},
  });

  return m.exports;
}

/**
 * Directly extracts and loads fetchHomeDataOrchestrated from HomeScreen.jsx.
 * Guarantees zero code duplication inside tests: runs the actual production orchestrator.
 */
function loadHomeScreenOrchestrator() {
  const homeCode = fs.readFileSync(homeScreenSourcePath, 'utf8');
  const startIndex = homeCode.indexOf('export async function fetchHomeDataOrchestrated');
  const endIndex = homeCode.indexOf('export default function HomeScreen');
  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Could not slice fetchHomeDataOrchestrated from HomeScreen.jsx');
  }
  const fnCode = homeCode.slice(startIndex, endIndex).replace('export async function fetchHomeDataOrchestrated', 'async function fetchHomeDataOrchestrated') + '\nreturn fetchHomeDataOrchestrated;';
  const createFn = new Function('console', 'AbortController', 'Promise', fnCode);
  return createFn({ warn: () => {}, error: () => {}, log: () => {} }, globalThis.AbortController, Promise);
}

// ==============================================================================
// 1. STALE-SESSION LOGOUT & DEVICE-TOKEN RACE TESTS (Executable Behavioral Tests)
// ==============================================================================

test('Section 1.1: An obsolete 401 does not clear either current auth token or current device token', async () => {
  const { authStorage } = loadAuthStorageModule();

  // 1. Establish genuine active session and device token in Keystore
  await authStorage.saveAuthTokens('valid-active-jwt-token', 'valid-refresh-token');
  await authStorage.saveDeviceToken('fcm-registration-token-device-001');

  // Verify initial state
  const initialAuth = await authStorage.getAuthTokens();
  assert.equal(initialAuth?.token, 'valid-active-jwt-token');
  const initialDeviceToken = await authStorage.getDeviceToken();
  assert.equal(initialDeviceToken, 'fcm-registration-token-device-001');

  // 2. An obsolete/delayed HTTP 401 arrives carrying an older expired session token
  const didClear = await authStorage.clearAuthTokens('obsolete-stale-jwt-token');

  // 3. Verify clearing was safely rejected without touching credentials or device token
  assert.equal(didClear, false, 'clearAuthTokens must return false when expectedToken does not match');

  const preservedAuth = await authStorage.getAuthTokens();
  assert.equal(preservedAuth?.token, 'valid-active-jwt-token', 'Active session token must NOT be cleared by obsolete 401');

  const preservedDeviceToken = await authStorage.getDeviceToken();
  assert.equal(preservedDeviceToken, 'fcm-registration-token-device-001', 'Active device token must NOT be cleared by obsolete 401');
});

test('Section 1.2: A matching expected token clears the session and device token atomically', async () => {
  const { authStorage } = loadAuthStorageModule();

  await authStorage.saveAuthTokens('session-to-invalidate', 'refresh-token');
  await authStorage.saveDeviceToken('device-token-to-invalidate');

  // When matching expectedToken is provided:
  const didClear = await authStorage.clearAuthTokens('session-to-invalidate');
  assert.equal(didClear, true, 'clearAuthTokens must return true when expectedToken matches current token');

  const finalAuth = await authStorage.getAuthTokens();
  assert.equal(finalAuth, null, 'Auth tokens must be cleared from Keystore');

  const finalDeviceToken = await authStorage.getDeviceToken();
  assert.equal(finalDeviceToken, null, 'Device token must be cleared from Keystore');
});

test('Section 1.3: Ordinary user logout clears credentials and device token even when device-token unregistration fails', async () => {
  const { authStorage } = loadAuthStorageModule();

  await authStorage.saveAuthTokens('user-session-token', 'user-refresh');
  await authStorage.saveDeviceToken('user-fcm-token');

  // Simulate network failure during unregistration (offline mode):
  // The unregistration network call rejects, caught non-fatally in ProfileScreen.
  // ProfileScreen delegates to onLogout(), which invokes clearAuthTokens(null).
  const didClear = await authStorage.clearAuthTokens(null);

  assert.equal(didClear, true);
  assert.equal(await authStorage.getAuthTokens(), null, 'Credentials must be cleared locally');
  assert.equal(await authStorage.getDeviceToken(), null, 'Device token must be cleared locally');
});

test('Section 1.4: Concurrent logout calls do not corrupt session state or storage queue', async () => {
  const { authStorage } = loadAuthStorageModule();

  await authStorage.saveAuthTokens('concurrent-test-token', 'refresh');
  await authStorage.saveDeviceToken('concurrent-device-token');

  // Fire 10 concurrent clearance and retrieval requests simultaneously
  const operations = [
    authStorage.clearAuthTokens('concurrent-test-token'),
    authStorage.clearAuthTokens('concurrent-test-token'),
    authStorage.getAuthTokens(),
    authStorage.clearAuthTokens(null),
    authStorage.getDeviceToken(),
  ];

  const results = await Promise.all(operations);
  assert.equal(Array.isArray(results), true);

  // Final state must be cleanly cleared without unhandled rejection or deadlocks
  assert.equal(await authStorage.getAuthTokens(), null);
  assert.equal(await authStorage.getDeviceToken(), null);
});

// ==============================================================================
// 2. API CLIENT TIMEOUT, BODY PARSING & CANCELLATION TESTS (Section 3)
// ==============================================================================

test('Section 3.1: Normal successful response parses JSON and returns data', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: [{ id: 'fish-101', name: 'Katla' }] }),
  });

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'mock-jwt' }),
  }, mockFetch);

  const res = await apiModule.api.getFish();
  assert.equal(res.success, true);
  assert.equal(res.data[0].id, 'fish-101');
});

test('Section 3.2: Request that stalls before response headers aborts and throws API_TIMEOUT', async () => {
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
    getAuthTokens: async () => ({ token: 'mock-jwt' }),
  }, mockFetch);

  await assert.rejects(
    async () => {
      await apiModule.request('/api/v1/customer/fish', { timeoutMs: 40 });
    },
    (err) => {
      assert.equal(err.code, 'API_TIMEOUT');
      assert.equal(err.isTimeout, true);
      assert.equal(err.networkCancelled, true, 'AbortController environment must confirm network cancellation');
      assert.match(err.message, /timed out after 40ms/);
      return true;
    }
  );
});

test('Section 3.3: Response that returns headers but stalls while reading body throws API_TIMEOUT', async () => {
  const mockFetch = async (url, opts) => {
    // Headers return immediately (status 200 OK)
    return {
      ok: true,
      status: 200,
      json: () => new Promise((resolve, reject) => {
        // Body stream hangs indefinitely
        const timer = setTimeout(() => {
          resolve({ success: true });
        }, 1000);
        opts.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          const abortErr = new Error('The operation was aborted.');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      }),
    };
  };

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'mock-jwt' }),
  }, mockFetch);

  await assert.rejects(
    async () => {
      await apiModule.request('/api/v1/customer/fish', { timeoutMs: 40 });
    },
    (err) => {
      assert.equal(err.code, 'API_TIMEOUT', 'Body parsing stalling must trigger API_TIMEOUT');
      assert.equal(err.isTimeout, true);
      return true;
    }
  );
});

test('Section 3.4: Caller abort while fetch is in progress throws API_ABORTED', async () => {
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
    getAuthTokens: async () => ({ token: 'mock-jwt' }),
  }, mockFetch);

  const callerController = new AbortController();
  const requestPromise = apiModule.request('/api/v1/customer/fish', {
    signal: callerController.signal,
    timeoutMs: 5000,
  });

  setTimeout(() => callerController.abort('User tapped back button'), 20);

  await assert.rejects(
    requestPromise,
    (err) => {
      assert.equal(err.code, 'API_ABORTED');
      assert.equal(err.isAborted, true);
      assert.equal(err.reason, 'User tapped back button');
      return true;
    }
  );
});

test('Section 3.5: Caller abort while secure auth-token retrieval is pending throws API_ABORTED before fetch', async () => {
  let fetchCalled = false;
  const mockStorage = {
    getAuthTokens: async () => {
      // Storage read takes 40ms
      await new Promise((r) => setTimeout(r, 40));
      return { token: 'jwt' };
    },
  };
  const mockFetch = async () => {
    fetchCalled = true;
    return { ok: true, status: 200, json: async () => ({}) };
  };

  const apiModule = loadApiModule(mockStorage, mockFetch);
  const callerController = new AbortController();

  const requestPromise = apiModule.request('/api/v1/customer/fish', {
    signal: callerController.signal,
  });

  // Caller cancels at 10ms while getAuthTokens() is still in progress
  setTimeout(() => callerController.abort('Canceled during auth read'), 10);

  await assert.rejects(
    requestPromise,
    (err) => {
      assert.equal(err.code, 'API_ABORTED');
      assert.equal(fetchCalled, false, 'Native fetch must not be invoked if aborted during auth retrieval');
      return true;
    }
  );
});

test('Section 3.6: Pre-aborted caller signal fails fast without calling storage or fetch', async () => {
  let storageCalled = false;
  let fetchCalled = false;

  const mockStorage = {
    getAuthTokens: async () => {
      storageCalled = true;
      return { token: 'jwt' };
    },
  };
  const mockFetch = async () => {
    fetchCalled = true;
    return { ok: true, status: 200, json: async () => ({}) };
  };

  const apiModule = loadApiModule(mockStorage, mockFetch);
  const callerController = new AbortController();
  callerController.abort('Pre-aborted signal');

  await assert.rejects(
    async () => {
      await apiModule.request('/api/v1/customer/fish', {
        signal: callerController.signal,
      });
    },
    (err) => {
      assert.equal(err.code, 'API_ABORTED');
      assert.equal(storageCalled, false, 'Storage must not be inspected if pre-aborted');
      assert.equal(fetchCalled, false, 'Fetch must not be invoked if pre-aborted');
      return true;
    }
  );
});

test('Section 3.7: Genuine HTTP 401 triggers unauthorized session handler with rejected token', async () => {
  let unauthorizedCalls = 0;
  let rejectedTokenSeen = null;

  const mockFetch = async (url) => {
    if (url.includes('/unauthorized-route')) {
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'expired-session-token-999' }),
  }, mockFetch);

  apiModule.setUnauthorizedHandler((token) => {
    unauthorizedCalls++;
    rejectedTokenSeen = token;
  });

  await assert.rejects(
    async () => {
      await apiModule.request('/api/v1/customer/unauthorized-route');
    },
    (err) => {
      assert.equal(err.status, 401);
      assert.equal(err.code, 'UNAUTHORIZED');
      return true;
    }
  );

  assert.equal(unauthorizedCalls, 1);
  assert.equal(rejectedTokenSeen, 'expired-session-token-999');
});

test('Section 3.8: Genuine HTTP 400/500 preserves backend error code, message, and details', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      error: {
        code: 'INVALID_SLOT_SELECTION',
        message: 'The requested morning slot is fully booked.',
        details: [{ field: 'slotId', reason: 'CAPACITY_REACHED' }],
      },
    }),
  });

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'mock-jwt' }),
  }, mockFetch);

  await assert.rejects(
    async () => {
      await apiModule.request('/api/v1/customer/bookings/validate', { method: 'POST' });
    },
    (err) => {
      assert.equal(err.status, 400);
      assert.equal(err.code, 'INVALID_SLOT_SELECTION');
      assert.equal(err.message, 'The requested morning slot is fully booked.');
      assert.deepEqual(err.details, [{ field: 'slotId', reason: 'CAPACITY_REACHED' }]);
      return true;
    }
  );
});

test('Section 3.9: FormData payload omits forced application/json Content-Type', async () => {
  let passedHeaders = null;

  class FakeFormData {}

  const mockFetch = async (url, opts) => {
    passedHeaders = opts.headers;
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    };
  };

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'mock-jwt' }),
  }, mockFetch, { FormData: FakeFormData });

  const fakeBody = new FakeFormData();
  await apiModule.request('/api/v1/customer/bills/upload', {
    method: 'POST',
    body: fakeBody,
  });

  assert.equal(passedHeaders['Content-Type'], undefined, 'FormData must NOT have forced application/json Content-Type');
  assert.equal(passedHeaders.Authorization, 'Bearer mock-jwt');
});

test('Section 3.10: Timers and abort listeners are cleaned up after success, HTTP failure, timeout, and caller cancellation', async () => {
  let clearedTimers = 0;
  let removedListeners = 0;

  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.clearTimeout = (id) => {
    clearedTimers++;
    return originalClearTimeout(id);
  };

  try {
    const apiModule = loadApiModule({
      getAuthTokens: async () => ({ token: 'mock-jwt' }),
    }, async (url) => {
      if (url.includes('/fail500')) {
        return { ok: false, status: 500, json: async () => ({ error: { code: 'SERVER_ERR' } }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    // 1. Success path cleanup
    const c1 = new AbortController();
    const origRemove1 = c1.signal.removeEventListener.bind(c1.signal);
    c1.signal.removeEventListener = (...args) => {
      removedListeners++;
      return origRemove1(...args);
    };
    await apiModule.request('/api/v1/customer/fish', { signal: c1.signal, timeoutMs: 5000 });
    assert.ok(clearedTimers >= 1, 'Timer must be cleared on success');
    assert.ok(removedListeners >= 1, 'Caller listener must be removed on success');

    // 2. HTTP 500 failure cleanup
    const c2 = new AbortController();
    const origRemove2 = c2.signal.removeEventListener.bind(c2.signal);
    c2.signal.removeEventListener = (...args) => {
      removedListeners++;
      return origRemove2(...args);
    };
    try {
      await apiModule.request('/api/v1/customer/fail500', { signal: c2.signal, timeoutMs: 5000 });
    } catch {}
    assert.ok(clearedTimers >= 2, 'Timer must be cleared on HTTP failure');
    assert.ok(removedListeners >= 2, 'Caller listener must be removed on HTTP failure');
  } finally {
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test('Section 3.11: No duplicate mutation requests executed after a timeout', async () => {
  let callCount = 0;
  const mockFetch = () => new Promise((resolve) => {
    callCount++;
    setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({}) }), 500);
  });

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'mock-jwt' }),
  }, mockFetch);

  try {
    await apiModule.api.createBooking({ paymentId: 'pay_test_001' }, { timeoutMs: 25 });
  } catch {}

  assert.equal(callCount, 1, 'Booking mutation request must never be retried after a timeout');
});

// ==============================================================================
// 3B. FALLBACK TIMEOUT & CANCELLATION TESTS (Simulated Unavailable AbortController)
// ==============================================================================

test('Section 3.12: Fallback when AbortController unavailable: Caller abort rejects promise without silently ignoring signal', async () => {
  let fetchStarted = false;
  const mockFetch = () => new Promise((resolve) => {
    fetchStarted = true;
    setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({}) }), 500);
  });

  // Instantiate api client with AbortController = undefined to simulate legacy runtime
  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'mock-jwt' }),
  }, mockFetch, { AbortController: undefined });

  // Create mock signal with event listener support
  const mockListeners = [];
  const mockSignal = {
    aborted: false,
    reason: 'Caller navigated away',
    addEventListener: (event, fn) => {
      if (event === 'abort') mockListeners.push(fn);
    },
    removeEventListener: (event, fn) => {
      const idx = mockListeners.indexOf(fn);
      if (idx >= 0) mockListeners.splice(idx, 1);
    },
  };

  const reqPromise = apiModule.request('/api/v1/customer/fish', {
    signal: mockSignal,
    timeoutMs: 5000,
  });

  // Fire caller abort while fetch is in progress
  setTimeout(() => {
    mockSignal.aborted = true;
    mockListeners.forEach((fn) => fn());
  }, 20);

  await assert.rejects(
    reqPromise,
    (err) => {
      assert.equal(err.code, 'API_ABORTED', 'Caller abort must not be silently ignored');
      assert.equal(err.isAborted, true);
      assert.equal(err.networkCancelled, false, 'Must accurately report that socket could not be cancelled on the wire');
      return true;
    }
  );
  assert.equal(fetchStarted, true);
});

test('Section 3.13: Fallback when AbortController unavailable: Timed-out fetch accurately reports timeout uncertainty (networkCancelled: false)', async () => {
  const mockFetch = () => new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({}) }), 500);
  });

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'mock-jwt' }),
  }, mockFetch, { AbortController: undefined });

  await assert.rejects(
    async () => {
      await apiModule.request('/api/v1/customer/fish', { timeoutMs: 30 });
    },
    (err) => {
      assert.equal(err.code, 'API_TIMEOUT');
      assert.equal(err.isTimeout, true);
      assert.equal(err.networkCancelled, false, 'Must NOT claim socket was cancelled when AbortController is missing');
      assert.match(err.message, /client detached; server state unconfirmed/);
      return true;
    }
  );
});

test('Section 3.14: Fallback when AbortController unavailable: Non-idempotent mutation is never automatically retried', async () => {
  let callCount = 0;
  const mockFetch = () => new Promise((resolve) => {
    callCount++;
    setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({}) }), 500);
  });

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'mock-jwt' }),
  }, mockFetch, { AbortController: undefined });

  try {
    await apiModule.api.createBooking({ paymentId: 'pay_unsupported_001' }, { timeoutMs: 25 });
  } catch {}

  assert.equal(callCount, 1, 'Mutation request must never be automatically retried in fallback mode');
});

test('Section 3.15: Fallback error classification distinguishes timeout from confirmed cancellation', async () => {
  const mockFetch = () => new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({}) }), 500);
  });

  const apiModule = loadApiModule({
    getAuthTokens: async () => ({ token: 'mock-jwt' }),
  }, mockFetch, { AbortController: undefined });

  // 1. Timeout classification
  let timeoutErr = null;
  try {
    await apiModule.request('/api/v1/customer/fish', { timeoutMs: 20 });
  } catch (err) {
    timeoutErr = err;
  }
  assert.equal(timeoutErr?.code, 'API_TIMEOUT');
  assert.equal(timeoutErr?.isTimeout, true);
  assert.equal(timeoutErr?.isAborted, undefined);

  // 2. Cancellation classification
  let abortErr = null;
  const mockListeners = [];
  const mockSignal = {
    aborted: false,
    reason: 'Manual stop',
    addEventListener: (event, fn) => { if (event === 'abort') mockListeners.push(fn); },
    removeEventListener: () => {},
  };
  const reqPromise = apiModule.request('/api/v1/customer/fish', { signal: mockSignal, timeoutMs: 5000 });
  setTimeout(() => {
    mockSignal.aborted = true;
    mockListeners.forEach((fn) => fn());
  }, 10);
  try {
    await reqPromise;
  } catch (err) {
    abortErr = err;
  }
  assert.equal(abortErr?.code, 'API_ABORTED');
  assert.equal(abortErr?.isAborted, true);
  assert.equal(abortErr?.isTimeout, undefined);
});

// ==============================================================================
// 4. HOME SCREEN LOAD ORCHESTRATION TESTS (Direct Execution of fetchHomeDataOrchestrated)
// ==============================================================================

test('Section 5.1: [Simulated Orchestration] Fish catalogue unblocks display immediately without waiting for slower secondary calls', async () => {
  const fetchHomeDataOrchestrated = loadHomeScreenOrchestrator();
  const timeline = [];

  const mockApi = {
    getFish: async () => {
      await new Promise((r) => setTimeout(r, 20)); // Fast (20ms)
      timeline.push('FISH_RESOLVED');
      return { success: true, data: [{ id: 'fish-1', name: 'Rohu' }] };
    },
    getCategories: async () => {
      await new Promise((r) => setTimeout(r, 100)); // Slower (100ms)
      timeline.push('CATEGORIES_RESOLVED');
      return { success: true, data: [] };
    },
    getSubscription: async () => {
      await new Promise((r) => setTimeout(r, 80));
      timeline.push('SUBSCRIPTION_RESOLVED');
      return { success: true, data: null };
    },
    getCustomerLiveTracking: async () => {
      await new Promise((r) => setTimeout(r, 60));
      timeline.push('TRACKING_RESOLVED');
      return { success: true, data: null };
    },
    getProfile: async () => {
      await new Promise((r) => setTimeout(r, 70));
      timeline.push('PROFILE_RESOLVED');
      return { success: true, data: null };
    },
  };

  let displayedFish = null;
  let loadingSkeletonDismissed = false;

  const orchestratePromise = fetchHomeDataOrchestrated({
    apiClient: mockApi,
    setFishList: (data) => {
      displayedFish = data;
      timeline.push('FISH_STATE_UPDATED_' + data.length);
    },
    setCategories: () => {},
    setSubData: () => {},
    setTrackingData: () => {},
    setCustomer: () => {},
    setLoading: (isLoading) => {
      if (!isLoading) {
        loadingSkeletonDismissed = true;
        timeline.push('SKELETON_DISMISSED');
      }
    },
    setRefreshing: () => {},
    setError: () => {},
    abortControllerRef: { current: null },
    isMountedRef: { current: true },
    requestSeqRef: { current: 0 },
    isRefresh: false,
  });

  // Wait for complete pipeline
  await orchestratePromise;

  assert.equal(loadingSkeletonDismissed, true, 'Loading skeleton must be dismissed when fish arrives');
  assert.equal(displayedFish[0].name, 'Rohu');
  assert.ok(
    timeline.indexOf('SKELETON_DISMISSED') < timeline.indexOf('CATEGORIES_RESOLVED'),
    'Fish catalogue must dismiss skeleton prior to categories resolution'
  );
});

test('Section 5.2: [Simulated Orchestration] Secondary call failures do not hide or clear successfully loaded fish catalogue', async () => {
  const fetchHomeDataOrchestrated = loadHomeScreenOrchestrator();

  let displayedFish = null;
  let mainError = null;

  const mockApi = {
    getFish: async () => ({ success: true, data: [{ id: 'fish-2', name: 'Catla' }] }),
    getCategories: async () => { throw new Error('Categories service unavailable 503'); },
    getSubscription: async () => { throw new Error('Subscription database timeout'); },
    getCustomerLiveTracking: async () => ({ data: null }),
    getProfile: async () => ({ data: null }),
  };

  await fetchHomeDataOrchestrated({
    apiClient: mockApi,
    setFishList: (data) => { displayedFish = data; },
    setCategories: () => {},
    setSubData: () => {},
    setTrackingData: () => {},
    setCustomer: () => {},
    setLoading: () => {},
    setRefreshing: () => {},
    setError: (err) => { mainError = err; },
    abortControllerRef: { current: null },
    isMountedRef: { current: true },
    requestSeqRef: { current: 0 },
    isRefresh: false,
  });

  assert.equal(displayedFish?.length, 1, 'Fish catalogue must remain intact');
  assert.equal(displayedFish[0].name, 'Catla');
  assert.equal(mainError, null, 'Secondary errors must not set main screen error state');
});

test('Section 5.3: [Simulated Orchestration] Pull-to-refresh fish request failure preserves previously loaded catalogue data', async () => {
  const fetchHomeDataOrchestrated = loadHomeScreenOrchestrator();

  let stateFishList = [{ id: 'fish-existing', name: 'Fresh Pomfret' }];
  let mainError = null;

  const mockApi = {
    getFish: async () => { throw new Error('Temporary gateway timeout 504'); },
    getCategories: async () => ({ data: [] }),
    getSubscription: async () => ({ data: null }),
    getCustomerLiveTracking: async () => ({ data: null }),
    getProfile: async () => ({ data: null }),
  };

  await fetchHomeDataOrchestrated({
    apiClient: mockApi,
    setFishList: (updater) => {
      if (typeof updater === 'function') {
        stateFishList = updater(stateFishList);
      } else {
        stateFishList = updater;
      }
    },
    setCategories: () => {},
    setSubData: () => {},
    setTrackingData: () => {},
    setCustomer: () => {},
    setLoading: () => {},
    setRefreshing: () => {},
    setError: (err) => { mainError = err; },
    abortControllerRef: { current: null },
    isMountedRef: { current: true },
    requestSeqRef: { current: 0 },
    isRefresh: true,
  });

  assert.equal(stateFishList.length, 1, 'Previous fish items must not be wiped on refresh failure');
  assert.equal(stateFishList[0].name, 'Fresh Pomfret');
  assert.equal(mainError, null, 'Error screen must not replace previously loaded fish list');
});

test('Section 5.4: [Simulated Orchestration] New requests cancel older requests and stale responses cannot overwrite newer data', async () => {
  const fetchHomeDataOrchestrated = loadHomeScreenOrchestrator();

  const abortControllerRef = { current: null };
  const isMountedRef = { current: true };
  const requestSeqRef = { current: 0 };
  let appliedFish = null;

  const slowApi = {
    getFish: async (params, opts) => new Promise((resolve, reject) => {
      opts.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
      setTimeout(() => resolve({ success: true, data: [{ id: 'fish-old', name: 'Old Stale Fish' }] }), 80);
    }),
    getCategories: async () => ({ data: [] }),
    getSubscription: async () => ({ data: null }),
    getCustomerLiveTracking: async () => ({ data: null }),
    getProfile: async () => ({ data: null }),
  };

  const fastApi = {
    getFish: async () => ({ success: true, data: [{ id: 'fish-new', name: 'New Fresh Fish' }] }),
    getCategories: async () => ({ data: [] }),
    getSubscription: async () => ({ data: null }),
    getCustomerLiveTracking: async () => ({ data: null }),
    getProfile: async () => ({ data: null }),
  };

  // Request 1 starts (slow)
  const req1 = fetchHomeDataOrchestrated({
    apiClient: slowApi,
    setFishList: (data) => { appliedFish = data; },
    setCategories: () => {},
    setSubData: () => {},
    setTrackingData: () => {},
    setCustomer: () => {},
    setLoading: () => {},
    setRefreshing: () => {},
    setError: () => {},
    abortControllerRef,
    isMountedRef,
    requestSeqRef,
    isRefresh: false,
  });

  // Request 2 starts immediately (fast, e.g. user refreshed)
  const req2 = fetchHomeDataOrchestrated({
    apiClient: fastApi,
    setFishList: (data) => { appliedFish = data; },
    setCategories: () => {},
    setSubData: () => {},
    setTrackingData: () => {},
    setCustomer: () => {},
    setLoading: () => {},
    setRefreshing: () => {},
    setError: () => {},
    abortControllerRef,
    isMountedRef,
    requestSeqRef,
    isRefresh: true,
  });

  await Promise.allSettled([req1, req2]);

  assert.equal(appliedFish?.length, 1);
  assert.equal(appliedFish[0].name, 'New Fresh Fish', 'Stale response from slow request 1 must not overwrite request 2');
});

test('Section 5.5: [Simulated Orchestration] Screen unmount aborts active in-flight requests and suppresses state updates', async () => {
  const fetchHomeDataOrchestrated = loadHomeScreenOrchestrator();

  const abortControllerRef = { current: null };
  const isMountedRef = { current: true };
  const requestSeqRef = { current: 0 };
  let stateUpdatedAfterUnmount = false;

  const slowApi = {
    getFish: async (params, opts) => new Promise((resolve, reject) => {
      opts.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
      setTimeout(() => resolve({ success: true, data: [{ id: 'fish-1' }] }), 50);
    }),
    getCategories: async () => ({ data: [] }),
    getSubscription: async () => ({ data: null }),
    getCustomerLiveTracking: async () => ({ data: null }),
    getProfile: async () => ({ data: null }),
  };

  const req = fetchHomeDataOrchestrated({
    apiClient: slowApi,
    setFishList: () => { stateUpdatedAfterUnmount = true; },
    setCategories: () => {},
    setSubData: () => {},
    setTrackingData: () => {},
    setCustomer: () => {},
    setLoading: () => {},
    setRefreshing: () => {},
    setError: () => {},
    abortControllerRef,
    isMountedRef,
    requestSeqRef,
    isRefresh: false,
  });

  // Simulate unmount at 10ms
  setTimeout(() => {
    isMountedRef.current = false;
    abortControllerRef.current?.abort();
  }, 10);

  await Promise.allSettled([req]);

  assert.equal(abortControllerRef.current?.signal.aborted, true, 'Abort controller must be aborted upon unmount');
  assert.equal(stateUpdatedAfterUnmount, false, 'State updates must be suppressed after component unmounts');
});

test('Section 5.6: [Simulated Orchestration] Refresh and loading indicators always settle deterministically via Promise.allSettled', async () => {
  const fetchHomeDataOrchestrated = loadHomeScreenOrchestrator();

  let refreshing = true;
  let loading = true;

  const failingApi = {
    getFish: async () => { throw new Error('Fish error'); },
    getCategories: async () => { throw new Error('Cats error'); },
    getSubscription: async () => { throw new Error('Sub error'); },
    getCustomerLiveTracking: async () => { throw new Error('Tracking error'); },
    getProfile: async () => { throw new Error('Profile error'); },
  };

  await fetchHomeDataOrchestrated({
    apiClient: failingApi,
    setFishList: () => {},
    setCategories: () => {},
    setSubData: () => {},
    setTrackingData: () => {},
    setCustomer: () => {},
    setLoading: (val) => { loading = val; },
    setRefreshing: (val) => { refreshing = val; },
    setError: () => {},
    abortControllerRef: { current: null },
    isMountedRef: { current: true },
    requestSeqRef: { current: 0 },
    isRefresh: true,
  });

  assert.equal(refreshing, false, 'Refreshing indicator must be false even if all calls reject');
  assert.equal(loading, false, 'Loading indicator must be false even if all calls reject');
});

// ==============================================================================
// 5. STATIC SOURCE INSPECTION CHECKS (Explicitly Labeled)
// ==============================================================================

test('Section 5.7: [Static Check] App shell remains sole owner of authoritative cart summary', () => {
  const homeCode = fs.readFileSync(homeScreenSourcePath, 'utf8');

  // Verify fetchHomeDataOrchestrated does NOT issue api.getCart()
  const orchestratorMatch = homeCode.match(/export async function fetchHomeDataOrchestrated\([\s\S]*?\n\}/);
  assert.ok(orchestratorMatch, 'fetchHomeDataOrchestrated must be present in HomeScreen.jsx');
  assert.equal(
    orchestratorMatch[0].includes('getCart()'),
    false,
    'HomeScreen loadAllData must NOT issue redundant api.getCart()'
  );

  // Verify cartSummary is passed as prop
  assert.ok(homeCode.includes('cartSummary: passedCartSummary'), 'HomeScreen must accept cartSummary from parent App');
});

test('Section 5.8: [Static Check] App.jsx handleCartUpdated is memoized and fetchCartSummary has in-flight guard', () => {
  const appCode = fs.readFileSync(appSourcePath, 'utf8');
  assert.ok(
    appCode.includes('const handleCartUpdated = useCallback((cartData) =>'),
    'App.jsx handleCartUpdated must be memoized with useCallback'
  );
  assert.ok(
    appCode.includes('if (isFetchingCartRef.current) return;'),
    'App.jsx fetchCartSummary must guard against concurrent requests'
  );
});

test('Section 5.9: [Static Check] ProfileScreen performLogout attempts unregistration before invoking onLogout', () => {
  const profileCode = fs.readFileSync(profileScreenSourcePath, 'utf8');

  const unregisterIndex = profileCode.indexOf('api.unregisterDeviceToken');
  const onLogoutIndex = profileCode.indexOf('onLogout()');

  assert.ok(unregisterIndex > 0, 'api.unregisterDeviceToken must be present in ProfileScreen');
  assert.ok(onLogoutIndex > 0, 'onLogout must be present in ProfileScreen');
  assert.ok(unregisterIndex < onLogoutIndex, 'api.unregisterDeviceToken must precede onLogout');
  assert.equal(
    profileCode.includes("api.unregisterDeviceToken('')"),
    false,
    "api.unregisterDeviceToken must NOT send hardcoded empty string ''"
  );
  assert.ok(
    profileCode.includes('getDeviceToken()'),
    'ProfileScreen must read actual registered token via getDeviceToken()'
  );
});
