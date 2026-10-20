/**
 * PondFish Design System Color Tokens - React Native Mobile
 * Traceability: PondFish Complete Design System UI/UX Specification
 */

export const colors = {
  // Brand Core Colors
  primary: '#0284C7',
  primaryHover: '#0369A1',
  primaryDark: '#075985',
  accent: '#38BDF8',
  accentLight: '#BAE6FD',

  // Stitch Design System Tokens
  navyPrimary: '#0A1C33',
  navyDark: '#071628',
  navyCard: '#0F223D',
  navySurface: '#172A45',
  blueAccent: '#0284C7',
  blueSecondary: '#1D61B4',
  blueSoft: '#EDF5FD',
  blueBorder: '#C6DEF9',

  // Surfaces & Backgrounds
  pageBg: '#F8FAFE',
  cardBg: '#FFFFFF',
  bgMain: '#F8FAFE',
  bgCard: '#FFFFFF',
  bgSurface: '#EDF5FD',
  bgInput: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Quota & Gold Tiers
  goldBg: '#FFFBEB',
  goldBorder: '#FEF3C7',
  goldText: '#92400E',
  goldAccent: '#F59E0B',

  // Freshness & Semantic Status
  freshGreen: '#16A34A',
  freshGreenBg: '#DCFCE7',
  freshGrey: '#64748B',
  freshGreyBg: '#F1F5F9',
  freshRed: '#DC2626',
  freshRedBg: '#FEE2E2',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#0284C7',

  // Typography
  textPrimary: '#0A1C33',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textLightMuted: '#94A3B8',
  textWhite: '#FFFFFF',
  textDark: '#0A1C33',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 14,
  xxl: 20,
  full: 9999,
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
  card: {
    shadowColor: '#0A1C33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardElevated: {
    shadowColor: '#0A1C33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
};

