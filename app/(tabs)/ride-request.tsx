import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Car, Users, Clock, X, Check } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS, formatCurrency } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { driverApi, type RideRequest } from '../../services/api';

const COUNTDOWN_SECONDS = 30;

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
    router.replace('/(tabs)');
  };

  const handleAccept = async () => {
    if (!ride || decided) return;
    setDecided(true);
    if (timerRef.current) clearInterval(timerRef.current);
    setLoading(true);
    try {
      await driverApi.acceptBooking(token, ride.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Course acceptée !', text2: 'Dirigez-vous vers l\'aéroport.' });
      router.replace('/(tabs)');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? 'Impossible d\'accepter.' });
      router.replace('/(tabs)');
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
      router.replace('/(tabs)');
    } catch {
      router.replace('/(tabs)');
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

  const progress = countdown / COUNTDOWN_SECONDS;
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
          <Text style={styles.rideTitle}>Nouvelle demande de course</Text>

          <View style={styles.infoRow}>
            <MapPin size={18} color={COLORS.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Destination</Text>
              <Text style={styles.infoValue}>{ride.destination}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Car size={18} color={COLORS.grayDark} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Aéroport de départ</Text>
              <Text style={styles.infoValue}>{ride.departureAirport}</Text>
            </View>
          </View>

          {ride.flightNumber && (
            <View style={styles.infoRow}>
              <Clock size={18} color={COLORS.grayDark} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Vol</Text>
                <Text style={styles.infoValue}>{ride.flightNumber}</Text>
              </View>
            </View>
          )}

          <View style={styles.infoRow}>
            <Users size={18} color={COLORS.grayDark} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Passagers / Type</Text>
              <Text style={styles.infoValue}>{ride.seats} pers. — {ride.vehicleType}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Tarif estimé</Text>
            <Text style={styles.priceValue}>{formatCurrency(ride.estimatedPrice)}</Text>
          </View>
        </View>

        {/* Actions */}
        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: SPACING.lg }} />
        ) : (
          <View style={styles.actions}>
            <Pressable style={styles.declineBtn} onPress={handleDecline} disabled={decided}>
              <X size={22} color={COLORS.error} strokeWidth={2.5} />
              <Text style={styles.declineBtnText}>Refuser</Text>
            </Pressable>
            <Pressable style={styles.acceptBtn} onPress={handleAccept} disabled={decided}>
              <Check size={22} color={COLORS.white} strokeWidth={2.5} />
              <Text style={styles.acceptBtnText}>Accepter</Text>
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
  rideTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black, marginBottom: SPACING.md },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: COLORS.grayMedium, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '600', color: COLORS.black },

  priceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: `${COLORS.primary}08`, borderRadius: 12, padding: SPACING.sm,
    marginTop: SPACING.xs,
  },
  priceLabel: { fontSize: 13, color: COLORS.grayDark, fontWeight: '500' },
  priceValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },

  actions: { flexDirection: 'row', gap: SPACING.sm },
  declineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: `${COLORS.error}12`,
    borderRadius: BORDER_RADIUS.button, paddingVertical: 16,
    borderWidth: 1.5, borderColor: `${COLORS.error}44`,
  },
  declineBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.error },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.button, paddingVertical: 16,
  },
  acceptBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
