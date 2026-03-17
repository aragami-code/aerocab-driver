import React from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { theme } from '../../constants/theme';

export interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Icon wrapper with AeroCab defaults (size 24, primary color).
 * Usage: <Icon icon={Map} size={28} color={theme.colors.accent} />
 */
export function Icon({
  icon: LucideIconComponent,
  size = 24,
  color = theme.colors.primary,
  strokeWidth = 2,
}: IconProps) {
  return (
    <LucideIconComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}
