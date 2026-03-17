import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@aerocab/shared';
import { Button } from '@aerocab/mobile-ui';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

const OTP_LENGTH = 6;
const OTP_EXPIRY = 300;

export default function VerifyOtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(OTP_EXPIRY);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Auto-focus first input
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];

    if (text.length > 1) {
      const chars = text.slice(0, OTP_LENGTH).split('');
      chars.forEach((char, i) => {
        if (index + i < OTP_LENGTH) {
          newOtp[index + i] = char;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + chars.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newOtp[index] = text;
      setOtp(newOtp);
      if (text && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }

    setError('');

    const fullCode = newOtp.join('');
    if (fullCode.length === OTP_LENGTH && !fullCode.includes('')) {
      handleVerify(fullCode);
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== OTP_LENGTH) {
      setError('Entrez les 6 chiffres du code');
      return;
    }

    if (!phone) {
      setError('Numero de telephone manquant');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Driver app: always verify with 'driver' role
      const result = await api.verifyOtp(phone, otpCode, 'driver');
      setAuth(
        result.user as any,
        result.accessToken,
        result.refreshToken,
        result.isNewUser,
      );

      if (result.isNewUser) {
        // New driver → complete driver profile
        router.replace('/(auth)/complete-driver-profile');
      } else {
        // Existing driver → main tabs
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Code invalide';
      setError(message);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || !phone) return;
    setCanResend(false);
    setTimer(OTP_EXPIRY);
    setError('');

    try {
      await api.sendOtp(phone);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Echec du renvoi';
      setError(message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={COLORS.primary} />
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Shield icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Lock size={32} color={COLORS.primary} />
          </View>
        </View>

        <Text style={styles.title}>Verification</Text>
        <Text style={styles.subtitle}>
          Un code a 6 chiffres a ete envoye au
        </Text>
        <Text style={styles.phoneText}>{phone}</Text>

        {/* OTP inputs */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[
                styles.otpInput,
                digit ? styles.otpInputFilled : null,
                error ? styles.otpInputError : null,
              ]}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, index)
              }
              keyboardType="number-pad"
              maxLength={index === 0 ? OTP_LENGTH : 1}
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Button
          title="Verifier le code"
          onPress={() => handleVerify()}
          loading={loading}
          size="large"
          style={styles.verifyButton}
        />

        {/* Timer / Resend */}
        <View style={styles.resendContainer}>
          {canResend ? (
            <Pressable onPress={handleResend} style={styles.resendButton}>
              <Text style={styles.resendText}>Renvoyer le code</Text>
            </Pressable>
          ) : (
            <View style={styles.timerRow}>
              <Text style={styles.timerLabel}>Nouveau code dans </Text>
              <View style={styles.timerBadge}>
                <Text style={styles.timerValue}>{formatTimer(timer)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Change number */}
        <Pressable
          style={styles.changeNumberButton}
          onPress={() => router.back()}
        >
          <Text style={styles.changeNumberText}>Changer de numero</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: SPACING.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.grayDark,
    textAlign: 'center',
    lineHeight: 20,
  },
  phoneText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 4,
    marginBottom: SPACING.xl,
  },
  otpContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACING.lg,
  },
  otpInput: {
    width: 48,
    height: 58,
    borderWidth: 2,
    borderColor: COLORS.grayLight,
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}08`,
  },
  otpInputError: {
    borderColor: COLORS.error,
    backgroundColor: `${COLORS.error}08`,
  },
  errorContainer: {
    backgroundColor: `${COLORS.error}10`,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.button,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  verifyButton: {
    width: '100%',
  },
  resendContainer: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 14,
    color: COLORS.grayMedium,
  },
  timerBadge: {
    backgroundColor: `${COLORS.primary}12`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timerValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendText: {
    fontSize: 15,
    color: COLORS.accent,
    fontWeight: '700',
  },
  changeNumberButton: {
    marginTop: SPACING.md,
    paddingVertical: 8,
  },
  changeNumberText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
