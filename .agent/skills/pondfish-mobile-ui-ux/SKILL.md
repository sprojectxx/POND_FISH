---
name: pondfish-mobile-ui-ux
description: Engineering and design standard for the PondFish customer mobile app, establishing visual clarity, atomic design tokens, verified fish-commerce patterns, and high-performance React Native guidelines.
---

# PondFish Mobile UI/UX Engineering Standard

<role>
You are an expert Mobile UI/UX Systems Architect and React Native Performance Engineer. You design and implement interfaces that deliver the clarity, calmness, and usability of tier-1 commerce applications while remaining strictly faithful to the PondFish business model: live-fish retail with preparation at the counter, customized counter dressing/cutting, and scheduled store pickup or local delivery.
</role>

---

## 1. Core Philosophy & Design Principles

### A. Cleanliness & Visual Calmness
- **Generous Whitespace**: Whitespace is an active design element, not empty space. Every element must breathe. Avoid cramped layouts, stacked borders, and visual noise.
- **Intentional Grouping**: Group related content using elevation or subtle background contrast (`#F7F8FA` vs `#FFFFFF`) rather than harsh borders or dark container fills.
- **Zero Decorative Clutter**: Reject decorative gradient pills, neon glowing borders, arbitrary badges, and decorative divider lines that do not convey operational information.

### B. Information Hierarchy
1. **Product Photography**: High-resolution, well-lit image of the fish on a clean, consistent neutral background.
2. **Title & Species**: Clear common name (with regional name where relevant, e.g., "Rohu / Rui") and operational availability status (e.g. "Available at Counter", "Live in Tank").
3. **Price & Quantity Unit**: High-contrast price per unit or per kg (e.g., `₹380 / kg`) with clear indication of minimum weight or unit basis.
4. **Weight & Yield Transparency**: When verified by species and cut configuration, provide clear yield context (distinguishing gross whole fish weight from expected net dressed weight). Never invent unverified hardcoded yields.
5. **Action**: Single clear call-to-action (compact `ADD` or inline `− 1 +` stepper) anchored predictably.

### C. Density with Legibility
- Maximize information density without sacrificing touch comfort or typography scale.
- **Do not mandate a rigid product card count** (such as 4–6 cards) in the initial viewport when varied Android screen sizes, font-scaling accessibility settings, and display densities make it impractical.
- Instead, optimize for **immediate product visibility**: users must see genuine product offerings near the top of the viewport without having to scroll past bloated promotional banners.
- Use horizontal scrolling carousels strictly for curated categories or seasonal highlights, never for primary browsing of core inventory.

### D. Product-Centric Commerce
- Put the fish front and center. Users open the app to order fish, not to read promotional essays or view static delivery truck animations.
- Offer cut and customization options that are supported by backend inventory configuration (e.g., Curry Cut, Bengali Cut, Steaks, Fillet, Whole Cleaned). Never display options that the store counter cannot fulfill for that specific species.

### E. Agreed PondFish Navigation Standard
The customer app uses a dedicated 5-action bottom navigation structure:
1. **Home**: Primary fish discovery, dynamic category filters, and active storefront.
2. **Track**: Morning harbor-to-store catch replenishment status and active customer order status.
3. **Scan Bill** *(Center Elevated Action)*: Direct access to physical counter receipt camera scanner, allowing store customers to link in-store purchases to their subscription account.
4. **Bookings**: Scheduled store pickup tokens, digital pickup slips, and order history.
5. **Profile**: Account management, saved delivery addresses, club pass overview, transactions, and secure logout.

> [!IMPORTANT]
> **Preserve the Agreed Navigation Structure**: Do not replace the existing 5-action navigation (`Home`, `Track`, `Scan Bill`, `Bookings`, `Profile`) with generic e-commerce tabs (`Store`, `Search`, `Orders`, `Subscription`, `Profile`). Subscription management remains cleanly accessible through Profile and designated Home sections.

### F. Absolute Honesty & Zero Deceptive Patterns
- **No False Urgency**: Never display fake countdown timers ("Ends in 03h:24m"), fake stock scarcity ("Only 2 left!"), or fake viewer counters.
- **No Fabricated Social Proof**: Never hardcode fake ratings (`★ 4.8`) or artificial review counts (`(1,420)`). If an item has no customer reviews, show verified cut options or species notes instead.
- **No Unverified Delivery SLAs**: PondFish is a fresh/live fish counter business where preparation requires manual descaling and cutting. Never display impossible "8-minute express delivery" promises. Display preparation or delivery windows only when backed by operational data or store confirmation.
- **No Unverified Guarantees or Quality Claims**: PondFish's stated business model is live-fish retail with preparation at the counter. Do not claim "Continuous 0-4°C Cold-Chain Reefer Logistics" when orders are prepared fresh at local retail counters. Furthermore, do not replace one unverified claim with another: do not display claims such as "Quality assured", "Hygienic cutting guaranteed", "Zero artificial preservatives", or "100% Chemical Free" without documented business certification. Prefer factual descriptions of actual customer workflows.

---

## 2. Visual Design System Tokens & Implementation Plan

### A. Token File Architecture & Non-Breaking Migration
To ensure a safe, incremental migration without breaking existing screens that import `customer-app/src/theme/colors.js`:
1. **New Token File**: Create `customer-app/src/theme/tokens.js` as the comprehensive single source of truth for all design tokens (`Colors`, `Typography`, `Spacing`, `Radii`, `Shadows`, `Layout`).
2. **Non-Breaking `colors.js` Adapter**: Update `customer-app/src/theme/colors.js` to import and re-export the color tokens from `tokens.js`. Existing screens importing `{ colors } from '../theme/colors'` will continue to function seamlessly while new components import from `tokens.js`.

```javascript
// customer-app/src/theme/tokens.js

export const Colors = {
  // Surface & Canvas
  background: '#F7F8FA',       // Clean, calm light grey canvas
  surface: '#FFFFFF',          // Card, modal sheet, and dialog background
  surfaceElevated: '#FFFFFF',  // Floating bottom navigation, sticky cart bar
  surfaceSubtle: '#F1F4F9',    // Input backgrounds, table headers, chip fills

  // Brand Palette
  brandNavy: '#0D203B',        // Primary text, hero titles, active bottom nav items
  brandNavyLight: '#1B3A60',   // Secondary interactive accents
  brandBlue: '#2583D8',        // Freshwater blue, info pills, verified links
  brandBlueSubtle: '#EBF4FC',  // Subtle brand highlight fills

  // Action / Accent Palette (High-Contrast Fresh Green)
  actionGreen: '#009B70',      // Primary CTA buttons, ADD button, success pills
  actionGreenPressed: '#007A58',// CTA active/pressed state
  actionGreenSubtle: '#E6F6F1', // Stepper background, freshness pill fill

  // Monochromes & Typography
  textPrimary: '#0D203B',      // High contrast primary body and titles (WCAG AAA)
  textSecondary: '#64748B',    // Subtitles, metadata, secondary timestamps (WCAG AA)
  textMuted: '#94A3B8',        // Placeholders, disabled icons, helper captions
  textWhite: '#FFFFFF',        // Text on dark/action backgrounds

  // Borders & Dividers
  borderSubtle: '#EEF2F6',     // Card outer borders, list dividers
  borderMedium: '#CBD5E1',     // Input borders, unselected controls
  borderFocus: '#009B70',      // Focused input outline

  // Semantic Status
  success: '#009B70',
  successSubtle: '#E6F6F1',
  warning: '#F59E0B',
  warningSubtle: '#FEF3C7',
  error: '#DC2626',
  errorSubtle: '#FEE2E2',
  info: '#2583D8',
  infoSubtle: '#EBF4FC',

  // Overlays & Feedback
  scrim: 'rgba(13, 32, 59, 0.45)', // Bottom sheet backdrop
  shimmerBase: '#E2E8F0',
  shimmerHighlight: '#F8FAFC',
};

// Supported typography using Android system fonts (Roboto / sans-serif)
export const Typography = {
  display: {
    fontFamily: 'sans-serif',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  screenTitle: {
    fontFamily: 'sans-serif',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontFamily: 'sans-serif',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontFamily: 'sans-serif',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  bodyMedium: {
    fontFamily: 'sans-serif',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  bodySmall: {
    fontFamily: 'sans-serif',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  caption: {
    fontFamily: 'sans-serif',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  price: {
    fontFamily: 'sans-serif',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  priceHero: {
    fontFamily: 'sans-serif',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: Colors.actionGreen,
    fontVariant: ['tabular-nums'],
  },
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  screenPadding: 16,
  cardPadding: 12,
  gridGap: 10,
};

export const Radii = {
  none: 0,
  xs: 4,     // Tag, micro-badge
  sm: 6,     // Small chip, counter pill
  md: 8,     // Stepper container, standard button
  lg: 12,    // Product card, input field
  xl: 16,    // Modal, bottom sheet top corners, banner
  pill: 9999,// Floating pill CTA, circular action button
};

export const Shadows = {
  none: {
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  card: {
    elevation: 2,
    shadowColor: Colors.brandNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  elevatedCenter: {
    elevation: 4,
    shadowColor: Colors.brandNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  floatingBar: {
    elevation: 6,
    shadowColor: Colors.brandNavy,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
};
```

---

## 3. Mobile Commerce UX Patterns

### A. Responsive Product Card Architecture
- **Grid Layout**: Render in a responsive 2-column grid using `FlatList` with `numColumns={2}` and `columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: Spacing.screenPadding }}`.
- **Dimensions**: Avoid hardcoded fixed-pixel heights or rigid `width: '48%'` flex-wrap definitions. Use flexible card containers with `flex: 1` and a standard gap (`marginHorizontal: 4`, `marginBottom: 10`).
- **Image Presentation**: 1:1 or 4:3 aspect ratio container with explicit width/aspectRatio to eliminate Cumulative Layout Shift (CLS).
- **Verified Hierarchy**:
  1. **Status Tag**: Show verified status (e.g. `Available at Counter`, `Live in Tank`) only when backed by backend inventory.
  2. **Image**: Square or 4:3 image using `OptimizedFishImage` with placeholder fallback.
  3. **Product Title**: 2-line clamp with `ellipsizeMode="tail"`.
  4. **Weight / Yield Note**: If cut-specific yield data is configured for the species in the backend, display estimated yield (e.g., `Est. yield ~70% meat`). If unconfigured, omit yield claims.
  5. **Price & Action Row**:
     - Left: Bold price (`₹380 / kg` or `₹190 / 500g`).
     - Right: Compact `+ ADD` button (`minHeight: 32`, `minWidth: 64`) or interactive `[ − 1 + ]` stepper when item quantity > 0.

### B. Fish Customization & Preparation Flow
- When adding fish to the cart, present a lightweight bottom-sheet modal allowing cut selection.
- **Configuration-Backed Cuts**: Only display cut options that the store counter actually supports for the selected species (e.g. Curry Cut, Bengali Steaks, Fillet, Whole Cleaned).
- **Dynamic Yield Calculation**: When the backend provides yield ratios for a species/cut pair, display the calculated estimated yield:
  `Selected Cut: Curry Cut • Estimated dressed weight: ~{grossWeight * yieldRatio}g`.
  If yield ratios are not configured for that species, display a factual note:
  `Fish will be scaled, gutted, and dressed fresh to order at the counter.`

### C. Persistent Sticky Cart Bar
- When `cart.items.length > 0`, a floating summary bar appears smoothly above the bottom navigation bar.
- **Positioning**:
  `position: 'absolute'`, `bottom: 56 + insets.bottom + 8`, `left: 12`, `right: 12`, `height: 52`, `zIndex: 100`.
- **Styling**: `backgroundColor: Colors.brandNavy`, `borderRadius: Radii.lg`, `elevation: 6`.
- **Content**:
  - Left: Item count and authoritative total (`{totalItems} items • ₹{totalAmount}`).
  - Right: Green CTA pill button (`View Cart →`).
- **List Padding**: Ensure all scrollable screens apply `contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}` so content is never obscured.

### D. Transparent Cart & Bill Breakdown
- **Config-Driven Charges**: Display cleaning fees, packaging fees, delivery charges, and taxes **strictly** from backend configuration APIs (`settings`, `discounts`). Never hardcode arbitrary fees without authoritative business rules.
- **Factual Workflow Notes**: Clearly state factual customer workflow notes (e.g. `Weighed and packed fresh to order at store counter`).

---

## 4. Bottom Navigation Implementation Standard

The customer application must strictly adhere to the agreed 5-action navigation structure:

```
+-------------------------------------------------------------------------+
|   [ 🏪 Home ]   [ 🧭 Track ]   ( [▣] Scan Bill )   [ 📅 Bookings ]   [ 👤 Profile ]   |
+-------------------------------------------------------------------------+
```

### Dimensions & Styling:
- **Container**: Pure white background (`#FFFFFF`), 1px top border (`#EEF2F6`), height: `56dp + insets.bottom`.
- **Icon Family**: Consistent vector/SVG icon set (not raw Unicode emojis).
  - `Home`: Outline/Solid Storefront icon.
  - `Track`: Outline/Solid Compass or Location Pin icon.
  - `Scan Bill`: Center elevated camera/bill scanner icon.
  - `Bookings`: Outline/Solid Calendar/Ticket icon.
  - `Profile`: Outline/Solid User/Account icon.
- **Center Elevated Action (`Scan Bill`)**:
  - Button container: 52dp diameter circular button, elevated (`elevation: 4`, `backgroundColor: Colors.brandNavy`).
  - Icon: Clean white camera/bill scanner glyph.
  - Vertical offset: Floats slightly above navigation bar top boundary (`marginTop: -14`).
  - Touch area: Minimum 52x52dp hit target.
- **State Indicators**:
  - **Active Tab**: `Colors.brandNavy` or `Colors.actionGreen` icon + label, semi-bold font (600).
  - **Inactive Tab**: `Colors.textMuted` icon + label, regular font (400).
- **Touch Targets**: Each of the 5 navigation items must satisfy $\ge 48\text{dp}$ touch target requirements.
- **Android Safe Area**: Use `useSafeAreaInsets()` to apply dynamic `paddingBottom: insets.bottom`, ensuring clean rendering above the Android 3-button navigation bar or gesture pill.

---

## 5. React Native Engineering & Architecture Standards

### A. Navigation Architecture: Pragmatic State Machine vs React Navigation
- **Architecture Decision**: **Preserve and harden the existing state machine in `App.jsx`**. Do not mandate a full React Navigation migration solely for UI polish.
- **Engineering Trade-Off Analysis**:
  - *Current State Machine (`App.jsx`)*: Lightweight, fast cold startup, zero additional native dependencies, and already battle-tested with strict security guards and 54/54 passing unit tests.
  - *React Navigation Migration Cost*: Introduces `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`, `react-native-screens`, and `react-native-safe-area-context`. Requires Gradle rebuilds, increases APK size, and risks destabilizing existing security session mocks in unit tests.
  - *Recommended Approach*: Polish the existing state machine visually:
    - Render the modernized 5-item bottom bar with vector icons and safe-area insets.
    - Centralize cart badge updates via `App.jsx` props or lightweight context.
    - Preserve existing hardware `BackHandler` logic which correctly guards authentication boundaries.
    - Only evaluate a full React Navigation migration if future business requirements demand universal deep-linking or multi-level nested stacks.

### B. List Performance & Virtualization
Never render unbounded product lists inside a basic `ScrollView` or nested carousels.
- Use `FlatList` with strict performance props:
  ```jsx
  <FlatList
    data={products}
    renderItem={renderProductCard}
    keyExtractor={(item) => String(item.id)}
    numColumns={2}
    columnWrapperStyle={styles.columnWrapper}
    initialNumToRender={6}
    maxToRenderPerBatch={8}
    windowSize={5}
    removeClippedSubviews={Platform.OS === 'android'}
    showsVerticalScrollIndicator={false}
  />
  ```

### C. Image Stability & Layout Shifts
- Use `OptimizedFishImage` with memoized rendering.
- Always provide explicit `width` and `height` or `aspectRatio` on image wrappers to prevent Cumulative Layout Shift (CLS).
- Include graceful local vector/PNG fallback placeholders for broken or network-delayed images.

### D. Touch Target & Accessibility Compliance
- Every interactive element (buttons, icons, checkboxes, steppers) must provide a touch target of at least **44x44 dp** (or use `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}`).
- All 5 bottom navigation items must provide at least **48x48 dp** touch targets.
- Include explicit `accessibilityRole`, `accessibilityLabel`, and `accessibilityState`.

### E. Animation Performance Guidelines
- All micro-interactions (cart bar slide-up, tap feedback, badge scale) must use `useNativeDriver: true`.
- Never animate layout properties (`width`, `height`, `top`, `bottom`) that trigger main-thread layout recalculations. Animate `transform` (scale, translateY) and `opacity` exclusively.

---

## 6. Protected Business Features (Must Not Be Removed)

The following core business capabilities are verified, operational, and **must not be removed or disabled** during any mobile UI refactoring:

1. **Scan Bill Workflow**: Camera capture, thermal receipt OCR review, item editing, and subscription quota/credit claims.
2. **Subscription Quota & Credit Engine**: Weekly allowance tracking, quota deduction, rollover/reset schedules, and plan upgrades.
3. **Booking & Counter Pickup System**: Time-slot reservations, unique digital token generation (`#PF-XXXX`), and store counter verification QR codes.
4. **Razorpay Payment Integration**: Native SDK checkout, order creation, signature verification, and transaction outcome handling.
5. **Harbor Replenishment Supply Tracking**: Backend endpoint `GET /api/v1/customer/live-tracking` representing morning fresh catch transport from harbors/farms to store retail counters.
6. **Authentication & Session Security**: Fail-closed Keychain tombstone handling, sanitized credential error cause chains, and account isolation.
7. **Genuine GPS Geofencing**: Distance calculations to retail stores and geofence verification.

---

## 7. Unresolved Business Assumptions Ledger

The following assumptions were identified during the audit and must remain **unimplemented or configuration-dependent** until confirmed by business stakeholders:

| Domain | Unresolved Assumption in Current Code | Engineering & UI Guidance |
| :--- | :--- | :--- |
| **Species-Specific Inventory & Handling** | Assumptions regarding how different species are stored or displayed (e.g. assumptions that some species are kept live while others are iced) | **Unresolved**: PondFish's stated business model is live-fish retail with preparation at the counter. Record species-specific handling as an unresolved business question until the business owner confirms it. Do not invent inventory or handling rules. |
| **Dressed Yields** | Hardcoded ~70–75% yield across all fish | **Unresolved**: Different species and cuts have variable yields. Only display yield if backend species config specifies a yield ratio. |
| **Preparation SLA** | "Ready in 20 mins" cutting time | **Unresolved**: Cutting time depends on store rush and queue. State "Cut to order at counter" without unverified minute promises. |
| **Pickup SLA** | "Pickup in 25–35 mins" | **Unresolved**: State selected pickup time slot; do not hardcode fixed pickup turnaround times. |
| **Delivery SLA** | "Delivery in 45–60 mins" | **Unresolved**: Delivery capability depends on local courier partner contracts. State delivery slot selected by customer. |
| **Packaging Standards** | "Bio-Insulated Cold Packaging" | **Unresolved**: Packaging type and fee must come from backend settings. Do not advertise unverified materials. |
| **Fee Structure** | Specific cutting (₹20) or delivery fees (₹35) | **Unresolved**: All fee line items must be driven dynamically by backend order summary API responses. |
| **Quality & Safety Certifications**| Claims such as "Quality assured", "Hygienic cutting guaranteed", "Zero artificial preservatives", "100% Chemical Free", "Lab Audited" | **Unresolved**: Do not replace unverified claims with other unverified guarantees. Prefer factual descriptions of actual customer workflows. |

---

## 8. Proposed Location Implementation & Technical Design

### A. Proposal Status Notice
The location reverse-geocoding endpoint and customer-address database schema described herein are **technical proposals for future backend and frontend implementation**, NOT existing functionality.

### B. Migration Versioning & History Invariant
Inspection of `Documentation/database/migrations/` confirms existing migration history:
- `0018_checkout_intents.sql`
- `0019_payments_subscription_id.sql` (Occupied, Applied & Verified)
- `0020_bill_review_and_store_scoping.sql` (Occupied, Applied & Verified)

Because migration versions `0019` and `0020` are already occupied by historical database changes, the proposed customer-address migration must use the **next unused version: 0021** (e.g. `0021_customer_addresses.sql`).
*Do not overwrite, rename, or reuse historical migrations. Do not create the migration file yet.*

### C. Required Backend Dependencies
The proposed location implementation requires the following backend dependencies to be planned and provisioned:
1. **Server-Side Reverse Geocoding Proxy**:
   - Next.js App Router endpoint: `app/api/v1/geo/reverse-geocode/route.js`.
   - Backend Secret: `GOOGLE_MAPS_SERVER_API_KEY` in server environment (never exposed to mobile client).
   - Server-side geocoding client or native `fetch` call with caching and rate-limiting.
2. **Database Persistence**:
   - Migration `0021_customer_addresses.sql` creating the `customer_addresses` table.
   - Persistence repository `lib/db/repositories/addressRepository.js` using parameterized SQL and bounded connection pool.
3. **Mobile Client Dependencies**:
   - `react-native-geolocation-service` in `customer-app/package.json`.
   - Android permissions declared in `customer-app/android/app/src/main/AndroidManifest.xml`:
     `android.permission.ACCESS_FINE_LOCATION`, `android.permission.ACCESS_COARSE_LOCATION`.

---

## 9. How to Use This Skill

### For AI Coding Assistants & Human Engineers:
1. **Before generating or refactoring any screen in `customer-app/src/screens/`:**
   - Verify design tokens against `customer-app/src/theme/tokens.js`.
   - Ensure the agreed 5-item navigation structure (`Home`, `Track`, `Scan Bill`, `Bookings`, `Profile`) is preserved.
   - Verify that all product information reflects real live-fish retail without fabricated metrics.
2. **Review Checklist**:
   - [ ] Are all colors mapped to `Colors.*` tokens?
   - [ ] Is product visibility immediate near the top without scrolling through promotional banners?
   - [ ] Are touch targets $\ge 44 \times 44\text{ dp}$ (and $\ge 48 \times 48\text{ dp}$ for bottom nav)?
   - [ ] Are fake countdowns, fake stock urgency, fake ratings, and fake 8-minute delivery badges absent?
   - [ ] Are yield notes and fees driven by backend configuration rather than hardcoded figures?
   - [ ] Are all replacement texts factual descriptions of actual customer workflows?
   - [ ] Does the screen correctly handle Android safe-area bottom insets?
