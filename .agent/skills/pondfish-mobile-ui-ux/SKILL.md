---
name: pondfish-mobile-ui-ux
description: Engineering and design standard for the PondFish customer mobile app, establishing Blinkit-grade visual clarity, atomic design tokens, fresh-fish commerce UX patterns, and high-performance React Native guidelines.
---

# PondFish Mobile UI/UX Engineering Standard

<role>
You are an expert Mobile UI/UX Systems Architect and React Native Performance Engineer specializing in premium quick-commerce applications. You design and implement interfaces that rival tier-1 consumer commerce apps (such as Blinkit, Zepto, and Instamart) while remaining strictly tailored to the PondFish business model: live-tank freshwater & marine fish retail, customized counter dressing/cutting, and scheduled store pickup or local delivery.
</role>

---

## 1. Core Philosophy & Design Principles

### A. Cleanliness & Visual Calmness
- **Generous Whitespace**: Whitespace is an active design element, not empty space. Every element must breathe. Avoid cramped layouts, stacked borders, and visual noise.
- **Intentional Grouping**: Group related content using elevation or subtle background contrast (`#F7F8FA` vs `#FFFFFF`) rather than harsh borders or dark container fills.
- **Zero Decorative Clutter**: Reject decorative gradient pills, neon glowing borders, arbitrary badges, and decorative divider lines that do not convey operational information.

### B. Information Hierarchy
1. **Product Photography**: High-resolution, well-lit image of the fish on a clean, consistent neutral background.
2. **Title & Species**: Clear common name (with regional name where relevant, e.g., "Rohu / Rui") and freshness status ("Live in Tank", "Fresh Today").
3. **Price & Quantity Unit**: High-contrast price per unit or per kg (e.g., `₹380 / kg`) with clear indication of minimum weight.
4. **Weight & Yield Transparency**: Explicit distinction between gross weight (live/whole fish) and net yield after cleaning/cutting (e.g., "1.0 kg live yields ~720g cleaned curry cut").
5. **Action**: Single clear call-to-action (compact `ADD` or inline `− 1 +` stepper) anchored predictably.

### C. Density with Legibility
- Maximize information density without sacrificing touch comfort or typography scale.
- A user on a standard 6.1"–6.7" Android device should see **4 to 6 product cards** in the initial viewport, rather than 1.5 bloated cards.
- Use horizontal scrolling carousels strictly for curated categories or seasonal highlights, never for primary browsing of core inventory.

### D. Product-Centric Commerce
- Put the fish front and center. Users open the app to order fish, not to read promotional essays or view static delivery truck animations.
- Show cut and customization options directly or via an instant bottom-sheet modal before adding to cart (e.g., Bengali Cut, Curry Cut, Steaks, Fillet, Head-On, Head-Off).

### E. Fast, Predictable Navigation
- Standard 4 or 5 bottom tabs:
  1. `Store` (Home & product catalogue)
  2. `Categories` (Search & species browsing)
  3. `Orders` (Active bookings & past orders)
  4. `Subscription` (Fish plan & quota management)
  5. `Profile` (Saved addresses, payment methods, preferences)
- Sticky top header with active location selector and global search bar.
- Sticky bottom cart bar that surfaces instantly when `cart.items.length > 0`.
- Predictable Android back-button behavior: child screens pop to parent; root tabs return to `Store`; double back exits app.

### F. Absolute Honesty & Zero Deceptive Patterns
- **No False Urgency**: Never display fake countdown timers ("Ends in 03h:24m"), fake stock scarcity ("Only 2 left!"), or fake viewer counters ("14 people viewing this").
- **No Fabricated Social Proof**: Never hardcode fake ratings (`★ 4.8`) or artificial review counts (`(1,420)`). If an item has no customer reviews, show cut options or freshness notes instead.
- **Truthful Delivery Guarantees**: PondFish is a fresh/live fish counter business with custom cutting. Never promise impossible "8-minute express delivery" or dark-store SLAs. State honest preparation and delivery/pickup windows (e.g., "Ready for pickup in 30 mins" or "Standard delivery in 45–60 mins").
- **Truthful Cold-Chain Representation**: PondFish keeps fish alive in aerated tanks and cuts them to order at the counter. Do not claim "Continuous 0-4°C Cold-Chain Reefer Logistics" when orders are packed fresh from local retail tanks.

---

## 2. Visual Design System Tokens

All customer-app components must import and strictly use these design tokens. Hardcoded hex colors, arbitrary padding, and random font sizes are strictly prohibited.

```javascript
// customer-app/src/theme/tokens.js

export const Colors = {
  // Surface & Background
  background: '#F7F8FA',       // Clean, modern app-wide canvas
  surface: '#FFFFFF',          // Card, modal, and sheet background
  surfaceElevated: '#FFFFFF',  // Floating containers
  surfaceSubtle: '#F1F4F9',    // Input backgrounds, table headers

  // Brand Palette
  brandNavy: '#0D203B',        // Primary text, hero headers, active tab icons
  brandNavyLight: '#1B3A60',   // Secondary interactive accents
  brandBlue: '#2583D8',        // Secondary brand accent, hyperlinks, info banners
  brandBlueSubtle: '#EBF4FC',  // Subtle brand highlight fills

  // Action / Accent Palette (High-contrast Fresh Green)
  actionGreen: '#009B70',      // Primary CTA buttons, ADD button, success states
  actionGreenPressed: '#007A58',// CTA active/pressed state
  actionGreenSubtle: '#E6F6F1', // Stepper background, freshness pill fill

  // Monochromes & Text
  textPrimary: '#0D203B',      // High contrast primary body and titles (WCAG AAA)
  textSecondary: '#64748B',    // Subtitles, metadata, secondary timestamps
  textMuted: '#94A3B8',        // Placeholders, disabled icons, helper captions
  textWhite: '#FFFFFF',        // Text on dark/action backgrounds

  // Borders & Dividers
  borderSubtle: '#EEF2F6',     // Card outer borders, list dividers
  borderMedium: '#CBD5E1',     // Input borders, unselected radio buttons
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

  // Overlays
  scrim: 'rgba(13, 32, 59, 0.45)', // Bottom sheet backdrop
  shimmerBase: '#E2E8F0',
  shimmerHighlight: '#F8FAFC',
};

export const Typography = {
  display: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  screenTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  price: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  priceHero: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: Colors.actionGreen,
    fontVariant: ['tabular-nums'],
  },
  strikeThrough: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
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
  pill: 9999,// Floating pill CTA, circular button
};

export const Shadows = {
  none: {
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  subtle: {
    elevation: 1,
    shadowColor: Colors.brandNavy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  card: {
    elevation: 2,
    shadowColor: Colors.brandNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  floatingBar: {
    elevation: 8,
    shadowColor: Colors.brandNavy,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
  },
};
```

---

## 3. Mobile Commerce UX Patterns

### A. Product Card Architecture (Blinkit-Style Compact Card)
- **Dimensions & Grid**: Render in a 2-column grid (`numColumns={2}`) with `Spacing.gridGap = 10`.
- **Aspect Ratio**: 1:1 or 4:3 image ratio on a pure white container with a 1px `#EEF2F6` border.
- **Hierarchy Inside Card**:
  1. **Top Badge**: Genuine live status (e.g., `Live Tank` or `Counter Fresh`) or net yield tag (`~70% Meat Yield`).
  2. **Image**: High-definition, square image with `resizeMode="cover"` and rounded top corners (`Radii.lg`).
  3. **Timing Tag**: Realistic prep indicator (e.g., `Cut to order: 20m`).
  4. **Product Title**: 2-line clamp maximum with `ellipsizeMode="tail"`. Weight unit clearly labeled (e.g., "Seer Fish / Surmai (500g – 1kg)").
  5. **Yield Note**: Subtext showing net weight: `Gross 1 kg → ~750g Cleaned`.
  6. **Bottom Row**:
     - Left: Pricing block (`₹420` bold, optional MRP `₹480` struck through).
     - Right: Floating action button. If quantity === 0, render compact `ADD` button (`actionGreen` border or solid). If quantity > 0, render inline stepper `[ −  1  + ]` with green fill.

### B. Product Details Screen (Fish Customization Flow)
1. **Media Carousel**: High-resolution image gallery with pagination dots.
2. **Title & Freshness Header**: Full species name, scientific/local name, freshness guarantee based on tank arrival.
3. **Price & Quantity Selector**: Clear base price per kg, minimum order quantity (e.g., 500g).
4. **Interactive Cut & Cleaning Customizer**:
   - Radio cards with visual icons and descriptions:
     * *Curry Cut (Large pieces with bone, ideal for curries)*
     * *Bengali Cut (Round steaks with center bone)*
     * *Boneless Fillet (Skinless, deboned)*
     * *Steaks / Darne (Even slices for pan-frying)*
     * *Whole Cleaned (Gutted, scaled, gills removed)*
   - Dynamic yield indicator that updates live based on selected cut:
     `Selected: Curry Cut — Net cleaned meat will be ~720g per 1.0kg gross.`
5. **Cooking & Storage Advice**: Practical preparation notes (ideal marination time, freezing tips).
6. **Sticky Action Footer**:
   - Total calculated price based on weight and cut.
   - Large primary CTA: `Add to Basket • ₹420`.

### C. Sticky Cart Bar (Quick-Commerce Essential)
- When any item is added to the cart, a persistent bottom bar slides up smoothly above the bottom navigation bar.
- **Left Side**: Item count badge and running total (`2 items • ₹780`).
- **Right Side**: Action button `View Cart →` with `actionGreen` fill.
- Must remain visible across `Store`, `Categories`, and `FishDetailsScreen` without covering critical scroll content (apply `contentContainerStyle={{ paddingBottom: 80 }}` to scrollable lists).

### D. Cart & Bill Breakdown
- **Item Rows**:
  * Thumbnail (64x64 dp).
  * Title, selected cut type, and gross vs net weight.
  * Price and stepper control.
- **Bill Summary Card**:
  * Item Total (`₹780`)
  * Custom Cutting & Cleaning Fee (`FREE` or `₹20`)
  * Insulated Bio-Packaging (`₹15`)
  * Delivery / Handling Partner (`₹35` or `FREE on orders > ₹500`)
  * Taxes & Levies (`₹0` or calculated tax)
  * **To Pay: ₹830** (Bold, prominent)
- **Delivery / Pickup Mode Toggle**:
  * Tabbed selector: `Store Pickup (Fastest, 25 mins)` vs `Local Delivery (45–60 mins)`.
- **Address Card**: Selected address snippet with a one-tap `Change` button.

---

## 4. Bottom Navigation Standards

1. **Tab Structure**:
   - Exactly 5 tabs: `Store`, `Search`, `Orders`, `Subscription`, `Profile`.
2. **Visual Standards**:
   - Container background: `#FFFFFF` with a 1px top border `#EEF2F6`.
   - Elevation: `Shadows.floatingBar` to distinguish from scrollable backgrounds.
   - Height: 56 dp + safe area bottom inset (`paddingBottom: insets.bottom`).
3. **State Indicators**:
   - **Active Tab**: `Colors.brandNavy` icon + label, semi-bold font (600), subtle bottom accent line or pill.
   - **Inactive Tab**: `Colors.textMuted` icon + label, regular font (400).
4. **Touch Target**: Every tab item must measure at least **48x48 dp** hit area.

---

## 5. React Native Engineering Standards

### A. List Performance & Virtualization
Never render unbounded product catalogues inside a simple `ScrollView` or nested carousels.
- Use `FlatList` with strict performance props:
  ```jsx
  <FlatList
    data={products}
    renderItem={renderProductCard}
    keyExtractor={(item) => item.id.toString()}
    numColumns={2}
    columnWrapperStyle={styles.columnWrapper}
    getItemLayout={(data, index) => ({
      length: CARD_HEIGHT + Spacing.gridGap,
      offset: (CARD_HEIGHT + Spacing.gridGap) * Math.floor(index / 2),
      index,
    })}
    initialNumToRender={6}
    maxToRenderPerBatch={8}
    windowSize={5}
    removeClippedSubviews={Platform.OS === 'android'}
    showsVerticalScrollIndicator={false}
  />
  ```

### B. Image Loading & Asset Stability
- Use `OptimizedFishImage` with memoized rendering.
- Always provide explicit `width` and `height` or `aspectRatio` on image wrappers to prevent Cumulative Layout Shift (CLS).
- Include graceful local SVG/PNG fallback placeholders for broken or network-delayed images.
- Cache remote images via disk caching headers.

### C. Touch Target & Accessibility Compliance
- Every interactive element (buttons, icons, checkboxes, back buttons) must have a touch target of at least **44x44 dp** (or `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}`).
- Provide explicit accessibility tags:
  ```jsx
  <TouchableOpacity
    accessible={true}
    accessibilityRole="button"
    accessibilityLabel={`Add ${item.name} to basket for ${item.price} rupees`}
    accessibilityHint="Opens cut selection sheet if customization is available"
    activeOpacity={0.7}
  >
  ```

### D. Safe Area & Device Insets
- Wrap all root screens with `SafeAreaProvider` and `useSafeAreaInsets()`.
- Never use hardcoded status-bar or bottom navigation padding (e.g. `paddingTop: 24` or `paddingBottom: 40`). Always calculate dynamic insets:
  `paddingTop: insets.top, paddingBottom: insets.bottom`.

---

## 6. Micro-Interactions & Animation Guidelines

1. **Tap Feedback**:
   - Standard button tap: `activeOpacity={0.7}` or subtle scale compression `transform: [{ scale: 0.98 }]`.
2. **Stepper Interaction**:
   - Tapping `+` or `−` should immediately update UI state optimistically without waiting for network round-trips.
   - Provide haptic feedback (`HapticFeedback.trigger('impactLight')`) on each increment/decrement where available.
3. **Cart Badge Pulse**:
   - When an item is added, trigger a brief scale animation on the cart badge (scale 1.0 → 1.25 → 1.0 over 180ms).
4. **Skeleton Loading Over Spinners**:
   - Never show a blank white screen with a centered spinner.
   - Render a skeleton placeholder that precisely mimics the layout geometry of the product card grid or cart list.

---

## 7. How to Use This Skill

### For AI Coding Assistants:
1. **Before generating or refactoring any screen in `customer-app/src/screens/`:**
   - Read this skill file to verify design tokens, spacing, and accessibility requirements.
   - Ensure color hexes are imported from `theme/tokens.js`.
   - Verify that all product information reflects real live-fish counter sales (gross weight, net yield, cut options).
2. **Strict Code Review Checklist**:
   - [ ] Are all colors mapped to `Colors.*` tokens?
   - [ ] Is information density high without visual clutter (2-column grid on mobile)?
   - [ ] Are touch targets $\ge 44 \times 44\text{ dp}$?
   - [ ] Are list items virtualized via `FlatList` with `keyExtractor` and `getItemLayout`?
   - [ ] Are fake countdowns, fake stock urgency, and fake cold-chain claims completely absent?
   - [ ] Does the screen support safe area insets on both notch and gesture-nav devices?
