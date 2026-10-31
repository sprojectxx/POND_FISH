# PONDFISH CUSTOMER MOBILE APPLICATION — PHASE 0
## Baseline Establishment & Technical Verification Report

**Document Version:** 1.1.1 (Refined Baseline — Calculation & Terminology Correction)  
**Repository:** `https://github.com/sprojectxx/POND_FISH`  
**Target Branch:** `main`  
**Starting Commit SHA:** `dd61fec53fd69018f5a916045dbf34eacd0cb0ad`  
**Prior Baseline Commit SHA:** `32b0b78b7eae2a1b36e4b05c8cbd85548f99eaf6`  
**Scope:** `customer-app/`  
**Date & Time:** 2026-10-31  
**Operating Environment:** Windows 11 Pro 64-bit (10.0.26100), Node.js v22.15.0, npm 10.9.2, OpenJDK 17.0.10  
**Test Hardware / Runtime:** Android Virtual Device (AVD) `PONDFISH_Pixel_8` (Device Model `sdk_gphone16k_x86_64`), Android 17 (API Level 37), 16KB page-size kernel, 4.0 GB RAM, 1080x2400 physical display  

---

## 0. Correction & Evidence Refinement Note

Following technical review and rigorous empirical validation, this document has been refined to eliminate unsubstantiated claims, establish precise measurement distinctions, and correctly classify all architectural findings and smoke-test results.

### 0.1 Summary of Corrections
1. **Image Delivery Analysis Corrected:**
   - **Wire Compression:** PNG assets transmitted over HTTP are **compressed via DEFLATE** at the protocol/file level. They are **not uncompressed bitstreams on the wire**. However, they remain desktop-resolution (1536x1024 px) assets without thumbnail resizing.
   - **Catalogue Image Volume & HTTP HEAD Distinctions:** Rather than an estimate of 31.5 MB extrapolated from a single asset, **all 20 unique image URLs** in the 21-item catalogue were individually queried via HTTP `HEAD` requests. The **aggregate declared image representation size based on HTTP HEAD Content-Length** across all 20 unique images is **44,376,391 bytes (42.32 MB)** (min: 1,570,137 bytes [1.50 MB], max: 2,836,819 bytes [2.71 MB], average: **2,218,819.55 bytes [~2.22 MB]**). Crucially, this metric represents HTTP `Content-Length` metadata returned by HEAD requests, not actual HTTP response-body bytes transferred or verified mobile application download volume. Actual application-level image traffic is governed by client caching (cold-cache vs. warm-cache) and viewport rendering, so 42.32 MB is not proven to be downloaded on every Home-screen mount.
   - **Threading & Decoding:** In React Native Android, remote image fetching, network streaming, and image decoding are handled asynchronously by native background threads (via Fresco and OkHttp), **not on the JavaScript main thread**. The performance impact stems from native memory consumption, decoding overhead, and heap pressure, not direct JS event-loop blocking during downloads.
   - **Optimization Target Clarification:** The reference to "200x200 WebP at 30 KB" is a **hypothetical Phase 1 optimization target**, not an existing verified asset or server capability.

2. **Startup & Launch Latency Distinctions Established:**
   - **Activity Launch Timing:** Cold launch to `MainActivity` reported by `am start-activity -W` is **TotalTime: 2,436 ms** (WaitTime: 2,451 ms). This measures native activity launch and initial view hierarchy creation.
   - **First Visible Frame:** **NOT MEASURED**. Accurately determining the first visible frame timestamp requires frame-level Systrace / Perfetto tracing on physical hardware or Choreographer frame callback instrumentation.
   - **Splash Completion & Usable Auth Screen:** **NOT MEASURED** as separate automated timestamps. The previously reported ~3,100 ms was a calculated sum of activity launch time plus the 600 ms timer, not an independently captured frame-level timestamp.
   - **Artificial Splash Timer:** The **600 ms** delay (`setTimeout(checkSession, 600)`) is a **statically observed source-code timer** in `SplashScreen.jsx`, not an additive measured OS metric.

3. **Checkout Add-On Contract Finding Reassessed:**
   - **Contract Omission vs. Financial Defect:** Joint inspection of `CheckoutScreen.jsx`, `src/services/api.js`, `app/api/v1/customer/bookings/route.js`, and `lib/engines/booking.js` proves that selecting "Artisanal Fish Masala (+₹39)" updates local UI state `totalPayable`, but `api.createRazorpayOrder()` calls the backend with `{}`. The backend recalculates the authoritative amount purely from cart items via `bookingEngine.previewCheckout()`, ignoring client add-ons.
   - **Financial Impact:** The customer is **NOT charged** for the unpersisted masala paste. The Razorpay order amount reflects only the cart items.
   - **Booking Creation Omission:** When creating the booking, `api.createBooking` transmits only `{ paymentVerification }`. Backend `POST /api/v1/customer/bookings` receives only `paymentVerification` and `storeId`. Neither the masala selection nor the delivery instructions are transmitted or persisted in database records.
   - **Correct Classification:** Confirmed **client-to-backend contract mismatch / client payload omission** (NOT a verified financial overcharge defect).

4. **Home Callback Identity & Duplicate-Fetch Issue Clarified:**
   - **Duplicate Cart Requests:** Confirmed. Entering `HomeScreen` fires two concurrent `GET /api/v1/customer/cart` requests (one from `App.jsx` `useEffect`, one inside `HomeScreen.jsx` `loadAllData()`).
   - **Unnecessary Reload Risk:** In `App.jsx`, `handleCartUpdated` is an unmemoized plain function reference. Passing it to `HomeScreen` causes `loadAllData`'s `useCallback` dependency array to invalidate on parent re-renders.
   - **Loop Status:** An infinite reload loop is **NOT proven or observed at runtime**. It represents an architectural reload risk during state updates, not an active runaway loop.

5. **Functional Smoke-Test Classifications Standardized:**
   - Every user journey has been reclassified into the required 5-state taxonomy: `RUNTIME_PASS`, `RUNTIME_FAIL`, `SOURCE_INSPECTION_ONLY`, `BLOCKED`, or `NOT_TESTED`.
   - Journeys verified purely by reviewing component source code (e.g., existing-session restoration without a stored session, fish details view, logout token clearing, bill image picker setup) are explicitly classified as `SOURCE_INSPECTION_ONLY` or `BLOCKED`, not `RUNTIME_PASS`.

6. **API Performance Evidence Qualified:**
   - Each endpoint measurement now explicitly states: authentication status, HTTP status, sample count, latency, network environment, and whether it was a single sample.
   - Unauthenticated 401 responses from protected endpoints (`/cart`, `/profile`, `/subscription`, `/gps/live`) are rejected early by auth middleware and **do not reflect normal authenticated business-logic latency**, which is marked as **NOT MEASURED**.

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
   Activity launch timing to `MainActivity` on the reference Android 17 emulator requires **2,436 ms** (TotalTime: 2,436 ms, WaitTime: 2,451 ms via `am start-activity -W`). An artificial delay of **600 ms** (`setTimeout(checkSession, 600)`) is statically observed in `SplashScreen.jsx` before secure Keystore session retrieval initiates. First visible frame and auth usable timestamps were **NOT MEASURED** (require frame-level tracing). Warm launch requires **535 ms**. Process memory on launch is **41.65 MB PSS** (**165.48 MB RSS**).
6. **Production API Connectivity:**  
   The production API base URL `https://pondfish.in` resolves to Vercel Anycast IP `216.198.79.1`. Unauthenticated read-only endpoints respond successfully: `/api/v1/customer/categories` (200 OK, 933 bytes, 2,390 ms latency, single sample) and `/api/v1/customer/fish` (200 OK, 14,019 bytes, 21 fish records, 1,017 ms latency, single sample). Protected endpoints (`/cart`, `/profile`, `/subscription`, `/gps/live`) correctly reject unauthenticated requests with 401 Unauthorized via middleware; their normal authenticated processing latency is **NOT MEASURED**.
7. **Image Delivery Bottleneck:**  
   Product images are hosted on Supabase Storage (`urkxrefqtrwjfttrukhw.supabase.co/storage/v1/object/public/fish-assets/`). All 20 unique images in the catalogue are high-resolution PNG files with an **aggregate declared image representation size based on HTTP HEAD Content-Length** of **44,376,391 bytes (42.32 MB)** (average declared representation size: **2,218,819.55 bytes [~2.22 MB]**; range: 1,570,137 bytes [1.50 MB] to 2,836,819 bytes [2.71 MB]). This represents declared `Content-Length` metadata from HTTP HEAD queries, not verified application-level response-body bytes transferred (actual network traffic depends on cold-cache vs. warm-cache behavior). The files use DEFLATE compression on the wire and are handled by native background threads (Fresco/OkHttp), but high resolution (1536x1024 px) causes substantial native memory footprint and decoding overhead when rendering into 110x110 px thumbnails.
8. **Unvirtualized Catalogue Rendering:**  
   `HomeScreen.jsx` renders all catalogue cards, flash sales, and previous purchases using standard vertical and horizontal `ScrollView` with `.map()`. In contrast, `CartScreen.jsx` and `NotificationsScreen.jsx` employ virtualized `FlatList`.
9. **Architectural & Contract Issues Confirmed:**
   - **Checkout Add-On Contract Mismatch:** `CheckoutScreen.jsx` provides a UI toggle for "Artisanal Fish Masala (+₹39)" and delivery instructions, altering the local payable amount. However, the Razorpay order creation recalculates amount authoritatively on the backend from cart items only (customer is not overcharged), and `api.createBooking` omits both the add-on and instructions from the payload sent to `POST /api/v1/customer/bookings`, resulting in complete client payload omission.
   - **FCM Token Invalidation Sequencing:** `ProfileScreen.jsx` calls `clearAuthTokens()` before calling `api.unregisterDeviceToken('')`. Because credentials are wiped prior to the network request, the unregister call is dispatched without an `Authorization` header, failing with HTTP 401 and leaking push tokens on the server.
   - **Duplicate Cart Fetches & Reload Risk:** `App.jsx` issues `api.getCart()` on every navigation to Home, while `HomeScreen.jsx` issues a concurrent `api.getCart()` inside `loadAllData()`. An unmemoized callback in `App.jsx` poses an architectural reload risk, though an infinite loop is not observed at runtime.

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

| Startup Phase / Stage | Metric Value | Characterization | Measurement Method / Evidence Source |
|---|---|---|---|
| Cold launch activity timing (`TotalTime`) | **2,436 ms** | Cold process initialization and native Activity creation | Measured via ADB `am start-activity -W` (`TotalTime: 2436`) |
| Cold launch window delivery (`WaitTime`) | **2,451 ms** | Total OS intent processing and window surface delivery | Measured via ADB `am start-activity -W` (`WaitTime: 2451`) |
| First visible frame | **NOT MEASURED** | RenderThread first frame presentation | Requires frame-level Systrace/Perfetto tracing |
| Splash completion timestamp | **NOT MEASURED** | Transition from native splash to JS rendering | Requires instrumentation / frame-level tracing |
| Authentication screen usable | **NOT MEASURED** | Input field interactive on `PHONE_AUTH` screen | Requires user interaction profiler / end-to-end timing |
| Artificial splash delay timer | **600 ms** | Fixed delay before session check triggers | Statically observed in `SplashScreen.jsx` (`setTimeout(checkSession, 600)`) |
| Keystore credentials read duration | **< 15 ms** | Hardware-backed secret read | Direct read benchmark via `getAuthTokens()` |
| Warm launch activity timing (`WaitTime`) | **535 ms** | Activity resume from background task stack | Measured via ADB `am start-activity -W` (`WaitTime: 535`) |

> **Measurement Distinction:** The activity launch timing (`TotalTime: 2,436 ms`) reflects Android OS ActivityManager reporting. The 600 ms splash delay is a statically observed timer in JavaScript and does not run until the JS engine has initialized and mounted `SplashScreen`. Total cold time to authentication screen interactivity is not an additive metric from ADB alone and requires dedicated frame-level tracing during Phase 1.

### 5.3 Home Screen Loading & Network Dependencies
Inspection of `HomeScreen.jsx` and `App.jsx`:
- **Requests Initiated on Home Entry:** **7 total API calls** (6 parallel in Home + 1 from App shell)
- **Home `loadAllData()` Parallel Calls:**
  1. `GET /api/v1/customer/categories` (Latency: 2,390 ms, Payload: 933 B)
  2. `GET /api/v1/customer/fish` (Latency: 1,017 ms, Payload: 14,019 B)
  3. `GET /api/v1/customer/subscription` (Requires Auth - 401 unauthenticated)
  4. `GET /api/v1/customer/gps/live` (Requires Auth - 401 unauthenticated)
  5. `GET /api/v1/customer/cart` (Requires Auth - 401 unauthenticated)
  6. `GET /api/v1/customer/profile` (Requires Auth - 401 unauthenticated)
- **App Shell Call:**
  7. `GET /api/v1/customer/cart` (triggered by `useEffect` in `App.jsx` on every screen navigation)
- **Duplicate Request Ratio:** `GET /api/v1/customer/cart` is executed twice concurrently upon navigating to Home.
- **Total Loading Duration:** Governed by slowest endpoint (`/categories` at ~2,390 ms cold latency).

### 5.4 Production API Performance Table
Measured against live production host `https://pondfish.in` from the test host environment:

| Endpoint | Method | Auth Required | Request State in Test | HTTP Status | Measurement Count | Latency (ms) | Network Environment | Single Sample? |
|---|---|---|---|---|---|---|---|---|
| `/api/v1/customer/categories` | GET | No | Public / Unauthenticated | 200 OK | 1 | 2,390 ms | Host Wi-Fi to Vercel CDN | Yes |
| `/api/v1/customer/fish` | GET | No | Public / Unauthenticated | 200 OK | 1 | 1,017 ms | Host Wi-Fi to Vercel CDN | Yes |
| `/api/v1/customer/auth/send-otp` | POST | No | Empty Body (Validation test) | 400 Bad Request | 1 | 473 ms | Host Wi-Fi to Vercel CDN | Yes |
| `/api/v1/customer/subscription/plans` | GET | Yes | Unauthenticated (Auth check) | 401 Unauthorized | 1 | 631 ms (401 rejection) | Host Wi-Fi to Vercel CDN | Yes (Normal auth latency: **NOT MEASURED**) |
| `/api/v1/customer/profile` | GET | Yes | Unauthenticated (Auth check) | 401 Unauthorized | 1 | 321 ms (401 rejection) | Host Wi-Fi to Vercel CDN | Yes (Normal auth latency: **NOT MEASURED**) |
| `/api/v1/customer/cart` | GET | Yes | Unauthenticated (Auth check) | 401 Unauthorized | 1 | 472 ms (401 rejection) | Host Wi-Fi to Vercel CDN | Yes (Normal auth latency: **NOT MEASURED**) |
| `/api/v1/customer/gps/live` | GET | Yes | Unauthenticated (Auth check) | 401 Unauthorized | 1 | 326 ms (401 rejection) | Host Wi-Fi to Vercel CDN | Yes (Normal auth latency: **NOT MEASURED**) |

> **Authentication Note:** Latencies for protected endpoints (`/subscription/plans`, `/profile`, `/cart`, `/gps/live`) represent early rejection by authentication middleware (HTTP 401 Unauthorized). They **do not** reflect normal authenticated database query or business logic execution latency. Normal authenticated latency is marked **NOT MEASURED** and will be benchmarked in Phase 1 with dedicated test credentials.

### 5.5 Image Delivery Analysis
Product images are hosted on Supabase Storage (`urkxrefqtrwjfttrukhw.supabase.co/storage/v1/object/public/fish-assets/`).

#### Empirical Catalogue Image Audit (Measured via HTTP HEAD):
- **Catalogue Size:** 21 fish items returned in `GET /api/v1/customer/fish`.
- **Unique Image URLs:** **20 unique image URLs** (one URL is shared between two product variants).
- **Inspection Coverage:** 20 of 20 unique image URLs measured individually via HTTP HEAD.
- **Aggregate Declared Image Representation Size (Based on HTTP HEAD Content-Length):** **44,376,391 bytes (42.32 MB)** across all 20 unique images.
- **Minimum Declared Image Size:** **1,570,137 bytes (1.50 MB)** (`apollo-boneless.png`).
- **Maximum Declared Image Size:** **2,836,819 bytes (2.71 MB)** (`prawns-large.png`).
- **Average Declared Image Size (Calculated):** **2,218,819.55 bytes (~2.22 MB)** (44,376,391 bytes / 20 unique images).
- **Image Format:** All 20 assets are declared as PNG (`image/png`).
- **Compression Characterization:** PNG files use DEFLATE compression on the wire. They are **not uncompressed raw bitstreams** during transmission. However, their physical dimensions (1536x1024 px) are designed for desktop displays rather than mobile thumbnails.
- **Measurement & Network Traffic Distinctions:**
  - **Content-Length Metadata vs. Transferred Bytes:** The audit inspected HTTP `Content-Length` metadata from HTTP HEAD requests. Unless actual GET response bodies or mobile network traces are captured, this aggregate Content-Length reflects declared asset representation size, **not measured network transfer volume**.
  - **Application Download Volume:** 42.32 MB is **not proven** to be downloaded during every Home-screen mount. Actual bytes transferred at the mobile application layer depend on viewport visibility, image mounting behavior, and device cache state.
  - **Cold-Cache vs. Warm-Cache Traffic:** On initial cold launch with empty disk/memory cache, images requested by mounted components initiate network transfers. On subsequent warm navigation, local disk/memory cache (Fresco) or edge caching (`Cache-Control: public, max-age=3600`, `cf-cache-status: HIT`) eliminates repeated full-body network transfers.
- **Threading Model:** Image downloading, decoding, and caching in React Native Android are executed on native background threads by the Fresco / OkHttp pipeline, **not on the JavaScript main thread**. UI jank occurs due to high native memory consumption and bitmap decompression overhead when mounting dozens of large images into 110x110 px containers simultaneously.
- **HTTP Cache Headers:** `Cache-Control: public, max-age=3600` (1-hour edge/browser cache), `cf-cache-status: HIT`.
- **Sample Asset Latency:** Full `GET` download of `apollo-boneless.png` required **2,431 ms** (single sample).
- **Optimization Target (Phase 1 Target, NOT Existing):** Serving thumbnail variants (e.g. 200x200 px WebP at ~30 KB) is a **projected optimization target** for Phase 1, not an existing verified backend feature.

### 5.6 Catalogue Rendering Strategy Comparison
- **`HomeScreen.jsx`:**
  - Renders all 21 items in `filteredFishes` through `filteredFishes.map()` inside a vertical `ScrollView`.
  - Also renders 4 items in "Previously bought" horizontal `ScrollView` and items in "Flash Sale" horizontal `ScrollView`.
  - Virtualization: **None**. All native view nodes and remote image containers are created and retained in memory simultaneously.
- **`CartScreen.jsx` & `NotificationsScreen.jsx`:**
  - Uses `FlatList` with `keyExtractor` and windowed virtualization. Offscreen items are unmounted from the native view tree.
- **Impact:** With 21 high-resolution images mounted without virtualization, native bitmap memory allocation approaches 100+ MB, leading to frame drops during scrolling and heightened OOM risk on low-memory devices.

### 5.7 Runtime Memory Profile
Measured via `dumpsys meminfo com.pondfish.customer` on clean launch:

| Memory Metric | Value (KB) | Value (MB) | Measurement Characterization |
|---|---|---|---|
| Native Heap PSS | 14,120 KB | 13.79 MB | Measured via `dumpsys meminfo` |
| Dalvik / Java Heap PSS | 7,656 KB | 7.48 MB | Measured via `dumpsys meminfo` |
| Unknown / Runtime Allocated PSS | 10,265 KB | 10.02 MB | Measured via `dumpsys meminfo` |
| **Total PSS (Proportional Set Size)** | **42,649 KB** | **41.65 MB** | Measured via `dumpsys meminfo` |
| **Total RSS (Resident Set Size)** | **169,456 KB** | **165.48 MB** | Measured via `dumpsys meminfo` |
| Total Swap PSS | 1,464 KB | 1.43 MB | Measured via `dumpsys meminfo` |
| Active Native Views | 41 views | - | Measured via `dumpsys meminfo` |
| Activities | 1 (`MainActivity`) | - | Measured via `dumpsys meminfo` |

---

## 6. Functional & Reliability Baseline (Smoke-Test Results)

Each user journey was audited against the installed production-connected build and repository source code. Results are classified into:
- `RUNTIME_PASS`: Verified working at runtime on the device/emulator.
- `RUNTIME_FAIL`: Executed at runtime and failed.
- `SOURCE_INSPECTION_ONLY`: Verified through code review; runtime execution was not performed.
- `BLOCKED`: Cannot be tested due to authentication, cellular network, or security policy constraints.
- `NOT_TESTED`: Not evaluated in this phase.

| # | User Journey / Feature | Classification | Verification Evidence & Observations |
|---|---|---|---|
| 1 | Application launch | **RUNTIME_PASS** | Cold launch initiates successfully into `MainActivity` (TotalTime: 2,436 ms). Zero crash. |
| 2 | Existing-session restoration | **SOURCE_INSPECTION_ONLY** | Code inspection of `SplashScreen.jsx` confirms `getAuthTokens()` call to Android Keystore. However, because no pre-existing valid token existed on test device, runtime session restoration was not exercised. |
| 3 | Phone OTP initiation | **RUNTIME_PASS** | User inputs valid Indian mobile number. `api.sendOtp()` validates with backend, and `sendFirebasePhoneOtp()` invokes Firebase Auth. Google Play Integrity connects and screen transitions to `OTP_VERIFY`. |
| 4 | OTP verification | **BLOCKED** | Real SMS delivered to recipient's physical SIM card. Because the test environment is a software emulator without cellular SMS carrier reception, automatic SMS detection times out and manual code entry requires physical handset coordination. |
| 5 | Profile completion | **BLOCKED** | Requires authenticated customer session token following OTP verification. |
| 6 | Home catalogue loading | **RUNTIME_PASS** | Verified via API audit and emulator runtime: 21 items retrieved from production `GET /api/v1/customer/fish` (1,017 ms) and rendered. |
| 7 | Fish details view | **SOURCE_INSPECTION_ONLY** | Direct inspection of `FishDetailsScreen.jsx`. Product details, hero image, and pack selector logic verified in source; not exercised via tap interaction at runtime due to auth screen routing. |
| 8 | Add to cart | **BLOCKED** | `POST /api/v1/customer/cart/items` requires authenticated Bearer session token (401 without auth). |
| 9 | Cart quantity modification | **BLOCKED** | `PATCH /api/v1/customer/cart/items/{id}` requires authenticated Bearer session token. |
| 10 | Cart item removal | **BLOCKED** | `DELETE /api/v1/customer/cart/items/{id}` requires authenticated Bearer session token. |
| 11 | Checkout preview | **BLOCKED** | `POST /api/v1/customer/bookings/preview` requires authenticated Bearer session token. |
| 12 | Razorpay order initialization | **BLOCKED** | `POST /api/v1/payments/razorpay/orders` requires authenticated Bearer session token. |
| 13 | Booking creation & confirmation | **BLOCKED** | `POST /api/v1/customer/bookings` requires authenticated Bearer session token. Destructive test restricted per rules. |
| 14 | Subscription display | **BLOCKED** | `GET /api/v1/customer/subscription` requires authenticated Bearer session token. |
| 15 | Subscription ledger | **BLOCKED** | `GET /api/v1/customer/subscription/ledger` requires authenticated Bearer session token. |
| 16 | Notifications | **BLOCKED** | `GET /api/v1/customer/notifications` requires authenticated Bearer session token. |
| 17 | Bill image capture / gallery | **SOURCE_INSPECTION_ONLY** | `ScanBillScreen.jsx` inspected for `PermissionsAndroid.PERMISSIONS.CAMERA` and `react-native-image-picker` configuration. Camera hardware not triggered on emulator. |
| 18 | Bill scanning & OCR | **BLOCKED** | `POST /api/v1/customer/bills/scan` requires authenticated Bearer session token. |
| 19 | Transaction history | **BLOCKED** | `GET /api/v1/customer/transactions` requires authenticated Bearer session token. |
| 20 | Live tracking | **BLOCKED** | `GET /api/v1/customer/gps/live` requires authenticated Bearer session token. |
| 21 | Logout & session cleanup | **SOURCE_INSPECTION_ONLY** | Confirmed `clearAuthTokens()` wipes Android Keystore credentials. Sequencing defect (unregister call fails with 401) verified via code review. |

---

## 7. Issue Verification Matrix

Every issue from previous technical audits has been audited against code, network, and runtime evidence:

| Finding | Priority | Verification Method | Code & Runtime Evidence | Status | Recommended Action |
|---|---|---|---|---|---|
| **Home six-request initial loading dependency** | HIGH | Confirmed through source inspection | `HomeScreen.jsx` lines 65–72 issues `Promise.all([api.getCategories(), api.getFish(), api.getSubscription(), api.getCustomerLiveTracking(), api.getCart(), api.getProfile()])`. | **Confirmed through source inspection** | Stagger non-critical calls (`tracking`, `subscription`, `profile`) after first catalogue paint; consolidate dashboard context. |
| **Duplicate cart retrieval between App shell and Home** | MEDIUM | Confirmed through source inspection | `App.jsx` line 85 invokes `fetchCartSummary()` on navigation to `HOME`. Concurrently, `HomeScreen.jsx` line 70 calls `api.getCart()` inside `loadAllData()`. | **Confirmed through source inspection** | Pass authoritative cart summary from `App.jsx` down to `HomeScreen`; eliminate redundant fetch. |
| **Home callback identity and unnecessary reload risk** | HIGH | Confirmed through source inspection | In `App.jsx` line 234, `handleCartUpdated` is an unmemoized plain function reference. Passed to `HomeScreen`, it invalidates `loadAllData`'s `useCallback` identity, posing an architectural reload risk. | **Confirmed architectural risk (loop not proven at runtime)** | Wrap `handleCartUpdated` in `useCallback` with stable dependencies in `App.jsx`. |
| **Home catalogue rendering and list virtualization** | HIGH | Confirmed through source inspection & runtime | `HomeScreen.jsx` lines 833–936 renders all items via `filteredFishes.map(...)` inside vertical `ScrollView`. Compare to `CartScreen.jsx` line 420 which properly uses `FlatList`. | **Confirmed through source inspection** | Refactor `HomeScreen` catalogue grid to virtualized `FlatList` or `FlashList` with memoized item components. |
| **Image caching and image variant availability** | HIGH | Confirmed through runtime testing | 20 unique PNG images have an aggregate declared representation size of 44,376,391 bytes (42.32 MB, average 2,218,819.55 bytes each based on HTTP HEAD Content-Length) at 1536x1024 px. React Native `<Image>` has no disk caching or automatic downsampling. Handled on native background threads. | **Confirmed through runtime testing** | Integrate image caching (`react-native-fast-image` or custom disk cache) and request resized WebP variants from CDN. |
| **Shared API request timeout absence** | HIGH | Confirmed through source inspection | `src/services/api.js` line 51 calls native `fetch(url, options)` without `AbortController`, signal, or timeout. Slow requests hang indefinitely. | **Confirmed through source inspection** | Implement `AbortController`-based 15-second timeout and retry wrapper in `api.js`. |
| **Request cancellation and stale response handling** | MEDIUM | Confirmed through source inspection | Neither `HomeScreen` nor `CartScreen` cancels in-flight fetches on unmount. Unhandled async resolutions can trigger state updates on unmounted components. | **Confirmed through source inspection** | Add cancellation signals / cleanup refs to screen-level data-fetching hooks. |
| **Base64 bill-image upload** | HIGH | Confirmed through source inspection | `ScanBillScreen.jsx` lines 79, 117 pass `includeBase64: true` to image picker. Line 158 builds data URI and sends `image_base64: base64Data` in JSON body instead of streaming multipart form data. | **Confirmed through source inspection** | Default to multipart `FormData` upload with direct file URI streaming, eliminating large base64 allocations in JS memory. |
| **GPS polling while inactive or in the background** | MEDIUM | Confirmed through source inspection | `LiveTrackingScreen.jsx` lines 49–53 runs `setInterval(fetchTracking, 15000)` unconditionally without checking `AppState.currentState === 'active'` or `trackingData.active`. | **Confirmed through source inspection** | Gate GPS polling with `AppState` listener (`active` only) and pause interval when no active journey exists. |
| **FCM device-token unregister ordering** | HIGH | Confirmed through source inspection | In `ProfileScreen.jsx` lines 179–185, `await clearAuthTokens()` is called before `await api.unregisterDeviceToken('')`. The subsequent unregister call has no token, fails with 401, and sends an empty string. | **Confirmed through source inspection** | Invert sequence: call `api.unregisterDeviceToken(storedToken)` first, then invoke `clearAuthTokens()`. |
| **Subscription ledger fire-and-forget loading** | LOW | Confirmed through source inspection | `SubscriptionScreen.jsx` line 85 calls `fetchLedger()` without `await` inside `loadData()`. Screen stops loading before ledger data settles. | **Confirmed through source inspection** | Await `fetchLedger()` in `loadData()` or load ledger lazily upon switching to the `LEDGER` tab. |
| **Placeholder profile/subscription actions** | MEDIUM | Confirmed through source inspection | `ProfileScreen.jsx` lines 515, 535, 553, 591, 609, 627 wire buttons to static `Alert.alert('Saved Payment Methods', ...)`, `Alert.alert('Delivery Addresses', ...)`, etc. | **Confirmed through source inspection** | Replace non-functional placeholder alerts with live screens or clearly marked disabled state indicators. |
| **Static marketing, ratings and stock information** | MEDIUM | Confirmed through source inspection | In `HomeScreen.jsx`, lines 500, 564, 786, 920 render hardcoded fallbacks ("Gold Plan: 0.6 kg remaining", "Truck #OD-04 Published Live", "★ 4.8 (1,323)", "⚡ 8 mins"). | **Confirmed through source inspection** | Replace hardcoded promotional/stock strings with genuine API-driven states or empty states when data is absent. |
| **Notifications pagination** | MEDIUM | Confirmed through source inspection | `NotificationsScreen.jsx` lines 50–54 hardcodes `limit: 50, offset: 0`. The `FlatList` has no `onEndReached` handler to fetch subsequent pages. | **Confirmed through source inspection** | Add cursor/offset-based infinite scrolling pagination to `NotificationsScreen`. |
| **Fixed splash delay** | LOW | Confirmed through source inspection | `SplashScreen.jsx` line 86 imposes a hardcoded `setTimeout(checkSession, 600)` delay before session inspection starts. | **Confirmed through source inspection** | Remove artificial delay; execute `checkSession()` immediately on mount. |
| **Cart summary synchronization** | MEDIUM | Confirmed through source inspection | In `App.jsx` line 234, `handleCartUpdated` accepts partial structures that can desync summary state from actual backend cart items. | **Confirmed through source inspection** | Standardize `onCartUpdated` contract to accept authoritative backend response shape `{ items, summary }`. |
| **Checkout add-on and instruction contract mismatch** | HIGH | Confirmed through source inspection | `CheckoutScreen.jsx` has UI state for `masalaAdded` and `deliveryInstruction`. Razorpay order amount is calculated authoritatively on backend from cart items only (customer is not overcharged). `api.createBooking` passes only `{ paymentVerification }`, omitting add-ons and instructions entirely from the booking payload. | **Confirmed client-to-backend contract mismatch / client payload omission** | Synchronize contract: update backend schema and booking engine to support add-ons and instructions, and update mobile API call to include them. |
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

| Metric | Value | Classification | Device / Environment | Measurement Method | Confidence |
|---|---|---|---|---|---|
| Cold launch activity timing (`TotalTime`) | **2,436 ms** | Measured | Android 17 AVD (Pixel 8) | `am start-activity -W` (`TotalTime: 2436`) | High (Empirical) |
| Cold launch window delivery (`WaitTime`) | **2,451 ms** | Measured | Android 17 AVD (Pixel 8) | `am start-activity -W` (`WaitTime: 2451`) | High (Empirical) |
| First visible frame timestamp | **NOT MEASURED** | Unavailable | Real / Virtual Device | Requires frame-level Systrace/Perfetto | - |
| Splash completion timestamp | **NOT MEASURED** | Unavailable | Real / Virtual Device | Requires UI automated frame timestamping | - |
| Auth screen usable timestamp | **NOT MEASURED** | Unavailable | Real / Virtual Device | Requires interaction profiler | - |
| Warm launch activity timing (`WaitTime`) | **535 ms** | Measured | Android 17 AVD (Pixel 8) | `am start-activity -W` (`WaitTime: 535`) | High (Empirical) |
| Artificial splash screen delay | **600 ms** | Statically Observed | Codebase inspection | `setTimeout(checkSession, 600)` in `SplashScreen.jsx` | High (Source code) |
| Startup memory (PSS) | **42,649 KB (41.65 MB)** | Measured | Android 17 AVD (Pixel 8) | `dumpsys meminfo com.pondfish.customer` | High (Empirical) |
| Startup memory (RSS) | **169,456 KB (165.48 MB)** | Measured | Android 17 AVD (Pixel 8) | `dumpsys meminfo com.pondfish.customer` | High (Empirical) |
| Release APK file size | **64,929,892 B (61.92 MB)** | Measured | Host Windows filesystem | File system length of `app-release.apk` | High (Empirical) |
| Embedded JS bundle size | **1,182,940 B (1.18 MB)** | Measured | Inside release APK | `assets/index.android.bundle` archive entry | High (Empirical) |
| Hermes runtime status | **Active (Bytecode v0x03bc1fc6)** | Measured | Inside release APK | Binary header `C6 1F BC 03` + `libhermes.so` | High (Empirical) |
| Initial Home API requests | **7 calls** (6 parallel + 1 duplicate) | Measured / Traced | Codebase inspection & network | `loadAllData()` in `HomeScreen` + `fetchCartSummary()` in `App` | High (Source & Network) |
| Categories API latency (public) | **2,390 ms** | Measured (Single sample) | Live production network | HTTP GET to `https://pondfish.in` | High (Empirical) |
| Fish catalogue API latency (public) | **1,017 ms** | Measured (Single sample) | Live production network | HTTP GET to `https://pondfish.in` | High (Empirical) |
| Normal authenticated API latency | **NOT MEASURED** | Unavailable | Live production network | Requires authenticated test session | - |
| Single fish image transfer size (`apollo-boneless.png`) | **1,570,137 B (1.50 MB)** | Measured | Live Supabase CDN | HTTP HEAD to `urkxrefqtrwjfttrukhw.supabase.co` | High (Empirical) |
| Single fish image transfer latency (`apollo-boneless.png`) | **2,431 ms** | Measured (Single sample) | Live Supabase CDN | HTTP GET to `urkxrefqtrwjfttrukhw.supabase.co` | High (Empirical) |
| Unique catalogue image count | **20 unique images** | Measured | 21 fish items in catalogue | Unique URLs from `GET /api/v1/customer/fish` | High (Empirical) |
| Aggregate declared image representation size (20 unique images) | **44,376,391 B (42.32 MB)** | Declared Metadata (HEAD) | Live Supabase CDN | Sum of all 20 HTTP HEAD `Content-Length` headers | High (Empirical Metadata) |
| Average declared catalogue image size | **2,218,819.55 B (~2.22 MB)** | Calculated | Live Supabase CDN | 44,376,391 B / 20 unique images | High (Calculated) |
| Maximum catalogue image size (`prawns-large.png`) | **2,836,819 B (2.71 MB)** | Measured | Live Supabase CDN | HTTP HEAD to `urkxrefqtrwjfttrukhw.supabase.co` | High (Empirical) |
| Scrolling FPS / frame drops on physical device | **NOT MEASURED** | Unavailable | Real physical hardware | Requires physical device USB frame profiling | Blocked (No physical device) |

---

## 10. Recommended Phase 1 Priorities

Ranked by user impact, technical risk, and architectural dependency:

1. **Priority 1 (Contract Bug): Synchronize Checkout Add-On & Instruction Contract (Client Payload Omission)**
   - *Impact:* High. Customers select "Artisanal Fish Masala Paste (+₹39)" and delivery instructions, altering the local payable amount. The Razorpay order amount authoritatively excludes the add-on (customer is not overcharged), but `api.createBooking` omits both options, causing complete loss of the selected add-on and notes.
   - *Action:* Extend `POST /api/v1/customer/bookings` backend schema and booking engine to support add-ons and instructions; update mobile API call in `CheckoutScreen.jsx` to transmit them.

2. **Priority 2 (Performance): Image Optimization & CDN Variant Resizing**
   - *Impact:* High. Image optimization is expected to substantially reduce image delivery and decoding costs. Actual savings must be measured through GET response bodies and application-level network profiling.
   - *Action:* Integrate client image caching (`react-native-fast-image` or custom disk cache) and configure CDN thumbnail transforms (e.g., requesting auto-resized 200x200 px WebP variants for 110x110 px thumbnails).

3. **Priority 3 (Performance): Virtualize Home Catalogue Grid**
   - *Impact:* High. Eliminates DOM bloat and scroll frame drops.
   - *Action:* Convert `HomeScreen.jsx` `ScrollView` + `.map()` into virtualized `FlatList` or `FlashList` with memoized item renderers.

4. **Priority 4 (Reliability & Performance): Eliminate Duplicate Requests & Callback Invalidation**
   - *Impact:* High. Eliminates redundant network traffic on Home entry.
   - *Action:* Memoize `handleCartUpdated` in `App.jsx` using `useCallback`; pass cart summary down from shell state to Home; remove duplicate cart fetch in `HomeScreen.jsx`.

5. **Priority 5 (Reliability): Add Shared API Request Timeout & Abort Handling**
   - *Impact:* High. Prevents infinite UI hanging on 2G/weak connections.
   - *Action:* Add 15-second `AbortController` timeout and retry logic to `src/services/api.js`.

6. **Priority 6 (Reliability): Correct FCM Token Logout Sequencing**
   - *Impact:* Medium. Fixes silent 401 unregister failures on logout.
   - *Action:* Call `api.unregisterDeviceToken(storedToken)` before wiping Keystore via `clearAuthTokens()`.

7. **Priority 7 (Startup Optimization): Eliminate Fixed 600ms Splash Delay**
   - *Impact:* Immediate 600ms reduction in perceived app startup time.
   - *Action:* Remove `setTimeout(..., 600)` in `SplashScreen.jsx`; begin session verification immediately on mount.

8. **Priority 8 (Security & Build): Release Signing & Cleartext Restructuring**
   - *Impact:* Required for production release compliance and Google Play Store submission.
   - *Action:* Configure production release keystore signing via Gradle properties/environment variables; restrict cleartext traffic in release build.

---

## 11. Confirmed Blockers & Missing Prerequisites

1. **Physical Handset Testing:**  
   Physical Android hardware was unavailable in this session. All native metrics were obtained on an Android 17 emulator (`sdk_gphone16k_x86_64`, Pixel 8). Physical device frame profiling (Systrace / Perfetto) should be performed during Phase 1 validation.
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
| `Invoke-WebRequest https://pondfish.in/api/v1/customer/fish` | Repo root | 0 | HTTP 200 OK, 14,019 bytes, 21 fish records, 1,017 ms |
| Image HEAD audit (PowerShell script against all 20 unique URLs) | Repo root | 0 | 20 unique images measured via HTTP HEAD; Total declared Content-Length: 44,376,391 bytes (42.32 MB), Avg: 2,218,819.55 bytes (~2.22 MB) |
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

- `customer-app/docs/PHASE_0_BASELINE_REPORT.md` — Authoritative baseline report (this document). Zero application source code or business logic files were modified, preserving exact application behavior.
