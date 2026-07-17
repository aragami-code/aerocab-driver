import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBiometricStore } from '../stores/biometricStore';
import { useAuthStore } from '../stores/authStore';
import { authenticateWithBiometric, getBiometricType } from '../lib/useBiometric';
import { COLORS } from '../lib/shared';

const MAX_ATTEMPTS = 3;

export default function BiometricLockScreen() {
  const router = useRouter();
  const markAuthenticated = useBiometricStore((s) => s.markAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | 'none'>('none');

  useEffect(() => {
    getBiometricType().then(setBiometricType);
    triggerAuth();
  }, []);

  async function triggerAuth() {
    setLoading(true);
    const success = await authenticateWithBiometric('Vérifiez votre identité pour continuer');
    setLoading(false);

    if (success) {
      markAuthenticated();
      router.replace('/(tabs)' as never);
      return;
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    if (newAttempts >= MAX_ATTEMPTS) {
      logout();
      router.replace('/(auth)/login' as never);
    }
  }

  const icon = biometricType === 'face' ? 'scan-outline' : 'finger-print-outline';
  const label = biometricType === 'face' ? 'Face ID' : 'Empreinte digitale';
  const remaining = MAX_ATTEMPTS - attempts;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="lock-closed" size={40} color={COLORS.primary} style={styles.lockIcon} />
        <Text style={styles.greeting}>
          {user?.name ? `Bonjour, ${user.name.split(' ')[0]}` : 'Bienvenue'}
        </Text>
        <Text style={styles.subtitle}>Vérifiez votre identité pour continuer</Text>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinner} />
        ) : (
          <TouchableOpacity style={styles.biometricBtn} onPress={triggerAuth} activeOpacity={0.8}>
            <Ionicons name={icon as any} size={56} color={COLORS.primary} />
            <Text style={styles.biometricLabel}>{label}</Text>
          </TouchableOpacity>
        )}

        {attempts > 0 && (
          <Text style={styles.attemptsText}>
            {remaining} tentative{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''}
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => { logout(); router.replace('/(auth)/login' as never); }}>
        <Text style={styles.logoutText}>Se connecter avec un autre compte</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FF', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 60, paddingHorizontal: 32 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  lockIcon: { marginBottom: 8 },
  greeting: { fontSize: 26, fontWeight: '700', color: COLORS.primary, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  biometricBtn: { alignItems: 'center', gap: 12, padding: 24, borderRadius: 24, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4, marginTop: 8 },
  biometricLabel: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  spinner: { marginVertical: 32 },
  attemptsText: { fontSize: 13, color: '#EF4444', marginTop: 8 },
  logoutBtn: { paddingVertical: 12 },
  logoutText: { fontSize: 14, color: '#9CA3AF', textDecorationLine: 'underline' },
});
