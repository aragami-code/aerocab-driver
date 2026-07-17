import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ActivityIndicator, ScrollView, Share,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Download } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDriverConfigStore, useCurrencySymbol } from '../../stores/configStore';
import { driverApi, DriverRideReceipt } from '../../services/api';

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

export default function TripReceiptScreen() {
  const token = useAuthStore((s) => s.token)!;
  const driverPhone = useAuthStore((s) => s.user?.phone ?? '');
  const tariffsRaw = useDriverConfigStore((s) => s.getSetting('tariffs_config', '{}'));
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const fcfaPerPoint: number = (() => {
    try { return JSON.parse(tariffsRaw).fcfaPerPoint ?? 10; } catch { return 10; }
  })();
  const sym = useCurrencySymbol();
  const currency = sym;

  const [receipt, setReceipt] = useState<DriverRideReceipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    driverApi.getDriverRideReceipt(token, bookingId)
      .then(setReceipt)
      .catch(() => Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger le reçu.' }))
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  const handleShare = async () => {
    if (!receipt) return;
    const total = Math.round(receipt.estimatedPrice * fcfaPerPoint);
    await Share.share({
      message: `Reçu AeroCab ${receipt.reference}\n${receipt.departureAirport} → ${receipt.destination}\nDate : ${formatDate(receipt.createdAt)}\nTotal : ${total.toLocaleString()} ${currency}`,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      </SafeAreaView>
    );
  }
  if (!receipt) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><Text style={styles.errorText}>Reçu introuvable</Text></View>
      </SafeAreaView>
    );
  }

  const totalAmount = Math.round(receipt.estimatedPrice * fcfaPerPoint);
  const baseFcfa = receipt.baseFare != null ? Math.round(receipt.baseFare) : null;
  const airportFcfa = receipt.airportFee != null ? Math.round(receipt.airportFee) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={COLORS.black} />
        </Pressable>
        <Text style={styles.headerTitle}>Reçu de course</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Référence */}
        <View style={styles.referenceBox}>
          <Text style={styles.referenceLabel}>Référence</Text>
          <Text style={styles.referenceValue}>{receipt.reference}</Text>
        </View>

        {/* Route */}
        <View style={styles.routeCard}>
          <View style={styles.routeItem}>
            <View style={styles.routeDotGreen} />
            <View>
              <Text style={styles.routeItemLabel}>Départ</Text>
              <Text style={styles.routeItemValue}>{receipt.departureAirport}</Text>
            </View>
          </View>
          <View style={styles.routeVLine} />
          <View style={styles.routeItem}>
            <View style={styles.routeDotNavy} />
            <View>
              <Text style={styles.routeItemLabel}>Arrivée</Text>
              <Text style={styles.routeItemValue}>{receipt.destination}</Text>
            </View>
          </View>
        </View>

        {/* Informations */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informations</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Client</Text>
            <Text style={styles.rowValue}>{receipt.passengerName ?? 'Client'}</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Date</Text>
            <Text style={styles.rowValue}>{formatDate(receipt.createdAt)}</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Heure départ</Text>
            <Text style={styles.rowValue}>{formatTime(receipt.startedAt)}</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Heure arrivée</Text>
            <Text style={styles.rowValue}>{formatTime(receipt.completedAt)}</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Durée</Text>
            <Text style={styles.rowValue}>{receipt.estimatedDurationMin != null ? `${receipt.estimatedDurationMin} min` : '—'}</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Distance</Text>
            <Text style={styles.rowValue}>{receipt.estimatedDistanceKm != null ? `${receipt.estimatedDistanceKm} km` : '—'}</Text>
          </View>
        </View>

        {/* Détail tarif */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Détail tarif</Text>
          {baseFcfa != null && (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Tarif de base</Text>
                <Text style={styles.rowValue}>{baseFcfa.toLocaleString()} {currency}</Text>
              </View>
              {airportFcfa != null && airportFcfa > 0 && (
                <View style={[styles.row, styles.rowBorder]}>
                  <Text style={styles.rowLabel}>Frais aéroport</Text>
                  <Text style={styles.rowValue}>{airportFcfa.toLocaleString()} {currency}</Text>
                </View>
              )}
              <View style={[styles.row, styles.rowBorder, { marginTop: 4 }]}>
                <Text style={[styles.rowLabel, styles.totalLabel]}>Total</Text>
                <Text style={styles.totalAmount}>{totalAmount.toLocaleString()} {currency}</Text>
              </View>
            </>
          )}
          {baseFcfa == null && (
            <View style={styles.row}>
              <Text style={[styles.rowLabel, styles.totalLabel]}>Total</Text>
              <Text style={styles.totalAmount}>{totalAmount.toLocaleString()} {currency}</Text>
            </View>
          )}
        </View>

        {/* Boutons */}
        <View style={styles.actionsRow}>
          <Pressable style={styles.downloadBtn} onPress={handleShare}>
            <Download size={18} color={COLORS.primary} />
            <Text style={styles.downloadBtnText}>Partager le reçu</Text>
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
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.black, textAlign: 'center' },

  referenceBox: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg, alignItems: 'center', marginBottom: SPACING.md,
  },
  referenceLabel: { fontSize: 11, color: `${COLORS.white}88`, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  referenceValue: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginTop: 4 },

  routeCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, marginBottom: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  routeItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  routeDotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.success, flexShrink: 0 },
  routeDotNavy: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary, flexShrink: 0 },
  routeVLine: { width: 2, height: 16, backgroundColor: COLORS.grayLight, marginLeft: 5, marginVertical: 2 },
  routeItemLabel: { fontSize: 11, color: COLORS.grayMedium, fontWeight: '600', textTransform: 'uppercase' },
  routeItemValue: { fontSize: 14, fontWeight: '700', color: COLORS.black, marginTop: 1 },

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
  rowValue: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  totalLabel: { fontSize: 14, color: COLORS.black, fontWeight: '700' },
  totalAmount: { fontSize: 22, fontWeight: '800', color: COLORS.primary },

  actionsRow: { flexDirection: 'row', gap: SPACING.sm },
  downloadBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.button, paddingVertical: 14,
  },
  downloadBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
});
