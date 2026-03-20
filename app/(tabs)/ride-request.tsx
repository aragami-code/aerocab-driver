import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Clock, Car } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, formatCurrency } from '@aerocab/shared';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

const TIMEOUT_SECONDS = 30;

export default function RideRequestScreen() {
  const { rideJson } = useLocalSearchParams<{ rideJson: string }>();
  const token = useAuthStore((s) => s.token)!;
  const [timer, setTimer] = useState(TIMEOUT_SECONDS);
  const [loading, setLoading] = useState(false);

  const ride = rideJson ? JSON.parse(rideJson) : null;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async () => {
    if (!ride) return;
    setLoading(true);
    try {
      await api.acceptBooking(token, ride.id);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!ride) { router.replace('/(tabs)'); return; }
    try {
      await api.declineBooking(token, ride.id);
    } catch { /* ignore */ } finally {
      router.replace('/(tabs)');
    }
  };

  if (!ride) {
    router.replace('/(tabs)');
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.timerRow}>
        <Clock size={18} color={COLORS.warning} />
        <Text style={styles.timerText}>{timer}s</Text>
      </View>

      <Text style={styles.title}>Nouvelle demande de course</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <MapPin size={18} color={COLORS.primary} />
          <Text style={styles.destination}>{ride.destination ?? 'Destination inconnue'}</Text>
        </View>
        {ride.departureAirport && (
          <View style={styles.row}>
            <Car size={16} color={COLORS.grayMedium} />
            <Text style={styles.sub}>{ride.departureAirport}{ride.flightNumber ? ` — Vol ${ride.flightNumber}` : ''}</Text>
          </View>
        )}
        <Text style={styles.price}>{formatCurrency(ride.estimatedPrice ?? 0)}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.btnDecline]}
          onPress={handleDecline}
          disabled={loading}
        >
          <Text style={styles.btnText}>Refuser</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnAccept]}
          onPress={handleAccept}
          disabled={loading}
        >
          <Text style={[styles.btnText, { color: '#fff' }]}>Accepter</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.lg, justifyContent: 'center' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  timerText: { fontSize: 16, fontWeight: '700', color: COLORS.warning },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.black, marginBottom: SPACING.lg },
  card: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card, padding: SPACING.md, marginBottom: SPACING.lg, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  destination: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.black },
  sub: { fontSize: 14, color: COLORS.grayMedium },
  price: { fontSize: 22, fontWeight: '800', color: COLORS.primary, marginTop: 4 },
  actions: { flexDirection: 'row', gap: SPACING.md },
  btn: { flex: 1, borderRadius: BORDER_RADIUS.button, paddingVertical: 16, alignItems: 'center' },
  btnAccept: { backgroundColor: COLORS.primary },
  btnDecline: { backgroundColor: COLORS.grayLight },
  btnText: { fontSize: 16, fontWeight: '700', color: COLORS.black },
});
