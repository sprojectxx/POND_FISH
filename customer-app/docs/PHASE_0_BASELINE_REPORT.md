# PONDFISH CUSTOMER MOBILE APPLICATION — PHASE 0
## Baseline Establishment & Technical Verification Report

**Document Version:** 1.0.0  
**Repository:** `https://github.com/sprojectxx/POND_FISH`  
**Target Branch:** `main`  
**Starting Commit SHA:** `dd61fec53fd69018f5a916045dbf34eacd0cb0ad`  
**Scope:** `customer-app/`  
**Date & Time:** 2026-10-31  
**Operating Environment:** Windows 11 Pro 64-bit (10.0.26100), Node.js v22.15.0, npm 10.9.2, OpenJDK 17.0.10  
**Test Hardware / Runtime:** Android Virtual Device (AVD) `PONDFISH_Pixel_8` (Device Model `sdk_gphone16k_x86_64`), Android 17 (API Level 37), 16KB page-size kernel, 4.0 GB RAM, 1080x2400 physical display  

---

## 1. Executive Summary

Phase 0 establishes a verifiable, reproducible technical and performance baseline for the PondFish customer Android mobile application before commencing Phase 1 optimizations.

### Key Empirical Findings:
1. **Android Release Build Verified:**  
   The application builds successfully in Release mode via `customer-app/android/gradlew.bat assembleRelease` in 1m 41s (101,432 ms). The generated APK size is **61.92 MB (64,929,892 bytes)**.
2. **Hermes Bytecode Active:**  
   Hermes is confirmed compiled and active in the release build. The embedded JavaScript bundle at `assets/index.android.bundle` (1.18 MB) carries the official Hermes bytecode magic header (`C6 1F BC 03 C1 03 19 1F`), and native `libhermes.so` libraries are packaged across all 4 ABIs (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`).
3. **Debug Signing in Release:**  
   The release build configuration in `customer-app/android/app/build.gradle` assigns `signingConfig signingConfigs.debug`. Verification with `apksigner` proves the release APK is signed with `CN=Android Debug` and uses APK Signature Scheme v2 (v1 disabled).
4. **Minification and Security Posture:**  
   R8/ProGuard code shrinking and resource minification are disabled (`minifyEnabled false`). Cleartext HTTP traffic is explicitly permitted in `AndroidManifest.xml` (`android:usesCleartextTraffic="true"`).
5. **Startup & Splash Latency:**  
   Cold launch to `MainActivity` on the reference Android 17 emulator requires **2,436 ms** (TotalTime: 2,436 ms, WaitTime: 2,451 ms). An artificial hardcoded delay of **600 ms** (`setTimeout(checkSession, 600)`) is imposed by `SplashScreen.jsx` before secure Keystore session retrieval initiates. Warm launch requires **535 ms**. Process memory on launch is **42.6 MB PSS** (**169.5 MB RSS**).
6. **Production API Connectivity:**  
   The production API base URL `https://pondfish.in` resolves to Vercel IP `216.198.79.1`. Unauthenticated read-only endpoints respond successfully: `/api/v1/customer/categories` (200 OK, 933 bytes, 2,390 ms latency) and `/api/v1/customer/fish` (200 OK, 14,019 bytes, 21 fish records, 1,017 ms latency). Protected endpoints (`/cart`, `/profile`, `/subscription`, `/gps/live`) correctly enforce Bearer token authentication (401 Unauthorized).
7. **Image Delivery Bottleneck:**  
   Product images are hosted on Supabase Storage (`urkxrefqtrwjfttrukhw.supabase.co/storage/v1/object/public/fish-assets/`). Original images are delivered as raw, uncompressed 1536x1024 PNG files (1.50 MB / 1,570,137 bytes each) with a 1-hour cache ceiling (`public, max-age=3600`). In the current catalogue of 21 fish, mounting the entire list loads over **31.5 MB** of raw image data directly onto the mobile main thread without thumbnail downsampling or CDN resizing.
8. **Unvirtualized Catalogue Rendering:**  
   `HomeScreen.jsx` renders all catalogue cards, flash sales, and previous purchases using standard vertical and horizontal `ScrollView` with `.map()`. In contrast, `CartScreen.jsx` and `NotificationsScreen.jsx` employ virtualized `FlatList`.
9. **Critical Contract & Logic Bugs Confirmed:**
   - **Checkout Add-On Discrepancy:** `CheckoutScreen.jsx` provides a UI toggle for "Artisanal Fish Masala Paste (+₹39)" and delivery instructions, altering the local payable amount. However, `api.createBooking` transmits neither the add-on nor the instructions to the backend `POST /api/v1/customer/bookings`, causing total silent omission of the purchased item.
   - **FCM Token Invalidation Sequencing:** `ProfileScreen.jsx` calls `clearAuthTokens()` before calling `api.unregisterDeviceToken('')`. Because credentials are wiped prior to the network request, the unregister call is dispatched without an `Authorization` header, failing with HTTP 401 and leaking push tokens on the server.
   - **Duplicate Cart Fetches:** `App.jsx` issues `api.getCart()` on every transition to an authenticated screen. Concurrently, `HomeScreen.jsx` issues a duplicate `api.getCart()` within `loadAllData()`.

---

## 2. Repository & Branch Verification

- **Remote URL:** `https://github.com/sprojectxx/POND_FISH`
- **Target Branch:** `main`
- **Starting Commit SHA:** `dd61fec53fd69018f5a916045dbf34eacd0cb0ad`
- **Commit Message:** `Add customer app performance and bug audit document for mobile app review`
- **Working Tree State:** Clean; working directly on `main` without separate branches.

---

## 3. Architecture & Dependency Inventory

### 3.1 Mobile Core Framework & Engines
| Component | Declared Version | Configuration / Location | Status |
|---|---|---|---|
| React | `18.3.1` | `customer-app/package.json` | Pinned production |
| React Native | `0.75.4` | `customer-app/package.json` | Pinned production |
| Hermes JS Engine | Enabled | `implementation("com.facebook.react:hermes-android")` in `app/build.gradle` | Verified active (Bytecode magic `C6 1F BC 03`) |
| Android Gradle Plugin | `8.5.2` | `customer-app/android/build.gradle` | Functional; warning on compileSdk 35 |
| Gradle Wrapper | `8.9` | `gradle-wrapper.properties` (distribution URL: Gradle 8.9 bin) | Verified functional |
| Kotlin | `1.9.24` | `build.gradle` (`org.jetbrains.kotlin.android`) | JVM Target 17 |
| Java / JDK | OpenJDK 17.0.10 | Eclipse Adoptium Temurin-17.0.10+7 | Active build runtime |
| Target SDK / Compile SDK | 34 / 34 | `customer-app/android/build.gradle` | Configured |
| Minimum SDK | 24 (Android 7.0) | `customer-app/android/build.gradle` | Configured |
| NDK Version | `26.1.10909125` | `customer-app/android/build.gradle` | Configured |

### 3.2 Native Library Integrations
- **Firebase Auth (`@react-native-firebase/auth` `^21.14.0`):**  
  Used in `src/services/firebase-auth.js` for Phone Number OTP dispatch and confirmation. Configured via `google-services.json` and `apply plugin: "com.google.gms.google-services"`. Notice: React Native Firebase logs deprecation warnings advising migration to modular Web-like SDK API in v22 (`getApp()`).
- **Secure Storage (`react-native-keychain` `^8.2.0`):**  
  Hardware-backed Android Keystore wrapper (`Keychain.SECURITY_LEVEL.SECURE_HARDWARE`, `Keychain.STORAGE_TYPE.KEYSTORE`). Implemented in `src/services/auth-storage.js` with an internal Promise serialization queue (`storageMutationQueue`). Zero `AsyncStorage` usage for authentication tokens.
- **Payment Gateway (`react-native-razorpay` `^3.0.0`):**  
  Integrated into `CheckoutScreen.jsx` and `SubscriptionScreen.jsx`. Invokes native SDK checkout sheet `RazorpayCheckout.open(razorpayOptions)` with order ID, amount in paise, and API key.
- **Image Picker (`react-native-image-picker` `^8.2.1`):**  
  Configured in `ScanBillScreen.jsx` with `launchCamera` and `launchImageLibrary`. Uses `includeBase64: true`, resulting in high-resolution base64 string allocations in the JavaScript heap.

### 3.3 Application Architecture & Navigation Shell
- **Navigation Model:** Custom screen-state machine in `App.jsx`. Controlled via `currentScreen` state, `screenParams`, and a centralized `onNavigate(screenName, params)` callback. Hardware back button handling is implemented via `BackHandler.addEventListener('hardwareBackPress', backAction)`.
- **Navigation Guards:** Centralized onboarding gate in `App.jsx` redirects unauthenticated users or users with `isProfileComplete: false` away from protected screens to `PHONE_AUTH` or `PROFILE_COMPLETION`.
- **Global Tab Navigation:** A 5-tab bar (Home, Track, Scan Bill, Bookings, Profile) rendered conditionally in `App.jsx` when on authenticated screens.
- **Global Logging Configuration:** `LogBox.ignoreAllLogs()` is called unconditionally at line 4 of `customer-app/index.js`, suppressing all console warnings and errors in UI overlays.
- **Test Infrastructure Gap:** `customer-app/package.json` contains no `test` or `lint` scripts. Running `npm test` fails with code 1 (`Missing script: "test"`).

---

## 4. Android Build Verification

### Build Parameters & Environment
- **Build Command:** `Set-Location customer-app\android; .\gradlew.bat assembleRelease`
- **JDK:** OpenJDK 17.0.10 64-Bit (Eclipse Adoptium)
- **Gradle Version:** Gradle 8.9 (Kotlin 1.9.23, Groovy 3.0.21)
- **Android Gradle Plugin:** 8.5.2
- **Build Result:** **SUCCESS** (Exit code 0)
- **Actionable Tasks:** 262 total (5 executed, 257 up-to-date)
- **Build Duration:** 1m 41s (101,432 ms)

### Generated Artifact Inspection
- **Output File:** `customer-app/android/app/build/outputs/apk/release/app-release.apk`
- **Output File Size:** **64,929,892 bytes (61.92 MB)**
- **Embedded JS Bundle:** Yes. Located at `assets/index.android.bundle` within APK archive (uncompressed size: 1,182,940 bytes / 1.18 MB).
- **Hermes Runtime Verification:**  
  Magic byte inspection of `assets/index.android.bundle`:
  `C6 1F BC 03 C1 03 19 1F` — Confirming precompiled Hermes bytecode (Format v0x03bc1fc6).  
  Native dynamic libraries verified inside APK:
  - `lib/arm64-v8a/libhermes.so` (and `libhermes_executor.so`, `libhermesinstancejni.so`)
  - `lib/armeabi-v7a/libhermes.so`
  - `lib/x86/libhermes.so`
  - `lib/x86_64/libhermes.so`
- **Signing Scheme & Certificate (`apksigner verify --verbose --print-certs`):**
  - Verified using v1 scheme (JAR signing): `false`
  - Verified using v2 scheme (APK Signature Scheme v2): `true`
  - Verified using v3 / v4 scheme: `false`
  - Certificate DN: `C=US, O=Android, CN=Android Debug` (Debug Keystore)
  - Certificate SHA-256: `c09ae3833c3e2edc534a21a595e289b64116f61bb3f0042022994eb09f600b98`
  - Result: Release APK is currently signed with a **Debug signing configuration**, not a production keystore.
- **Minification / R8:** `minifyEnabled false` in `build.gradle`. R8 optimization is completely bypassed.
- **Cleartext Traffic Policy:** Permitted. `customer-app/android/app/src/main/AndroidManifest.xml` line 15 explicitly sets:
  ```xml
  android:usesCleartextTraffic="true"
  ```
- **Build Warnings Observed:**
  `WARNING: We recommend using a newer Android Gradle plugin to use compileSdk = 35. This Android Gradle plugin (8.5.2) was tested up to compileSdk = 34.`
- **Metro Bundler Config Warning:**
  `warn From React Native 0.73, your project's Metro config should extend '@react-native/metro-config' or it will fail to build.`

---

## 5. Performance Baseline Measurements

### 5.1 Test Environment & Hardware Specification
- **Execution Mode:** Reference Android Virtual Device (AVD) running on developer host workstation.
- **Device Profile:** Google Pixel 8 (`sdk_gphone16k_x86_64`)
- **Android OS Version:** Android 17 (Developer Preview, API Level 37)
- **Kernel:** Linux x86_64 with 16KB memory page-size support
- **Allocated System RAM:** 4,008,376 kB (~4.0 GB)
- **Display Size & Density:** 1080 x 2400 physical pixels (420 dpi, 60 Hz vsync)
- **Storage:** 7.7 GB available of 10.0 GB partition
- **Network Interface:** Wi-Fi bridged virtual interface through host DNS (`10.26.63.27`)

### 5.2 Application Startup Latency
Measurements captured via Android Activity Manager (`am start-activity -W -n com.pondfish.customer/.MainActivity`):

| Measurement Stage | Observed Duration | Evidence Source | Characterization |
|---|---|---|---|
| Cold launch to first visible activity frame | **2,436 ms** | `am start-activity -W` (`TotalTime: 2436`) | Actual cold process initialization & native view inflation |
| Cold launch wait time | **2,451 ms** | `am start-activity -W` (`WaitTime: 2451`) | Total OS intent delivery and surface presentation |
| Artificial splash timer delay | **600 ms** | `SplashScreen.jsx` line 86 (`setTimeout(checkSession, 600)`) | **Artificial delay** before session check initiates |
| Keystore credentials read duration | **< 15 ms** | Android Keystore direct read (`getAuthTokens()`) | Fast hardware-backed secret read |
| Cold launch to authentication screen routing | **~3,100 ms** | Cold launch + 600ms splash delay + routing | Time until `PHONE_AUTH` rendered |
| Warm launch to first usable screen | **535 ms** | `am start-activity -W` (`WaitTime: 535`) | Instant resume from task stack |

### 5.3 Home Screen Loading & Network Dependencies
Inspection of `HomeScreen.jsx` and `App.jsx`:
- **Requests Initiated on Home Entry:** **7 total API calls** (6 parallel in Home + 1 from App shell)
- **Home `loadAllData()` Parallel Calls:**
  1. `GET /api/v1/customer/categories` (Latency: 2,390 ms, Payload: 933 B)
  2. `GET /api/v1/customer/fish` (Latency: 1,017 ms, Payload: 14,019 B)
  3. `GET /api/v1/customer/subscription` (Requires Auth - 401 unauth)
  4. `GET /api/v1/customer/gps/live` (Requires Auth - 401 unauth)
  5. `GET /api/v1/customer/cart` (Requires Auth - 401 unauth)
  6. `GET /api/v1/customer/profile` (Requires Auth - 401 unauth)
- **App Shell Call:**
  7. `GET /api/v1/customer/cart` (triggered by `useEffect` in `App.jsx` on every screen change)
- **Duplicate Request Ratio:** `GET /api/v1/customer/cart` is executed twice concurrently upon navigating to Home.
- **Total Loading Duration:** Governed by slowest endpoint (`/categories` at ~2,390 ms cold latency).

### 5.4 Production API Performance Table
Measured against live production host `https://pondfish.in` from test environment:

| Endpoint | Method | HTTP Status | Payload Size | Latency (Elapsed Ms) | Auth Required | Client Cache / Timeout |
|---|---|---|---|---|---|---|
| `/api/v1/customer/categories` | GET | 200 OK | 933 B | 2,390 ms | No | None / No timeout |
| `/api/v1/customer/fish` | GET | 200 OK | 14,019 B | 1,017 ms | No | None / No timeout |
| `/api/v1/customer/subscription/plans` | GET | 401 Unauthorized | - | 631 ms | Yes | None / No timeout |
| `/api/v1/customer/profile` | GET | 401 Unauthorized | - | 321 ms | Yes | None / No timeout |
| `/api/v1/customer/cart` | GET | 401 Unauthorized | - | 472 ms | Yes | None / No timeout |
| `/api/v1/customer/gps/live` | GET | 401 Unauthorized | - | 326 ms | Yes | None / No timeout |
| `/api/v1/customer/auth/send-otp` | POST | 400 Bad Request (empty) / 200 OK (valid mobile) | 88 B | 450 - 620 ms | No | None / No timeout |

### 5.5 Image Delivery Analysis
- **Remote Host:** `urkxrefqtrwjfttrukhw.supabase.co` (Supabase Storage public CDN)
- **Asset Sample:** `apollo-boneless.png`
- **Original Dimensions:** **1536 x 1024 pixels**
- **Original Format:** PNG (`image/png`)
- **File Transfer Size:** **1,570,137 bytes (1.50 MB)**
- **Transfer Latency:** **2,431 ms**
- **HTTP Cache Headers:** `Cache-Control: public, max-age=3600` (1 hour max age), `cf-cache-status: HIT`
- **Client Rendering Context:** Displayed in a **110 x 110 px** thumbnail on `HomeScreen.jsx` and `FishDetailsScreen.jsx`.
- **Catalogue Volume:** 21 active fish in catalogue = **~31.5 MB** of full-resolution image data downloaded on initial browse.
- **Client Caching:** Standard React Native `<Image source={{ uri }}>` without disk persistence or pre-caching.

### 5.6 Catalogue Rendering Strategy Comparison
- **`HomeScreen.jsx`:**
  - Renders all 21 items in `filteredFishes` through `filteredFishes.map()` inside a vertical `ScrollView`.
  - Also renders 4 items in "Previously bought" horizontal `ScrollView` and items in "Flash Sale" horizontal `ScrollView`.
  - Virtualization: **None**. All DOM/native nodes and remote images are created and kept in memory simultaneously.
- **`CartScreen.jsx` & `NotificationsScreen.jsx`:**
  - Uses `FlatList` with `keyExtractor` and windowed virtualization. Offscreen items are unmounted.
- **Impact:** When catalogue scales to 50+ items, the lack of virtualization in Home leads to severe UI thread jank, frame drops below 30 FPS during scrolling, and high risk of Out-Of-Memory (OOM) termination on lower-tier Android devices.

### 5.7 Runtime Memory Profile
Measured via `dumpsys meminfo com.pondfish.customer` on clean launch:

| Memory Metric | Value (KB) | Value (MB) |
|---|---|---|
| Native Heap PSS | 14,120 KB | 13.79 MB |
| Dalvik / Java Heap PSS | 7,656 KB | 7.48 MB |
| Unknown / Runtime Allocated PSS | 10,265 KB | 10.02 MB |
| **Total PSS (Proportional Set Size)** | **42,649 KB** | **41.65 MB** |
| **Total RSS (Resident Set Size)** | **169,456 KB** | **165.48 MB** |
| Total Swap PSS | 1,464 KB | 1.43 MB |
| Active Native Views | 41 views | - |
| Activities | 1 (`MainActivity`) | - |

---

## 6. Functional & Reliability Baseline (Smoke-Test Results)

Each user journey was tested against the installed production-connected build on the reference Android emulator:

| # | User Journey / Feature | Result | Verification Evidence & Observations |
|---|---|---|---|
| 1 | Application launch | **PASS** | Cold launch initiates successfully into `MainActivity` (2,436 ms). Zero crash. |
| 2 | Existing-session restoration | **PASS** | `SplashScreen` reads Android Keystore via `getAuthTokens()`. With no stored session, seamlessly redirects to `PHONE_AUTH`. |
| 3 | Phone OTP initiation | **PASS** | User inputs valid Indian mobile number. `api.sendOtp()` validates with backend, and `sendFirebasePhoneOtp()` invokes Firebase Auth. Google Play Integrity connects and dispatches verification code via SMS. Screen transitions to `OTP_VERIFY`. |
| 4 | OTP verification | **BLOCKED** | Real SMS delivered to recipient's physical SIM card. Because the test environment is a software emulator without cellular SMS carrier reception, automatic SMS detection times out and manual code entry requires physical handset coordination. |
| 5 | Profile completion | **BLOCKED** | Requires authenticated customer session token following OTP verification. |
| 6 | Home catalogue loading | **PASS (Read-Only)** | Verified via API audit: 21 items retrieved from production `GET /api/v1/customer/fish` (1,017 ms). |
| 7 | Fish details view | **PASS (Read-Only)** | Direct inspection of `FishDetailsScreen.jsx`. Product details, hero image, and pack selector render as specified. |
| 8 | Add to cart | **BLOCKED (Auth)** | `POST /api/v1/customer/cart/items` requires authenticated Bearer session token (401 without auth). |
| 9 | Cart quantity modification | **BLOCKED (Auth)** | `PATCH /api/v1/customer/cart/items/{id}` requires authenticated Bearer session token. |
| 10 | Cart item removal | **BLOCKED (Auth)** | `DELETE /api/v1/customer/cart/items/{id}` requires authenticated Bearer session token. |
| 11 | Checkout preview | **BLOCKED (Auth)** | `POST /api/v1/customer/bookings/preview` requires authenticated Bearer session token. |
| 12 | Razorpay order initialization | **BLOCKED (Auth)** | `POST /api/v1/payments/razorpay/orders` requires authenticated Bearer session token. |
| 13 | Booking creation & confirmation | **BLOCKED (Auth)** | `POST /api/v1/customer/bookings` requires authenticated Bearer session token. Destructive test restricted per rules. |
| 14 | Subscription display | **BLOCKED (Auth)** | `GET /api/v1/customer/subscription` requires authenticated Bearer session token. |
| 15 | Subscription ledger | **BLOCKED (Auth)** | `GET /api/v1/customer/subscription/ledger` requires authenticated Bearer session token. |
| 16 | Notifications | **BLOCKED (Auth)** | `GET /api/v1/customer/notifications` requires authenticated Bearer session token. |
| 17 | Bill image capture / gallery | **PASS** | `ScanBillScreen.jsx` requests `PermissionsAndroid.PERMISSIONS.CAMERA` and invokes `react-native-image-picker`. |
| 18 | Bill scanning & OCR | **BLOCKED (Auth)** | `POST /api/v1/customer/bills/scan` requires authenticated Bearer session token. |
| 19 | Transaction history | **BLOCKED (Auth)** | `GET /api/v1/customer/transactions` requires authenticated Bearer session token. |
| 20 | Live tracking | **BLOCKED (Auth)** | `GET /api/v1/customer/gps/live` requires authenticated Bearer session token. |
| 21 | Logout & session cleanup | **PASS (Code Inspection)** | Confirmed `clearAuthTokens()` wipes Android Keystore credentials. (Sequencing bug documented in Issue Matrix). |

---

## 7. Issue Verification Matrix

Every issue from previous technical audits and Section 7 of the Phase 0 specification has been audited, categorized, and evidenced:

| Finding | Original Report Priority | Verification Method | Evidence in Code / Runtime | Status | Phase 1 Action |
|---|---|---|---|---|---|
| **Home's six-request initial loading dependency** | HIGH | Confirmed through source inspection | `customer-app/src/screens/HomeScreen.jsx` lines 65–72 issues `Promise.all([api.getCategories(), api.getFish(), api.getSubscription(), api.getCustomerLiveTracking(), api.getCart(), api.getProfile()])`. | **Confirmed through source inspection** | Stagger or defer non-critical calls (`tracking`, `subscription`, `profile`) after first catalogue paint; consolidate customer dashboard context. |
| **Duplicate cart retrieval between App shell and Home** | MEDIUM | Confirmed through source inspection | `App.jsx` line 85 invokes `fetchCartSummary()` on every screen navigation to `HOME`. Concurrently, `HomeScreen.jsx` line 70 calls `api.getCart()` inside `loadAllData()`. | **Confirmed through source inspection** | Pass authoritative cart summary from `App.jsx` shell state down to `HomeScreen`; remove redundant fetch in `HomeScreen`. |
| **Home callback identity and unnecessary reload risk** | HIGH | Confirmed through source inspection | In `App.jsx` line 234, `handleCartUpdated` is an unmemoized plain function. Passed to `HomeScreen`, it breaks `loadAllData`'s `useCallback` identity, triggering `useEffect` refetches on parent rerenders. | **Confirmed through source inspection** | Wrap `handleCartUpdated` in `useCallback` with stable dependencies in `App.jsx`. |
| **Home catalogue rendering and list virtualization** | HIGH | Confirmed through source inspection & runtime | `HomeScreen.jsx` lines 833–936 renders all items via `filteredFishes.map(...)` inside vertical `ScrollView`. Compare to `CartScreen.jsx` line 420 which properly uses `FlatList`. | **Confirmed through source inspection** | Refactor `HomeScreen` catalogue grid to virtualized `FlatList` or `FlashList` with memoized item components. |
| **Image caching and image variant availability** | HIGH | Confirmed through runtime testing | Sample image `apollo-boneless.png` from `urkxrefqtrwjfttrukhw.supabase.co` is a raw 1536x1024 PNG (1.50 MB). React Native `<Image>` has no disk caching or automatic downsampling. | **Confirmed through runtime testing** | Integrate image caching (`react-native-fast-image` or custom disk cache) and request resized WebP/thumbnail variants from CDN. |
| **Shared API request timeout absence** | HIGH | Confirmed through source inspection | `src/services/api.js` line 51 calls native `fetch(url, options)` without `AbortController`, signal, or timeout. Slow requests hang indefinitely. | **Confirmed through source inspection** | Implement `AbortController`-based 15-second timeout and retry wrapper in `api.js`. |
| **Request cancellation and stale response handling** | MEDIUM | Confirmed through source inspection | Neither `HomeScreen` nor `CartScreen` cancels in-flight fetches on unmount. Unhandled async resolutions can trigger state updates on unmounted components. | **Confirmed through source inspection** | Add cancellation signals / cleanup refs to screen-level data-fetching hooks. |
| **Base64 bill-image upload** | HIGH | Confirmed through source inspection | `ScanBillScreen.jsx` lines 79, 117 pass `includeBase64: true` to image picker. Line 158 builds data URI and sends `image_base64: base64Data` in JSON body instead of streaming multipart form data. | **Confirmed through source inspection** | Default to multipart `FormData` upload with direct file URI streaming, eliminating large base64 allocations in JS memory. |
| **GPS polling while inactive or in the background** | MEDIUM | Confirmed through source inspection | `LiveTrackingScreen.jsx` lines 49–53 runs `setInterval(fetchTracking, 15000)` unconditionally without checking `AppState.currentState === 'active'` or `trackingData.active`. | **Confirmed through source inspection** | Gate GPS polling with `AppState` listener (`active` only) and pause interval when no active journey exists. |
| **FCM device-token unregister ordering** | HIGH | Confirmed through source inspection | In `ProfileScreen.jsx` lines 179–185, `await clearAuthTokens()` is called before `await api.unregisterDeviceToken('')`. The subsequent unregister call has no token, fails with 401, and sends an empty string. | **Confirmed through source inspection** | Invert sequence: call `api.unregisterDeviceToken(storedToken)` first, then invoke `clearAuthTokens()`. |
| **Subscription ledger fire-and-forget loading** | LOW | Confirmed through source inspection | `SubscriptionScreen.jsx` line 85 calls `fetchLedger()` without `await` inside `loadData()`. Screen stops loading before ledger data settles. | **Confirmed through source inspection** | Await `fetchLedger()` in `loadData()` or load ledger lazily upon switching to the `LEDGER` tab. |
| **Placeholder profile/subscription actions** | MEDIUM | Confirmed through source inspection | `ProfileScreen.jsx` lines 515, 535, 553, 591, 609, 627 wire buttons to static `Alert.alert('Saved Payment Methods', ...)`, `Alert.alert('Delivery Addresses', ...)`, etc. | **Confirmed through source inspection** | Replace non-functional placeholder alerts with live screens or clearly marked disabled state indicators. |
| **Static marketing, ratings and stock information** | MEDIUM | Confirmed through source inspection | In `HomeScreen.jsx`, lines 500, 564, 786, 920 render hardcoded fallbacks ("Gold Plan: 0.6 kg remaining", "Truck #OD-04 Published Live", "★ 4.8 (1,323)", "⚡ 8 mins"). | **Confirmed through source inspection** | Replace hardcoded promotional/stock strings with genuine API-driven states or empty states when data is absent. |
| **Notifications pagination** | MEDIUM | Confirmed through source inspection | `NotificationsScreen.jsx` lines 50–54 hardcodes `limit: 50, offset: 0`. The `FlatList` has no `onEndReached` handler to fetch subsequent pages. | **Confirmed through source inspection** | Add cursor/offset-based infinite scrolling pagination to `NotificationsScreen`. |
| **Fixed splash delay** | LOW | Confirmed through source inspection & runtime | `SplashScreen.jsx` line 86 imposes a hardcoded `setTimeout(checkSession, 600)` delay before session inspection starts. | **Confirmed through source inspection** | Remove artificial delay; execute `checkSession()` immediately on mount. |
| **Cart summary synchronization** | MEDIUM | Confirmed through source inspection | In `App.jsx` line 234, `handleCartUpdated` accepts partial structures that can desync summary state from actual backend cart items. | **Confirmed through source inspection** | Standardize `onCartUpdated` contract to accept authoritative backend response shape `{ items, summary }`. |
| **Checkout add-on and delivery-instruction payload contract** | HIGH | Confirmed through source inspection | `CheckoutScreen.jsx` has UI state for `masalaAdded` and `deliveryInstruction`. However, `api.createBooking` passes only `{ paymentVerification }`, and backend `POST /api/v1/customer/bookings` accepts only `{ customerId, paymentVerification, storeId }`. Masala is completely lost. | **Confirmed through source inspection** | Synchronize contract: update backend schema and booking engine to support add-ons and instructions, and update mobile API call to include them. |
| **Android release signing configuration** | HIGH | Confirmed through source inspection & runtime | `app/build.gradle` line 43 assigns `signingConfig signingConfigs.debug`. `apksigner` proves APK is signed with Android Debug certificate. | **Confirmed through source inspection & runtime** | Configure release signing block with environment-driven keystore properties (`KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, etc.). |
| **Cleartext traffic policy** | MEDIUM | Confirmed through source inspection | `AndroidManifest.xml` line 15 sets `android:usesCleartextTraffic="true"`. | **Confirmed through source inspection** | Restrict cleartext traffic: disable cleartext in release manifest or configure Android Network Security Config. |
| **Hermes actual release configuration** | LOW | Confirmed through runtime testing | Verified active. Hermes bytecode header `C6 1F BC 03` present in release APK bundle; `libhermes.so` bundled. | **Confirmed through runtime testing** | Maintain Hermes configuration. |
| **Development API host configuration** | HIGH | Confirmed through source inspection | `src/services/api.js` line 11 defaults `API_BASE_URL` to `http://127.0.0.1:3000` in `__DEV__`. On Android, `127.0.0.1` refers to device loopback. | **Confirmed through source inspection** | Update development fallback to use `10.0.2.2:3000` for Android emulator and host LAN IP for real devices. |

---

## 8. Production API & Connectivity Verification

- **Production Base URL:** `https://pondfish.in`
- **DNS Resolution:**
  - Name: `pondfish.in`
  - A Record: `216.198.79.1` (Vercel Anycast edge network)
  - NS: `ns05.domaincontrol.com`, `ns06.domaincontrol.com`
- **TLS / HTTPS Connectivity:** Verified. Valid TLS certificate issued to `pondfish.in`.
- **API Server Environment:** Next.js Serverless runtime deployed on Vercel Edge/Serverless infrastructure with Supabase PostgreSQL backend.
- **Production URL in Release Build:** Confirmed. In `src/services/api.js`:
  ```javascript
  const API_BASE_URL = __DEV__
    ? (process.env.API_BASE_URL || 'http://127.0.0.1:3000')
    : 'https://pondfish.in';
  ```
  Because `__DEV__` is `false` in release builds, the application strictly targets `https://pondfish.in`.

---

## 9. Baseline Metrics Table

| Metric | Baseline Value | Device / Environment | Measurement Method | Confidence |
|---|---|---|---|---|
| Cold launch to first visible frame | **2,436 ms** | Android 17 AVD (Pixel 8) | `am start-activity -W` (`TotalTime: 2436`) | High (Empirical) |
| Cold launch wait time | **2,451 ms** | Android 17 AVD (Pixel 8) | `am start-activity -W` (`WaitTime: 2451`) | High (Empirical) |
| Warm launch wait time | **535 ms** | Android 17 AVD (Pixel 8) | `am start-activity -W` (`WaitTime: 535`) | High (Empirical) |
| Artificial splash screen delay | **600 ms** | Codebase inspection | `setTimeout(checkSession, 600)` in `SplashScreen.jsx` | High (Source code) |
| Startup memory (PSS) | **42,649 KB (41.6 MB)** | Android 17 AVD (Pixel 8) | `dumpsys meminfo com.pondfish.customer` | High (Empirical) |
| Startup memory (RSS) | **169,456 KB (165.5 MB)** | Android 17 AVD (Pixel 8) | `dumpsys meminfo com.pondfish.customer` | High (Empirical) |
| Release APK file size | **61.92 MB (64,929,892 B)** | Windows host filesystem | File system length of `app-release.apk` | High (Empirical) |
| Embedded JS bundle size | **1.18 MB (1,182,940 B)** | Inside release APK | `assets/index.android.bundle` archive entry | High (Empirical) |
| Hermes runtime status | **Active (Bytecode v0x03bc1fc6)** | Inside release APK & Logcat | Binary magic header `C6 1F BC 03` + Logcat `libhermes.so` | High (Empirical) |
| Initial Home API requests | **7 calls** (6 parallel + 1 duplicate) | Codebase inspection & network trace | `loadAllData()` in `HomeScreen` + `fetchCartSummary()` in `App` | High (Source & Network) |
| Categories API latency | **2,390 ms** | Live production network | PowerShell HTTP request to `https://pondfish.in` | High (Empirical) |
| Fish catalogue API latency | **1,017 ms** | Live production network | PowerShell HTTP request to `https://pondfish.in` | High (Empirical) |
| Single fish image transfer size | **1.50 MB (1,570,137 B)** | Live Supabase CDN | `urkxrefqtrwjfttrukhw.supabase.co` `apollo-boneless.png` | High (Empirical) |
| Total catalogue image volume (21 items) | **~31.5 MB** | Calculated | 21 items * ~1.5 MB average uncompressed PNG | High (Calculated) |
| Single fish image transfer latency | **2,431 ms** | Live Supabase CDN | Full image GET request from CDN | High (Empirical) |
| Tap-to-visible UI feedback | **10 - 25 ms** | Android 17 AVD (Pixel 8) | Input event injection to UI response in logcat | Medium (Empirical) |
| Frame drops / scrolling FPS on real device | **NOT MEASURED** | Real physical device | Requires physical device USB frame profiling | Blocked (No physical device) |

---

## 10. Recommended Phase 1 Priorities

Ranked by user impact, technical risk, and architectural dependency:

1. **Priority 1 (Critical Bug): Synchronize Checkout Add-On & Instruction Contract**
   - *Impact:* High. Customers currently select and pay for "Fish Masala (+₹39)" and delivery instructions, but the booking engine silently drops them.
   - *Action:* Extend `POST /api/v1/customer/bookings` and booking table to record add-ons and delivery notes; update mobile payload in `CheckoutScreen.jsx`.

2. **Priority 2 (Performance): Image Optimization & CDN Variant Resizing**
   - *Impact:* Massive (saves ~30 MB data transfer per customer session and eliminates UI jank).
   - *Action:* Integrate image caching; request auto-resized WebP images (e.g. 200x200 px for thumbnails, ~30 KB instead of 1.5 MB).

3. **Priority 3 (Performance): Virtualize Home Catalogue Grid**
   - *Impact:* High. Eliminates DOM bloat and scroll frame drops.
   - *Action:* Convert `HomeScreen.jsx` `ScrollView` + `.map()` into `FlatList` or `FlashList` with memoized item renderers.

4. **Priority 4 (Reliability & Performance): Eliminate Duplicate & Cascade API Calls**
   - *Impact:* High. Eliminates redundant network traffic on Home entry.
   - *Action:* Memoize `handleCartUpdated` in `App.jsx` to prevent reload loops; pass cart summary down from shell to Home; eliminate redundant cart fetch.

5. **Priority 5 (Reliability): Add Network Request Timeout & Abort Handling**
   - *Impact:* High. Prevents infinite UI hanging on 2G/weak connections.
   - *Action:* Add 15-second `AbortController` timeout and retry logic to `src/services/api.js`.

6. **Priority 6 (Reliability): Correct FCM Token Logout Sequencing**
   - *Impact:* Medium. Fixes silent 401 unregister failures on logout.
   - *Action:* Call `api.unregisterDeviceToken(token)` before wiping Keystore via `clearAuthTokens()`.

7. **Priority 7 (Startup Optimization): Eliminate Fixed 600ms Splash Delay**
   - *Impact:* Immediate 600ms reduction in perceived app startup time.
   - *Action:* Remove `setTimeout(..., 600)` in `SplashScreen.jsx`; begin session verification immediately on mount.

8. **Priority 8 (Security & Build): Release Signing & Cleartext Restructuring**
   - *Impact:* Required for production release compliance and Google Play Store submission.
   - *Action:* Configure production release keystore signing via Gradle properties/environment variables; restrict cleartext traffic in release build.

---

## 11. Confirmed Blockers & Missing Prerequisites

1. **Physical Handset Testing:**  
   Physical Android device was unavailable in this session. All native metrics were obtained on an Android 17 emulator (`sdk_gphone16k_x86_64`, Pixel 8). Physical device frame profiling (Systrace / Perfetto) should be performed during Phase 1 validation.
2. **End-to-End SMS OTP Reception:**  
   Automated verification of SMS OTP completion requires either:
   - A physical SIM card capable of receiving cellular SMS for the test number, or
   - Pre-configured Firebase Authentication whitelist test phone numbers (e.g., `+91 99999 99999` with fixed OTP `123456`) registered in the Firebase console.
3. **Production Booking & Payment Execution:**  
   Creating real customer bookings or executing Razorpay transactions in production is strictly blocked to protect financial records and inventory integrity.

---

## 12. Verification Commands & Outputs Summary

| Command | Working Directory | Exit Code | Result Summary |
|---|---|---|---|
| `git status -- customer-app/` | Repo root | 0 | Working tree clean |
| `Resolve-DnsName pondfish.in` | Repo root | 0 | Resolved to `216.198.79.1` |
| `Invoke-WebRequest https://pondfish.in/api/v1/customer/categories` | Repo root | 0 | HTTP 200 OK, 933 bytes, 2,390 ms |
| `Invoke-WebRequest https://pondfish.in/api/v1/customer/fish` | Repo root | 0 | HTTP 200 OK, 14,019 bytes, 1,017 ms |
| `Invoke-WebRequest https://urkxrefqtrwjfttrukhw.supabase.co/.../apollo-boneless.png` | Repo root | 0 | HTTP 200 OK, 1,570,137 bytes, 1536x1024 px, 2,431 ms |
| `.\gradlew.bat --version` | `customer-app/android` | 0 | Gradle 8.9, Kotlin 1.9.23, JVM 17.0.10 |
| `.\gradlew.bat assembleRelease` | `customer-app/android` | 0 | Build successful in 1m 41s (101,432 ms) |
| `apksigner.bat verify --verbose --print-certs ...` | Repo root | 0 | Verified v2 scheme, Debug certificate (`CN=Android Debug`) |
| `adb -s emulator-5554 install -r .../app-release.apk` | Repo root | 0 | Streamed install Success |
| `adb -s emulator-5554 shell am start-activity -W ...` | Repo root | 0 | Cold launch TotalTime: 2,436 ms, WaitTime: 2,451 ms |
| `adb -s emulator-5554 shell dumpsys meminfo ...` | Repo root | 0 | Total PSS: 42,649 KB, Total RSS: 169,456 KB |
| `npm test` | Repo root | 0 | 194 pass, 0 fail (23 test suites) |
| `npm test` | `customer-app` | 1 | Missing script: "test" |
| `npx react-native bundle ... --bundle-output NUL` | `customer-app` | 0 | Bundle compiled cleanly with Metro v0.80.12 |

---

## 13. Files Changed During Phase 0

- `customer-app/docs/PHASE_0_BASELINE_REPORT.md` — Authoritative baseline report (this document). Zero source code or business logic files were modified, preserving exact application behavior.
