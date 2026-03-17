import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { theme } from '../../constants/theme';

interface TabIconProps {
  icon: LucideIcon;
  label: string;
  focused: boolean;
}

/**
 * Shared tab bar icon component — replaces duplicate emoji-based TabIcon in both apps.
 * Uses lucide SVG icons instead of text emojis for a professional look.
 */
export function TabIcon({ icon: LucideIconComponent, label, focused }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      <LucideIconComponent
        size={22}
        color={focused ? theme.colors.primary : theme.colors.textPlaceholder}
        strokeWidth={focused ? 2.2 : 1.8}
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.textPlaceholder,
  },
  tabLabelActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
