import {
  Pressable,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../../constants/theme';
import { useHaptic } from '../../hooks/useHaptic';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'small' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const haptic = useHaptic();

  const handlePress = () => {
    haptic.light();
    onPress();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        size === 'small' && styles.small,
        size === 'large' && styles.large,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'outline' || variant === 'ghost'
              ? theme.colors.primary
              : variant === 'primary'
                ? theme.colors.primaryDark
                : '#FFFFFF'
          }
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.text,
            size === 'small' && styles.textSmall,
            size === 'large' && styles.textLarge,
            (variant === 'outline' || variant === 'ghost') && styles.textOutline,
            variant === 'primary' && styles.textPrimary,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.minTouchTarget,
    borderRadius: theme.borderRadius.button,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  } as ViewStyle,
  small: {
    minHeight: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
  } as ViewStyle,
  large: {
    minHeight: 56,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
  } as ViewStyle,
  primary: {
    backgroundColor: theme.colors.accent,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  } as ViewStyle,
  secondary: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  } as ViewStyle,
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  } as ViewStyle,
  ghost: {
    backgroundColor: 'transparent',
  } as ViewStyle,
  disabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  } as ViewStyle,
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  } as ViewStyle,
  text: {
    ...theme.typography.button,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  } as TextStyle,
  textSmall: {
    fontSize: 14,
  } as TextStyle,
  textLarge: {
    fontSize: 18,
    fontWeight: '700',
  } as TextStyle,
  textOutline: {
    color: theme.colors.primary,
  } as TextStyle,
  textPrimary: {
    color: theme.colors.primaryDark,
    fontWeight: '700',
  } as TextStyle,
});
