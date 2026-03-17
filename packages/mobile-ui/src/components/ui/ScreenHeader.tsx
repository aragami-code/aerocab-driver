import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, type ViewStyle } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { theme } from '../../constants/theme';

/** Static safe-area top estimate — avoids requiring SafeAreaProvider on web */
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : Platform.OS === 'android' ? 30 : 0;

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
  backgroundColor?: string;
}

/**
 * Proper screen header using useSafeAreaInsets() instead of hardcoded paddingTop.
 * Adapts to all devices: iPhone SE, iPhone 15 Pro, Android fold, etc.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  style,
  backgroundColor = theme.colors.background,
}: ScreenHeaderProps) {
  return (
    <View
      style={[
        styles.container,
        { paddingTop: STATUS_BAR_HEIGHT + 12, backgroundColor },
        style,
      ]}
    >
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={8}>
            <ArrowLeft size={24} color={theme.colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightAction ? (
          <View style={styles.rightAction}>{rightAction}</View>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 40,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  rightAction: {
    width: 40,
    alignItems: 'flex-end',
  },
});
