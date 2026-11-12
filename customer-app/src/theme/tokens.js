/**
 * PondFish Design System Tokens
 * Traceability: .agent/skills/pondfish-mobile-ui-ux/SKILL.md
 * Single source of truth for colors, typography, spacing, radii, shadows, and layout.
 */

export const Colors = {
  // Surface & Canvas
  background: '#F7F8FA',       // Clean, calm light grey canvas
  surface: '#FFFFFF',          // Card, modal sheet, and dialog background
  surfaceElevated: '#FFFFFF',  // Floating bottom navigation, sticky cart bar
  surfaceSubtle: '#F1F4F9',    // Input backgrounds, table headers, chip fills

  // Brand Palette
  brandNavy: '#0D203B',        // Primary text, hero titles, active bottom nav items
  brandNavyDark: '#071628',    // Deep dark navy
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

// Supported typography matching PondFish Website Design Standard: Plus Jakarta Sans
export const Typography = {
  display: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  screenTitle: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  bodyMedium: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  bodySmall: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  caption: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  price: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  priceHero: {
    fontFamily: 'PlusJakartaSans',
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

export const Layout = {
  bottomNavHeight: 56,
  stickyCartBarHeight: 52,
  minTouchTarget: 48,
  headerHeight: 60,
};

