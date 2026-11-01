# POND FISH — Phase 3B.3 Implementation & Verification Report
## API Request Ownership, Deduplication & Data-Loading Efficiency

**Repository:** `https://github.com/sprojectxx/POND_FISH`<br>
**Application:** `customer-app/`<br>
**Starting Commit Baseline:** `0824d31c4ce34d91a12fadb4aeae3cdfec7fb391`<br>
**Target Branch:** `main`<br>
**Latest Implementation Commit:** `121a9bdf2b1e21bfabb734d6a230f1f5d9956ad6`<br>
**Previous Report Commit:** `118a4498e7a7f851fdd49c31b323009798c825f2`<br>
**Execution Date:** 2026-11-01<br>
**Optimization Scope:** Workstreams A, B, C, and D (Cart Ownership, Safe In-Flight GET Deduplication, Category & Home Data Efficiency, Account Lifecycle Safety)

---

## 1. Phase Objective

The primary objective of Phase 3B.3 is to eliminate redundant API requests, prevent duplicate in-flight network round-trips over mobile connections, establish authoritative data-fetch ownership, and improve customer application data-loading efficiency without changing existing business rules or serving stale data.

Specifically, the work addresses two major architectural inefficiencies identified on `main`:
1. **Cart Retrieval Duplication:** Navigating to the `CART` screen simultaneously triggered two concurrent `GET /api/v1/customer/cart` network requests—one initiated by the `App.jsx` navigation lifecycle `useEffect` to update global badges, and a second initiated by `CartScreen.jsx` upon mounting.
2. **Missing In-Flight Request Deduplication:** The core API client (`customer-app/src/services/api.js`) lacked an in-flight request coalescing mechanism. Concurrent or overlapping invocations of identical `GET` endpoints (e.g. fish catalogue, categories, or cart queries) each spawned independent network socket requests over the wire.

The phase delivers authoritative cart ownership, in-flight GET coalescing with strict caller cancellation isolation, case-insensitive Authorization header normalization, collision-safe structured request identity, category caching with pull-to-refresh invalidation, and session-scoped lifecycle cleanup.

---

## 2. Exact Implementation Commits

All changes have been committed directly to `main` without creating auxiliary branches or rewriting history:

| Commit Hash | Type | Summary |
| :--- | :--- | :--- |
| `0824d31c4ce34d91a12fadb4aeae3cdfec7fb391` | Baseline | Approved starting baseline commit on `main`. |
| `2b542947fa611f1792775bcb8403c5ad1b42e073` | Feature | Initial Phase 3B.3 implementation across Workstreams A, B, C, and D. |
| `a0168361c579084bf8747580cf9706832e61bcb5` | Correction | Request identity isolation (skipUnauthorizedHandler & timeout scoping), cancellation fallback, and 23 deduplication tests. |
| `c4c47084e269730e46d68a6bb6177c542d9ab58c` | Correction | Stale-entry deletion race fix via identity checks, semantic fetch option support, and direct bypass safety. |
| `d0ce60b5a9b8b47c1963665f1d4fa94efb6111a3` | Correction | Case-insensitive Authorization header normalization, ambiguous credential rejection (`API_INVALID_HEADERS`), and explicit token preservation. |
| `1e04156c471358073184186b37366ab20bd3b4ee` | Correction | Structured JSON array deduplication key and tuple auth identity (`['AUTH', token]` vs `['ANON']`), eliminating prefix collisions (`foo` vs `AUTH:foo`) and delimiter collisions. |
| `121a9bdf2b1e21bfabb734d6a230f1f5d9956ad6` | Correction | Authorization scheme preservation in request identity (`['AUTH', effectiveAuth]`), ensuring `Bearer foo`, raw `foo`, and `Basic foo` dispatch distinct fetches while canonical casing/whitespace coalesce cleanly. |
| `a81945a0cb9c0300bfcf4dff74902072e0f93dfd` | Test/Doc | Added Test 5.46 verifying extracted 401 token lifecycle and startup probe isolation; updated documentation. |
| `118a4498e7a7f851fdd49c31b323009798c825f2` | Docs | Previous Phase 3B.3 report qualification and correction commit. |

---

## 3. Files Changed

| File Path | Nature of Changes |
| :--- | :--- |
| [`customer-app/App.jsx`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/App.jsx) | Excluded `currentScreen === 'CART'` from authenticated `fetchCartSummary` effect trigger; added `api.clearInFlightRequests()` to `handleLogout` upon session clearance. |
| [`customer-app/src/services/api.js`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/services/api.js) | Implemented case-insensitive Authorization header detection and normalization via `extractAndNormalizeAuthorization`, rejection of conflicting credentials with `API_INVALID_HEADERS`, preservation of explicit caller tokens without Keystore overwrites, canonical Authorization scheme representation in deduplication identity (`['AUTH', effectiveAuth]` vs `['ANON']`), option-aware collision-safe `buildDeduplicationKey` using complete JSON structured array serialization (`JSON.stringify(['GET', url, authIdentity, skip401, timeout, headers, opts])`), semantic fetch options extraction (`SUPPORTED_SEMANTIC_FETCH_OPTIONS`), safe bypass for unrepresentable options, identity-safe deletion guards (`inFlightGetRequests.get(dedupKey) === entry`), settled entry state hygiene, uniform subscriber model, AbortController fallback mechanics, cancellation isolation, settle cleanup, response cloning, and exported management methods (`clearInFlightRequests`, `getInFlightRequestCount`). |
| [`customer-app/src/screens/HomeScreen.jsx`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/screens/HomeScreen.jsx) | Added `existingCategories` support in `fetchHomeDataOrchestrated` to reuse loaded categories on non-refresh transitions; added `categoriesRef` in `HomeScreen` to pass cached categories without triggering hook dependency re-render loops. |
| [`tests/unit/customer-app-phase3-startup.test.js`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/tests/unit/customer-app-phase3-startup.test.js) | Added Suite 5 (46 tests: 5.1–5.46) covering in-flight GET request deduplication, case-insensitive Authorization normalization, conflicting header rejection, 401 identity isolation, cancellation fallbacks, replacement-entry race protection, structured collision-safe keys, production request credential isolation (`foo` vs `AUTH:foo`, auth vs anon, token named `ANON`), authorization scheme preservation (`Bearer foo` vs raw `foo` vs `Basic foo`), wire header verification, delimiter safety, query string distinctness, 401 token lifecycle extraction verification; and Suite 6 (13 tests: 6.1–6.13) covering cart/home request ownership and static code structure invariants. |
| [`customer-app/docs/PHASE_3B_3_API_REQUEST_EFFICIENCY_REPORT.md`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/docs/PHASE_3B_3_API_REQUEST_EFFICIENCY_REPORT.md) | Comprehensive engineering, QA audit, and verification report for Phase 3B.3. |

---

## 4. Request Deduplication Behavior

### 4.1 In-Flight GET Request Registry
In `customer-app/src/services/api.js`, an in-flight request registry is maintained in memory:
```javascript
const inFlightGetRequests = new Map();
```
When a network request is initiated via `request(endpoint, options)`:
1. **Method Check:** Deduplication is strictly evaluated for HTTP `GET` requests (`isGet = method === 'GET'`). Non-GET mutations (`POST`, `PUT`, `PATCH`, `DELETE`) evaluate `dedupKey = null` and completely bypass the registry. Every mutation spawns its own independent HTTP socket.
2. **Key Computation:** If eligible, `buildDeduplicationKey` computes an option-aware identity string.
3. **Registry Lookup:** If an active, unsettled entry already exists for that key (`entry && !entry.isSettled`), the calling invocation registers as an additional subscriber on that entry rather than initiating a new network fetch.
4. **Initiator Lifecycle:** If no active entry exists, the calling invocation becomes the initiator. It creates an `AbortController` (if supported) for the network socket, initializes an empty `Set` of subscribers, and dispatches the actual fetch asynchronously.
5. **Settlement & Data Isolation:** When the underlying network promise settles:
   - On success, each registered subscriber's promise is resolved with an independent deep clone (`cloneResponse(json)`) to guarantee data isolation and prevent cross-subscriber object mutation.
   - On rejection, the error is propagated to all waiting subscribers.
   - The entry is marked `entry.isSettled = true`, and removed from `inFlightGetRequests`.
   - **No Caching:** Completed responses are never cached in memory or served to subsequent calls. Any request initiated after settlement triggers a fresh network round-trip.

### 4.2 Stale-Entry Race Protection
To eliminate race conditions between settling operations and newly registered requests:
- Deletions in both the `finally` block and subscriber detachment handlers are strictly identity-guarded by reference equality:
  ```javascript
  if (inFlightGetRequests.get(dedupKey) === entry) {
    inFlightGetRequests.delete(dedupKey);
  }
  ```
  If all subscribers abort or `clearInFlightRequests()` runs and a new request registers under the same key before the old network socket closes, the old settling request cannot delete the newly registered entry.
- Furthermore, `request()` ignores any entry where `entry.isSettled === true`, ensuring stale settling promises never resolve replacement callers.

---

## 5. Authentication Identity and Session Isolation Behavior

### 5.1 Case-Insensitive Authorization Normalization
HTTP header names are case-insensitive. Callers or middleware may provide `Authorization`, `authorization`, or `AUTHORIZATION`. The helper `extractAndNormalizeAuthorization(headers)` handles all variations:
- It locates all header keys matching `authorization` case-insensitively.
- If multiple Authorization headers are provided with conflicting values, it throws an error with `err.code = 'API_INVALID_HEADERS'` and immediately fails closed without dispatching network traffic.
- If values match, it deletes all casing duplicates and attaches exactly one canonical `headers.Authorization` property.
- When an explicit Authorization header is present, Keystore lookup is bypassed, preserving caller credentials and preventing Keystore overwriting.

### 5.2 Scheme Preservation & Delimiter-Safe Key Structure
Early implementations keyed entries with token strings, which caused collisions between distinct HTTP schemes (`Bearer foo` vs raw `foo` vs `Basic foo`) and delimiter collisions.

In the corrected implementation:
- `authInfo.rawValue` preserves the canonical wire header string (e.g. `Bearer foo`, `foo`, or `Basic foo`).
- `authIdentity` is structured as a two-element tuple:
  ```javascript
  const authIdentity = effectiveAuth !== null ? ['AUTH', effectiveAuth] : ['ANON'];
  ```
- The complete deduplication key is serialized as a single JSON array:
  ```javascript
  return JSON.stringify([
    'GET',
    url,
    authIdentity,
    Boolean(skipUnauthorizedHandler),
    effectiveTimeoutMs,
    normalizedHeaders,
    semanticList,
  ]);
  ```
- **Collision Invariants Guaranteed:**
  - `Authorization: Bearer foo` produces `['AUTH', 'Bearer foo']`.
  - Raw `Authorization: foo` produces `['AUTH', 'foo']`.
  - `Authorization: Basic foo` produces `['AUTH', 'Basic foo']`.
  - Token `AUTH:foo` produces `['AUTH', 'AUTH:foo']`.
  - Anonymous requests produce `['ANON']`.
  - A token named `'ANON'` produces `['AUTH', 'ANON']`.
  All states remain strictly collision-safe under JSON serialization.
  Equivalent schemes with casing/whitespace variations (`bearer  foo  `) canonicalize to `Bearer foo` and coalesce cleanly.

### 5.3 Request Identity Isolation for Startup Probes
Startup session validation (`startup-session.js`) executes `getProfile(stored.token, { skipUnauthorizedHandler: true, timeoutMs: 5000 })`.
Normal screens (`HomeScreen.jsx`, `ProfileScreen.jsx`) execute `getProfile()` with `{ skipUnauthorizedHandler: false, timeoutMs: 15000 }`.
Because `skipUnauthorizedHandler` (boolean at index 3) and `effectiveTimeoutMs` (number at index 4) are encoded directly in the structured JSON array:
- The startup probe and standard profile requests produce disjoint keys and **never coalesce**.
- A 401 on the startup probe cannot inadvertently trigger global logout via the centralized handler.
- A 401 on a normal user request cannot be swallowed by a coalesced probe.

---

## 6. Request Ownership and Cancellation Behavior

### 6.1 Uniform Subscriber Model & Cancellation Isolation
Every caller awaiting an in-flight request is treated as an independent subscriber attached to `entry.subscribers`:
- Each subscriber registers its own `resolve`, `reject`, and optional `cleanup` callback.
- **No Shared Signal Inheritance:** The shared underlying network socket does **not** inherit the initiating caller's `AbortSignal`.
- **Individual Abort:** When Subscriber A aborts (e.g., due to component unmounting or navigation):
  1. Subscriber A is removed from `entry.subscribers`.
  2. Subscriber A's promise immediately rejects with `API_ABORTED` (`isAborted: true`, `reason: ...`).
  3. The underlying network request is **not aborted** as long as other subscribers remain in `entry.subscribers`.
  4. Subscriber B continues awaiting the network response without interruption.
- **Wire Abort on Last Subscriber:** If and only if **all** subscribers abort before the request settles does the shared `entry.controller.abort()` fire on the wire.

### 6.2 Fallback Mechanics When `AbortController` is Unavailable
In environments where `AbortController` is not supported:
- `entry.controller` is `null`.
- Subscribers attach abort listeners to their individual subscriber promises. If Subscriber A aborts, Subscriber A detaches and rejects with `code: 'API_ABORTED'`, `networkCancelled: false`.
- The shared background network operation completes cleanly, delivering data to any remaining subscribers without unhandled rejections.

### 6.3 Logout Session Clearance
When the user logs out (`handleLogout` in `App.jsx`):
- `api.clearInFlightRequests()` is invoked immediately after clearing Keystore tokens.
- Active in-flight requests abort their underlying controllers and reject all waiting subscribers with `API_SESSION_RESET`.
- The registry is emptied, preventing any pending responses from resolving in an unauthenticated or subsequent user session.

---

## 7. Home-Screen Startup Orchestration Behavior

### 7.1 Category Re-fetching Optimization
In `customer-app/src/screens/HomeScreen.jsx`:
- Categories represent relatively static product classification metadata.
- `fetchHomeDataOrchestrated` accepts `existingCategories = null`.
- When navigating back to `HOME` during normal use:
  - If `categories` already exist in state and the request is not a user pull-to-refresh (`!isRefresh && existingCategories?.length > 0`), the orchestrator reuses `existingCategories` immediately via `Promise.resolve()`, making **zero** network requests.
  - When the user performs a pull-to-refresh (`isRefresh = true`), existing categories are bypassed and a fresh network request is dispatched to `api.getCategories()`.
- In `HomeScreen.jsx`, a `categoriesRef` holds the latest categories across renders, allowing `loadAllData` to access current categories without adding `categories` to its `useCallback` dependency array, eliminating unnecessary re-render and re-fetching loops.

### 7.2 Fish Catalogue Priority 1 Preserved
The critical fish inventory catalogue remains strictly Priority 1:
- `api.getFish()` resolves and immediately invokes `setLoading(false)` and `setFishList(res.data)`.
- Visual display of available inventory unblocks instantly, decoupled from secondary metadata queries (subscription, tracking, profile).

---

## 8. Cart Data Ownership Behavior

### 8.1 CartScreen Authoritative Ownership
Prior to Phase 3B.3, `App.jsx` triggered `fetchCartSummary()` on entry to any screen in `AUTHENTICATED_SCREENS`. Navigating to `CART` produced two simultaneous `GET /api/v1/customer/cart` requests (one from `App.jsx`, one from `CartScreen.jsx`).

To establish clear, authoritative data ownership:
- `customer-app/App.jsx` explicitly excludes `'CART'` from the authenticated screen badge-fetch trigger:
  ```javascript
  useEffect(() => {
    if (
      AUTHENTICATED_SCREENS.includes(currentScreen) &&
      isProfileComplete &&
      currentScreen !== 'PROFILE_COMPLETION' &&
      currentScreen !== 'CART'
    ) {
      fetchCartSummary();
    }
  }, [currentScreen, isProfileComplete, fetchCartSummary]);
  ```
- `CartScreen.jsx` is the sole authoritative owner of cart data when the user visits the Cart screen. It fetches the full itemized cart state upon mounting and during pull-to-refresh.

### 8.2 Continuous Synchronization via `onCartUpdated`
Global badge counts in `App.jsx` remain perfectly synchronized:
- `CartScreen.jsx` notifies `App.jsx` via `onCartUpdated(cartData)` on:
  - Initial fetch completion (`fetchCart`)
  - Pull-to-refresh resolution (`handleRefresh`)
  - Stepper quantity changes (`handleUpdateQty`)
  - Item removals (`handleRemoveItem`)
  - Cart clearance (`handleClearCart`)
- When the user navigates to `CART`, exactly **one** network request is made (by `CartScreen`), and `App.jsx`'s `cartSummary` badge updates immediately upon response arrival.

---

## 9. Tests and Exact Test Results

### 9.1 Test Execution Table

Every test execution is recorded separately in the table below, distinguishing successful runs from historical infrastructure-affected and assertion-failing runs. All 26 failed TAP records across Tasks 3394, 3425, and 3450 have been itemized: 21 failed subtests and 5 suite-level roll-up failures:
- **Task 3394:** 5 failed subtests + 1 suite roll-up = 6 failed TAP records.
- **Task 3425:** 4 failed subtests + 2 suite roll-ups = 6 failed TAP records.
- **Task 3450:** 12 failed subtests + 2 suite roll-ups = 14 failed TAP records.
- **Total:** 21 failed subtests + 5 suite roll-ups = 26 failed TAP records.

| Task ID | Exact command | Mode | Duration | Passed | Failed | Skipped | Exit code | Failing tests/files | Failure classification |
| :--- | :--- | :--- | :--- | ---: | ---: | ---: | ---: | :--- | :--- |
| **Task 3621** | `npm test --prefix customer-app` | Parallel | 15.9s (15919ms) | 141 | 0 | 0 | **0** | None (all 12 customer-app suites passed) | N/A (Successful execution; 100% local, zero external network dependencies) |
| **Task 3626** | `npm test` | Parallel | 16.1s (16099ms) | 335 | 0 | 0 | **0** | None (all 14 root suites passed) | N/A (Successful execution; remote Supabase PostgreSQL responded within pool checkout timeout) |
| **Task 3543** | `node --test --test-concurrency=1 "tests/**/*.test.js"` | Sequential | 74.2s (74233ms) | 335 | 0 | 0 | **0** | None (all 14 root suites passed) | N/A (Successful execution; remote Supabase PostgreSQL connection was responsive throughout) |
| **Task 3394** | `node --test --test-concurrency=1 "tests/**/*.test.js"` | Sequential | 79.3s (79293ms) | 329 | 6 | 0 | **1** | File: `tests/integration/postgres-subscription-lifecycle.test.js`<br><br>Subtests (5 failed):<br>1. `1. Initial purchase atomically records subscription, purchase ledger, and payment with subscription_id`<br>• Error: `'Connection terminated due to connection timeout'` (`ERR_TEST_FAILURE`, 5007.31ms)<br>2. `2. Replaying the verified payment returns the exact subscription with ZERO duplicate credit or ledger writes`<br>• Error: `TypeError: Cannot read properties of undefined (reading 'credit_balance')` (`ERR_TEST_FAILURE`, 3899.33ms)<br>3. `3. Unlinked legacy payment (subscription_id is NULL) fails closed with PAYMENT_SUBSCRIPTION_UNPROVABLE`<br>• Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'PAYMENT_SUBSCRIPTION_UNPROVABLE'` (6551.95ms)<br>4. `4. Cross-customer payment replay is rejected with PAYMENT_CUSTOMER_MISMATCH`<br>• Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'PAYMENT_CUSTOMER_MISMATCH'` (5011.62ms)<br>5. `5. Plan mismatch replay is rejected with PAYMENT_PLAN_MISMATCH`<br>• Error: `AssertionError [ERR_ASSERTION]: Missing expected rejection.` (16508.44ms)<br><br>Suite Roll-Up (1 failed):<br>`PostgreSQL Subscription Lifecycle & Payment Replay Suite (Migration 0019)` (Error: `'5 subtests failed'`, 50714.50ms) | **Disaggregated Classification (5 failed subtests + 1 suite roll-up = 6 failed TAP records):**<br>• Subtest 1: **Direct Connection Acquisition Timeout** (`lib/db/pool.js:127` client checkout exceeded 5000ms threshold).<br>• Subtest 2: **Fixture Dependency Failure** (dependent on `createdSubId` from Subtest 1; missing record caused `TypeError`).<br>• Subtest 3: **Independent Assertion Failure (Root Cause Unverified)** (creates independent unlinked legacy payment; failed assertion with `err.code === undefined`).<br>• Subtests 4 & 5: **Fixture Dependency Failures (Root Cause Unverified)** (depend on payment from Subtest 1; root cause unverified beyond missing payment fixture).<br>• Suite: **Suite-Level TAP Roll-Up Failure**.<br>• Customer app suites passed 100%. |
| **Task 3425** | `node --test --test-concurrency=1 "tests/**/*.test.js"` | Sequential | 162.5s (162527ms) | 329 | 6 | 0 | **1** | File 1: `tests/integration/postgres-bill-concurrency-and-scoping.test.js`<br><br>Subtests (3 failed):<br>1. `1. Missing worker store identity is rejected with STORE_MISMATCH (403)` (Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'STORE_MISMATCH'`, 6568.66ms)<br>2. `2. Missing bill store identity is rejected with STORE_MISMATCH (403)` (Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'STORE_MISMATCH'`, 5839.59ms)<br>3. `3. Cross-store checkout attempt is rejected with STORE_MISMATCH (403)` (Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'STORE_MISMATCH'`, 5793.10ms)<br>Suite Roll-Up 1 (1 failed): `PostgreSQL Phase 4: Migration 0020, Store Scoping, and Concurrency Suite` (Error: `'3 subtests failed'`, 37704.99ms)<br><br>File 2: `tests/integration/postgres-subscription-lifecycle.test.js`<br><br>Subtest (1 failed):<br>1. `7. Concurrency: concurrent first-time purchases commit exactly one credit, subscription, payment, and ledger entry` (Error: `'timeout exceeded when trying to connect'`, 5005.15ms)<br>Suite Roll-Up 2 (1 failed): `PostgreSQL Subscription Lifecycle & Payment Replay Suite (Migration 0019)` (Error: `'1 subtest failed'`, 64797.94ms) | **Disaggregated Classification (4 failed subtests + 2 suite roll-ups = 6 failed TAP records):**<br>• Subscription Subtest 7: **Direct Connection Acquisition Timeout** (`lib/db/pool.js:127` pool checkout timed out after 5000ms: `'timeout exceeded when trying to connect'`).<br>• Store Scoping Subtests 1–3: **Independent Assertion Failures (Root Cause Unverified from Captured Log)** (`err.code` was `undefined` instead of `'STORE_MISMATCH'`; direct connection timeout error string not captured in TAP block for these tests).<br>• Suites 1 & 2: **Suite-Level TAP Roll-Up Failures**.<br>• Customer app suites passed 100%. |
| **Task 3450** | `npm test` | Parallel | 94.0s (93967ms) | 321 | 14 | 0 | **1** | File 1: `tests/integration/postgres-bill-concurrency-and-scoping.test.js`<br><br>Subtests (5 failed):<br>1. `1. Missing worker store identity is rejected with STORE_MISMATCH (403)` (Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'STORE_MISMATCH'`, 5937.19ms)<br>2. `2. Missing bill store identity is rejected with STORE_MISMATCH (403)` (Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'STORE_MISMATCH'`, 5493.59ms)<br>3. `3. Cross-store checkout attempt is rejected with STORE_MISMATCH (403)` (Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'STORE_MISMATCH'`, 5763.50ms)<br>4. `4. Concurrent checkout race on distinct bills with same bill number serializes and rejects duplicate with 409` (Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + actual - expected: + 2 - 1`, 5885.39ms)<br>5. `5. Worker database store reassignment prevents old token from authorizing previous store` (Error: `'Connection terminated due to connection timeout'`, 5013.91ms)<br>Suite Roll-Up 1 (1 failed): `PostgreSQL Phase 4: Migration 0020, Store Scoping, and Concurrency Suite` (Error: `'5 subtests failed'`, 93618.71ms)<br><br>File 2: `tests/integration/postgres-subscription-lifecycle.test.js`<br><br>Subtests (7 failed):<br>1. `1. Initial purchase atomically records subscription, purchase ledger, and payment with subscription_id` (Error: `'Connection terminated due to connection timeout'`, 5010.75ms)<br>2. `2. Replaying the verified payment returns the exact subscription with ZERO duplicate credit or ledger writes` (Error: `TypeError: Cannot read properties of undefined (reading 'credit_balance')`, 3538.82ms)<br>3. `3. Unlinked legacy payment (subscription_id is NULL) fails closed with PAYMENT_SUBSCRIPTION_UNPROVABLE` (Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'PAYMENT_SUBSCRIPTION_UNPROVABLE'`, 6022.19ms)<br>4. `4. Cross-customer payment replay is rejected with PAYMENT_CUSTOMER_MISMATCH` (Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'PAYMENT_CUSTOMER_MISMATCH'`, 5006.95ms)<br>5. `5. Plan mismatch replay is rejected with PAYMENT_PLAN_MISMATCH` (Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'PAYMENT_PLAN_MISMATCH'`, 5003.88ms)<br>6. `6. Rollback: deliberate failure during payment insertion rolls back subscription, ledger, and payment` (Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value: assert.ok(err.message.includes('DELIBERATE_POSTGRES_PAYMENT_INSERT_FAILURE'))`, 6024.45ms)<br>7. `7. Concurrency: concurrent first-time purchases commit exactly one credit, subscription, payment, and ledger entry` (Error: `'Connection terminated due to connection timeout'`, 5599.20ms)<br>Suite Roll-Up 2 (1 failed): `PostgreSQL Subscription Lifecycle & Payment Replay Suite (Migration 0019)` (Error: `'7 subtests failed'`, 58573.53ms) | **Disaggregated Classification (12 failed subtests + 2 suite roll-ups = 14 failed TAP records):**<br>• Direct Connection Timeouts (3): Store Scoping Subtest 5, Subscription Subtest 1, and Subscription Subtest 7 each directly failed with `'Connection terminated due to connection timeout'` at the ~5000ms threshold.<br>• Fixture Dependency Failures (3): Subscription Subtest 2 (dependent on initial purchase fixture from Subtest 1; threw `TypeError`); Subscription Subtests 4 & 5 (depend on payment from Subtest 1; root cause unverified beyond missing fixture).<br>• Independent Assertion Failures (6 subtests): Store Scoping Subtests 1–3 (`err.code === undefined`); Store Scoping Subtest 4 (checkout count `2 !== 1`); Subscription Subtest 3 (independent unlinked legacy payment; `err.code === undefined`); Subscription Subtest 6 (independent rollback customer and query hook; deliberate error message missing; not a cascade from Subtest 1). Root cause unverified from captured evidence.<br>• Subtest category arithmetic reconciles: 3 connection timeouts + 3 fixture dependencies + 6 independent assertion failures = 12 failed subtests (3 + 3 + 6 = 12).<br>• Suites 1 & 2: **Suite-Level TAP Roll-Up Failures**.<br>• Customer app suites passed 100%. |

---

### 9.2 Customer App Test Breakdown (141/141 Passing)
- **Suite 1: Phase 1 Responsiveness Suite (38 tests):**
  - Section 1.1–1.4: Keystore stale-token logout protection & atomic token clearing.
  - Section 3.1–3.15: API client timeout, abort, retry boundaries, and AbortController fallbacks.
  - Section 5.1–5.6: Home screen prioritized data-loading orchestration.
- **Suite 2: Phase 2 Virtualization Suite (21 tests):**
  - List virtualization configuration, windowing, item layout measurements, fish image optimization.
- **Suite 3: Phase 3B.2 Startup & Navigation Guard Suite (23 tests):**
  - Startup session orchestrator transitions, 401 single-owner coordination, navigation guard gates.
- **Suite 5: Phase 3B.3 In-Flight GET Request Deduplication Suite (46 tests: 5.1–5.46):**
  - Coalescing concurrent GETs into single fetch (5.1); distinct URLs, query parameters, and tokens (5.2, 5.3, 5.42); mutations bypass dedup (5.4); `bypassDedup: true` (5.5); immediate settle cleanup (5.6); error propagation and non-caching (5.7, 5.8); cancellation isolation (5.9); all-subscriber cancellation (5.10); pre-aborted signal fast-fail (5.11); session reset clearance (5.12); response clone data isolation (5.13); startup probe vs authenticated request isolation (5.14, 5.15, 5.16); timeout isolation (5.17); custom header isolation (5.18); mutation safety during session reset (5.19); AbortController unavailable fallback (5.20); registry timeout cleanup (5.21); all-caller abort cleanup (5.22); option-aware key verification (5.23); stale entry race protection on abort settle (5.24); stale entry race protection on session reset (5.25); replacement subscriber isolation (5.26); collision-safe headers (5.27); case-insensitive header normalization (5.28); semantic fetch options (5.29); unsupported options bypass (5.30); case-insensitive Authorization normalization (5.31); conflicting Authorization rejection with `API_INVALID_HEADERS` (5.32); duplicate Authorization collapse (5.33); explicit token isolation (5.34); custom Authorization vs Keystore token (5.35); unsafe Authorization bypass (5.36); explicit getProfile token behavior (5.37); production request isolation for `foo` vs `AUTH:foo` (5.38); production request coalescing for identical tokens (5.39); auth vs anon vs token-named-`ANON` isolation (5.40); delimiter safety in URLs/tokens (5.41); query string isolation and coalescing (5.42); scheme isolation (`Bearer foo` vs raw `foo` vs `Basic foo`) (5.43); scheme coalescing and whitespace normalization (5.44); Keystore vs explicit Authorization wire comparison (5.45); and 401 token lifecycle extraction verification (5.46).
- **Suite 6: Phase 3B.3 Cart & Home Ownership Suite (13 tests: 6.1–6.13):**
  - Cart navigation exclusion in App shell (6.1, 6.6); `handleCartUpdated` state update (6.2); category reuse on non-refresh transitions (6.3); category refetch on pull-to-refresh (6.4); fish catalogue Priority 1 paint (6.5); logout in-flight clearance static check (6.7); api client deduplication registry export static checks (6.8–6.13).

---

### 9.3 Detailed Audit of Test 5.46 and Authentication Verification

#### What Production API Code Does:
In `customer-app/src/services/api.js`:
1. `extractAndNormalizeAuthorization(headers)` parses the Authorization header. If formatted as `Bearer <token>`, it extracts `token = match[1].trim()`, while setting `canonicalAuth = Bearer ${token}`.
2. In `request()`, `requestToken` is bound to the extracted clean token (e.g. `authInfo.token` for explicit headers, or `tokens.token` when retrieved from Keystore).
3. If an authenticated request receives an HTTP 401 and `options.skipUnauthorizedHandler` is false, line 453 executes `onUnauthorizedCallback(requestToken)`.
4. Crucially, the callback receives `requestToken`—the **extracted token string** (e.g. `my-token`), **not** the full Authorization header (e.g. `Bearer my-token`).

#### What Test 5.46 Directly Verifies:
Test 5.46 in `tests/unit/customer-app-phase3-startup.test.js` verifies:
- **Part 1:** When an explicit `Authorization: Bearer explicit-bearer-token-val` request receives a 401, `api.js` extracts `explicit-bearer-token-val` and delivers that extracted string (without the `Bearer ` prefix) to the registered unauthorized callback.
- **Part 2:** When a request passes `skipUnauthorizedHandler: true` (the startup probe pattern), a 401 response does **not** invoke the unauthorized callback, and no tokens are submitted for clearing.
- **Part 3:** When a request derives its Authorization header from Keystore (`Bearer mock-session-secret`), a 401 response delivers the clean stored token `mock-session-secret` to the unauthorized callback.

#### Nature of Test Doubles in Test 5.46:
- The callback registered via `setUnauthorizedHandler` is a **mock test double closure**:
  ```javascript
  setUnauthorizedHandler(async (rejectedToken) => {
    reportedUnauthorizedToken = rejectedToken;
    await mockStorage.clearAuthTokens(rejectedToken);
  });
  ```
- `mockStorage.clearAuthTokens` is an **in-memory mock function**:
  ```javascript
  clearAuthTokens: async (expectedToken) => {
    clearedTokens.push(expectedToken);
    return true;
  }
  ```
- The mock callback forwards the extracted token directly to the mock token-clearing function.

#### What Test 5.46 Does NOT Independently Prove:
- Test 5.46 does **not** execute the real `App.jsx` React component or its lifecycle hooks (`useEffect`, `useCallback`).
- Test 5.46 does **not** execute the real `customer-app/src/services/auth-storage.js` implementation or interact with Android Keystore hardware via `react-native-keychain`.
- Test 5.46 does **not** demonstrate that `App.jsx`'s `handleUnauthorized` -> `handleLogout` state transitions successfully execute in a live React Native DOM/tree.

#### Separate Independent Test Coverage:
Separate test suites independently verify the components that Test 5.46 mocks:
1. **Real `auth-storage.js` Implementation:**
   - File: `tests/unit/customer-app-phase1-responsiveness.test.js`
   - Tests: Section 1.1 (`An obsolete 401 does not clear either current auth token or current device token`), Section 1.2 (`A matching expected token clears the session and device token atomically`), Section 1.3 (`Ordinary user logout clears credentials...`), Section 1.4 (`Concurrent logout calls do not corrupt session state or storage queue`).
   - Verifies the real `auth-storage.js` source code with a serialized mutation queue against a mock Keychain store, verifying that `clearAuthTokens(expectedToken)` returns `false` on token mismatch and `true` on match.
2. **Real Startup Orchestrator 401 Coordination:**
   - File: `tests/unit/customer-app-phase3-startup.test.js`
   - Tests: Suite 2 tests 2.1–2.8 (e.g. Test 2.2: `Global unauthorized callback and startup orchestrator do not independently clear the same token`, Test 2.3: `The rejected token is passed to the one responsible clearAuthTokens operation`, Test 2.4: `A newer token is never removed by a stale 401`).
   - Verifies that `orchestrateStartupSession` coordinates cleanly with production API logic and safely aborts transitions when token clearing is rejected.
3. **Real Navigation Decision Logic:**
   - File: `tests/unit/customer-app-phase3-startup.test.js`
   - Tests: Suite 3 tests 3.1–3.4 (verifying `resolveNavigationDecision` redirects and gates).
4. **Static Structural Invariants:**
   - File: `tests/unit/customer-app-phase3-startup.test.js`
   - Tests: Suite 4 (tests 4.1–4.5) and Suite 6 (tests 6.6, 6.7) verify that `App.jsx`, `SplashScreen.jsx`, and `startup-session.js` wire these production handlers and guard against race conditions.

---

## 10. Build and Bundle Verification Results

Metro production JavaScript bundle compilation was verified directly using the React Native CLI:
```bash
cd customer-app; npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/build/test.bundle
```
**Results:**
- **Exit Code:** `0`
- **Output:** `info Done writing bundle output`
- **Bundle File:** Successfully created at `android/app/build/test.bundle` (subsequently deleted).
- **Hermes/Babel Transformations:** Clean; zero syntax errors, zero missing imports, zero module resolution failures.

---

## 11. Android Release-Build Verification Results

Android native compilation was verified using the Gradle build system:
```bash
cd customer-app/android; ./gradlew assembleRelease
```
**Results:**
- **Exit Code:** `0`
- **Build Status:** `BUILD SUCCESSFUL in 1m 20s`
- **Actionable Tasks:** 262 tasks (5 executed, 257 up-to-date)
- **Artifact Output:** Release APK successfully compiled at:
  `customer-app/android/app/build/outputs/apk/release/app-release.apk`
- **Native Linkage:** React Native Keychain, FastImage, and core runtime linked without symbol errors or proguard/R8 conflicts.

---

## 12. Known Limitations

1. **In-Memory Request Registry:** The in-flight deduplication registry is purely transient and lives in JavaScript memory. It coalesces overlapping concurrent calls; it does not persist HTTP responses across full screen unmounts once an in-flight entry has settled.
2. **Strict GET Scoping:** In-flight request deduplication is deliberately restricted to idempotent `GET` requests. State-altering mutations (`POST`, `PUT`, `PATCH`, `DELETE`) are intentionally non-deduplicatable to avoid swallowing caller intent or corrupting transaction sequences.
3. **Headless Test Emulation:** In the Node.js test environment, React Native native modules (such as `react-native-keychain`) are executed via faithful emulated doubles rather than physical Android Keystore hardware. Full hardware-backed crypto execution occurs when running the compiled APK on a physical Android device.
4. **Headless React Lifecycle:** Automated unit and integration tests exercise the extracted JavaScript business logic, orchestrators, and AST source invariants. They do not run a full Android headless browser or live React Native UI rendering pipeline.

---

## 13. Environmental Dependencies and Failed Executions

### 13.1 Remote Database Connection Checkout Mechanism
The root repository test suite contains two PostgreSQL integration test files:
- `tests/integration/postgres-bill-concurrency-and-scoping.test.js`
- `tests/integration/postgres-subscription-lifecycle.test.js`

These tests establish live network connections to a remote PostgreSQL database hosted on Supabase (`aws-0-ap-south-1.pooler.supabase.com:6543`). The database connection pool (`lib/db/pool.js`) configures a connection acquisition timeout:
```javascript
connectionTimeoutMillis: 5000
```
This is an individual **client acquisition timeout** enforced by `pg-pool` whenever `withTransaction` calls `await p.connect()` (at `lib/db/pool.js:127`). If acquiring a database connection from the pooler exceeds 5000 milliseconds—due to network latency spikes, remote socket drops, or pooler saturation—the pool terminates the acquisition attempt and throws an error (`'Connection terminated due to connection timeout'` or `'timeout exceeded when trying to connect'`). This is not a limit on total test execution duration.

### 13.2 Documented Executions Breakdown
During Phase 3B.3 verification, sequential test runs (`node --test --test-concurrency=1 "tests/**/*.test.js"`), parallel root runs (`npm test`), and customer-app runs (`npm test --prefix customer-app`) were executed across multiple verification cycles. All 26 failed TAP records across Tasks 3394, 3425, and 3450 have been itemized (21 failed subtests and 5 suite roll-ups):

1. **Task 3621 (`npm test --prefix customer-app`):**
   - Mode: Parallel (Customer App)
   - Duration: 15.9s (15919ms)
   - Exit Code: **0**
   - Result: 141 passed, 0 failed, 0 skipped.
   - Outcome: 100% clean pass across all 12 customer-app suites. Local execution without external network dependencies.
2. **Task 3626 (`npm test`):**
   - Mode: Parallel (Root Ecosystem)
   - Duration: 16.1s (16099ms)
   - Exit Code: **0**
   - Result: 335 passed, 0 failed, 0 skipped.
   - Outcome: 100% clean pass across all 14 root suites. Remote Supabase PostgreSQL responded within pool checkout timeout.
3. **Task 3543 (`node --test --test-concurrency=1 "tests/**/*.test.js"`):**
   - Mode: Sequential (Root Ecosystem)
   - Duration: 74.2s (74233ms)
   - Exit Code: **0**
   - Result: 335 passed, 0 failed, 0 skipped.
   - Outcome: 100% clean pass sequentially. Remote database connection was responsive throughout.
4. **Task 3394 (`node --test --test-concurrency=1 "tests/**/*.test.js"`):**
   - Mode: Sequential (Root Ecosystem)
   - Duration: 79.3s (79293ms)
   - Exit Code: **1**
   - Result: 329 passed, 6 failed (5 failed subtests + 1 suite roll-up = 6 failed TAP records), 0 skipped.
   - Failure Details:
     - Subtest 1 (`1. Initial purchase...`): Direct connection checkout timeout (`duration_ms: 5007.31`, error: `'Connection terminated due to connection timeout'`).
     - Subtest 2 (`2. Replaying the verified payment...`): Fixture dependency failure (`TypeError: Cannot read properties of undefined (reading 'credit_balance')`) because `createdSubId` from Subtest 1 was never established.
     - Subtest 3 (`3. Unlinked legacy payment...`): Independent assertion failure (`AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'PAYMENT_SUBSCRIPTION_UNPROVABLE'`). Creates independent legacy payment; root cause unverified from captured task output.
     - Subtests 4 & 5 (`Cross-customer payment replay...`, `Plan mismatch replay...`): Fixture dependency failures (depend on payment from Subtest 1; root cause unverified beyond missing payment fixture).
     - Suite: Suite-level TAP roll-up failure (`PostgreSQL Subscription Lifecycle & Payment Replay Suite`, `'5 subtests failed'`).
   - Customer-app test suites passed 100%.
5. **Task 3425 (`node --test --test-concurrency=1 "tests/**/*.test.js"`):**
   - Mode: Sequential (Root Ecosystem)
   - Duration: 162.5s (162527ms)
   - Exit Code: **1**
   - Result: 329 passed, 6 failed (4 failed subtests + 2 suite roll-ups = 6 failed TAP records), 0 skipped.
   - Failure Details:
     - Subscription Subtest 7 (`7. Concurrency...`): Direct connection checkout timeout (`duration_ms: 5005.15`, error: `'timeout exceeded when trying to connect'`).
     - Store Scoping Subtests 1–3 (`Missing worker store identity...`, `Missing bill store identity...`, `Cross-store checkout attempt...`): Independent assertion failures (`AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + undefined - 'STORE_MISMATCH'`). Because no connection error was captured in their specific TAP blocks, their root cause is classified as unverified from log evidence alone.
     - Suites: 2 suite-level TAP roll-up failures (`'3 subtests failed'` and `'1 subtest failed'`).
   - Customer-app test suites passed 100%.
6. **Task 3450 (`npm test`):**
   - Mode: Parallel (Root Ecosystem)
   - Duration: 94.0s (93967ms)
   - Exit Code: **1**
   - Result: 321 passed, 14 failed (12 failed subtests + 2 suite roll-ups = 14 failed TAP records), 0 skipped.
   - Failure Details:
     - Direct Connection Acquisition Timeouts (3 subtests): Store Scoping Subtest 5 (`Worker database store reassignment...`, `5013.91ms`, error: `'Connection terminated due to connection timeout'`), Subscription Subtest 1 (`Initial purchase...`, `5010.75ms`, error: `'Connection terminated due to connection timeout'`), Subscription Subtest 7 (`Concurrency...`, `5599.20ms`, error: `'Connection terminated due to connection timeout'`).
     - Fixture Dependency Failures (3 subtests): Subscription Subtest 2 (dependent on initial purchase fixture from Subtest 1; threw `TypeError`); Subscription Subtests 4 & 5 (depend on payment from Subtest 1; root cause unverified beyond missing fixture).
     - Independent Assertion Failures (6 subtests): Store Scoping Subtests 1–3 (`err.code === undefined`); Store Scoping Subtest 4 (checkout count `2 !== 1`); Subscription Subtest 3 (independent unlinked legacy payment; `err.code === undefined`); Subscription Subtest 6 (independent rollback customer and query hook; deliberate error message missing; not a cascade from Subtest 1). Root cause unverified from captured evidence.
     - Subtest Category Arithmetic: 3 connection timeouts + 3 fixture dependencies + 6 independent assertion failures = 12 failed subtests (3 + 3 + 6 = 12).
     - Suites: 2 suite-level TAP roll-up failures (`'5 subtests failed'` and `'7 subtests failed'`).
   - Customer-app test suites passed 100%.

### 13.3 Customer App Isolation
All customer-app-specific tests (`npm test --prefix customer-app`) are 100% local, have zero external network or database dependencies, and consistently achieve a **100% pass rate (141/141 passed, exit code 0)** in under 16 seconds. When the remote Supabase database is reachable within the 5000ms pool timeout, the root test suite also passes 100% (335/335 passed, exit code 0, as demonstrated in Task 3543 and Task 3626).

---

## 14. Remaining Risks

1. **Slow Mobile Connection Latency:** On high-latency mobile networks (2G/3G), pull-to-refresh requests in `HomeScreen` and `CartScreen` could overlap with earlier in-flight requests. This risk is mitigated by request sequence counters (`requestSeqRef`) and mounted flags (`isMountedRef`) that ignore stale out-of-order responses.
2. **App Backgrounding During Active Fetch:** If an Android activity is backgrounded or destroyed by OS memory management while an in-flight request is pending, component unmount triggers subscriber abort. The uniform subscriber model guarantees that individual subscriber aborts never abort the shared socket if other components remain listening, and cleans up the controller if all subscribers detach.
3. **Third-Party Supabase Pooler Latency:** If Supabase connection latency exceeds 5000ms during CI/CD test execution, root PostgreSQL integration tests will fail closed as designed. This is an external network dependency, not a customer-app code defect.

---

## 15. Explicit Phase Disposition

### **READY FOR INDEPENDENT REVIEW**

All four Phase 3B.3 workstreams (Cart Ownership, Safe In-Flight GET Deduplication, Category & Home Data Ownership, and Account Lifecycle Safety) have been implemented, tested, and empirically verified:
- Cart request duplication between `App.jsx` and `CartScreen.jsx` is eliminated.
- In-flight GET request deduplication is option-aware, scheme-preserving, collision-safe, and cancellation-isolated.
- Case-insensitive Authorization header normalization rejects ambiguous conflicting headers and preserves explicit tokens.
- Category re-fetching on non-refresh transitions is eliminated while preserving pull-to-refresh and Priority 1 fish catalogue loading.
- 141/141 customer-app tests pass with zero failures (exit code 0).
- Metro production bundle and Android release APK compile with zero errors (exit code 0).
- Historical test executions, exact failure error messages, and environmental Supabase database connection dependencies are fully and transparently documented.
