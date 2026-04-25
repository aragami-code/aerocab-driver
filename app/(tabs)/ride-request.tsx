import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Car, Users, Clock, X, Check, Moon, CloudRain, Package, Plane, ChevronRight } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { driverApi, type RideRequest } from '../../services/api';

const COUNTDOWN_SECONDS = 30;
const THUMB_SIZE = 56;
const TRACK_PADDING = 4;

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
    const progress = translateX.value / max;
    return { opacity: Math.max(0, 1 - progress * 2.5) };
  });

  return (
    <View
      style={styles.swipeTrack}
      onLayout={(e) => { trackWidth.value = e.nativeEvent.layout.width; }}
    >
      <Animated.Text style={[styles.swipeLabel, labelStyle]}>
        Glisser pour accepter
      </Animated.Text>
      <ChevronRight size={16} color={`${COLORS.primary}55`} style={styles.swipeArrow} />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.swipeThumb, thumbStyle]}>
          <Check size={24} color={COLORS.white} strokeWidth={2.5} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default function RideRequestScreen() {
  const token = useAuthStore((s) => s.token)!;
  const params = useLocalSearchParams<{ rideJson: string }>();

  const [ride, setRide] = useState<RideRequest | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [loading, setLoading] = useState(false);
  const [decided, setDecided] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (params.rideJson) {
      try {
        setRide(JSON.parse(params.rideJson));
      } catch { /* invalid JSON */ }
    }
  }, [params.rideJson]);

  // Countdown timer
  useEffect(() => {
    if (!ride || decided) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ride, decided]);

  const handleTimeout = () => {
    if (decided) return;
    setDecided(true);
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
      const isDeparture = ride.type === 'DEPARTURE';
      Toast.show({
        type: 'success',
        text1: 'Course acceptée !',
        text2: isDeparture ? 'Allez chercher le passager.' : 'Dirigez-vous vers l\'aéroport.'
      });
      const immediateRide = JSON.stringify({
        id: ride.id,
        status: 'confirmed',
        passengerId: ride.passengerId,
        passengerName: ride.passengerName,
        passengerPhone: null,
        flightNumber: ride.flightNumber,
        flightStatus: null,
        destination: ride.destination,
        vehicleType: ride.vehicleType,
        estimatedPrice: ride.estimatedPrice,
        departureAirport: ride.departureAirport,
        shareTripEnabled: false,
        type: ride.type ?? 'ARRIVAL',
        pickupAddress: ride.pickupAddress,
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
      router.replace({ pathname: '/(tabs)', params: { clearRequest: ride.id } } as never);
    } catch {
      router.replace({ pathname: '/(tabs)', params: { clearRequest: ride?.id ?? '' } } as never);
    } finally {
      setLoading(false);
    }
  };

  if (!ride) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const urgentColor = countdown <= 10 ? COLORS.error : COLORS.primary;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>

        {/* Countdown ring */}
        <View style={styles.countdownContainer}>
          <View style={[styles.countdownRing, { borderColor: urgentColor }]}>
            <Clock size={20} color={urgentColor} />
            <Text style={[styles.countdownText, { color: urgentColor }]}>{countdown}s</Text>
          </View>
          <Text style={styles.countdownLabel}>Répondez avant expiration</Text>
        </View>

        {/* Ride card */}
        <View style={styles.rideCard}>
          <View style={styles.badgeRow}>
            <Text style={styles.rideTitle}>Nouvelle demande</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {ride.type === 'INTERNATIONAL' && (
                <View style={[styles.typeBadge, { backgroundColor: '#7B1FA2', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                  <Plane size={11} color={COLORS.white} strokeWidth={2.5} />
                  <Text style={styles.typeBadgeText}>INTERNATIONAL</Text>
                </View>
              )}
              {ride.type === 'DEPARTURE' && (
                <View style={[styles.typeBadge, { backgroundColor: COLORS.accent }]}>
                  <Text style={styles.typeBadgeText}>DÉPART</Text>
                </View>
              )}
              {(!ride.type || ride.type === 'ARRIVAL') && (
                <View style={[styles.typeBadge, { backgroundColor: COLORS.primary }]}>
                  <Text style={styles.typeBadgeText}>ARRIVÉE</Text>
                </View>
              )}
              {ride.pricingMode === 'forfait' && (
                <View style={[styles.typeBadge, { backgroundColor: '#0EA5E9' }]}>
                  <Text style={styles.typeBadgeText}>FORFAIT</Text>
                </View>
              )}
            </View>
          </View>

          {/* Destination */}
          <View style={styles.infoRow}>
            <MapPin size={18} color={ride.type === 'DEPARTURE' ? COLORS.accent : COLORS.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>{ride.type === 'DEPARTURE' ? 'Déposer à' : 'Destination'}</Text>
              <Text style={styles.infoValue}>{ride.type === 'DEPARTURE' ? ride.departureAirport : ride.destination}</Text>
            </View>
          </View>

          {/* Prise en charge (DEPARTURE) */}
          {ride.type === 'DEPARTURE' && ride.pickupAddress && (
            <View style={styles.infoRow}>
              <Car size={18} color={COLORS.primary} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Prise en charge</Text>
                <Text style={styles.infoValue}>{ride.pickupAddress}</Text>
              </View>
            </View>
          )}

          {/* Aéroport (ARRIVAL / INTERNATIONAL) */}
          {ride.type !== 'DEPARTURE' && (
            <View style={styles.infoRow}>
              <Car size={18} color={COLORS.grayDark} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Aéroport de départ</Text>
                <Text style={styles.infoValue}>{ride.departureAirport}</Text>
              </View>
            </View>
          )}

          {/* Vol */}
          {ride.flightNumber && (
            <View style={styles.infoRow}>
              <Clock size={18} color={COLORS.grayDark} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Vol</Text>
                <Text style={styles.infoValue}>{ride.flightNumber}</Text>
              </View>
            </View>
          )}

          {/* Véhicule */}
          <View style={styles.infoRow}>
            <Users size={18} color={COLORS.grayDark} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Passagers / Type</Text>
              <Text style={styles.infoValue}>{ride.seats} pers. — {ride.vehicleType}</Text>
            </View>
          </View>

          {/* Surcharges actives */}
          {ride.surgeMultiplier && ride.surgeMultiplier > 1 && (
            <View style={styles.surgeRow}>
              <Text style={styles.surgeLabel}>Surcharge ×{ride.surgeMultiplier.toFixed(2)}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {ride.nightSurge    && <View style={styles.surgeBadge}><Moon      size={11} color="#5C6BC0" /><Text style={[styles.surgeBadgeText, { color: '#5C6BC0' }]}>Nuit</Text></View>}
                {ride.rainSurge     && <View style={styles.surgeBadge}><CloudRain size={11} color="#0288D1" /><Text style={[styles.surgeBadgeText, { color: '#0288D1' }]}>Pluie</Text></View>}
              </View>
            </View>
          )}

          {/* Consigne */}
          {ride.withConsigne && (
            <View style={styles.consigneRow}>
              <Package size={14} color="#7B1FA2" />
              <Text style={styles.consigneText}>
                Consigne : {ride.consigneDays}j × {ride.consigneDailyRate?.toLocaleString()} F = {ride.consigneTotal?.toLocaleString()} F
              </Text>
            </View>
          )}

          {/* Prix */}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Gains estimés</Text>
            <Text style={styles.priceValue}>{ride.estimatedPrice.toLocaleString()} pts</Text>
          </View>
        </View>

        {/* Actions */}
        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: SPACING.lg }} />
        ) : (
          <View style={styles.actions}>
            <Pressable
              style={styles.declineBtn}
              onPress={handleDecline}
              disabled={decided}
              accessibilityLabel="Refuser la course"
            >
              <X size={22} color={COLORS.error} strokeWidth={2.5} />
              <Text style={styles.declineBtnText}>Refuser</Text>
            </Pressable>
            <View style={{ flex: 2 }}>
              <SwipeToAccept onAccept={handleAccept} disabled={decided} />
            </View>
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

  countdownContainer: { alignItems: 'center', marginBottom: SPACING.lg },
  countdownRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, alignItems: 'center', justifyContent: 'center',
    gap: 2, marginBottom: SPACING.xs,
  },
  countdownText: { fontSize: 20, fontWeight: '800' },
  countdownLabel: { fontSize: 13, color: COLORS.grayMedium },

  rideCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg, marginBottom: SPACING.lg,
    borderWidth: 1.5, borderColor: COLORS.grayLight,
  },
  rideTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  typeBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.white },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: COLORS.grayMedium, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '600', color: COLORS.black },

  priceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: `${COLORS.accent}12`, borderRadius: 12, padding: SPACING.sm,
    marginTop: SPACING.xs,
  },
  priceLabel: { fontSize: 13, color: COLORS.grayDark, fontWeight: '500' },
  priceValue: { fontSize: 20, fontWeight: '800', color: COLORS.accent },

  actions: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'stretch' },
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: `${COLORS.error}12`,
    borderRadius: BORDER_RADIUS.button, paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: `${COLORS.error}44`,
  },
  declineBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.error },

  // Swipe to accept
  swipeTrack: {
    height: 64,
    backgroundColor: `${COLORS.primary}12`,
    borderRadius: 32,
    padding: TRACK_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}30`,
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
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  swipeArrow: {
    position: 'absolute',
    right: 20,
  },

  surgeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF8E1', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
    borderWidth: 1, borderColor: '#FFE082',
  },
  surgeLabel: { fontSize: 12, fontWeight: '700', color: '#7B5E00' },
  surgeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.white, borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  surgeBadgeText: { fontSize: 10, fontWeight: '600' },

  consigneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F3E5F5', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },
  consigneText: { fontSize: 12, fontWeight: '600', color: '#7B1FA2', flex: 1 },
});
