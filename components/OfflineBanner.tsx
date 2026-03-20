import { View, Text, StyleSheet, Platform } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppTheme } from '../lib/theme';
import { useLanguageStore } from '../stores/languageStore';

const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : 30;

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const { colors } = useAppTheme();
  const { t } = useLanguageStore();

  if (isOnline) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.error }]}>
      <Text style={styles.text}>📡 {t.common.offline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingTop: STATUS_BAR_HEIGHT,
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

export default OfflineBanner;
