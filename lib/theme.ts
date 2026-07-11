import { COLORS, BORDER_RADIUS, SPACING, MIN_TOUCH_TARGET } from './shared';
import { useThemeStore } from '../stores/themeStore';
import { activeBrand } from './brand';

export const theme = {
  colors: {
    get primary() { return activeBrand.primary; },
    get primaryLight() { return activeBrand.primaryLight; },
    get primaryDark() { return activeBrand.primaryDark; },
    get accent() { return activeBrand.accent; },
    get accentLight() { return activeBrand.accentLight; },
    get onPrimary() { return activeBrand.onPrimary; },
    get onAccent() { return activeBrand.onAccent; },
    black: COLORS.black,
    textPrimary: COLORS.black,
    textSecondary: COLORS.grayDark,
    textPlaceholder: COLORS.grayMedium,
    border: COLORS.grayLight,
    background: COLORS.background,
    success: COLORS.success,
    error: COLORS.error,
    warning: COLORS.warning,
    white: COLORS.white,
  },

  typography: {
    h1: { fontSize: 48, fontWeight: '700' as const },
    h2: { fontSize: 24, fontWeight: '700' as const },
    h3: { fontSize: 20, fontWeight: '700' as const },
    body: { fontSize: 16, fontWeight: '400' as const },
    bodySmall: { fontSize: 14, fontWeight: '400' as const },
    caption: { fontSize: 12, fontWeight: '400' as const },
    button: { fontSize: 16, fontWeight: '600' as const },
    cardTitle: { fontSize: 18, fontWeight: '600' as const },
  },

  borderRadius: {
    button: BORDER_RADIUS.button,
    card: BORDER_RADIUS.card,
    bottomSheet: BORDER_RADIUS.bottomSheet,
    input: BORDER_RADIUS.button,
  },

  spacing: {
    xs: SPACING.xs,
    sm: SPACING.sm,
    md: SPACING.md,
    lg: SPACING.lg,
    xl: SPACING.xl,
  },

  minTouchTarget: MIN_TOUCH_TARGET,
};

export const darkTheme = {
  colors: {
    get primary() { return activeBrand.primary; },
    get primaryLight() { return activeBrand.primaryLight; },
    get primaryDark() { return activeBrand.primaryDark; },
    get accent() { return activeBrand.accent; },
    get accentLight() { return activeBrand.accentLight; },
    get onPrimary() { return activeBrand.onPrimary; },
    get onAccent() { return activeBrand.onAccent; },
    black: '#FFFFFF',
    textPrimary: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textPlaceholder: '#888888',
    border: '#2C2C2C',
    background: '#121212',
    success: COLORS.success,
    error: COLORS.error,
    warning: COLORS.warning,
    white: '#1E1E1E',
  },

  typography: {
    h1: { fontSize: 48, fontWeight: '700' as const },
    h2: { fontSize: 24, fontWeight: '700' as const },
    h3: { fontSize: 20, fontWeight: '700' as const },
    body: { fontSize: 16, fontWeight: '400' as const },
    bodySmall: { fontSize: 14, fontWeight: '400' as const },
    caption: { fontSize: 12, fontWeight: '400' as const },
    button: { fontSize: 16, fontWeight: '600' as const },
    cardTitle: { fontSize: 18, fontWeight: '600' as const },
  },

  borderRadius: {
    button: BORDER_RADIUS.button,
    card: BORDER_RADIUS.card,
    bottomSheet: BORDER_RADIUS.bottomSheet,
    input: BORDER_RADIUS.button,
  },

  spacing: {
    xs: SPACING.xs,
    sm: SPACING.sm,
    md: SPACING.md,
    lg: SPACING.lg,
    xl: SPACING.xl,
  },

  minTouchTarget: MIN_TOUCH_TARGET,
};

export type Theme = typeof theme;

export function useAppTheme(): Theme {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? (darkTheme as unknown as Theme) : theme;
}
