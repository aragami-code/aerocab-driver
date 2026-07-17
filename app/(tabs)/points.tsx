import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDriverConfigStore, useCurrencySymbol } from '../../stores/configStore';
import { driverApi } from '../../services/api';

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'] as const;
const TIER_ROADMAP = [
  { key: 'bronze',   label: 'Bronze',  emoji: '🥉', color: '#CD7F32' },
  { key: 'silver',   label: 'Argent',  emoji: '🥈', color: '#A8A9AD' },
  { key: 'gold',     label: 'Or',      emoji: '🥇', color: '#FFD700' },
  { key: 'platinum', label: 'Platine', emoji: '💎', color: '#E5E4E2' },
] as const;

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

const SOURCE_LABELS: Record<string, string> = {
  ride:      'Course',
  bonus:     'Bonus',
  referral:  'Parrainage',
  loyalty:   'Fidélité',
  withdrawal:'Retrait',
  payment:   'Paiement',
  manual:    'Ajustement',
};

export default function PointsScreen() {
  const token = useAuthStore((s) => s.token)!;
  const driverPhone = useAuthStore((s) => s.user?.phone ?? '');
  const tariffsRaw = useDriverConfigStore((s) => s.getSetting('tariffs_config', '{}'));

  const fcfaPerPoint: number = (() => {
    try { return JSON.parse(tariffsRaw).fcfaPerPoint ?? 10; } catch { return 10; }
  })();
  const sym = useCurrencySymbol();
  const currency = sym;

  const [balance, setBalance] = useState<number | null>(null);
  const [loyalty, setLoyalty] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async (p: number, append = false) => {
    try {
      const [profileRes, historyRes, loyaltyRes] = await Promise.all([
        driverApi.getMyProfile(token),
        driverApi.getPointsHistory(token, p),
        driverApi.getLoyaltyStatus(token).catch(() => null),
      ]);
      setBalance((profileRes as any).walletBalance ?? 0);
      setLoyalty(loyaltyRes);
      setTransactions((prev) => append ? [...prev, ...(historyRes.data ?? [])] : (historyRes.data ?? []));
      setTotal(historyRes.total ?? 0);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger les points.' });
    }
  };

  useEffect(() => {
    load(1).finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await load(1);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (loadingMore || transactions.length >= total) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    await load(next, true);
    setLoadingMore(false);
  };

  const localBalance = balance != null ? Math.round(balance * fcfaPerPoint) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mes points</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item, idx) => item.id ?? String(idx)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <>
              {/* Solde card */}
              <View style={styles.balanceCard}>
                <View style={styles.balanceRow}>
                  <Zap size={28} color={COLORS.accent} fill={COLORS.accent} />
                  <Text style={styles.balancePts}>{balance != null ? balance.toLocaleString() : '—'} pts</Text>
                </View>
                <Text style={styles.balanceFcfa}>
                  ≈ {localBalance != null ? localBalance.toLocaleString() : '—'} {currency}
                </Text>
                <View style={styles.rateRow}>
                  <Text style={styles.rateText}>Taux : {fcfaPerPoint} {currency} / pt</Text>
                </View>
              </View>

              {/* ── Niveau fidélité ── */}
              {loyalty && (
                <View style={[styles.loyaltyCard, { borderColor: loyalty.tierColor + '55' }]}>
                  {/* Header */}
                  <View style={styles.loyaltyHeader}>
                    <Text style={styles.loyaltyEmoji}>{loyalty.tierEmoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.loyaltyTierLabel, { color: loyalty.tierColor }]}>
                        Niveau {loyalty.tierLabel}
                      </Text>
                      <Text style={styles.loyaltyPts}>
                        {(loyalty.pointsTotal ?? loyalty.pointsBalance ?? 0).toLocaleString()} pts cumulés
                      </Text>
                    </View>
                    {loyalty.tier !== 'platinum' && (
                      <View style={[styles.loyaltyBadge, { backgroundColor: loyalty.tierColor + '20' }]}>
                        <Text style={[styles.loyaltyBadgeText, { color: loyalty.tierColor }]}>
                          {loyalty.progressPct}%
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Barre de progression */}
                  {loyalty.nextThreshold && (
                    <View style={styles.progressSection}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, {
                          width: `${loyalty.progressPct}%` as any,
                          backgroundColor: loyalty.tierColor,
                        }]} />
                      </View>
                      <View style={styles.progressLabels}>
                        <Text style={[styles.progressLabelLeft, { color: loyalty.tierColor }]}>
                          {loyalty.tierLabel}
                        </Text>
                        <Text style={styles.progressLabelRight}>
                          encore {((loyalty.nextThreshold) - (loyalty.pointsTotal ?? loyalty.pointsBalance ?? 0)).toLocaleString()} pts →{' '}
                          {loyalty.nextTier === 'silver' ? '🥈 Argent' :
                           loyalty.nextTier === 'gold'   ? '🥇 Or'     : '💎 Platine'}
                        </Text>
                      </View>
                    </View>
                  )}
                  {loyalty.tier === 'platinum' && (
                    <View style={[styles.platinumBadge, { backgroundColor: loyalty.tierColor + '18' }]}>
                      <Text style={[styles.platinumBadgeText, { color: loyalty.tierColor }]}>
                        💎 Niveau maximum atteint
                      </Text>
                    </View>
                  )}

                  {/* Roadmap */}
                  <View style={styles.roadmap}>
                    {TIER_ROADMAP.map((t) => {
                      const isActive = t.key === loyalty.tier;
                      const isDone = TIER_ORDER.indexOf(t.key) < TIER_ORDER.indexOf(loyalty.tier as any);
                      return (
                        <View key={t.key} style={styles.roadmapStep}>
                          <View style={[
                            styles.roadmapDot,
                            isActive && { backgroundColor: t.color, borderColor: t.color },
                            isDone   && { backgroundColor: t.color + '60', borderColor: t.color + '60' },
                            !isActive && !isDone && { backgroundColor: COLORS.background, borderColor: COLORS.grayLight },
                          ]}>
                            <Text style={{ fontSize: isActive ? 14 : 11 }}>{t.emoji}</Text>
                          </View>
                          <Text style={[
                            styles.roadmapLabel,
                            { color: isActive ? t.color : COLORS.grayMedium, fontWeight: isActive ? '800' : '500' },
                          ]}>{t.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              <Text style={styles.sectionTitle}>Historique</Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Aucune transaction</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => {
            const isCredit = item.type === 'credit' || (item.points ?? 0) > 0;
            const pts = Math.abs(item.points ?? 0);
            const date = new Date(item.createdAt ?? Date.now()).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'short', year: 'numeric',
            });
            const sourceLabel = SOURCE_LABELS[item.source] ?? item.source ?? '';

            return (
              <View style={styles.txRow}>
                <View style={styles.txLeft}>
                  <Text style={styles.txLabel} numberOfLines={1}>{item.label ?? sourceLabel}</Text>
                  <Text style={styles.txDate}>{date}</Text>
                </View>
                <Text style={[styles.txPts, isCredit ? styles.txCredit : styles.txDebit]}>
                  {isCredit ? '+' : '-'}{pts.toLocaleString()} pts
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.sm },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.black },
  listContent: { padding: SPACING.lg, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  balanceCard: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  balancePts: { fontSize: 30, fontWeight: '800', color: COLORS.white },
  balanceFcfa: { fontSize: 15, color: `${COLORS.white}88`, marginBottom: SPACING.sm },
  rateRow: {
    backgroundColor: `${COLORS.white}15`, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start',
  },
  rateText: { fontSize: 12, color: COLORS.white, fontWeight: '600' },

  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.grayMedium,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm,
  },
  emptyBox: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg, alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: COLORS.grayMedium },

  txRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, marginBottom: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  txLeft: { flex: 1, marginRight: 12 },
  txLabel: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  txDate: { fontSize: 12, color: COLORS.grayMedium, marginTop: 2 },
  txPts: { fontSize: 15, fontWeight: '800', flexShrink: 0 },
  txCredit: { color: COLORS.success },
  txDebit: { color: COLORS.error },

  loyaltyCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg, marginBottom: SPACING.lg,
    borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  loyaltyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.md },
  loyaltyEmoji: { fontSize: 36 },
  loyaltyTierLabel: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  loyaltyPts: { fontSize: 12, color: COLORS.grayMedium, marginTop: 2 },
  loyaltyBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  loyaltyBadgeText: { fontSize: 13, fontWeight: '800' },

  progressSection: { marginBottom: SPACING.md },
  progressTrack: {
    height: 8, borderRadius: 4, backgroundColor: COLORS.background,
    overflow: 'hidden', marginBottom: 6,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabelLeft: { fontSize: 11, fontWeight: '700' },
  progressLabelRight: { fontSize: 11, color: COLORS.grayMedium },

  platinumBadge: { borderRadius: 10, padding: 10, alignItems: 'center', marginBottom: SPACING.sm },
  platinumBadgeText: { fontSize: 13, fontWeight: '700' },

  roadmap: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm },
  roadmapStep: { alignItems: 'center', gap: 4, flex: 1 },
  roadmapDot: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  roadmapLabel: { fontSize: 10, textAlign: 'center' },
});
