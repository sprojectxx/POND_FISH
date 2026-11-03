/**
 * PondFish Design System Color Tokens - React Native Mobile
 * Traceability: PondFish Complete Design System UI/UX Specification & .agent/skills/pondfish-mobile-ui-ux/SKILL.md
 * 
 * Non-breaking shim: Re-exports design system tokens from tokens.js
 * while maintaining 100% backward compatibility for legacy color, spacing, radius,
 * typography, and shadow keys.
 */

import { Colors, Typography, Spacing, Radii, Shadows, Layout } from './tokens';

export { Colors, Typography, Spacing, Radii, Shadows, Layout };

export const colors = {
  // Brand Core Colors
  primary: Colors.brandBlue,
  primaryHover: '#0369A1',
  primaryDark: Colors.brandNavy,
  accent: '#38BDF8',
  accentLight: Colors.brandBlueSubtle,

  // Stitch & Modern Tokens
  navyPrimary: Colors.brandNavy,
  navyDark: Colors.brandNavyDark,
  navyCard: '#0F223D',
  navySurface: '#172A45',
  blueAccent: Colors.brandBlue,
  blueSecondary: '#1D61B4',
  blueSoft: Colors.brandBlueSubtle,
  blueBorder: '#C6DEF9',

  // Surfaces & Backgrounds
  pageBg: Colors.background,
  cardBg: Colors.surface,
  bgMain: Colors.background,
  bgCard: Colors.surface,
  bgSurface: Colors.surfaceSubtle,
  bgInput: Colors.surface,
  border: Colors.borderSubtle,
  borderLight: '#F1F5F9',

  // Quota & Gold Tiers
  goldBg: '#FFFBEB',
  goldBorder: '#FEF3C7',
  goldText: '#92400E',
  goldAccent: Colors.warning,

  // Freshness & Semantic Status
  freshGreen: Colors.actionGreen,
  freshGreenBg: Colors.actionGreenSubtle,
  freshGrey: Colors.textSecondary,
  freshGreyBg: Colors.surfaceSubtle,
  freshRed: Colors.error,
  freshRedBg: Colors.errorSubtle,
  success: Colors.success,
  warning: Colors.warning,
  danger: Colors.error,
  info: Colors.info,

  // Typography
  textPrimary: Colors.textPrimary,
  textSecondary: Colors.textSecondary,
  textMuted: Colors.textMuted,
  textLightMuted: '#94A3B8',
  textWhite: Colors.textWhite,
  textDark: Colors.brandNavy,
};

export const spacing = {
  xs: Spacing.xs,
  sm: Spacing.sm,
  md: Spacing.md,
  lg: Spacing.base,
  xl: Spacing.lg,
  xxl: Spacing.xl,
  xxxl: Spacing.xxl,
};

export const radius = {
  xs: Radii.xs,
  sm: Radii.sm,
  md: Radii.md,
  lg: Radii.lg,
  xl: Radii.xl,
  xxl: 20,
  full: Radii.pill,
};

export const typography = {
  h1: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  h4: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 18 },
  bodyBold: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  caption: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  tiny: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  priceLarge: { fontSize: 22, fontWeight: '900', color: colors.textPrimary },
  priceNormal: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
};

export const shadows = {
  card: Shadows.card,
  cardElevated: Shadows.elevatedCenter,
  modal: Shadows.floatingBar,
};
