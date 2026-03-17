import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { theme } from '../../constants/theme';

const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : 30;

/**
 * Sticky offline banner — appears at top of screen when device has no internet.
 * Placed in root _layout.tsx for global coverage.
 * Uses Platform-based height instead of useSafeAreaInsets to avoid requiring SafeAreaProvider.
 */
export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View style={styles.container}>
      <WifiOff size={16} color={theme.colors.white} strokeWidth={2} />
      <Text style={styles.text}>Pas de connexion internet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.error,
    paddingTop: STATUS_BAR_HEIGHT,
    paddingBottom: 8,
    paddingHorizontal: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  text: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
