import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ScrollView,
  ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Car, MapPin, Clock, Navigation } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDriverConfigStore, useCurrencySymbol } from '../../stores/configStore';
import { driverApi, DriverRide } from '../../services/api';

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

const FILTERS = [
  { key: 'all',       label: 'Tous' },
  { key: 'today',     label: "Aujourd'hui" },
  { key: 'week',      label: 'Semaine' },
  { key: 'month',     label: 'Mois' },
  { key: 'cancelled', label: 'Annulés' },
] as const;

type FilterKey = typeof FILTERS[number]['key'];

function groupByDate(rides: DriverRide[]): { label: string; data: DriverRide[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups: Record<string, DriverRide[]> = {};
  for (const ride of rides) {
    const d = new Date(ride.createdAt); d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = "Aujourd'hui";
    else if (d.getTime() === yesterday.getTime()) label = 'Hier';
    else {
      label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    (groups[label] ??= []).push(ride);
  }
  return Object.entries(groups).map(([label, data]) => ({ label, data }));
}

export default function TripsScreen() {
  const token = useAuthStore((s) => s.token)!;
  const driverPhone = useAuthStore((s) => s.user?.phone ?? '');
  const tariffsRaw = useDriverConfigStore((s) => s.getSetting('tariffs_config', '{}'));
  const fcfaPerPoint: number = (() => {
    try { return JSON.parse(tariffsRaw).fcfaPerPoint ?? 10; } catch { return 10; }
  })();
  const sym = useCurrencySymbol();
  const currency = sym;

  const [filter, setFilter] = useState<FilterKey>('all');
  const [rides, setRides] = useState<DriverRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadRides = useCallback(async (f: FilterKey, p: number, append = false) => {
    try {
      const res = await driverApi.getDriverRideHistory(token, f, p);
      setRides((prev) => append ? [...prev, ...res.rides] : res.rides);
      setTotalPages(res.totalPages);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger les trajets.' });
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadRides(filter, 1).finally(() => setLoading(false));
  }, [filter, loadRides]);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadRides(filter, 1);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await loadRides(filter, nextPage, true);
    setLoadingMore(false);
  };

  const total = rides.length;
  const completed = rides.filter((r) => r.status === 'completed').length;
  const cancelled = rides.filter((r) => r.status === 'cancelled').length;

  const grouped = groupByDate(rides);
  const flatData: Array<{ type: 'header'; label: string } | { type: 'ride'; ride: DriverRide }> = [];
  for (const g of grouped) {
    flatData.push({ type: 'header', label: g.label });
    for (const ride of g.data) flatData.push({ type: 'ride', ride });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mes trajets</Text>
        <Text style={styles.subtitle}>Historique de vos courses</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, styles.statCardSuccess]}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{completed}</Text>
          <Text style={styles.statLabel}>Terminées</Text>
        </View>
        <View style={[styles.statCard, styles.statCardError]}>
          <Text style={[styles.statValue, { color: COLORS.error }]}>{cancelled}</Text>
          <Text style={styles.statLabel}>Annulées</Text>
        </View>
      </View>

      {/* Filtres */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Contenu */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Car size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>Aucun trajet trouvé</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'all'
              ? 'Vos courses apparaîtront ici une fois terminées.'
              : 'Aucune course dans cette période.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, idx) =>
            item.type === 'header' ? `h-${item.label}` : `r-${item.ride.id}-${idx}`
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
              : null
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.dateHeaderRow}>
                  <View style={styles.dateHeaderLine} />
                  <Text style={styles.dateHeaderText}>{item.label}</Text>
                  <View style={styles.dateHeaderLine} />
                </View>
              );
            }

            const ride = item.ride;
            const isCancelled = ride.status === 'cancelled';
            const amount = Math.round(ride.estimatedPrice * fcfaPerPoint);
            const time = new Date(ride.createdAt).toLocaleTimeString('fr-FR', {
              hour: '2-digit', minute: '2-digit',
            });

            return (
              <Pressable
                style={styles.card}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/trip-detail' as any, params: { bookingId: ride.id } })
                }
              >
                {/* Badge statut + heure */}
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, isCancelled ? styles.badgeCancelled : styles.badgeCompleted]}>
                    <View style={[styles.badgeDot, { backgroundColor: isCancelled ? COLORS.error : COLORS.success }]} />
                    <Text style={[styles.badgeText, { color: isCancelled ? COLORS.error : COLORS.success }]}>
                      {isCancelled ? 'Annulé' : 'Terminé'}
                    </Text>
                  </View>
                  <Text style={styles.cardTime}>{time}</Text>
                </View>

                {/* Route */}
                <View style={styles.routeContainer}>
                  <View style={styles.routeIcons}>
                    <View style={styles.originDot} />
                    <View style={styles.routeVertLine} />
                    <MapPin size={14} color={COLORS.primary} />
                  </View>
                  <View style={styles.routeLabels}>
                    <Text style={styles.routeFrom} numberOfLines={1}>{ride.departureAirport}</Text>
                    <Text style={styles.routeTo} numberOfLines={1}>{ride.destination}</Text>
                  </View>
                </View>

                {/* Infos bas */}
                <View style={styles.cardFooter}>
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
                    <Text style={styles.passengerName} numberOfLines={1}>
                      {ride.passengerName ?? 'Client'}
                    </Text>
                  </View>

                  {/* Métadonnées */}
                  <View style={styles.metaRow}>
                    {ride.estimatedDurationMin != null && (
                      <View style={styles.metaItem}>
                        <Clock size={11} color={COLORS.grayMedium} />
                        <Text style={styles.metaText}>{ride.estimatedDurationMin} min</Text>
                      </View>
                    )}
                    {ride.estimatedDistanceKm != null && (
                      <View style={styles.metaItem}>
                        <Navigation size={11} color={COLORS.grayMedium} />
                        <Text style={styles.metaText}>{ride.estimatedDistanceKm} km</Text>
                      </View>
                    )}
                  </View>

                  {/* Montant */}
                  {!isCancelled && (
                    <Text style={styles.amount}>
                      {amount.toLocaleString()} {currency}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },

  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.black },
  subtitle: { fontSize: 13, color: COLORS.grayMedium, marginTop: 2 },

  statsRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: SPACING.lg, marginBottom: 14,
  },
  statCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statCardSuccess: { borderTopWidth: 3, borderTopColor: COLORS.success },
  statCardError:   { borderTopWidth: 3, borderTopColor: COLORS.error },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.black },
  statLabel: { fontSize: 11, color: COLORS.grayMedium, marginTop: 2, fontWeight: '600' },

  filtersWrapper: { height: 44, marginBottom: 10 },
  filtersContent: { paddingHorizontal: SPACING.lg, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.grayDark },
  chipTextActive: { color: COLORS.white },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  emptySubtitle: { fontSize: 13, color: COLORS.grayMedium, textAlign: 'center', paddingHorizontal: 40 },

  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: 24 },

  dateHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, marginBottom: 8,
  },
  dateHeaderLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dateHeaderText: { fontSize: 12, fontWeight: '700', color: COLORS.grayMedium, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: SPACING.md, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeCompleted: { backgroundColor: `${COLORS.success}15` },
  badgeCancelled: { backgroundColor: `${COLORS.error}12` },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  cardTime: { fontSize: 12, color: COLORS.grayMedium, fontWeight: '500' },

  routeContainer: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  routeIcons: { alignItems: 'center', paddingTop: 2 },
  originDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6B7280', marginBottom: 2 },
  routeVertLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 2 },
  routeLabels: { flex: 1, gap: 10 },
  routeFrom: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  routeTo: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, gap: 8,
  },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarPlaceholder: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: `${COLORS.primary}15`, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  passengerName: { fontSize: 12, fontWeight: '600', color: COLORS.black, flex: 1 },

  metaRow: { flexDirection: 'row', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: COLORS.grayMedium, fontWeight: '500' },

  amount: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
});
