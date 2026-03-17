import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isWeb = Platform.OS === 'web';

/** No-op function used on web where haptics are unavailable. */
const noop = () => {};

/**
 * Haptic feedback hook — provides branded haptic patterns.
 * Returns no-ops on web; falls back gracefully on devices without haptic support.
 */
export function useHaptic() {
  if (isWeb) {
    return { light: noop, medium: noop, heavy: noop, success: noop, error: noop, selection: noop };
  }

  const light = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const medium = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  };

  const heavy = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
  };

  const success = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const error = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  };

  const selection = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
  };

  return { light, medium, heavy, success, error, selection };
}
