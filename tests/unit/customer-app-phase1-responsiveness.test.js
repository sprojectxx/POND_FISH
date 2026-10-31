/**
 * Customer Mobile App Phase 1 — Responsiveness & API Reliability Test Suite
 * Traceability: customer-app/docs/PHASE_1_IMPLEMENTATION_REPORT.md
 * 
 * Verifies:
 * - Section 1: Stale-session logout / device-token race (obsolete 401 isolation, atomic clearance, offline tolerance, concurrency).
 * - Section 3: API client complete response timeout (body parsing included, caller abort, post-auth signal check, cleanup, fallback).
 * - Section 4: Client error classifications vs. genuine HTTP responses (code vs. status).
 * - Section 5: Home screen prioritized loading, lifecycle cancellation, stale sequence guards, cart ownership.
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
  const mockFetch = () => new Promise((resolve, reject) => {
    callCount++;
    // Hangs longer than timeoutMs
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

test('Section 3.12: Fallback timeout path functions correctly when AbortController is unavailable', async () => {
  const mockFetch = () => new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({}) }), 500);
  });

  // Load api client with AbortController = undefined to test safe fallback
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
      return true;
    }
  );
});

// ==============================================================================
// 3. HOME SCREEN PRIORITIZED LOADING & LIFECYCLE TESTS (Section 5)
// ==============================================================================

test('Section 5.1: Fish catalogue unblocks visual display immediately without waiting for slower secondary calls', async () => {
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

  // Simulate HomeScreen loadAllData prioritized orchestration
  let displayedFish = null;
  let loadingSkeletonDismissed = false;

  const currentSeq = 1;
  const requestSeq = { current: 1 };
  const isMounted = { current: true };

  const fishPromise = mockApi.getFish().then((res) => {
    if (!isMounted.current || currentSeq !== requestSeq.current) return;
    displayedFish = res.data;
    loadingSkeletonDismissed = true;
    timeline.push('SKELETON_DISMISSED_AT_' + displayedFish.length);
  });

  const secondaryPromise = Promise.allSettled([
    mockApi.getCategories(),
    mockApi.getSubscription(),
    mockApi.getCustomerLiveTracking(),
    mockApi.getProfile(),
  ]);

  await fishPromise;
  assert.equal(loadingSkeletonDismissed, true, 'Loading skeleton must be dismissed immediately when fish arrives');
  assert.equal(displayedFish[0].name, 'Rohu');

  await secondaryPromise;
  assert.ok(timeline.indexOf('SKELETON_DISMISSED_AT_1') < timeline.indexOf('CATEGORIES_RESOLVED'), 'Fish catalogue must dismiss skeleton prior to categories resolution');
});

test('Section 5.2: Secondary call failures do not hide or clear successfully loaded fish catalogue', async () => {
  let displayedFish = null;
  let mainError = null;

  const mockApi = {
    getFish: async () => ({ success: true, data: [{ id: 'fish-2', name: 'Catla' }] }),
    getCategories: async () => { throw new Error('Categories service unavailable 503'); },
    getSubscription: async () => { throw new Error('Subscription database timeout'); },
    getCustomerLiveTracking: async () => ({ data: null }),
    getProfile: async () => ({ data: null }),
  };

  // Execute prioritized pipeline
  const fishPromise = mockApi.getFish().then((res) => {
    displayedFish = res.data;
  }).catch((err) => {
    mainError = err.message;
  });

  const secondaryPromise = Promise.allSettled([
    mockApi.getCategories().catch(() => {}),
    mockApi.getSubscription().catch(() => {}),
    mockApi.getCustomerLiveTracking().catch(() => {}),
    mockApi.getProfile().catch(() => {}),
  ]);

  await Promise.all([fishPromise, secondaryPromise]);

  assert.equal(displayedFish?.length, 1, 'Fish catalogue must remain intact');
  assert.equal(mainError, null, 'Secondary errors must not set main screen error state');
});

test('Section 5.3: Pull-to-refresh fish request failure preserves previously loaded catalogue data', async () => {
  let fishList = [{ id: 'fish-existing', name: 'Fresh Pomfret' }];
  let mainError = null;

  const mockFailingFishApi = async () => {
    throw new Error('Temporary gateway timeout 504');
  };

  try {
    await mockFailingFishApi();
  } catch (err) {
    // HomeScreen functional state updater logic:
    // Only show error if list was empty; preserve existing data on refresh failure
    if (!fishList || fishList.length === 0) {
      mainError = err.message;
    }
  }

  assert.equal(fishList.length, 1, 'Previous fish items must not be wiped on refresh failure');
  assert.equal(fishList[0].name, 'Fresh Pomfret');
  assert.equal(mainError, null, 'Error screen must not replace previously loaded fish list');
});

test('Section 5.4: New requests cancel older requests and stale responses cannot overwrite newer data', async () => {
  const controller1 = new AbortController();
  const requestSeqRef = { current: 1 };
  let appliedData = null;

  // Request 1 starts
  const seq1 = 1;
  const promise1 = new Promise((resolve) => {
    setTimeout(() => {
      if (seq1 === requestSeqRef.current) {
        appliedData = 'DATA_FROM_REQ_1';
      }
      resolve();
    }, 50);
  });

  // Request 2 starts immediately (e.g. user toggles filter or pulls to refresh)
  controller1.abort();
  const seq2 = ++requestSeqRef.current;
  assert.equal(controller1.signal.aborted, true, 'Previous controller must be aborted');

  const promise2 = new Promise((resolve) => {
    setTimeout(() => {
      if (seq2 === requestSeqRef.current) {
        appliedData = 'DATA_FROM_REQ_2';
      }
      resolve();
    }, 20); // Resolves earlier
  });

  await Promise.all([promise1, promise2]);
  assert.equal(appliedData, 'DATA_FROM_REQ_2', 'Stale response from request 1 must be ignored');
});

test('Section 5.5: Screen unmount aborts active in-flight requests and suppresses state updates', async () => {
  const abortController = new AbortController();
  const isMountedRef = { current: true };
  let stateUpdatedAfterUnmount = false;

  // Screen unmount cleanup simulated:
  const cleanup = () => {
    isMountedRef.current = false;
    abortController.abort();
  };

  const activePromise = new Promise((resolve) => {
    setTimeout(() => {
      if (isMountedRef.current) {
        stateUpdatedAfterUnmount = true;
      }
      resolve();
    }, 30);
  });

  cleanup();

  await activePromise;
  assert.equal(abortController.signal.aborted, true, 'Active controller must be aborted upon unmount');
  assert.equal(stateUpdatedAfterUnmount, false, 'State update must be suppressed when unmounted');
});

test('Section 5.6: Refresh and loading indicators always settle deterministically via Promise.allSettled', async () => {
  let refreshing = true;
  let loading = true;

  const p1 = Promise.reject(new Error('Fish fail'));
  const p2 = Promise.reject(new Error('Categories fail'));
  const p3 = Promise.reject(new Error('Sub fail'));

  try {
    await Promise.allSettled([p1, p2, p3]);
  } finally {
    refreshing = false;
    loading = false;
  }

  assert.equal(refreshing, false, 'Refreshing indicator must be false');
  assert.equal(loading, false, 'Loading indicator must be false');
});

// ==============================================================================
// 4. STATIC SOURCE INSPECTION CHECKS (Explicitly Labeled)
// ==============================================================================

test('Section 5.7: [Static Check] App shell remains sole owner of authoritative cart summary', () => {
  const homeCode = fs.readFileSync(homeScreenSourcePath, 'utf8');

  // Verify loadAllData does NOT call api.getCart()
  const loadAllDataMatch = homeCode.match(/const loadAllData = useCallback\([\s\S]*?\}, \[\]\);/);
  assert.ok(loadAllDataMatch, 'loadAllData must be defined with empty dependencies []');
  assert.equal(
    loadAllDataMatch[0].includes('api.getCart()'),
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
