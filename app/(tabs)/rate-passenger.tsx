import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDriverConfigStore, useCurrencySymbol } from '../../stores/configStore';
import { driverApi } from '../../services/api';

const PHONE_CURRENCY: Record<string, string> = {
  '+237': 'FCFA', '+221': 'FCFA', '+225': 'FCFA', '+242': 'FCFA',
  '+241': 'FCFA', '+235': 'FCFA', '+236': 'FCFA', '+240': 'FCFA',
  '+254': 'KSh',  '+234': '₦',   '+212': 'Dh',   '+33': '€', '+233': 'GH₵',
};
function getCurrencySymbol(phone: string): string {
  for (const prefix of Object.keys(PHONE_CURRENCY)) {
    if (phone.startsWith(prefix)) return PHONE_CURRENCY[prefix];
  }
  return 'FCFA';
}

export default function RatePassengerScreen() {
  const token = useAuthStore((s) => s.token)!;
  const driverPhone = useAuthStore((s) => s.user?.phone ?? '');
  const tariffsRaw = useDriverConfigStore((s) => s.getSetting('tariffs_config', '{}'));
  const params = useLocalSearchParams<{
    passengerId: string;
    bookingId: string;
    conversationId?: string;
    passengerName?: string;
    passengerAvatarUrl?: string;
    passengerVerified?: string;
    estimatedPrice?: string;
    distanceKm?: string;
    durationMin?: string;
    pricingMode?: string;
    departureAirport?: string;
    destination?: string;
  }>();

  const fcfaPerPoint: number = (() => {
    try { return JSON.parse(tariffsRaw).fcfaPerPoint ?? 10; } catch { return 10; }
  })();
  const sym = useCurrencySymbol();
  const currencySymbol = sym;

  const estimatedPrice = parseFloat(params.estimatedPrice ?? '0') || 0;
  const localAmount    = Math.round(estimatedPrice * fcfaPerPoint);
  const distanceKm     = params.distanceKm && params.distanceKm !== '' ? parseFloat(params.distanceKm) : null;
  const durationMin    = params.durationMin && params.durationMin !== '' ? parseInt(params.durationMin) : null;
  const isVerified     = params.passengerVerified === 'true';
  const pricingLabel   = 'Zone tarifaire';

  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleStarPress = (s: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScore(s);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (score > 0) {
        await driverApi.ratePassenger(token, {
          toUserId: params.passengerId,
          conversationId: params.conversationId || undefined,
          bookingId: params.bookingId || undefined,
          score,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: err?.message || 'Impossible d\'envoyer la note.' });
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Résumé du trajet</Text>
            <Text style={styles.subtitle}>Tout s'est bien passé 👍</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Course terminée</Text>
          </View>
        </View>

        {/* Gain total */}
        <View style={styles.gainCard}>
          <Text style={styles.gainLabel}>Gain total</Text>
          <Text style={styles.gainAmount}>
            {localAmount.toLocaleString()} {currencySymbol}
          </Text>
          {estimatedPrice > 0 && (
            <Text style={styles.gainPts}>{estimatedPrice.toLocaleString()} pts</Text>
          )}
        </View>

        {/* Détails trajet */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Distance</Text>
            <Text style={styles.detailValue}>{distanceKm != null ? `${distanceKm} km` : '—'}</Text>
          </View>
          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Text style={styles.detailLabel}>Durée</Text>
            <Text style={styles.detailValue}>{durationMin != null ? `${durationMin} min` : '—'}</Text>
          </View>
          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{pricingLabel}</Text>
          </View>
          {/* Route */}
          {(params.departureAirport || params.destination) && (
            <View style={[styles.routeRow, styles.detailRowBorder]}>
              <View style={styles.routeDot} />
              <Text style={styles.routeStop} numberOfLines={1}>{params.departureAirport ?? '—'}</Text>
              <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.routeStop} numberOfLines={1}>{params.destination ?? '—'}</Text>
            </View>
          )}
        </View>

        {/* Passager */}
        <View style={styles.passengerCard}>
          <View style={styles.passengerRow}>
            {params.passengerAvatarUrl ? (
              <Image source={{ uri: params.passengerAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(params.passengerName ?? 'C')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.passengerInfo}>
              <Text style={styles.passengerName}>{params.passengerName || 'Passager'}</Text>
              {isVerified && <Text style={styles.verifiedText}>Client vérifié</Text>}
            </View>
          </View>
          {/* Paiement reçu */}
          <View style={styles.paymentBadge}>
            <Text style={styles.paymentBadgeText}>✓ Paiement reçu</Text>
          </View>
        </View>

        {/* Notation */}
        <View style={styles.ratingCard}>
          <Text style={styles.ratingTitle}>Noter le client</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable key={s} onPress={() => handleStarPress(s)} style={styles.starBtn}>
                <Star
                  size={40}
                  color={s <= score ? COLORS.accent : COLORS.grayLight}
                  fill={s <= score ? COLORS.accent : 'transparent'}
                  strokeWidth={1.5}
                />
              </Pressable>
            ))}
          </View>
          {score > 0 && (
            <Text style={styles.scoreLabel}>
              {score === 1 ? '😞 Très mauvais' :
               score === 2 ? '😕 Mauvais' :
               score === 3 ? '😐 Correct' :
               score === 4 ? '😊 Bien' : '😁 Excellent !'}
            </Text>
          )}
        </View>

        {/* Bouton principal */}
        <Pressable
          style={[styles.submitBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.submitBtnText}>
                {score > 0 ? 'Envoyer & Nouvelle course' : 'Nouvelle course'}
              </Text>
          }
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: SPACING.md,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.black },
  subtitle: { fontSize: 13, color: COLORS.grayMedium, marginTop: 2 },
  statusBadge: {
    backgroundColor: `${COLORS.success}20`,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: `${COLORS.success}40`,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.success },

  // ── Gain ─────────────────────────────────────────────────────────────────
  gainCard: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  gainLabel: { fontSize: 12, color: `${COLORS.white}88`, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  gainAmount: { fontSize: 32, fontWeight: '800', color: COLORS.accent },
  gainPts: { fontSize: 13, color: `${COLORS.white}66`, fontWeight: '500', marginTop: 2 },

  // ── Détails ───────────────────────────────────────────────────────────────
  detailsCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 13,
  },
  detailRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.grayLight },
  detailLabel: { fontSize: 13, color: COLORS.grayMedium, fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  routeRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingVertical: 12,
  },
  routeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success, flexShrink: 0 },
  routeStop: { flex: 1, fontSize: 13, color: COLORS.grayDark, fontWeight: '500' },

  // ── Passager ──────────────────────────────────────────────────────────────
  passengerCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, marginBottom: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.sm },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: `${COLORS.primary}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  passengerInfo: { flex: 1 },
  passengerName: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  verifiedText: { fontSize: 12, color: COLORS.grayMedium, marginTop: 2 },

  paymentBadge: {
    backgroundColor: `${COLORS.success}15`,
    borderRadius: 20, paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1, borderColor: `${COLORS.success}30`,
  },
  paymentBadgeText: { fontSize: 13, fontWeight: '700', color: COLORS.success },

  // ── Notation ──────────────────────────────────────────────────────────────
  ratingCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, marginBottom: SPACING.lg,
    borderWidth: 1.5, borderColor: COLORS.grayLight,
  },
  ratingTitle: { fontSize: 15, fontWeight: '700', color: COLORS.black, marginBottom: SPACING.md },
  starsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  starBtn: { padding: 4 },
  scoreLabel: {
    textAlign: 'center', fontSize: 14, fontWeight: '600',
    color: COLORS.grayDark, marginTop: SPACING.sm,
  },

  // ── Bouton ────────────────────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.button,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
