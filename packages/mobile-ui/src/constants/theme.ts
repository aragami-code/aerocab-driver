import { COLORS, BORDER_RADIUS, SPACING, MIN_TOUCH_TARGET } from '@aerocab/shared';

export const theme = {
  colors: {
    primary: COLORS.primary,
    primaryLight: COLORS.primaryLight,
    primaryDark: COLORS.primaryDark,
    accent: COLORS.accent,
    accentLight: COLORS.accentLight,
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
} as const;
