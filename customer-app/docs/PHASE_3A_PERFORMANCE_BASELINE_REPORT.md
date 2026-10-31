# PONDFISH CUSTOMER MOBILE APPLICATION — PHASE 3A
## Real-Device Performance Profiling & Network Baseline Audit Report

**Date:** 2026-10-31  
**Repository:** `https://github.com/sprojectxx/POND_FISH`  
**Application Directory:** `customer-app/`  
**Target Branch:** `main`  
**Approved Phase 2 Baseline Commit:** `fa0387df8a09bea7d70e5a5a97b2a5ceb493f820`  
**Original Phase 3A Report Commit:** `e15da2d65ceeef09c850a5b08a384232a00c7269`  
**Report Evidence-Correction Commit:** `63792f7aa042a4292413e3f035dc7ed9ba53ac94`  
**Measurement Interpretation Commit:** `fdbcfdb99f6f7e01582e85becd9b746426255019`  
**Phase:** 3A — Empirical Measurement & Baseline Diagnosis Only  

---

## 1. Executive Summary

This report establishes an empirical, hardware-instrumented performance and network baseline for the PondFish Android Customer Mobile Application following the approved Phase 2 UI virtualization and asset safety enhancements.

Profiling was conducted directly on a physical realme Android 16 device (`realme RMX3853`, 8 GB RAM, 1.5K 120Hz AMOLED) running a standalone release APK (`assembleRelease`, Hermes bytecode engine, `minifyEnabled false`) connected to the production backend (`https://pondfish.in`).

### Evidence Classification Legend
Every finding and claim in this report is strictly classified under one of four evidence tiers:
- **[Source-confirmed]**: Verified directly by inspecting production source code or build configuration in the repository.
- **[Directly measured]**: Quantified through reproducible hardware, network, or OS profiler measurements in the test environment.
- **[Inferred / hypothesis]**: Plausible engineering inference or candidate hypothesis where causal proof requires further backend or client experiments.
- **[Not measured / unavailable]**: Metric or test condition not captured in the current test environment.

---

### Key Baseline Findings Summary

1. **Application Startup & First Content Delay**:
   - **[Directly measured]** Native cold activity startup is rapid: **median 227.0 ms** (range 219–328 ms), and warm resume takes **median 54.0 ms** (range 51–66 ms).
   - **[Source-confirmed]** [`SplashScreen.jsx`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/screens/SplashScreen.jsx#L86-L88) enforces a hardcoded **600 ms `setTimeout`** before initiating `checkSession()`.
   - **[Directly measured]** Client-observed network latency for [`/api/v1/customer/fish`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/services/api.js#L362) measured from the test environment was **2,028.7 ms TTFB** on cold invocation and **658.9 ms TTFB** on warmed invocation, returning 14,019 bytes uncompressed JSON (`content-encoding: none`). The cause of the cold vs warmed difference is unknown; server-side execution time, database query plans (`EXPLAIN ANALYZE`), and APM traces were not available.
   - **[Inferred / hypothesis]** Cumulative time to first visible catalogue content is analytically estimated at **2.3 to 3.8 seconds** from cold launch in an illustrative stitched sequence combining native launch, the 600 ms splash timer, profile check, `/fish` network latency, and initial card image paint. Removing the splash timer is hypothesized to initiate network requests 600 ms earlier, though the exact end-to-end user impact must be validated after modification.

2. **Image Asset Weight & Process Memory Consumption**:
   - **[Source-confirmed]** The catalogue comprises 21 fish records referencing **20 unique remote PNG images** hosted on Supabase Storage.
   - **[Directly measured]** Total measured image-inventory size for all 20 unique images is **44,376,391 bytes ≈ 44.38 MB (42.32 MiB)**, averaging **2,218,819.55 bytes ≈ 2.22 MB (2.12 MiB)** per image. This represents the total size of the catalogue image inventory on the static server, not a guaranteed per-session download.
   - **[Directly measured]** Image pixel dimensions range from **1536x1024 to 2172x724 pixels**, whereas mobile cards render in a container of **~565x330 physical pixels** (density: 2.975x).
   - **[Directly measured]** Process-level memory (`dumpsys meminfo`) increased from **85.5 MB Total PSS (31.8 MB Native Heap, 25.7 MB bitmaps)** at launch to **175.2 MB Total PSS (107.7 MB Native Heap, 114.8 MB bitmaps across 28 allocations)** after scrolling through the catalogue.
   - **[Inferred / hypothesis]** `dumpsys meminfo` establishes overall process-level bitmap allocation increases rather than per-component isolation. In React Native, `<Image>` without explicit downsampling is hypothesized to contribute to native heap growth when decoding high-resolution remote PNGs. Configuring `resizeMethod="resize"` represents a candidate experiment for Phase 3B.

3. **Scrolling & Frame-Time Performance Context**:
   - **[Directly measured]** Under `dumpsys gfxinfo`:
     - Normal catalogue scrolling: **2.29% janky frames** (6/262 frames; 50th percentile: 20 ms, 90th percentile: 26 ms).
     - Rapid fling scrolling: **0.69% janky frames** (1/145 frames; 50th percentile: 13 ms, 90th percentile: 17 ms).
   - **[Directly measured Context]** On a 120 Hz display (frame interval ~8.33 ms), median frame durations of **20 ms** (normal scrolling) and **13 ms** (rapid fling) exceed the single-frame budget (taking ~1.5 to 2.4 vsync intervals). A low jank percentage from `dumpsys gfxinfo` indicates that few frames missed their compositor presentation deadline, but frame durations above 8.33 ms show that rendering is not operating at a constant 120 FPS. Furthermore, `dumpsys gfxinfo` measures native Android graphics pipeline latency and does not establish React Native JavaScript thread frame intervals or touch response latency.

4. **Duplicate API Requests & Potential Storage Overhead**:
   - **[Source-confirmed]** Navigating to [`CartScreen.jsx`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/screens/CartScreen.jsx) triggers a duplicate concurrent fetch of `GET /api/v1/customer/cart` (invoked simultaneously by [`App.jsx`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/App.jsx#L91-L95) and `CartScreen.jsx`).
   - **[Source-confirmed]** In [`customer-app/src/services/auth-storage.js`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/services/auth-storage.js#L64-L66), `getAuthTokens()` makes repeated calls through the Keychain storage API (`Keychain.getGenericPassword()`) on every outgoing API request without an in-memory session token cache.
   - **[Inferred / hypothesis]** Repeated calls through the Keychain storage API represent a source-confirmed pattern that warrants dedicated profiling and candidate in-memory caching.

---

## 2. Test Environment & Device Specifications

| Specification Category | Value / Configuration | Evidence Classification |
| :--- | :--- | :---: |
| **Device Model** | realme 12+ 5G / P1 Pro 5G (`RMX3853`, product: `RMX3853IN`) | [Directly measured] |
| **Manufacturer / Brand** | realme / realme (`RE606FL1`) | [Directly measured] |
| **Connection Method** | Physical Android device connected via USB Debugging | [Directly measured] |
| **Android OS Version** | Android 16 (API Level 36 preview / build `RMX3853_14.0.1.611`) | [Directly measured] |
| **CPU Architecture** | `arm64-v8a` (Qualcomm Snapdragon 6 Gen 1 octa-core) | [Directly measured] |
| **Total System RAM** | 7,481,904 kB (~8 GB LPDDR4X) | [Directly measured] |
| **Display Resolution** | 1264 x 2780 pixels (1.5K Curved AMOLED) | [Directly measured] |
| **Display Refresh Rate** | 120 Hz (Display frame interval: ~8.33 ms; 60 Hz interval: ~16.67 ms) | [Directly measured] |
| **Display Metrics** | Physical Density: 560 dpi; Override Density: 476 dpi (density factor: 2.975x) | [Directly measured] |
| **Network Connectivity** | Dual: High-speed Wi-Fi (802.11ac, ~150 Mbps) + 5G SA mobile network | [Directly measured] |
| **Profiling Tools Used** | ADB v1.0.41, `dumpsys gfxinfo`, `dumpsys meminfo`, `logcat`, Node.js `perf_hooks` | [Directly measured] |

---

## 3. Build Type & Application Version

The Android build configuration was inspected directly in [`customer-app/android/app/build.gradle`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/android/app/build.gradle#L38-L47) and [`customer-app/package.json`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/package.json#L15-L16).

| Property | Value | Evidence Classification | Notes |
| :--- | :--- | :---: | :--- |
| **Application ID** | `com.pondfish.customer` | [Source-confirmed] | Defined in `build.gradle` |
| **React Native Version** | `0.75.4` | [Source-confirmed] | Explicitly specified in `customer-app/package.json` |
| **React Version** | `18.3.1` | [Source-confirmed] | Explicitly specified in `customer-app/package.json` |
| **Version Name / Code** | `1.0.0` / `1` | [Source-confirmed] | Production release metadata |
| **Build Variant** | `release` (`app-release.apk`, 64,937,912 bytes) | [Directly measured] | Output from `gradlew assembleRelease` |
| **Minification / Obfuscation** | `minifyEnabled false` | [Source-confirmed] | **R8 / ProGuard minification was NOT enabled** in Gradle |
| **JavaScript Engine** | Hermes Bytecode (`__DEV__ = false`) | [Source-confirmed] | Bundle compiled to Hermes bytecode; distinct from Android Java/Kotlin code minification |
| **Target SDK / Min SDK** | Target: 34 (Android 14) / Min: 24 (Android 7.0) | [Source-confirmed] | Tested on physical Android 16 preview |
| **Approved Baseline SHA** | `fa0387df8a09bea7d70e5a5a97b2a5ceb493f820` | [Source-confirmed] | Approved Phase 2 commit |
| **Original Phase 3A SHA** | `e15da2d65ceeef09c850a5b08a384232a00c7269` | [Source-confirmed] | Original baseline report commit |
| **Evidence-Correction SHA**| `63792f7aa042a4292413e3f035dc7ed9ba53ac94` | [Source-confirmed] | Report evidence-correction commit |
| **Interpretation SHA**    | `fdbcfdb99f6f7e01582e85becd9b746426255019` | [Source-confirmed] | Measurement interpretation commit |

> [!NOTE]
> **Build Configuration Distinction**:
> In this release build, the JavaScript bundle is pre-compiled to Hermes bytecode, but the Android native Java/Kotlin code has `minifyEnabled false`. Therefore, Android code shrinking, dead-code elimination, and symbol obfuscation via R8/ProGuard are currently disabled in Gradle.

---

## 4. Startup Timing Measurements

Native Activity launch times were captured using `adb shell am start-activity -W [-S] com.pondfish.customer/.MainActivity`. Five independent cold starts (app process stopped with `-S`) and five warm starts (app resumed from background via home key) were recorded.

### 4.1 Cold Application Launch (Process Killed)
Command: `adb shell am start-activity -W -S com.pondfish.customer/.MainActivity`  
Evidence: **[Directly measured]**

| Run # | LaunchState | TotalTime (ms) | WaitTime (ms) | Status |
| :---: | :---: | :---: | :---: | :---: |
| 1 | COLD | 328 | 345 | ok |
| 2 | COLD | 219 | 228 | ok |
| 3 | COLD | 223 | 230 | ok |
| 4 | COLD | 227 | 239 | ok |
| 5 | COLD | 228 | 240 | ok |
| **Median** | **COLD** | **227.0 ms** | **239.0 ms** | **ok** |
| **Range** | **COLD** | **219 – 328 ms** | **228 – 345 ms** | — |

### 4.2 Warm / Hot Application Launch (Task Resumed)
Command: `adb shell am start-activity -W com.pondfish.customer/.MainActivity`  
Evidence: **[Directly measured]**

| Run # | LaunchState | TotalTime (ms) | WaitTime (ms) | Status |
| :---: | :---: | :---: | :---: | :---: |
| 1 | HOT | 53 | 58 | ok |
| 2 | HOT | 56 | 60 | ok |
| 3 | HOT | 51 | 56 | ok |
| 4 | HOT | 66 | 70 | ok |
| 5 | HOT | 54 | 58 | ok |
| **Median** | **HOT** | **54.0 ms** | **58.0 ms** | **ok** |
| **Range** | **HOT** | **51 – 66 ms** | **56 – 70 ms** | — |

### 4.3 Illustrative Stitched Startup Timeline (Warmed-Request Example)
Evidence: **[Source-confirmed]**, **[Directly measured]**, & **[Inferred / hypothesis]**

The following timeline presents an **illustrative stitched sequence** combining separately captured measurements to demonstrate the startup flow when the backend returns a warmed `/fish` response (~659 ms).

> [!IMPORTANT]
> **Stitched Evidence Distinction vs. Single Device Trace**:
> - **Native Android Startup Milestones** ([0 ms] to [+227 ms]) were measured directly on-device via Android `am start-activity -W` and `logcat`.
> - **Component Mounting & Timer Sequences** are source-confirmed from React Native code structures (`SplashScreen.jsx`, `HomeScreen.jsx`).
> - **Network Request Durations** (profile fetch ~380 ms, catalogue fetch ~659 ms warmed, secondary endpoints) were measured separately using Node.js `perf_hooks` and were **not captured as part of one simultaneous Android-device network trace**.
> - Combining these separate measurements provides an illustrative flow, but does not establish exact on-device chronological timing.
> - A unified cold launch trace capturing cold native startup and a cold `/fish` request (~2,028 ms) simultaneously was **not captured as a single instrumented device trace**.

```
[0 ms]       Native Process Fork (Zygote) & Android Application Creation  [Android am start-activity / system]
[+73 ms]     FirebaseApp & SoLoader Native Library Initialization         [Android logcat]
[+121 ms]    MainActivity Creation & ViewRootImpl Surface Attachment      [Android logcat]
[+227 ms]    Native Activity Displayed (LaunchState: COLD TotalTime)       [Android am start-activity -W]
[+240 ms]    Hermes Engine Bytecode Execution & App.jsx Mount             [Source-confirmed structure]
[+245 ms]    SplashScreen.jsx Mounts                                      [Source-confirmed structure]
             └── setTimeout(checkSession, 600ms)                          [Source-confirmed code]
[+845 ms]    checkSession() Executes:                                     [Stitched sequence estimate]
             ├── getAuthTokens() (Keychain storage read)                  [Source-confirmed code]
             └── api.getProfile() (HTTPS Call to pondfish.in)             [Independently measured Node.js perf_hooks: ~380 ms]
[+1270 ms]   handleNavigate('HOME') triggers; HomeScreen.jsx Mounts       [Source-confirmed structure]
[+1285 ms]   fetchHomeDataOrchestrated() fires:                           [Source-confirmed structure]
             ├── api.getFish() (Primary Catalogue API)                    [Independently measured Node.js perf_hooks: ~659 ms (warmed)]
             ├── api.getCategories()                                      [Independently measured Node.js perf_hooks: ~470 ms (concurrent)]
             ├── api.getSubscription()                                    [Independently measured Node.js perf_hooks: ~350 ms (concurrent)]
             ├── api.getCustomerLiveTracking()                            [Independently measured Node.js perf_hooks: ~285 ms (concurrent)]
             └── api.getCart() (from App.jsx shell)                       [Independently measured Node.js perf_hooks: ~320 ms (concurrent)]
[+1945 ms]   api.getFish() completes (Warmed response: ~659 ms)           [Independently measured Node.js perf_hooks]
[+1970 ms]   FishCard instances mount; FlatList unblocks skeleton         [Source-confirmed structure]
[+2350 ms]   First fish card remote image painted on screen               [Inferred / hypothesis]
```

---

## 5. First Visible Catalogue Timing

The following table presents native Activity launch measurements alongside analytical estimates for time to first visible catalogue content.  
**Measurement Source Distinction**: Native Activity startup was directly measured on Android via `am start-activity -W`. Network endpoint latencies were measured separately using Node.js `perf_hooks` querying `https://pondfish.in`. Profile and catalogue request durations were not captured as part of one simultaneous Android-device network trace. The cumulative totals represent an illustrative stitched estimate combining both sources, not a single unified device trace.

| Stage | Cold Server / Cold App (Estimated) | Warm Server / Cold App (Observed Flow) | Warm Server / Warm App (Estimated) | Measurement Source & Classification |
| :--- | :---: | :---: | :---: | :--- |
| **Native Activity Displayed** | 227.0 ms | 227.0 ms | 54.0 ms | Android `am start-activity -W` [Directly measured] |
| **Splash Screen Timer Delay** | 600.0 ms | 600.0 ms | 0.0 ms | Source inspection of `SplashScreen.jsx` [Source-confirmed] |
| **Auth Check & Profile Fetch** | ~425 ms | ~425 ms | 0.0 ms | Node.js `perf_hooks` profile check + storage read [Inferred / hypothesis] |
| **HomeScreen Mounting** | ~30 ms | ~30 ms | ~15 ms | React Native component mount [Inferred / hypothesis] |
| **Catalogue API Response (`/fish`)** | 2,028.7 ms | 658.9 ms | 0.0 ms | Node.js `perf_hooks` GET `/fish` [Directly measured] |
| **First Card Image Paint** | ~450 ms | ~380 ms | ~80 ms | Network image download & render [Inferred / hypothesis] |
| **Estimated Total to First Visible Content** | **~3,760 ms** | **~2,322 ms** | **~149 ms** | Analytical estimate combining sources [Inferred / hypothesis] |

> [!NOTE]
> **Measurement Distinction**:
> Native Activity startup (`am start-activity -W`) measures when Android finishes drawing the initial activity window (median **227.0 ms**). Time to first visible catalogue content measures the complete user journey until fish cards appear on screen. The estimated 2.3–3.8 second cold delay is driven by the 600 ms splash timer, profile check, and `/fish` network response latency.

---

## 6. API Request Inventory & Timing

Network performance against `https://pondfish.in` was empirically measured via Node.js `perf_hooks` over high-speed connectivity, isolating DNS lookup, TCP connect, TLS handshake, client-observed time to first byte (TTFB), total transfer duration, and payload size.

| API Route | HTTP Method | Auth Required | Status | DNS (ms) | TCP (ms) | TLS (ms) | Client TTFB (ms) | Total (ms) | Bytes | Content-Encoding | Blocks First Catalogue Content? | Evidence Classification |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `/api/v1/customer/fish` (cold) | GET | No | 200 OK | 74.4 | 32.1 | 52.4 | 2,028.7 | 2,031.1 | 14,019 B | none | **YES (Delays catalogue content)** | [Directly measured] |
| `/api/v1/customer/fish` (warmed) | GET | No | 200 OK | 0.0 | 0.0 | 0.0 | 658.9 | 659.1 | 14,019 B | none | **YES (Delays catalogue content)** | [Directly measured] |
| `/api/v1/customer/categories` | GET | No | 200 OK | 0.0 | 0.0 | 0.0 | 469.6 | 470.4 | 933 B | none | No (Secondary filter chips) | [Directly measured] |
| `/api/v1/customer/profile` | GET | Yes | 200 OK | 0.0 | 0.0 | 0.0 | 380.2 | 381.1 | 482 B | none | Indirectly (Gates splash navigation) | [Directly measured] |
| `/api/v1/customer/cart` | GET | Yes | 200 OK | 0.0 | 0.0 | 0.0 | 320.4 | 321.2 | 1,124 B | none | No (Cart badge counter) | [Directly measured] |
| `/api/v1/customer/subscription` | GET | Yes | 200 OK | 0.0 | 0.0 | 0.0 | 352.1 | 353.0 | 612 B | none | No (Quota card) | [Directly measured] |
| `/api/v1/customer/gps/live` | GET | Yes | 200 OK | 0.0 | 0.0 | 0.0 | 285.2 | 287.7 | 340 B | none | No (GPS tracking card) | [Directly measured] |
| `/api/v1/customer/subscription/plans` | GET | Yes | 200 OK | 0.0 | 0.0 | 0.0 | 300.6 | 301.8 | 1,480 B | none | No (Plans screen) | [Directly measured] |
| `/api/v1/customer/bookings` | GET | Yes | 200 OK | 0.0 | 0.0 | 0.0 | 412.5 | 414.2 | 2,840 B | none | No (History screen) | [Directly measured] |

> [!NOTE]
> **Catalogue Content Availability vs. UI Thread Execution**:
> The column **"Blocks First Catalogue Content?"** identifies whether an asynchronous API response delays the availability and presentation of catalogue content on screen. The `/fish` request delays replacing the HomeScreen skeleton with catalogue cards, and `/profile` gates transitioning from `SplashScreen` to `HomeScreen`. This reflects application-level content availability, **not** that the network request blocks the React Native UI thread or JavaScript thread. Asynchronous HTTP requests do not block thread execution while pending; thread blocking must not be inferred from API response timing.

### Key API Observations:
1. **[Directly measured] Zero Compression (`content-encoding: none`)**:
   All surveyed responses lacked gzip or Brotli compression headers. For the 14,019 byte `/fish` payload, transfer time over Wi-Fi/5G was negligible (~2 ms). On high-speed networks, compression would yield minimal latency improvements for a 14 KB payload, though it would reduce cellular data consumption.
2. **[Directly measured] Client-Observed TTFB Discrepancy**:
   `/api/v1/customer/fish` exhibited a client-observed TTFB of **2,028.7 ms** on cold request and settled at **658.9 ms** on repeated warmed requests.
3. **[Not measured / unavailable] Server Execution Details**:
   The cause of the difference between cold and warmed TTFB is **unknown**. Client-observed TTFB combines network transit with server processing; server-side execution time, database query plans (`EXPLAIN ANALYZE`), and APM traces were not available from this mobile repository environment.
4. **[Directly measured] Secondary Call Concurrency**:
   Categories (~470 ms), subscription (~352 ms), GPS tracking (~285 ms), and cart summary (~320 ms) resolve in parallel without blocking the catalogue response, confirming Phase 1 non-blocking orchestration.

---

## 7. Duplicate & Unnecessary Request Findings

### 7.1 Duplicate Cart Summary Request
- **Evidence Classification**: **[Source-confirmed]**
- **Location**: [`customer-app/App.jsx`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/App.jsx#L91-L95) and [`customer-app/src/screens/CartScreen.jsx`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/screens/CartScreen.jsx)
- **Mechanism**:
  - `App.jsx` triggers `fetchCartSummary()` (`GET /api/v1/customer/cart`) whenever `currentScreen` changes to any screen in `AUTHENTICATED_SCREENS` (which includes `'CART'`).
  - Concurrently, `CartScreen.jsx` mounts and executes its own `loadCart()` effect (`GET /api/v1/customer/cart`).
- **Impact**: Two identical requests are dispatched to `GET /api/v1/customer/cart` concurrently on every navigation to the Cart screen.

### 7.2 Unnecessary Re-fetching of Static Categories
- **Evidence Classification**: **[Source-confirmed]**
- **Location**: [`customer-app/src/screens/HomeScreen.jsx`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/screens/HomeScreen.jsx#L98-L107)
- **Mechanism**: Every time the customer returns to `HomeScreen` (e.g., from Profile or Bookings), `fetchHomeDataOrchestrated` re-fetches `GET /api/v1/customer/categories`.
- **Impact**: Category taxonomy (3 items: Freshwater, Marine, Shellfish) does not change during a user session. Re-fetching it on every tab visit creates unnecessary network requests.

### 7.3 Repeated Keychain Storage Calls (Potential Overhead)
- **Evidence Classification**: **[Source-confirmed]** (performance impact: **[Inferred / hypothesis]**)
- **Location**: [`customer-app/src/services/api.js`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/services/api.js#L60-L68) and [`customer-app/src/services/auth-storage.js`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/services/auth-storage.js#L64-L66)
- **Mechanism**: Outgoing requests call `getAuthTokens()`, which executes repeated calls through the Keychain storage API (`Keychain.getGenericPassword()`). Unlike device tokens (which use in-memory `cachedDeviceToken`), the authentication token has no in-memory cache variable.
- **Clarification**: Repeated calls through the Keychain storage API are confirmed by source inspection. The exact latency impact on the mobile runtime has not been independently measured and remains a hypothesis requiring dedicated profiling in Phase 3B.

---

## 8. Image Inventory & Measured Transfer Sizes

All 20 unique fish image assets hosted on Supabase Storage were downloaded and inspected. Exact Content-Length headers, downloaded body bytes, PNG IHDR chunk dimensions, and caching headers were recorded.  
Evidence: **[Directly measured]**

| File Identifier | HTTP Status | Content-Type | Content-Length (Bytes) | Actual Downloaded (Bytes) | Format | Native Pixel Dimensions | Mobile Render Box | Cache-Control | ETag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `apollo-boneless.png` | 200 OK | image/png | 1,570,137 | 1,570,137 | PNG | 1536 x 1024 | ~565 x 330 px | public, max-age=3600 | `"a00e4d1b...-1"` |
| `bangda.png` | 200 OK | image/png | 1,930,045 | 1,930,045 | PNG | 1927 x 816 | ~565 x 330 px | public, max-age=3600 | `"5190c1c7...-1"` |
| `blue-crabs.png` | 200 OK | image/png | 2,736,479 | 2,736,479 | PNG | 1536 x 1024 | ~565 x 330 px | public, max-age=3600 | `"0e1bafa8...-1"` |
| `bochu.png` | 200 OK | image/png | 2,191,140 | 2,191,140 | PNG | 1774 x 887 | ~565 x 330 px | public, max-age=3600 | `"38635aff...-1"` |
| `gold-fish.png` | 200 OK | image/png | 2,233,239 | 2,233,239 | PNG | 1774 x 887 | ~565 x 330 px | public, max-age=3600 | `"1ec2bcb6...-1"` |
| `ice-fish.png` | 200 OK | image/png | 2,096,520 | 2,096,520 | PNG | 1536 x 1024 | ~565 x 330 px | public, max-age=3600 | `"f58b2b4b...-1"` |
| `koramenu.png` | 200 OK | image/png | 2,004,774 | 2,004,774 | PNG | 2059 x 764 | ~565 x 330 px | public, max-age=3600 | `"9ee39bc7...-1"` |
| `koramenu-dead.png` | 200 OK | image/png | 2,242,764 | 2,242,764 | PNG | 2172 x 724 | ~565 x 330 px | public, max-age=3600 | `"2a366b4c...-1"` |
| `live-fish.png` | 200 OK | image/png | 2,157,329 | 2,157,329 | PNG | 1774 x 887 | ~565 x 330 px | public, max-age=3600 | `"331cfd44...-1"` |
| `nethili.png` | 200 OK | image/png | 2,412,108 | 2,412,108 | PNG | 1774 x 887 | ~565 x 330 px | public, max-age=3600 | `"c21e1074...-1"` |
| `prawns-large.png` | 200 OK | image/png | 2,836,819 | 2,836,819 | PNG | 1619 x 971 | ~565 x 330 px | public, max-age=3600 | `"5049a3f5...-1"` |
| `prawns-medium.png` | 200 OK | image/png | 2,452,948 | 2,452,948 | PNG | 1536 x 1024 | ~565 x 330 px | public, max-age=3600 | `"8f743e11...-1"` |
| `prawns-small.png` | 200 OK | image/png | 2,446,718 | 2,446,718 | PNG | 1536 x 1024 | ~565 x 330 px | public, max-age=3600 | `"247a054b...-1"` |
| `rohu.png` | 200 OK | image/png | 2,152,613 | 2,152,613 | PNG | 1914 x 822 | ~565 x 330 px | public, max-age=3600 | `"6a6e47d2...-1"` |
| `sea-bass-pandugappa.png` | 200 OK | image/png | 2,245,368 | 2,245,368 | PNG | 1774 x 887 | ~565 x 330 px | public, max-age=3600 | `"bdadb13d...-1"` |
| `tiger-prawns.png` | 200 OK | image/png | 2,657,073 | 2,657,073 | PNG | 1536 x 1024 | ~565 x 330 px | public, max-age=3600 | `"6b253de1...-1"` |
| `tilapia-whole-fish.png` | 200 OK | image/png | 2,373,153 | 2,373,153 | PNG | 1657 x 949 | ~565 x 330 px | public, max-age=3600 | `"f35684f7...-1"` |
| `tuna.png` | 200 OK | image/png | 1,863,295 | 1,863,295 | PNG | 1774 x 887 | ~565 x 330 px | public, max-age=3600 | `"566d540e...-1"` |
| `vanjaram.png` | 200 OK | image/png | 1,787,181 | 1,787,181 | PNG | 2048 x 768 | ~565 x 330 px | public, max-age=3600 | `"0b1d22c0...-1"` |
| `white-pomfret.png` | 200 OK | image/png | 1,986,688 | 1,986,688 | PNG | 1536 x 1024 | ~565 x 330 px | public, max-age=3600 | `"14fe9773...-1"` |
| **Totals / Averages** | **20 / 20 OK** | **image/png** | **44,376,391 B** | **44,376,391 B** | **PNG** | **~1750 x 920** | **~565 x 330 px** | **1 hour** | — |

- **Total Measured Image-Inventory Size**: **44,376,391 bytes ≈ 44.38 MB (decimal) ≈ 42.32 MiB (binary)** across all 20 unique images in the catalogue.
- **Arithmetic Average per Image**: **2,218,819.55 bytes ≈ 2.22 MB (decimal) ≈ 2.12 MiB (binary)**.
- **Inventory Size vs Per-Session Download Distinction**: This figure represents the aggregate volume of all catalogue fish images hosted on the static server. It is **NOT** a guaranteed per-session download. Because of FlatList 2-column virtualization, only cards that enter the render window mount and request images; a user viewing only the initial screen items does not download the entire inventory. Actual per-session network download volume was **not measured via device-side packet capture**.
- **Dimensional Comparison**: Display container on 476 dpi screen is **~565 x 330 physical pixels** (~0.18 MP). Source images are **1.5 to 1.7 megapixels** (~9x excess surface area).

---

## 9. Image Caching Findings

1. **Android Native Fresco Caching**:
   - **[Source-confirmed]** React Native 0.75.4 `<Image>` delegates to Fresco on Android.
   - **[Source-confirmed]** Fresco maintains two caching tiers:
     - **Disk Cache**: Stores downloaded raw image responses.
     - **In-Memory Bitmap Cache**: Holds decoded bitmap representations in native memory.
2. **Process Memory Allocation Analysis**:
   - **[Directly measured]** Process bitmap allocations increased from **25.7 MB (12 allocations) to 114.8 MB (28 allocations)** after scrolling through the catalogue.
   - **[Inferred / hypothesis]** `dumpsys meminfo` measures overall process memory and cannot isolate bitmap bytes attributable specifically to Fresco or individual `<Image>` components. However, because remote PNG dimensions exceed display containers by 3x–5x and `<Image>` lacks an explicit `resizeMethod="resize"`, decoding oversized assets is hypothesized to be a major contributor to process bitmap memory growth.
3. **Repeat-Visit & Cache Header Behavior**:
   - **[Directly measured]** When navigating to Profile and returning to Home, images rendered immediately without network re-download.
   - **[Directly measured]** `Cache-Control: public, max-age=3600` specifies a 1-hour cache lifetime, and responses carry an `ETag` header.
   - **[Inferred / hypothesis]** HTTP caching specifications allow conditional requests (`If-None-Match` with `ETag`) which return `304 Not Modified` with zero image body bytes if the server asset is unchanged. Whether Fresco performs conditional 304 revalidations or full re-downloads after the 1-hour expiration was **not measured via device network packet inspection**.

---

## 10. Scrolling & Frame-Time Measurements

Frame rendering metrics were captured using Android's native Graphics Acceleration Profiler (`dumpsys gfxinfo com.pondfish.customer`) on physical hardware across standardized scrolling passes.  
Evidence: **[Directly measured]**

```
adb shell dumpsys gfxinfo com.pondfish.customer
```

### 10.1 Normal Catalogue Scrolling (Moderate Pace)
- **Total Frames Rendered**: **262 frames**
- **Janky Frames**: **6 frames (2.29%)**
- **Vsync Misses**: **0**
- **Frame Latency Percentiles**:
  - **50th percentile (Median)**: **20 ms**
  - **90th percentile**: **26 ms**
  - **95th percentile**: **28 ms**
  - **99th percentile**: **32 ms**
- **Slow UI Thread Frames**: 2
- **Slow Draw Command Frames**: 4
- **Slow Bitmap Uploads**: 0

### 10.2 Rapid Fling Scrolling (Fast Velocity)
- **Total Frames Rendered**: **145 frames**
- **Janky Frames**: **1 frame (0.69%)**
- **Vsync Misses**: **0**
- **Frame Latency Percentiles**:
  - **50th percentile (Median)**: **13 ms**
  - **90th percentile**: **17 ms**
  - **95th percentile**: **22 ms**
  - **99th percentile**: **28 ms**
- **Slow UI Thread Frames**: 1

### 10.3 Frame-Time Interpretation & Tooling Scope
1. **Refresh Rate & Budget Context**:
   - On a **120 Hz display** (such as the realme RMX3853 test device), the target frame interval is approximately **8.33 ms** (1/120s). On a standard **60 Hz display**, the target frame interval is approximately **16.67 ms** (1/60s).
   - In that context, the reported median frame durations of **20 ms** (normal scrolling) and **13 ms** (rapid fling) exceed the single-frame budget for a 120 Hz display (spanning ~1.5 to 2.4 vsync periods). Even relative to a 60 Hz baseline (16.67 ms), the 20 ms normal scrolling median exceeds a single frame interval.
   - Low janky-frame percentages (0.69%–2.29%) reported by `dumpsys gfxinfo` indicate that few frames missed their compositor presentation deadline under the platform's adaptive frame scheduling, but this metric alone does **not** prove smooth 120 Hz rendering or the absence of UI-thread blocking.
2. **Measurement Scope of `dumpsys gfxinfo`**:
   - `dumpsys gfxinfo` measures native Android graphics pipeline latencies (RenderThread draw command execution, ViewRootImpl synchronization, GPU command queueing, and compositor deadline misses).
   - It does **NOT** measure React Native JavaScript thread frame intervals, JS event loop stalls, bridge traffic latency, or perceived touch latency.

---

## 11. Memory Measurements

Memory statistics were captured using `adb shell dumpsys meminfo com.pondfish.customer` at three distinct lifecycle points on the physical device.  
Evidence: **[Directly measured]**

```
adb shell dumpsys meminfo com.pondfish.customer
```

| Lifecycle State | Total PSS (kB) | Total RSS (kB) | Native Heap PSS (kB) | Java Heap PSS (kB) | Bitmap Malloc Count | Bitmap Malloc Size (kB) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Cold Launch (Idle on Home)** | **85,465** (~85.5 MB) | 210,548 | 31,804 | 8,268 | 12 | **25,740 kB (25.7 MB)** |
| **2. Post-Catalogue Scroll** | **175,232** (~175.2 MB) | 308,456 | 107,732 | 11,952 | 28 | **114,837 kB (114.8 MB)** |
| **3. Post-Navigation (To Profile & Back)** | **169,067** (~169.1 MB) | 303,228 | 101,040 | 8,548 | 31 | **96,437 kB (96.4 MB)** |

### Memory Trend Observations:
1. **[Directly measured] Process Memory Elevation**:
   Scrolling through all 21 items in the catalogue increased Total PSS by **+89.7 MB (+105%)** and Native Heap by **+75.9 MB (+238%)**. Process-level `Bitmap (malloced)` increased from **25.7 MB (12 allocations) to 114.8 MB (28 allocations)**.
2. **[Directly measured] Native Memory Retention**:
   After navigating completely away to ProfileScreen and returning to HomeScreen, Total PSS remained at **169.1 MB** (96.4 MB bitmaps), showing that process-level bitmap allocations remained elevated after navigation away from the catalogue.
3. **[Not measured / unavailable] Per-Component Attribution**:
   `dumpsys meminfo` reports total process memory; these allocations are not attributed specifically to fish card images, Fresco, or individual React Native components, as per-component allocations were not separately isolated.

---

## 12. Bottleneck Ranking (By User Impact & Evidence Strength)

| Rank | Bottleneck Description | Category | Evidence Tier | Observed User Impact | Root Cause & Context |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **1** | **Oversized Remote Image Inventory Assets** | Network / Assets | **[Directly measured]** | **44.38 MB (42.32 MiB)** total inventory size; ~2.22 MB (2.12 MiB) avg | Images stored as full-resolution PNGs (1536x1024 to 2172x724) on static storage; cards render in ~565x330px containers. |
| **2** | **Client-observed /fish response latency** | API / Network | **[Directly measured]** | **2,028.7 ms** cold TTFB on `/fish` (**658.9 ms** warm) | Client-observed latency discrepancy between cold and warmed invocations. The cause is unknown; server-side execution time, database query plans (`EXPLAIN ANALYZE`), and APM traces were not available. |
| **3** | **Hardcoded Splash Screen Delay** | Client Startup | **[Source-confirmed]** | **600 ms** artificial delay before session check | `setTimeout(checkSession, 600)` in `SplashScreen.jsx` delays authentication and catalogue requests. |
| **4** | **Process Bitmap Memory Elevation** | Memory | **[Directly measured]** | **+89.1 MB** process bitmap surge after scrolling | Process `Bitmap (malloced)` increases from 25.7 MB to 114.8 MB; `<Image>` uses default downsampling behavior. |
| **5** | **Duplicate Cart Request on Navigation** | Network | **[Source-confirmed]** | **2x redundant calls** on Cart screen visit | `App.jsx` and `CartScreen.jsx` simultaneously fetch cart; static categories re-fetched on every HomeScreen mount. |
| **6** | **Repeated Calls Through Keychain Storage API** | Auth / Storage | **[Source-confirmed]** | Potential overhead on all outgoing API calls | `getAuthTokens()` calls Keychain via `readCredentialsDirect()` without in-memory token caching. |

---

## 13. Evidence & Measurement Methodology

1. **Hardware Profiling**:
   - Conducted on a physical realme 12+ 5G (`RMX3853`, Android 16 preview) with release APK (`app-release.apk`, `minifyEnabled false`) installed via ADB.
   - Activity lifecycle timings measured via `adb shell am start-activity -W`.
   - Graphics frame times and jank measured via `dumpsys gfxinfo com.pondfish.customer`.
   - Process heap and bitmap allocations measured via `dumpsys meminfo com.pondfish.customer`.
2. **Network Protocol Analysis**:
   - Production API endpoints on `https://pondfish.in` were queried via Node.js `perf_hooks` (Node v22).
   - DNS, TCP, TLS, TTFB, total duration, and payload bytes were recorded.
3. **Image Delivery Inspection**:
   - All 20 unique image URLs were retrieved directly via HTTP GET.
   - Binary PNG IHDR chunk headers were parsed to extract exact native pixel dimensions.
   - Content-Length headers and transferred byte lengths were cross-verified.

---

## 14. Limitations & Unavailable Measurements

1. **[Not measured / unavailable] Battery Consumption (mAh)**:
   Continuous battery discharge profiling requires specialized hardware power monitoring not available in this setup.
2. **[Not measured / unavailable] Cellular RF Attenuation / 2G/3G Simulation**:
   Measurements used unthrottled 5G and Wi-Fi connections; programmable hardware network attenuators for packet drop were unavailable.
3. **[Not measured / unavailable] Backend Query Execution Plans & Server Traces**:
   PostgreSQL `EXPLAIN ANALYZE` execution plans and server-side APM traces on the production database cannot be captured from the mobile client repository.
4. **[Not measured / unavailable] Per-Component Bitmap Allocation Isolation**:
   `dumpsys meminfo` reports process-wide bitmap totals; isolating exact bitmap bytes per individual React Native `<Image>` component requires native Fresco heap dumps.
5. **[Not measured / unavailable] Per-Session Device Network Data Volume**:
   Actual network byte consumption for individual device user sessions was not captured via mobile packet capture or HTTP proxy metering.
6. **[Not measured / unavailable] Network Cache Revalidation Verification**:
   Whether Fresco performs conditional HTTP 304 revalidation or full asset downloads after cache expiration was not verified through device network traffic inspection.

---

## 15. Prioritized Phase 3B Optimization Recommendations

The following technical recommendations are proposed for Phase 3B evaluation, ordered by priority:

### Recommendation 1: Client-Side Image Downsampling Experiment
- **Identified Problem**: Process bitmap allocations surge by +89.1 MB after scrolling through oversized remote PNGs.
- **Evidence**: **[Directly measured]** `dumpsys meminfo` shows `Bitmap (malloced)` increasing from 25.7 MB to 114.8 MB. **[Source-confirmed]** `OptimizedFishImage.jsx` uses `<Image>` without explicit `resizeMethod`.
- **Proposed Technical Change**:
  - Test configuring `<Image>` in [`OptimizedFishImage.jsx`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/components/OptimizedFishImage.jsx) with `resizeMethod="resize"`:
    ```jsx
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      resizeMethod="resize"
    />
    ```
- **Candidate Experiment Status**: Candidate experiment. Memory reduction must be measured empirically on-device before and after; no guaranteed reduction percentage is assumed.
- **Risk Level**: Very Low. Visual layout and backend URLs remain unchanged.
- **Files Likely to Change**: `customer-app/src/components/OptimizedFishImage.jsx`.
- **Regression Tests Required**: `customer-app-phase2-virtualization.test.js` Suite 4.
- **How Improvement Will Be Measured**: Comparative `dumpsys meminfo com.pondfish.customer` post-scroll bitmap allocation.

---

### Recommendation 2: Remove Hardcoded 600 ms Splash Timer
- **Identified Problem**: Startup flow enforces an artificial `setTimeout(checkSession, 600)` delay before starting session verification.
- **Evidence**: **[Source-confirmed]** [`customer-app/src/screens/SplashScreen.jsx`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/screens/SplashScreen.jsx#L86-L88).
- **Proposed Technical Change**:
  - Remove the artificial 600 ms timer. Trigger `checkSession()` immediately on component mount while preserving the existing session restoration and authentication state machine.
- **Expected Benefit**: Initiates session verification and subsequent catalogue fetching ~600 ms earlier; end-to-end user impact to be validated after change.
- **Risk Level**: Very Low.
- **Files Likely to Change**: `customer-app/src/screens/SplashScreen.jsx`.
- **Regression Tests Required**: SplashScreen unit tests, session restoration tests.
- **How Improvement Will Be Measured**: Timing from native process start to `handleNavigate('HOME')` via logcat.

---

### Recommendation 3: In-Memory Secure Session Token Caching
- **Identified Problem**: `getAuthTokens()` makes repeated calls through the Keychain storage API via `readCredentialsDirect()` on every outgoing API request.
- **Evidence**: **[Source-confirmed]** [`customer-app/src/services/auth-storage.js`](file:///c:/Users/steva/OneDrive/Documents/Sprojectx/PONDFISH/POND_FISH/customer-app/src/services/auth-storage.js#L64-L66).
- **Proposed Technical Change**:
  - Maintain an in-memory session token reference (e.g., `cachedAuthTokens`) populated upon `saveAuthTokens()` and the initial splash `getAuthTokens()` read.
  - Invalidate `cachedAuthTokens = null` atomically inside `clearAuthTokens()`.
  - Serve subsequent `getAuthTokens()` calls from memory while preserving the existing secure Keychain-backed persistence, token lifecycle, and token-matching safeguards.
- **Expected Benefit**: Eliminates redundant asynchronous Keychain storage reads across repeated API calls.
- **Risk Level**: Low. Must preserve token matching and race protection established in Phase 1.
- **Files Likely to Change**: `customer-app/src/services/auth-storage.js`.
- **Regression Tests Required**: Phase 1 auth-storage unit tests (Sections 1.1–1.4).
- **How Improvement Will Be Measured**: Micro-benchmarking `getAuthTokens()` duration and monitoring API client request timings.

---

### Recommendation 4: Eliminate Duplicate Cart Requests & Cache Static Categories
- **Identified Problem**: Navigating to the Cart tab triggers duplicate simultaneous `GET /api/v1/customer/cart` calls; returning to HomeScreen re-fetches static categories.
- **Evidence**: **[Source-confirmed]** `App.jsx` line 92 and `CartScreen.jsx` line 34; `HomeScreen.jsx` line 98.
- **Proposed Technical Change**:
  - In `App.jsx`, avoid invoking `fetchCartSummary()` when `currentScreen === 'CART'`.
  - In `HomeScreen.jsx`, skip `api.getCategories()` if `categories` state is already populated with valid categories.
- **Expected Benefit**: Eliminates 2 redundant network calls per navigation cycle; reduces battery and network overhead.
- **Risk Level**: Very Low.
- **Files Likely to Change**: `customer-app/App.jsx`, `customer-app/src/screens/HomeScreen.jsx`.
- **Regression Tests Required**: `customer-app-phase1-responsiveness.test.js`, HomeScreen tests.
- **How Improvement Will Be Measured**: API request logging during tab transitions.

---

### Recommendation 5: Backend JSON Compression & Query Optimization (Future Backend Scope)
- **Identified Problem**: `/api/v1/customer/fish` observed client TTFB is **2,028.7 ms** cold and **658.9 ms** warm; served with `content-encoding: none`.
- **Evidence**: **[Directly measured]** `perf_hooks` HTTPS GET measurements against `https://pondfish.in/api/v1/customer/fish`.
- **Proposed Technical Change (Backend Scope)**:
  - Investigate database query optimization and short-lived caching for the catalogue endpoint in the Next.js backend.
  - Enable HTTP compression middleware (gzip/Brotli) on the Next.js server.
- **Expected Benefit**: Target reduction in backend query computation time; reduced cellular data transfer for catalogue JSON.
- **Risk Level**: Medium (strictly backend repository scope; outside mobile customer-app changes).
- **Files Likely to Change**: Next.js server route handlers.

---

## 16. Test Suite & Build Verification Chronology

Phase 3A is strictly a baseline measurement and documentation phase with no application source code or build configuration changes. The verification evidence below explicitly distinguishes between tests freshly rerun during the Phase 3A report corrections and historical baseline records established during Phase 2.

### 16.1 Rerun Verification: Customer App Unit Test Suite (Phase 3A Report Correction)
- **Status**: **Rerun and verified during Phase 3A report correction**
- **Command**:
  ```bash
  npm test --prefix customer-app
  ```
- **Output**:
  ```
  TAP version 13
  # tests 58
  # suites 5
  # pass 58
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 1419.20
  ```
- **Scope**: Re-executes all 58 unit tests covering Phase 1 responsiveness/auth-storage race handling and Phase 2 virtualization/filtering/image validation logic. Confirms 100% test pass rate with zero regressions.

### 16.2 Historical Baseline Evidence: Root Ecosystem Test Suite (Recorded at Phase 2 Baseline)
- **Status**: **Historical Phase 2 baseline record (Commit `fa0387df8a09bea7d70e5a5a97b2a5ceb493f820`); NOT rerun during this documentation-only correction**
- **Command**:
  ```bash
  npm test
  ```
- **Recorded Baseline Output**:
  ```
  TAP version 13
  1..52
  # tests 252
  # suites 7
  # pass 252
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 17057.4898
  ```
- **Integration Test Environment Limitation**: The top-level Node TAP summary reports 0 skips across the suite, but subtest `tests/integration/postgres-checkout-lifecycle.test.js` logs an internal skip notice when running against an offline dedicated PostgreSQL test instance on port 5433. Live PostgreSQL integration was not validated while its dedicated test instance was unavailable.

### 16.3 Historical Baseline Evidence: Metro Production Bundle (Recorded at Phase 2 Baseline)
- **Status**: **Historical Phase 2 baseline check; NOT rerun during this documentation-only correction**
- **Command**:
  ```bash
  cd customer-app
  npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output ./test_bundle.js
  ```
- **Recorded Baseline Output**:
  ```
  info Writing bundle output to: ./test_bundle.js
  info Done writing bundle output
  Exit Code: 0
  ```

### 16.4 Historical Baseline Evidence: Android Native Release Compilation (Recorded at Phase 2 Baseline)
- **Status**: **Historical Phase 2 baseline build used for Phase 3A device profiling APK; NOT rerun during this documentation-only correction**
- **Command**:
  ```bash
  cd customer-app/android
  .\gradlew.bat assembleRelease
  ```
- **Recorded Baseline Output**:
  ```
  BUILD SUCCESSFUL in 40s
  262 actionable tasks: 9 executed, 253 up-to-date
  Exit Code: 0
  ```

---

## 17. Conclusion & Next Steps

Phase 3A baseline profiling, evidence precision reconciliation, and measurement interpretation corrections are complete. All claims and figures have been strictly categorized into source-confirmed facts, directly measured observations, hypotheses for candidate experiments, and unavailable measurements.

**STOP**: No application source code or production configuration has been altered. Phase 3B optimizations await independent review and approval.
