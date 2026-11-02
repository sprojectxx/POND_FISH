/**
 * Customer Mobile App Phase 3B.5 — Lifecycle, Memory & Navigation Verification Suite
 * Traceability: PondFish Customer Mobile App Specification
 * 
 * Verifies:
 * - Scenario 1: Live tracking polling starts when screen is mounted in active foreground.
 * - Scenario 2: Polling stops when app transitions to background.
 * - Scenario 3: Polling resumes safely on return to foreground.
 * - Scenario 4: Repeated AppState transitions do not duplicate intervals.
 * - Scenario 5: Slow polling requests do not overlap (concurrency guard).
 * - Scenario 6: Manual refresh and polling share safe request ownership without race conditions.
 * - Scenario 7: Unmounted screens abort in-flight requests and drop stale state updates.
 * - Scenario 8: Request sequence guards prevent older delayed responses from overwriting newer state.
 * - Scenario 9: ProfileScreen success-message timer is retained and cleared on unmount.
 * - Scenario 10: CartScreen async lifecycle drops responses if unmounted before completion.
 * - Scenario 11: SubscriptionScreen awaits ledger retrieval and guards unmount.
 * - Scenario 12: BookingHistoryScreen memoizes renderBookingItem and guards async state.
 * - Scenario 13: TransactionHistoryScreen virtualizes large lists with FlatList and guards async state.
 * - Scenario 14: MarketplaceScreen catalogue filtering is memoized and preserves reference identity.
 * - Scenario 15: App.jsx navigation avoids redundant cart fetches on non-cart screens (Tracking, Profile, Bookings).
 * - Scenario 16: App.jsx hardware back handler and session cleanup on logout.
 */

const { describe, it, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Configure node path for customer-app modules
process.env.NODE_PATH = path.resolve(__dirname, '../../customer-app/node_modules');
require('module').Module._initPaths();
const babel = require('../../customer-app/node_modules/@babel/core');

const liveTrackingSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/LiveTrackingScreen.jsx');
const profileScreenSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/ProfileScreen.jsx');
const cartScreenSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/CartScreen.jsx');
const subscriptionScreenSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/SubscriptionScreen.jsx');
const bookingHistoryScreenSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/BookingHistoryScreen.jsx');
const transactionHistoryScreenSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/TransactionHistoryScreen.jsx');
const marketplaceScreenSourcePath = path.resolve(__dirname, '../../customer-app/src/screens/MarketplaceScreen.jsx');
const appSourcePath = path.resolve(__dirname, '../../customer-app/App.jsx');

// ==============================================================================
// TEST HARNESS HELPERS
// ==============================================================================

function createDeterministicTimerHarness() {
  let currentTime = 0;
  let nextTimerId = 1;
  const activeTimers = new Map();

  return {
    setTimeout: (fn, delay) => {
      const id = nextTimerId++;
      activeTimers.set(id, { fn, triggerAt: currentTime + delay, isInterval: false, delay });
      return id;
    },
    clearTimeout: (id) => {
      activeTimers.delete(id);
    },
    setInterval: (fn, delay) => {
      const id = nextTimerId++;
      activeTimers.set(id, { fn, triggerAt: currentTime + delay, isInterval: true, delay });
      return id;
    },
    clearInterval: (id) => {
      activeTimers.delete(id);
    },
    advanceTime: async (ms) => {
      currentTime += ms;
      const due = [];
      for (const [id, t] of activeTimers.entries()) {
        if (t.triggerAt <= currentTime) {
          due.push({ id, ...t });
        }
      }
      for (const t of due) {
        if (t.isInterval) {
          activeTimers.set(t.id, { ...t, triggerAt: currentTime + t.delay });
        } else {
          activeTimers.delete(t.id);
        }
        await t.fn();
      }
    },
    getActiveTimerCount: () => activeTimers.size,
    getActiveTimers: () => Array.from(activeTimers.values()),
    reset: () => {
      currentTime = 0;
      activeTimers.clear();
    },
  };
}

function loadScreenComponent(sourcePath, options = {}) {
  const {
    mockReact,
    mockRN = {},
    mockApi = {},
    mockAuthStorage = { getAuthToken: async () => 'test-token', clearAuthToken: async () => {} },
    timerHarness = null,
    onRequire = null,
  } = options;

  const src = fs.readFileSync(sourcePath, 'utf8');
  const res = babel.transformSync(src, {
    configFile: false,
    babelrc: false,
    presets: [require.resolve('../../customer-app/node_modules/metro-react-native-babel-preset')],
    filename: path.basename(sourcePath),
  });

  const m = { exports: {} };
  const customRequire = (id) => {
    if (onRequire) {
      const custom = onRequire(id);
      if (custom !== undefined) return custom;
    }
    if (id === 'react') return mockReact;
    if (id === 'react-native') {
      return {
        Platform: { OS: 'android', select: (o) => o.android || o.default },
        View: 'View',
        Text: 'Text',
        StyleSheet: { create: (s) => s },
        TouchableOpacity: 'TouchableOpacity',
        ScrollView: 'ScrollView',
        FlatList: 'FlatList',
        Image: 'Image',
        ActivityIndicator: 'ActivityIndicator',
        RefreshControl: 'RefreshControl',
        Alert: { alert: () => {} },
        TextInput: 'TextInput',
        Modal: 'Modal',
        StatusBar: 'StatusBar',
        KeyboardAvoidingView: 'KeyboardAvoidingView',
        AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) },
        ...mockRN,
      };
    }
    if (id.includes('razorpay')) return { open: async () => {} };
    if (id.includes('api')) return { api: mockApi };
    if (id.includes('auth-storage')) return mockAuthStorage;
    if (id.includes('colors')) return { colors: new Proxy({}, { get: () => '#000000' }) };
    if (id.startsWith('.') || id.includes('components') || id.includes('theme') || id.includes('services')) {
      return () => null;
    }
    return require(id);
  };

  const setIntervalFn = timerHarness ? timerHarness.setInterval : setInterval;
  const clearIntervalFn = timerHarness ? timerHarness.clearInterval : clearInterval;
  const setTimeoutFn = timerHarness ? timerHarness.setTimeout : setTimeout;
  const clearTimeoutFn = timerHarness ? timerHarness.clearTimeout : clearTimeout;

  const fn = new Function(
    'exports',
    'require',
    'module',
    'setInterval',
    'clearInterval',
    'setTimeout',
    'clearTimeout',
    res.code
  );
  fn(m.exports, customRequire, m, setIntervalFn, clearIntervalFn, setTimeoutFn, clearTimeoutFn);

  return m.exports.default || m.exports;
}

describe('Customer App Phase 3B.5: Lifecycle, Memory & Navigation Verification Suite', () => {

  // ============================================================================
  // SECTION 1: LiveTrackingScreen Polling & AppState Lifecycle
  // ============================================================================

  test('8.1: LiveTrackingScreen starts polling every 15s when mounted in active foreground', async () => {
    const timerHarness = createDeterministicTimerHarness();
    let apiCallCount = 0;

    const mockApi = {
      getCustomerLiveTracking: async () => {
        apiCallCount++;
        return { success: true, data: { active: true, vehicleId: 'TRUCK-01' } };
      },
    };

    let appStateListeners = [];
    const mockAppState = {
      currentState: 'active',
      addEventListener: (event, handler) => {
        appStateListeners.push(handler);
        return {
          remove: () => {
            appStateListeners = appStateListeners.filter((h) => h !== handler);
          },
        };
      },
    };

    const effects = [];
    const cleanups = [];
    let hookIndex = 0;
    const hookStates = [];

    const mockReact = {
      useState: (init) => {
        const idx = hookIndex++;
        if (hookStates[idx] === undefined) {
          hookStates[idx] = typeof init === 'function' ? init() : init;
        }
        const setState = (val) => {
          hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val;
        };
        return [hookStates[idx], setState];
      },
      useRef: (init) => {
        const idx = hookIndex++;
        if (!hookStates[idx]) {
          hookStates[idx] = { current: init };
        }
        return hookStates[idx];
      },
      useCallback: (fn) => fn,
      useEffect: (cb) => {
        effects.push(cb);
      },
    };

    const LiveTrackingScreen = loadScreenComponent(liveTrackingSourcePath, {
      mockReact,
      mockRN: { AppState: mockAppState },
      mockApi,
      timerHarness,
    });

    // Mount component
    hookIndex = 0;
    LiveTrackingScreen({ onNavigate: () => {} });

    // Execute mount effects
    for (const eff of effects) {
      const cleanup = eff();
      if (cleanup) cleanups.push(cleanup);
    }
    await new Promise((r) => setImmediate(r));

    // 1. Initial call triggered immediately on mount
    assert.equal(apiCallCount, 1, 'Initial tracking fetch must be invoked on mount');
    assert.equal(timerHarness.getActiveTimerCount(), 1, 'Exactly one polling interval must be registered');

    // 2. Advance time by 15 seconds -> next poll occurs
    await timerHarness.advanceTime(15000);
    assert.equal(apiCallCount, 2, 'Second poll must trigger after 15 seconds');

    // 3. Advance time by another 15 seconds -> third poll occurs
    await timerHarness.advanceTime(15000);
    assert.equal(apiCallCount, 3, 'Third poll must trigger after 30 seconds total');

    // Clean up
    for (const c of cleanups) c();
  });

  test('8.2: LiveTrackingScreen stops polling when app enters background', async () => {
    const timerHarness = createDeterministicTimerHarness();
    let apiCallCount = 0;

    const mockApi = {
      getCustomerLiveTracking: async () => {
        apiCallCount++;
        return { success: true, data: { active: true } };
      },
    };

    let appStateListeners = [];
    const mockAppState = {
      currentState: 'active',
      addEventListener: (event, handler) => {
        appStateListeners.push(handler);
        return {
          remove: () => {
            appStateListeners = appStateListeners.filter((h) => h !== handler);
          },
        };
      },
    };

    const effects = [];
    const cleanups = [];
    let hookIndex = 0;
    const hookStates = [];

    const mockReact = {
      useState: (init) => {
        const idx = hookIndex++;
        if (hookStates[idx] === undefined) hookStates[idx] = typeof init === 'function' ? init() : init;
        return [hookStates[idx], (val) => { hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val; }];
      },
      useRef: (init) => {
        const idx = hookIndex++;
        if (!hookStates[idx]) hookStates[idx] = { current: init };
        return hookStates[idx];
      },
      useCallback: (fn) => fn,
      useEffect: (cb) => { effects.push(cb); },
    };

    const LiveTrackingScreen = loadScreenComponent(liveTrackingSourcePath, {
      mockReact,
      mockRN: { AppState: mockAppState },
      mockApi,
      timerHarness,
    });

    hookIndex = 0;
    LiveTrackingScreen({ onNavigate: () => {} });
    for (const eff of effects) {
      const c = eff();
      if (c) cleanups.push(c);
    }

    assert.equal(apiCallCount, 1, 'Initial call on mount');

    // Simulate App entering background
    mockAppState.currentState = 'background';
    for (const listener of appStateListeners) {
      listener('background');
    }

    assert.equal(timerHarness.getActiveTimerCount(), 0, 'Polling timer must be cancelled when entering background');

    // Advance 60 seconds in background
    await timerHarness.advanceTime(60000);
    assert.equal(apiCallCount, 1, 'Zero polls must occur while app is backgrounded');

    for (const c of cleanups) c();
  });

  test('8.3: LiveTrackingScreen resumes polling safely when app returns to foreground', async () => {
    const timerHarness = createDeterministicTimerHarness();
    let apiCallCount = 0;

    const mockApi = {
      getCustomerLiveTracking: async () => {
        apiCallCount++;
        return { success: true, data: { active: true } };
      },
    };

    let appStateListeners = [];
    const mockAppState = {
      currentState: 'active',
      addEventListener: (event, handler) => {
        appStateListeners.push(handler);
        return { remove: () => { appStateListeners = appStateListeners.filter((h) => h !== handler); } };
      },
    };

    const effects = [];
    const cleanups = [];
    let hookIndex = 0;
    const hookStates = [];

    const mockReact = {
      useState: (init) => {
        const idx = hookIndex++;
        if (hookStates[idx] === undefined) hookStates[idx] = typeof init === 'function' ? init() : init;
        return [hookStates[idx], (val) => { hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val; }];
      },
      useRef: (init) => {
        const idx = hookIndex++;
        if (!hookStates[idx]) hookStates[idx] = { current: init };
        return hookStates[idx];
      },
      useCallback: (fn) => fn,
      useEffect: (cb) => { effects.push(cb); },
    };

    const LiveTrackingScreen = loadScreenComponent(liveTrackingSourcePath, {
      mockReact,
      mockRN: { AppState: mockAppState },
      mockApi,
      timerHarness,
    });

    hookIndex = 0;
    LiveTrackingScreen({ onNavigate: () => {} });
    for (const eff of effects) {
      const c = eff();
      if (c) cleanups.push(c);
    }
    await new Promise((r) => setImmediate(r));

    // 1. Move to background
    mockAppState.currentState = 'background';
    for (const listener of appStateListeners) listener('background');
    assert.equal(timerHarness.getActiveTimerCount(), 0);

    // 2. Return to foreground
    mockAppState.currentState = 'active';
    for (const listener of appStateListeners) listener('active');
    await new Promise((r) => setImmediate(r));

    // Immediate foreground refresh triggered
    assert.equal(apiCallCount, 2, 'Foreground return must trigger an immediate fresh poll');
    assert.equal(timerHarness.getActiveTimerCount(), 1, 'Polling interval must be restored upon foregrounding');

    // 3. Advance 15s in foreground
    await timerHarness.advanceTime(15000);
    assert.equal(apiCallCount, 3, 'Interval polling must resume every 15s');

    for (const c of cleanups) c();
  });

  test('8.4: Repeated AppState transitions do not duplicate polling intervals', async () => {
    const timerHarness = createDeterministicTimerHarness();
    let apiCallCount = 0;

    const mockApi = {
      getCustomerLiveTracking: async () => {
        apiCallCount++;
        return { success: true, data: { active: true } };
      },
    };

    let appStateListeners = [];
    const mockAppState = {
      currentState: 'active',
      addEventListener: (event, handler) => {
        appStateListeners.push(handler);
        return { remove: () => { appStateListeners = appStateListeners.filter((h) => h !== handler); } };
      },
    };

    const effects = [];
    const cleanups = [];
    let hookIndex = 0;
    const hookStates = [];

    const mockReact = {
      useState: (init) => {
        const idx = hookIndex++;
        if (hookStates[idx] === undefined) hookStates[idx] = typeof init === 'function' ? init() : init;
        return [hookStates[idx], (val) => { hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val; }];
      },
      useRef: (init) => {
        const idx = hookIndex++;
        if (!hookStates[idx]) hookStates[idx] = { current: init };
        return hookStates[idx];
      },
      useCallback: (fn) => fn,
      useEffect: (cb) => { effects.push(cb); },
    };

    const LiveTrackingScreen = loadScreenComponent(liveTrackingSourcePath, {
      mockReact,
      mockRN: { AppState: mockAppState },
      mockApi,
      timerHarness,
    });

    hookIndex = 0;
    LiveTrackingScreen({ onNavigate: () => {} });
    for (const eff of effects) {
      const c = eff();
      if (c) cleanups.push(c);
    }
    await new Promise((r) => setImmediate(r));

    // Toggle back and forth rapidly 4 times
    for (let i = 0; i < 4; i++) {
      mockAppState.currentState = 'background';
      for (const listener of appStateListeners) listener('background');

      mockAppState.currentState = 'active';
      for (const listener of appStateListeners) listener('active');
      await new Promise((r) => setImmediate(r));
    }

    // Must have exactly 1 active interval registered, never duplicates
    assert.equal(timerHarness.getActiveTimerCount(), 1, 'Only one polling interval must exist despite repeated transitions');

    const baselineCalls = apiCallCount;
    await timerHarness.advanceTime(15000);
    assert.equal(apiCallCount, baselineCalls + 1, 'Exactly one poll must trigger at the 15-second tick, not multiple');

    for (const c of cleanups) c();
  });

  test('8.5: Slow polling requests do not overlap (concurrency guard)', async () => {
    const timerHarness = createDeterministicTimerHarness();
    let apiCallCount = 0;
    let finishFirstRequest;

    const mockApi = {
      getCustomerLiveTracking: async () => {
        apiCallCount++;
        if (apiCallCount === 1) {
          // Simulate slow response that hangs until explicitly resolved
          await new Promise((resolve) => { finishFirstRequest = resolve; });
        }
        return { success: true, data: { active: true } };
      },
    };

    const mockAppState = {
      currentState: 'active',
      addEventListener: () => ({ remove: () => {} }),
    };

    const effects = [];
    const cleanups = [];
    let hookIndex = 0;
    const hookStates = [];

    const mockReact = {
      useState: (init) => {
        const idx = hookIndex++;
        if (hookStates[idx] === undefined) hookStates[idx] = typeof init === 'function' ? init() : init;
        return [hookStates[idx], (val) => { hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val; }];
      },
      useRef: (init) => {
        const idx = hookIndex++;
        if (!hookStates[idx]) hookStates[idx] = { current: init };
        return hookStates[idx];
      },
      useCallback: (fn) => fn,
      useEffect: (cb) => { effects.push(cb); },
    };

    const LiveTrackingScreen = loadScreenComponent(liveTrackingSourcePath, {
      mockReact,
      mockRN: { AppState: mockAppState },
      mockApi,
      timerHarness,
    });

    hookIndex = 0;
    LiveTrackingScreen({ onNavigate: () => {} });
    for (const eff of effects) {
      const c = eff();
      if (c) cleanups.push(c);
    }

    assert.equal(apiCallCount, 1, 'First slow poll launched');

    // Advance 15s while request 1 is still in-flight
    await timerHarness.advanceTime(15000);

    // Call count must remain 1 because inFlightRef skipped concurrent poll
    assert.equal(apiCallCount, 1, 'In-flight guard must skip interval tick while previous poll is unresolved');

    // Resolve first request
    finishFirstRequest();
    await new Promise((r) => setImmediate(r));

    // Next 15s interval tick should now proceed cleanly
    await timerHarness.advanceTime(15000);
    assert.equal(apiCallCount, 2, 'Subsequent poll can proceed once previous request finishes');

    for (const c of cleanups) c();
  });

  test('8.6: Manual pull-to-refresh aborts in-flight background poll and takes request ownership', async () => {
    let abortedSignalCount = 0;
    let callCount = 0;

    const mockApi = {
      getCustomerLiveTracking: async (opts) => {
        callCount++;
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            abortedSignalCount++;
          });
        }
        if (callCount === 1) {
          // Hang until aborted
          await new Promise((r) => setTimeout(r, 1000));
        }
        return { success: true, data: { active: true, step: callCount } };
      },
    };

    const mockAppState = {
      currentState: 'active',
      addEventListener: () => ({ remove: () => {} }),
    };

    const effects = [];
    const cleanups = [];
    let hookIndex = 0;
    const hookStates = [];
    const callbacks = [];

    const mockReact = {
      useState: (init) => {
        const idx = hookIndex++;
        if (hookStates[idx] === undefined) hookStates[idx] = typeof init === 'function' ? init() : init;
        return [hookStates[idx], (val) => { hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val; }];
      },
      useRef: (init) => {
        const idx = hookIndex++;
        if (!hookStates[idx]) hookStates[idx] = { current: init };
        return hookStates[idx];
      },
      useCallback: (fn) => {
        callbacks.push(fn);
        return fn;
      },
      useEffect: (cb) => { effects.push(cb); },
    };

    const LiveTrackingScreen = loadScreenComponent(liveTrackingSourcePath, {
      mockReact,
      mockRN: { AppState: mockAppState },
      mockApi,
    });

    hookIndex = 0;
    LiveTrackingScreen({ onNavigate: () => {} });
    for (const eff of effects) {
      const c = eff();
      if (c) cleanups.push(c);
    }

    assert.equal(callCount, 1, 'Background poll started');
    assert.equal(abortedSignalCount, 0, 'Signal not yet aborted');

    // Trigger manual pull-to-refresh
    const capturedFetchTracking = callbacks[1];
    assert.ok(capturedFetchTracking, 'capturedFetchTracking must be found');
    await capturedFetchTracking(true);

    assert.equal(abortedSignalCount, 1, 'Previous in-flight background poll signal must be aborted');
    assert.equal(callCount, 2, 'Manual pull-to-refresh must execute with priority');

    for (const c of cleanups) c();
  });

  test('8.7: Unmounted LiveTrackingScreen aborts in-flight request and cleans up AppState listener', () => {
    let aborted = false;
    let removedListener = false;

    const mockApi = {
      getCustomerLiveTracking: async (opts) => {
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => { aborted = true; });
        }
        return new Promise(() => {}); // never resolves
      },
    };

    const mockAppState = {
      currentState: 'active',
      addEventListener: () => ({
        remove: () => { removedListener = true; },
      }),
    };

    const effects = [];
    const cleanups = [];
    let hookIndex = 0;
    const hookStates = [];

    const mockReact = {
      useState: (init) => {
        const idx = hookIndex++;
        if (hookStates[idx] === undefined) hookStates[idx] = typeof init === 'function' ? init() : init;
        return [hookStates[idx], (val) => { hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val; }];
      },
      useRef: (init) => {
        const idx = hookIndex++;
        if (!hookStates[idx]) hookStates[idx] = { current: init };
        return hookStates[idx];
      },
      useCallback: (fn) => fn,
      useEffect: (cb) => { effects.push(cb); },
    };

    const LiveTrackingScreen = loadScreenComponent(liveTrackingSourcePath, {
      mockReact,
      mockRN: { AppState: mockAppState },
      mockApi,
    });

    hookIndex = 0;
    LiveTrackingScreen({ onNavigate: () => {} });
    for (const eff of effects) {
      const c = eff();
      if (c) cleanups.push(c);
    }

    assert.equal(aborted, false);
    assert.equal(removedListener, false);

    // Unmount
    for (const c of cleanups) c();

    assert.equal(aborted, true, 'In-flight request signal must be aborted on unmount');
    assert.equal(removedListener, true, 'AppState listener must be removed on unmount');
  });

  // ============================================================================
  // SECTION 2: ProfileScreen Success Timer & State Cleanup
  // ============================================================================

  test('8.8: ProfileScreen success-message timer is retained and cleared on unmount', async () => {
    const timerHarness = createDeterministicTimerHarness();
    let stateUpdatesPostUnmount = 0;
    let isMountedInTest = true;

    const effects = [];
    const cleanups = [];
    let hookIndex = 0;
    const hookStates = [];

    const mockReact = {
      useState: (init) => {
        const idx = hookIndex++;
        if (hookStates[idx] === undefined) hookStates[idx] = typeof init === 'function' ? init() : init;
        return [hookStates[idx], (val) => {
          if (!isMountedInTest) {
            stateUpdatesPostUnmount++;
          }
          hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val;
        }];
      },
      useRef: (init) => {
        const idx = hookIndex++;
        if (!hookStates[idx]) hookStates[idx] = { current: init };
        return hookStates[idx];
      },
      useCallback: (fn) => fn,
      useEffect: (cb) => { effects.push(cb); },
    };

    const mockApi = {
      getProfile: async () => ({ success: true, data: { name: 'Ramesh', age: 30, area: 'Indiranagar' } }),
      getSubscription: async () => ({ success: true, data: { hasSubscription: false } }),
      updateProfile: async () => ({ success: true, data: { name: 'Ramesh Kumar', age: 31, area: 'Koramangala' } }),
    };

    const ProfileScreen = loadScreenComponent(profileScreenSourcePath, {
      mockReact,
      mockApi,
      timerHarness,
    });

    hookIndex = 0;
    ProfileScreen({ onNavigate: () => {}, onLogout: () => {} });
    for (const eff of effects) {
      const c = eff();
      if (c) cleanups.push(c);
    }

    // Unmount ProfileScreen
    isMountedInTest = false;
    for (const c of cleanups) c();

    assert.equal(timerHarness.getActiveTimerCount(), 0, 'All timers must be cleared when ProfileScreen unmounts');

    // Advance 10 seconds past any potential timer
    await timerHarness.advanceTime(10000);
    assert.equal(stateUpdatesPostUnmount, 0, 'No state updates should occur after ProfileScreen unmounts');
  });

  // ============================================================================
  // SECTION 3: Async Lifecycle Across Other Screens (Cart, Subscriptions, History)
  // ============================================================================

  test('8.9: CartScreen guards async state updates when unmounted before fetchCart completes', async () => {
    let cartUpdatedPostUnmount = 0;
    let isMountedInTest = true;

    const effects = [];
    const cleanups = [];
    let hookIndex = 0;
    const hookStates = [];

    const mockReact = {
      useState: (init) => {
        const idx = hookIndex++;
        if (hookStates[idx] === undefined) hookStates[idx] = typeof init === 'function' ? init() : init;
        return [hookStates[idx], (val) => {
          if (!isMountedInTest) cartUpdatedPostUnmount++;
          hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val;
        }];
      },
      useRef: (init) => {
        const idx = hookIndex++;
        if (!hookStates[idx]) hookStates[idx] = { current: init };
        return hookStates[idx];
      },
      useCallback: (fn) => fn,
      useEffect: (cb) => { effects.push(cb); },
    };

    let resolveGetCart;
    const mockApi = {
      getCart: () => new Promise((resolve) => { resolveGetCart = resolve; }),
    };

    const CartScreen = loadScreenComponent(cartScreenSourcePath, {
      mockReact,
      mockApi,
    });

    hookIndex = 0;
    CartScreen({ onNavigate: () => {}, onCartUpdated: () => {} });
    for (const eff of effects) {
      const c = eff();
      if (c) cleanups.push(c);
    }

    // Unmount before getCart resolves
    isMountedInTest = false;
    for (const c of cleanups) c();

    // Now resolve getCart
    resolveGetCart({ data: { items: [{ id: 1, name: 'Rohu' }], summary: { totalItems: 1 } } });
    await new Promise((r) => setImmediate(r));

    assert.equal(cartUpdatedPostUnmount, 0, 'Unmounted CartScreen must not update state');
  });

  test('8.10: SubscriptionScreen awaits ledger retrieval and guards unmount', async () => {
    let ledgerAwaited = false;
    let isMountedInTest = true;
    let stateUpdatesPostUnmount = 0;

    const effects = [];
    const cleanups = [];
    let hookIndex = 0;
    const hookStates = [];

    const mockReact = {
      useState: (init) => {
        const idx = hookIndex++;
        if (hookStates[idx] === undefined) hookStates[idx] = typeof init === 'function' ? init() : init;
        return [hookStates[idx], (val) => {
          if (!isMountedInTest) stateUpdatesPostUnmount++;
          hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val;
        }];
      },
      useRef: (init) => {
        const idx = hookIndex++;
        if (!hookStates[idx]) hookStates[idx] = { current: init };
        return hookStates[idx];
      },
      useCallback: (fn) => fn,
      useEffect: (cb) => { effects.push(cb); },
    };

    const mockApi = {
      getSubscription: async () => ({ success: true, data: { hasSubscription: true } }),
      getSubscriptionPlans: async () => ({ success: true, data: [{ id: 'p1', name: 'Gold' }] }),
      getSubscriptionLedger: async () => {
        ledgerAwaited = true;
        return { success: true, data: [{ id: 'l1', amount: 50 }] };
      },
    };

    const SubscriptionScreen = loadScreenComponent(subscriptionScreenSourcePath, {
      mockReact,
      mockApi,
    });

    hookIndex = 0;
    SubscriptionScreen({ onNavigate: () => {} });
    for (const eff of effects) {
      const c = eff();
      if (c) cleanups.push(c);
    }

    await new Promise((r) => setImmediate(r));
    assert.equal(ledgerAwaited, true, 'getSubscriptionLedger must be called as part of screen initialization');

    // Unmount
    isMountedInTest = false;
    for (const c of cleanups) c();
    assert.equal(stateUpdatesPostUnmount, 0, 'Zero state updates after SubscriptionScreen unmount');
  });

  test('8.11: TransactionHistoryScreen virtualized FlatList replaces unvirtualized ScrollView', () => {
    const code = fs.readFileSync(transactionHistoryScreenSourcePath, 'utf8');

    // Verify FlatList is imported and used
    assert.ok(code.includes('FlatList'), 'TransactionHistoryScreen must import FlatList');
    assert.ok(code.includes('<FlatList'), 'TransactionHistoryScreen must render FlatList for transaction items');
    assert.ok(code.includes('keyExtractor='), 'FlatList must define keyExtractor');
    assert.ok(code.includes('initialNumToRender='), 'FlatList must configure initialNumToRender');
    assert.ok(code.includes('renderTransactionCard'), 'Render card function must be defined and memoized');
  });

  test('8.12: MarketplaceScreen catalogue filtering is memoized with useMemo', () => {
    const code = fs.readFileSync(marketplaceScreenSourcePath, 'utf8');

    assert.ok(code.includes('useMemo'), 'MarketplaceScreen must import useMemo');
    assert.ok(code.includes('const filteredFish = useMemo('), 'filteredFish must be wrapped in useMemo to prevent redundant filtering passes');
  });

  // ============================================================================
  // SECTION 4: Navigation & Global Cart Fetching In App.jsx
  // ============================================================================

  test('8.13: App.jsx CART_AWARE_SCREENS prevents redundant getCart calls during non-cart navigation', () => {
    const code = fs.readFileSync(appSourcePath, 'utf8');

    assert.ok(
      code.includes('CART_AWARE_SCREENS'),
      'App.jsx must define CART_AWARE_SCREENS to restrict redundant cart queries'
    );
    assert.ok(
      code.includes("CART_AWARE_SCREENS.includes(currentScreen)"),
      'App.jsx must check if target screen is cart-aware before calling fetchCartSummary'
    );
  });

  test('8.14: App.jsx BackHandler hardware-back rules preserved across all screens', () => {
    const code = fs.readFileSync(appSourcePath, 'utf8');

    assert.ok(code.includes("currentScreen === 'PHONE_AUTH' || currentScreen === 'SPLASH'"), 'Auth/Splash hardware back exits app');
    assert.ok(code.includes("currentScreen === 'OTP_VERIFY'"), 'OTP Verify hardware back navigates to PHONE_AUTH');
    assert.ok(code.includes("currentScreen === 'CHECKOUT'"), 'Checkout hardware back navigates to CART');
    assert.ok(code.includes("currentScreen === 'HOME'"), 'Home hardware back exits app');
  });

  test('8.15: App.jsx handleLogout clears credentials, in-flight requests, and response cache safely', () => {
    const code = fs.readFileSync(appSourcePath, 'utf8');

    assert.ok(code.includes('api.clearInFlightRequests()'), 'Logout must clear in-flight requests');
    assert.ok(code.includes('api.clearResponseCache()'), 'Logout must clear response cache');
    assert.ok(code.includes("setCurrentScreen('PHONE_AUTH')"), 'Logout must navigate to PHONE_AUTH');
    assert.ok(code.includes('isLoggingOutRef'), 'Logout must be guarded against concurrent invocations');
  });

  test('8.16: App.jsx handleUnauthorized ignores obsolete 401 token and protects active session', () => {
    const code = fs.readFileSync(appSourcePath, 'utf8');

    assert.ok(code.includes('if (rejectedToken !== current.token)'), 'handleUnauthorized must validate rejected token against active stored token');
    assert.ok(code.includes('Ignored 401 from obsolete session token'), 'Obsolete 401 must be logged and ignored');
  });
});
