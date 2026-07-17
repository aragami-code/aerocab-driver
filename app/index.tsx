import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useBiometricStore } from '../stores/biometricStore';
import { driverApi } from '../services/api';
import { COLORS } from '../lib/shared';

export default function Index() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const requiresAuth = useBiometricStore((s) => s.requiresAuth);
  const [kycStatus, setKycStatus] = useState<'loading' | 'approved' | 'fee_required' | 'pending' | 'rejected' | 'suspended'>('loading');
  const retryCount = useRef(0);
  // Ce composant reste monté en arrière-plan après la première navigation.
  // On s'assure de n'exécuter le check KYC qu'une seule fois (démarrage froid).
  const didCheckRef = useRef(false);

  useEffect(() => {
    // Déjà vérifié (re-login depuis les tabs) → ne pas interférer
    if (didCheckRef.current) return;
    didCheckRef.current = true;

    if (!token || !user) {
      setKycStatus('pending'); // pas connecté → redirect login
      return;
    }

    retryCount.current = 0;

    const checkProfile = async () => {
      try {
        const profile = await driverApi.getMyProfile(token);
        if (profile.status === 'approved' && !profile.registrationFeePaid) {
          setKycStatus('fee_required');
        } else {
          setKycStatus(profile.status);
        }
      } catch {
        // D2 — En cas d'erreur réseau, on réessaie une fois après 3s
        if (retryCount.current < 1) {
          retryCount.current += 1;
          setTimeout(checkProfile, 3000);
        } else {
          setKycStatus('pending');
        }
      }
    };

    checkProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // [] = cold start only — intentionally not re-runs on token change

  if (!token || !user) return <Redirect href="/(auth)/login" />;

  if (kycStatus === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (kycStatus === 'approved') {
    if (requiresAuth()) return <Redirect href={'/biometric-lock' as never} />;
    return <Redirect href="/(tabs)" />;
  }

  if (kycStatus === 'fee_required') {
    return <Redirect href={'/registration-fee' as never} />;
  }

  return <Redirect href={'/pending-review' as never} />;
}
