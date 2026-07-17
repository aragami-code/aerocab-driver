import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet, Clock, CheckCircle, XCircle, ArrowDownLeft } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDriverConfigStore } from '../../stores/configStore';
import { driverApi } from '../../services/api';
import { useCurrency } from '../../hooks/useCurrency';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending:  { color: '#F39C12', label: 'En attente' },
  approved: { color: '#2980B9', label: 'Approuvé' },
  rejected: { color: COLORS.error, label: 'Rejeté' },
  paid:     { color: COLORS.success, label: 'Payé' },
};

export default function PaymentScreen() {
  const token = useAuthStore((s) => s.token)!;
  const tariffsRaw = useDriverConfigStore((s) => s.getSetting('tariffs_config', '{}'));

  const fcfaPerPoint: number = (() => {
    try { return JSON.parse(tariffsRaw).fcfaPerPoint ?? 1; } catch { return 1; }
  })();

  const [driverCountryCode, setDriverCountryCode] = useState<string>('CM');
  const currency = useCurrency(driverCountryCode);

  const [balance, setBalance] = useState<number | null>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [profileRes, withdrawalsRes] = await Promise.all([
        driverApi.getMyProfile(token),
        driverApi.getWithdrawals(token),
      ]);
      setBalance((profileRes as any).walletBalance ?? 0);
      setDriverCountryCode((profileRes as any).countryCode ?? 'CM');
      setWithdrawals(withdrawalsRes.data ?? []);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger le portefeuille.' });
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const localBalance = balance != null ? balance * fcfaPerPoint : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mon portefeuille</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
        ) : (
          <>
            {/* Wallet card */}
            <View style={styles.walletCard}>
              <View style={styles.walletTop}>
                <Wallet size={20} color={`${COLORS.white}88`} />
                <Text style={styles.walletLabel}>Solde disponible</Text>
              </View>
              <Text style={styles.walletPts}>
                {balance != null ? balance.toLocaleString() : '—'} pts
              </Text>
              <Text style={styles.walletFcfa}>
                ≈ {localBalance != null ? currency.format(localBalance) : '—'}
              </Text>
              <Pressable
                style={styles.withdrawBtn}
                onPress={() => router.push('/(tabs)/withdraw' as never)}
              >
                <ArrowDownLeft size={16} color={COLORS.primary} />
                <Text style={styles.withdrawBtnText}>Retirer mes gains</Text>
              </Pressable>
            </View>

            {/* Historique retraits */}
            <Text style={styles.sectionTitle}>Historique des retraits</Text>
            {withdrawals.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Aucun retrait effectué</Text>
              </View>
            ) : (
              withdrawals.map((w, idx) => {
                const cfg = STATUS_CONFIG[w.status] ?? { color: COLORS.grayMedium, label: w.status };
                const wPts = Math.round((w.amount ?? 0) / fcfaPerPoint);
                const date = new Date(w.createdAt ?? Date.now()).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short', year: 'numeric',
                });
                return (
                  <View key={w.id ?? idx} style={styles.withdrawalRow}>
                    <View style={styles.withdrawalLeft}>
                      <Text style={styles.withdrawalDate}>{date}</Text>
                      <Text style={styles.withdrawalPts}>{wPts.toLocaleString()} pts → {currency.format(w.amount ?? 0)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${cfg.color}18` }]}>
                      <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.sm },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.black },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  center: { paddingTop: 60, alignItems: 'center' },

  walletCard: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  walletTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  walletLabel: { fontSize: 12, color: `${COLORS.white}88`, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  walletPts: { fontSize: 32, fontWeight: '800', color: COLORS.white },
  walletFcfa: { fontSize: 15, color: `${COLORS.white}88`, marginTop: 4, marginBottom: SPACING.md },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.button,
    paddingVertical: 12, paddingHorizontal: SPACING.md, alignSelf: 'flex-start',
  },
  withdrawBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.grayMedium,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm,
  },
  emptyBox: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg, alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: COLORS.grayMedium },

  withdrawalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, marginBottom: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  withdrawalLeft: { flex: 1 },
  withdrawalDate: { fontSize: 12, color: COLORS.grayMedium, marginBottom: 2 },
  withdrawalPts: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
});
