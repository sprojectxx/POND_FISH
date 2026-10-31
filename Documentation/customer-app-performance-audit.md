# Customer App Performance, API, Bug, and Issue Audit

Repository: `sprojectxx/POND_FISH`
Mobile app folder reviewed: `customer-app`

## Scope reviewed
- `customer-app/App.jsx`
- `customer-app/src/services/api.js`
- `customer-app/src/screens/FishDetailsScreen.jsx`
- `customer-app/src/screens/CartScreen.jsx`
- `customer-app/package.json`

## 1) API surface used by the mobile app
The customer app makes calls to the following backend APIs via `customer-app/src/services/api.js`:

- Authentication
  - `POST /api/v1/customer/auth/send-otp`
  - `POST /api/v1/customer/auth/verify-otp`
- Profile
  - `GET /api/v1/customer/profile`
  - `PUT /api/v1/customer/profile`
- Catalog
  - `GET /api/v1/customer/categories`
  - `GET /api/v1/customer/fish`
  - `GET /api/v1/customer/fish/{id}`
- Cart
  - `GET /api/v1/customer/cart`
  - `POST /api/v1/customer/cart/items`
  - `PATCH /api/v1/customer/cart/items/{id}`
  - `DELETE /api/v1/customer/cart/items/{id}`
  - `DELETE /api/v1/customer/cart`
- Booking / checkout
  - `POST /api/v1/customer/bookings/preview`
  - `POST /api/v1/customer/bookings`
  - `GET /api/v1/customer/bookings`
  - `GET /api/v1/customer/bookings/{id}`
  - `POST /api/v1/customer/bookings/{id}/cancel`
  - `POST /api/v1/customer/bookings/expire`
- Payments
  - `POST /api/v1/payments/razorpay/orders`
- Subscription
  - `GET /api/v1/customer/subscription`
  - `GET /api/v1/customer/subscription/plans`
  - `POST /api/v1/customer/subscription/purchase`
  - `POST /api/v1/customer/subscription/verify`
  - `GET /api/v1/customer/subscription/ledger`
- Notifications
  - `GET /api/v1/customer/notifications`
  - `PATCH /api/v1/customer/notifications/{id}/read`
  - `POST /api/v1/customer/notifications/mark-all-read`
  - `POST /api/v1/customer/notifications/device`
  - `DELETE /api/v1/customer/notifications/device`
- Bill scan / transaction
  - `POST /api/v1/customer/bills/scan`
  - `GET /api/v1/customer/bills/scans/{id}`
  - `POST /api/v1/customer/bills/scans/{id}/bill-number`
  - `POST /api/v1/customer/bills/scans/{id}/preview`
  - `POST /api/v1/customer/bills/scans/{id}/confirm`
  - `POST /api/v1/customer/transactions/commit`
  - `GET /api/v1/customer/transactions`
  - `GET /api/v1/customer/transactions/{id}`
  - `GET /api/v1/customer/gps/live`
  - `GET /api/v1/customer/gps/journeys/{id}`

## 2) Key findings

| ID | Category | Finding | Evidence in code | Impact |
|---|---|---|---|---|
| PERF-01 | API / Network | Development API URL points to `http://127.0.0.1:3000` for the mobile app. On Android devices/emulators, `127.0.0.1` refers to the device itself, not the backend server. | `customer-app/src/services/api.js`: `__DEV__ ? (process.env.API_BASE_URL || 'http://127.0.0.1:3000') : ...` | Requests fail or hang on real Android devices; slow/failed loading on the app even with good network |
| PERF-02 | API / Network | No request timeout or network cancellation is implemented. `fetch()` is used directly without timeout logic. | `customer-app/src/services/api.js`: `const response = await fetch(url, { ...options, headers })` | Slow or unstable connections can freeze screens and create long UI lag |
| PERF-03 | API / Network | Every API response is always parsed as JSON using `response.json()`, even when the backend returns empty or non-JSON payloads. | `customer-app/src/services/api.js`: `const json = await response.json().catch(() => ({}));` | Increased latency and poor resilience on failed/slow responses |
| PERF-04 | App flow / UX | Cart summary is re-fetched every time an authenticated screen becomes active, causing repeated API calls during navigation. | `customer-app/App.jsx`: `useEffect(() => { if (AUTHENTICATED_SCREENS.includes(currentScreen) ...) fetchCartSummary(); }, [currentScreen,...])` | Unnecessary network round trips and lag while navigating between screens |
| PERF-05 | App flow / UX | Multiple screens trigger separate cart/profile/fish fetches without deduplication or cache reuse. | `customer-app/App.jsx`, `FishDetailsScreen.jsx`, `CartScreen.jsx` | Frequent loading delays and stale UI |
| PERF-06 | Image / UI | Full-size product images are loaded directly from remote URLs without resizing, caching, compression, or placeholders. | `customer-app/src/screens/FishDetailsScreen.jsx`: `<Image source={{ uri: fish.imageUrl }} style={styles.heroImage} resizeMode="cover" />` and cart thumbnails using remote URLs | Large images slow page rendering, memory pressure, and slower screen transitions |
| PERF-07 | Layout / Rendering | The product details screen contains a large number of nested UI sections, large style blocks, and a nested horizontal `ScrollView` inside a full-screen `ScrollView`. | `customer-app/src/screens/FishDetailsScreen.jsx` | More work per frame; janky scrolling and slower interactions on mid-range devices |
| PERF-08 | UI / Performance | Screen-level fetches and state updates are not memoized; each screen render recreates objects and triggers more work. | `customer-app/App.jsx` and `FishDetailsScreen.jsx` | More rendering cost and slower taps/clicks |
| PERF-09 | UX / Interaction | Mutation actions (`update qty`, `remove item`, `clear cart`) do not provide optimistic UI or lightweight local updates; they wait for server response before UI settles. | `customer-app/src/screens/CartScreen.jsx` | Delays in click response feel like lag, especially on poor connectivity |
| PERF-10 | UX / Interaction | `FlatList` is used in cart but other screens still use large `ScrollView` structures with more content than needed, which increases frame time. | `customer-app/src/screens/CartScreen.jsx` and `FishDetailsScreen.jsx` | App feels slow while scrolling and interacting |
| BUG-01 | Logic / API | The app attempts to use local auth storage and backend session expiry flows, but there is no robust retry/backoff strategy when token refresh or API failure occurs. | `customer-app/src/services/api.js` and `customer-app/App.jsx` | Session loss and repeated request failure loops during poor connectivity |
| BUG-02 | Navigation | App navigation guards are implemented, but screen re-entry after auth failures may still cause blocked or delayed transitions because state depends on multiple async fetches. | `customer-app/App.jsx` | Unclear or delayed screen transitions after API failure |
| BUG-03 | State | Cart summary state is updated by a generic `onCartUpdated` callback that can overwrite state with partial or stale data. | `customer-app/App.jsx` and `CartScreen.jsx` | Incorrect totals/cart badges after failed mutation or stale fetch |
| BUG-04 | Data integrity | The app assumes always-JSON backend responses and throws on malformed payloads without fallback UI, which can break critical screens (fish details, cart). | `customer-app/src/services/api.js` and `FishDetailsScreen.jsx` | Screens may fail to render or show stale state |

## 3) Observed performance bottlenecks and user experience issues

1. Slow app start / slow first load
   - The app does a lot of work on start and screen entry.
   - Auth checks and cart fetches are triggered as soon as a screen mounts.
   - Combined with slow network and no timeout, the app feels unresponsive.

2. Lag when tapping or navigating
   - Cart and details screens wait for server responses before reflecting user actions.
   - Large nested screens increase rendering cost.
   - Taps and button actions feel delayed even when internet is good.

3. Slow image rendering
   - Product images are loaded in full size without optimized caching or lazy loading.
   - Large remote images increase memory and network use.

4. Repeated backend calls
   - The same cart or profile data can be asked for again while navigating.
   - This creates unnecessary traffic and slows the app, especially on slower or mid-tier mobile devices.

5. Poor recovery on weak networks
   - No retry/backoff or timeouts.
   - App remains waiting instead of showing helpful loading or fallback states.

## 4) Most important bug risks

- `API_BASE_URL` in development is wrong for Android devices (`127.0.0.1`), which can make the app fail to connect to the backend in normal mobile testing.
- Network requests can hang indefinitely due to no timeout.
- The app loads large image content and complex screen layouts without optimization, causing delayed rendering and UI jank.
- Cart and navigation logic are heavily dependent on backend round trips, so any latency is perceived directly by the user.

## 5) Recommended fixes

- Use a correct mobile backend URL strategy:
  - Android emulator: `10.0.2.2`
  - physical Android device: LAN IP of development machine
  - production: environment-configured base URL
- Add request timeout, retry, and abort handling in `api.js`.
- Cache API results for cart/profile/catalog screens and avoid duplicate fetches.
- Use `react-native-fast-image` or equivalent image caching for product and gallery images.
- Resize/compress images and add placeholders.
- Replace heavy nested `ScrollView` layouts with `FlatList`/`FlashList` for long lists and large cards.
- Debounce repetitive fetches and avoid reloading on every screen change.
- Add skeleton/loading states for slower APIs rather than blocking the screen.
- Use optimistic updates on cart actions while still syncing with backend in background.

## 6) Summary
The main problem is not only a few isolated bugs; it is a combination of:
- poor mobile networking configuration,
- no timeouts / retries,
- repeated API calls,
- large image payloads,
- heavy screen layouts,
- and server-wait dependent UX.

Together, these make the app feel slow even on good internet and cause visible lag for navigation, clicks, and image loading.

## 7) Recommended next actions
1. Fix the mobile API base URL for emulator/device environment.
2. Introduce network timeouts and cached fetches.
3. Optimize all product images and list rendering.
4. Reduce repeated navigation-triggered API calls.
5. Validate performance on Android with real-device profiling.

This audit was based on the reviewed code in the `customer-app` folder, especially `App.jsx`, `src/services/api.js`, `FishDetailsScreen.jsx`, and `CartScreen.jsx`.
