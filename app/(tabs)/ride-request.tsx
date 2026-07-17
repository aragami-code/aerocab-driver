import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin, Plane, ChevronRight, Check, X, CalendarClock,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDriverConfigStore, useCurrencySymbol } from '../../stores/configStore';
import { driverApi, type RideRequest } from '../../services/api';

const COUNTDOWN_SECONDS = 30;
const THUMB_SIZE = 52;
const TRACK_PADDING = 4;

// ── Currency helper ───────────────────────────────────────────────────────────
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

function formatCountdown(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ── Swipe to Accept ───────────────────────────────────────────────────────────
function SwipeToAccept({ onAccept, disabled }: { onAccept: () => void; disabled: boolean }) {
  const trackWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .enabled(!disabled)
    .onUpdate((e) => {
      const max = Math.max(0, trackWidth.value - THUMB_SIZE - TRACK_PADDING * 2);
      translateX.value = Math.max(0, Math.min(e.translationX, max));
    })
    .onEnd(() => {
      const max = Math.max(0, trackWidth.value - THUMB_SIZE - TRACK_PADDING * 2);
      if (max > 0 && translateX.value > max * 0.75) {
        translateX.value = withSpring(max);
        onAccept();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const labelStyle = useAnimatedStyle(() => {
    const max = Math.max(1, trackWidth.value - THUMB_SIZE - TRACK_PADDING * 2);
    return { opacity: Math.max(0, 1 - (translateX.value / max) * 2.5) };
  });

  return (
    <View
      style={styles.swipeTrack}
      onLayout={(e) => { trackWidth.value = e.nativeEvent.layout.width; }}
    >
      <Animated.Text style={[styles.swipeLabel, labelStyle]}>
        Glisser pour accepter la course
      </Animated.Text>
      <ChevronRight size={14} color={`${COLORS.primary}44`} style={styles.swipeArrow} />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.swipeThumb, thumbStyle]}>
          <Check size={22} color={COLORS.white} strokeWidth={2.5} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function RideRequestScreen() {
  const token = useAuthStore((s) => s.token)!;
  const driverPhone = useAuthStore((s) => s.user?.phone ?? '');
  const tariffsRaw = useDriverConfigStore((s) => s.getSetting('tariffs_config', '{}'));
  const params = useLocalSearchParams<{ rideJson: string }>();

  const fcfaPerPoint: number = (() => {
    try { return JSON.parse(tariffsRaw).fcfaPerPoint ?? 10; } catch { return 10; }
  })();
  const sym = useCurrencySymbol();
  const currencySymbol = sym;

  const [ride, setRide] = useState<RideRequest | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [loading, setLoading] = useState(false);
  const [decided, setDecided] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (params.rideJson) {
      try {
        // Nouvelle demande : réinitialiser tout l'état pour éviter le blocage UI
        // quand Expo Router réutilise le composant (replace vers le même screen)
        if (timerRef.current) clearInterval(timerRef.current);
        setRide(JSON.parse(params.rideJson));
        setDecided(false);
        setCountdown(COUNTDOWN_SECONDS);
      } catch { /* JSON invalide */ }
    }
  }, [params.rideJson]);

  useEffect(() => {
    if (!ride || decided) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); handleTimeout(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ride, decided]);

  const handleTimeout = () => {
    if (decided) return;
    setDecided(true);
    // Libère le dispatch lock côté backend même sans déclin explicite du chauffeur
    if (ride) driverApi.declineBooking(token, ride.id).catch(() => {});
    Toast.show({ type: 'info', text1: 'Temps écoulé', text2: 'La demande a été passée à un autre chauffeur.' });
    router.replace({ pathname: '/(tabs)', params: { clearRequest: ride?.id ?? '' } } as never);
  };

  const handleAccept = async () => {
    if (!ride || decided) return;
    setDecided(true);
    if (timerRef.current) clearInterval(timerRef.current);
    setLoading(true);
    try {
      await driverApi.acceptBooking(token, ride.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Course acceptée !',
        text2: ride.type === 'DEPARTURE' ? 'Allez chercher le passager.' : 'Dirigez-vous vers l\'aéroport.',
      });
      const immediateRide = JSON.stringify({
        id: ride.id, status: 'confirmed', passengerId: ride.passengerId,
        passengerName: ride.passengerName, passengerPhone: null,
        passengerAvatarUrl: ride.passengerAvatarUrl ?? null,
        passengerVerified: ride.passengerVerified ?? false,
        flightNumber: ride.flightNumber, flightStatus: null,
        destination: ride.destination, vehicleType: ride.vehicleType,
        estimatedPrice: ride.estimatedPrice, departureAirport: ride.departureAirport,
        shareTripEnabled: false, type: ride.type ?? 'ARRIVAL', pickupAddress: ride.pickupAddress,
        pricingMode: ride.pricingMode ?? 'kilometrage',
        distanceKm: ride.distanceKm,
        durationMin: ride.durationMin,
      });
      router.replace({ pathname: '/(tabs)', params: { immediateRide } } as never);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? 'Impossible d\'accepter.' });
      router.replace({ pathname: '/(tabs)', params: { clearRequest: ride?.id ?? '' } } as never);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!ride || decided) return;
    setDecided(true);
    if (timerRef.current) clearInterval(timerRef.current);
    setLoading(true);
    try {
      await driverApi.declineBooking(token, ride.id);
    } catch { /* non bloquant */ } finally {
      setLoading(false);
      router.replace({ pathname: '/(tabs)', params: { clearRequest: ride?.id ?? '' } } as never);
    }
  };

  if (!ride) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const isUrgent = countdown <= 10;
  const localAmount = Math.round(ride.estimatedPrice * fcfaPerPoint);

  // Type label
  const typeLabel =
    ride.type === 'INTERNATIONAL' ? 'INTERNATIONAL' :
    ride.type === 'DEPARTURE'     ? 'DÉPART' : 'ARRIVÉE';

  const pickupLabel = ride.type === 'DEPARTURE' ? (ride.pickupAddress ?? 'Lieu de départ') : ride.departureAirport;
  const destLabel   = ride.type === 'DEPARTURE' ? ride.departureAirport : ride.destination;

  const pricingLabel = 'Zone';

  // Réservation programmée : afficher l'heure prévue (fuseau local de l'appareil)
  const isScheduled = ride.isScheduled === true || !!ride.scheduledAt;
  const scheduledDate = ride.scheduledAt ? new Date(ride.scheduledAt) : null;
  const scheduledLabel = scheduledDate && !isNaN(scheduledDate.getTime())
    ? scheduledDate.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>

        {/* Card principale */}
        <View style={styles.card}>

          {/* En-tête : titre + countdown */}
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardSub}>Nouvelle demande</Text>
              <Text style={styles.cardTitle}>Course aéroport</Text>
            </View>
            <View style={[styles.countdownBadge, isUrgent && styles.countdownBadgeUrgent]}>
              <Text style={[styles.countdownText, isUrgent && styles.countdownTextUrgent]}>
                {formatCountdown(countdown)}
              </Text>
            </View>
          </View>

          {/* Bannière réservation programmée */}
          {isScheduled && (
            <View style={styles.scheduledBanner}>
              <CalendarClock size={16} color="#E65100" strokeWidth={2.5} />
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduledBannerTitle}>Course programmée</Text>
                <Text style={styles.scheduledBannerSub}>
                  {scheduledLabel
                    ? `Prise en charge prévue le ${scheduledLabel}`
                    : 'Prise en charge à une heure planifiée'}
                </Text>
              </View>
            </View>
          )}

          {/* Passager */}
          <View style={styles.passengerRow}>
            {ride.passengerAvatarUrl ? (
              <Image source={{ uri: ride.passengerAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(ride.passengerName ?? 'C')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.passengerInfo}>
              <Text style={styles.passengerName}>{ride.passengerName ?? 'Client'}</Text>
              <View style={styles.passengerMeta}>
                {ride.passengerTrustScore !== undefined && (
                  <View style={[styles.trustBadge, {
                    backgroundColor:
                      ride.passengerTrustScore >= 4.5 ? '#22C55E20' :
                      ride.passengerTrustScore >= 4.0 ? '#84CC1620' :
                      ride.passengerTrustScore >= 3.5 ? '#EAB30820' :
                      ride.passengerTrustScore >= 3.0 ? '#F9731620' : '#EF444420',
                  }]}>
                    <Text style={[styles.trustText, {
                      color:
                        ride.passengerTrustScore >= 4.5 ? '#22C55E' :
                        ride.passengerTrustScore >= 4.0 ? '#84CC16' :
                        ride.passengerTrustScore >= 3.5 ? '#EAB308' :
                        ride.passengerTrustScore >= 3.0 ? '#F97316' : '#EF4444',
                    }]}>
                      ★ {ride.passengerTrustScore.toFixed(1)}
                    </Text>
                  </View>
                )}
                {ride.passengerVerified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>✓ Client vérifié</Text>
                  </View>
                )}
                {ride.isFavoritePassenger && (
                  <View style={styles.favoriteBadge}>
                    <Text style={styles.favoriteText}>⭐ Client fidèle</Text>
                  </View>
                )}
                {/* Type badge */}
                <View style={[styles.typeBadge,
                  ride.type === 'INTERNATIONAL' ? { backgroundColor: '#7B1FA2' } :
                  ride.type === 'DEPARTURE'     ? { backgroundColor: COLORS.accent } :
                                                  { backgroundColor: COLORS.primary }
                ]}>
                  {ride.type === 'INTERNATIONAL' && <Plane size={9} color={COLORS.white} strokeWidth={2.5} />}
                  <Text style={styles.typeBadgeText}>{typeLabel}</Text>
                </View>
              </View>
            </View>
            {/* Prix */}
            <View style={styles.priceBlock}>
              <Text style={styles.priceFcfa}>
                {localAmount.toLocaleString()} {currencySymbol}
              </Text>
              <Text style={styles.pricePts}>{ride.estimatedPrice.toLocaleString()} pts</Text>
            </View>
          </View>

          {/* Meet & Greet — pancarte au nom du passager */}
          {ride.meetAndGreet && (
            <View style={styles.meetGreetBox}>
              <Text style={styles.meetGreetText}>🪧 Meet & Greet — pancarte au nom de « {ride.passengerName ?? 'Client'} »</Text>
            </View>
          )}

          {/* Itinéraire */}
          <View style={styles.routeBox}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: COLORS.success }]} />
              <View style={styles.routeText}>
                <Text style={styles.routeLabel}>Prise en charge</Text>
                <Text style={styles.routeValue} numberOfLines={1}>{pickupLabel}</Text>
              </View>
            </View>
            <View style={styles.routeDivider} />
            <View style={styles.routeRow}>
              <MapPin size={10} color={COLORS.primary} />
              <View style={styles.routeText}>
                <Text style={styles.routeLabel}>Destination</Text>
                <Text style={styles.routeValue} numberOfLines={1}>{destLabel}</Text>
              </View>
            </View>
          </View>

          {/* Stats 3 colonnes */}
          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>
                {ride.distanceKm != null ? `${ride.distanceKm} km` : '—'}
              </Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={[styles.statCell, styles.statCellBorder]}>
              <Text style={styles.statValue}>
                {ride.durationMin != null ? `${ride.durationMin} min` : '—'}
              </Text>
              <Text style={styles.statLabel}>Durée</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{pricingLabel}</Text>
              <Text style={styles.statLabel}>Type</Text>
            </View>
          </View>

          {/* Extras : vol */}
          {ride.flightNumber && (
            <View style={styles.extraRow}>
              <Plane size={12} color={COLORS.grayMedium} />
              <Text style={styles.extraText}>Vol {ride.flightNumber}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: SPACING.lg }} />
        ) : (
          <View style={styles.actions}>
            <SwipeToAccept onAccept={handleAccept} disabled={decided} />
            <Pressable
              style={styles.declineBtn}
              onPress={handleDecline}
              disabled={decided}
              accessibilityLabel="Refuser la course"
            >
              <X size={16} color={COLORS.error} strokeWidth={2.5} />
              <Text style={styles.declineBtnText}>Refuser</Text>
            </Pressable>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, padding: SPACING.lg, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  cardSub: { fontSize: 12, color: COLORS.grayMedium, fontWeight: '500', marginBottom: 2 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: COLORS.black },

  countdownBadge: {
    backgroundColor: `${COLORS.success}18`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: `${COLORS.success}40`,
  },
  countdownBadgeUrgent: {
    backgroundColor: `${COLORS.error}18`,
    borderColor: `${COLORS.error}40`,
  },
  countdownText: { fontSize: 15, fontWeight: '800', color: COLORS.success },
  countdownTextUrgent: { color: COLORS.error },

  // ── Bannière réservation programmée ───────────────────────────────────────
  scheduledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  scheduledBannerTitle: { fontSize: 14, fontWeight: '800', color: '#E65100' },
  scheduledBannerSub: { fontSize: 12, color: '#A1620A', marginTop: 1 },

  // ── Passager ──────────────────────────────────────────────────────────────
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: SPACING.md,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: `${COLORS.primary}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  passengerInfo: { flex: 1 },
  passengerName: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginBottom: 4 },
  passengerMeta: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  trustBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  trustText: { fontSize: 11, fontWeight: '700' },
  verifiedBadge: {
    backgroundColor: `${COLORS.success}18`,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  verifiedText: { fontSize: 10, fontWeight: '600', color: COLORS.success },
  favoriteBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  favoriteText: { fontSize: 10, fontWeight: '700', color: '#D97706' },
  meetGreetBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  meetGreetText: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20,
  },
  typeBadgeText: { fontSize: 9, fontWeight: '800', color: COLORS.white },

  priceBlock: { alignItems: 'flex-end' },
  priceFcfa: { fontSize: 18, fontWeight: '800', color: COLORS.accent },
  pricePts: { fontSize: 11, color: COLORS.grayMedium, fontWeight: '500', marginTop: 1 },

  // ── Itinéraire ────────────────────────────────────────────────────────────
  routeBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.sm + 4,
    marginBottom: SPACING.md,
    gap: 6,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeText: { flex: 1 },
  routeLabel: { fontSize: 10, fontWeight: '600', color: COLORS.grayMedium, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1 },
  routeValue: { fontSize: 13, fontWeight: '600', color: COLORS.black },
  routeDivider: { height: 1, backgroundColor: COLORS.grayLight, marginLeft: 20 },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  statCell: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
  },
  statCellBorder: {
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.grayLight,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: COLORS.black },
  statLabel: { fontSize: 10, color: COLORS.grayMedium, fontWeight: '500', marginTop: 2 },

  // ── Extras ────────────────────────────────────────────────────────────────
  extraRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 6,
  },
  extraText: { fontSize: 12, color: COLORS.grayMedium, fontWeight: '500' },

  // ── Actions ───────────────────────────────────────────────────────────────
  actions: { gap: SPACING.sm },

  swipeTrack: {
    height: 60,
    backgroundColor: `${COLORS.accent}18`,
    borderRadius: 30,
    padding: TRACK_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: `${COLORS.accent}50`,
  },
  swipeThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  swipeLabel: {
    position: 'absolute',
    left: THUMB_SIZE + TRACK_PADDING + 12,
    right: 12,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  swipeArrow: { position: 'absolute', right: 18 },

  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: BORDER_RADIUS.button,
    borderWidth: 1.5,
    borderColor: `${COLORS.error}50`,
    backgroundColor: COLORS.white,
  },
  declineBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.error },
});
