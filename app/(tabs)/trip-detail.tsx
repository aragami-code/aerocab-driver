import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ActivityIndicator, ScrollView, Image, Share,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Share2, MapPin } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDriverConfigStore, useCurrencySymbol } from '../../stores/configStore';
import { driverApi, DriverRideDetail } from '../../services/api';

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

function formatTime(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function TripDetailScreen() {
  const token = useAuthStore((s) => s.token)!;
  const driverPhone = useAuthStore((s) => s.user?.phone ?? '');
  const tariffsRaw = useDriverConfigStore((s) => s.getSetting('tariffs_config', '{}'));
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const fcfaPerPoint: number = (() => {
    try { return JSON.parse(tariffsRaw).fcfaPerPoint ?? 10; } catch { return 10; }
  })();
  const sym = useCurrencySymbol();
  const currency = sym;

  const [ride, setRide] = useState<DriverRideDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    driverApi.getDriverRideDetail(token, bookingId)
      .then(setRide)
      .catch(() => Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger le trajet.' }))
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  const handleShare = async () => {
    if (!ride) return;
    const amount = Math.round(ride.estimatedPrice * fcfaPerPoint);
    await Share.share({
      message: `Trajet AeroCab : ${ride.departureAirport} → ${ride.destination}\nMontant : ${amount.toLocaleString()} ${currency}\nDate : ${formatDate(ride.createdAt)}`,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      </SafeAreaView>
    );
  }
  if (!ride) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><Text style={styles.errorText}>Trajet introuvable</Text></View>
      </SafeAreaView>
    );
  }

  const isCancelled = ride.status === 'cancelled';
  const amount = Math.round(ride.estimatedPrice * fcfaPerPoint);
  const pricingLabel = ride.pricingMode === 'zone' || ride.pricingMode === 'forfait' ? 'Zone tarifaire' : 'Zone';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={COLORS.black} />
        </Pressable>
        <Text style={styles.headerTitle}>Détails du trajet</Text>
        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <Share2 size={20} color={COLORS.primary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Carte statique placeholder */}
        <View style={styles.mapPlaceholder}>
          <MapPin size={32} color={COLORS.primary} />
          <Text style={styles.mapText}>{ride.departureAirport} → {ride.destination}</Text>
          <Text style={styles.mapSubText}>
            {formatDate(ride.createdAt)} · Départ {formatTime(ride.startedAt)} · Arrivée {formatTime(ride.completedAt)}
          </Text>
        </View>

        {/* Statut */}
        <View style={[styles.statusCard, isCancelled ? styles.statusCancelled : styles.statusCompleted]}>
          <Text style={[styles.statusText, isCancelled ? styles.statusTextCancelled : styles.statusTextCompleted]}>
            {isCancelled ? 'Course annulée' : 'Course terminée'}
          </Text>
        </View>

        {/* Informations */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informations</Text>
          {ride.flightNumber && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Vol</Text>
              <Text style={styles.rowValue}>{ride.flightNumber}</Text>
            </View>
          )}
          <View style={[styles.row, ride.flightNumber ? styles.rowBorder : undefined]}>
            <Text style={styles.rowLabel}>Type</Text>
            <Text style={styles.rowValue}>{pricingLabel}</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Durée estimée</Text>
            <Text style={styles.rowValue}>{ride.estimatedDurationMin != null ? `${ride.estimatedDurationMin} min` : '—'}</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Distance</Text>
            <Text style={styles.rowValue}>{ride.estimatedDistanceKm != null ? `${ride.estimatedDistanceKm} km` : '—'}</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Prise en charge</Text>
            <Text style={styles.rowValue}>{ride.departureAirport}</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Destination</Text>
            <Text style={styles.rowValue}>{ride.destination}</Text>
          </View>
        </View>

        {/* Client */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Client</Text>
          <View style={styles.passengerRow}>
            {ride.passengerAvatarUrl ? (
              <Image source={{ uri: ride.passengerAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{(ride.passengerName ?? 'C')[0].toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.passengerName}>{ride.passengerName ?? 'Client'}</Text>
          </View>
        </View>

        {/* Paiement */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paiement</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Montant total</Text>
            <Text style={[styles.rowValue, { color: COLORS.primary, fontWeight: '800', fontSize: 18 }]}>
              {amount.toLocaleString()} {currency}
            </Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Équivalent</Text>
            <Text style={styles.rowValue}>{ride.estimatedPrice} pts</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.receiptBtn}
            onPress={() => router.push({ pathname: '/(tabs)/trip-receipt' as any, params: { bookingId: ride.id } })}
          >
            <Text style={styles.receiptBtnText}>Voir le reçu</Text>
          </Pressable>
          <Pressable style={styles.shareActionBtn} onPress={handleShare}>
            <Share2 size={18} color={COLORS.primary} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15, color: COLORS.grayMedium },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm, paddingBottom: SPACING.sm,
  },
  backBtn: { padding: 4, marginRight: SPACING.sm },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.black },
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${COLORS.primary}12`, alignItems: 'center', justifyContent: 'center',
  },

  mapPlaceholder: {
    backgroundColor: `${COLORS.primary}08`, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg, alignItems: 'center', marginBottom: SPACING.md,
    borderWidth: 1, borderColor: `${COLORS.primary}20`,
  },
  mapText: { fontSize: 15, fontWeight: '700', color: COLORS.black, marginTop: SPACING.sm, textAlign: 'center' },
  mapSubText: { fontSize: 12, color: COLORS.grayMedium, marginTop: 4, textAlign: 'center' },

  statusCard: {
    borderRadius: BORDER_RADIUS.card, padding: SPACING.md,
    alignItems: 'center', marginBottom: SPACING.md,
  },
  statusCompleted: { backgroundColor: `${COLORS.success}18` },
  statusCancelled: { backgroundColor: `${COLORS.error}18` },
  statusText: { fontSize: 14, fontWeight: '700' },
  statusTextCompleted: { color: COLORS.success },
  statusTextCancelled: { color: COLORS.error },

  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.grayMedium,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.grayLight },
  rowLabel: { fontSize: 13, color: COLORS.grayMedium, fontWeight: '500' },
  rowValue: { fontSize: 14, fontWeight: '700', color: COLORS.black, textAlign: 'right', flex: 1, marginLeft: 8 },

  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: `${COLORS.primary}18`, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  passengerName: { fontSize: 15, fontWeight: '700', color: COLORS.black, flex: 1 },

  actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  receiptBtn: {
    flex: 1, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.button,
    paddingVertical: 14, alignItems: 'center',
  },
  receiptBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  shareActionBtn: {
    width: 48, height: 48, borderRadius: BORDER_RADIUS.button,
    borderWidth: 1.5, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
