import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, AlertTriangle, CheckCircle, Clock, XCircle, ChevronDown, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../lib/shared';
import { driverApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

type Report = {
  id: string;
  reason: string;
  status: string;
  resolution?: string;
  createdAt: string;
  messages?: any[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  open:          { label: 'Ouvert',      color: '#E65100', bg: '#FFF3E0', icon: Clock },
  pending:       { label: 'En attente',  color: '#E65100', bg: '#FFF3E0', icon: Clock },
  investigating: { label: 'En cours',    color: '#1565C0', bg: '#E3F2FD', icon: Clock },
  resolved:      { label: 'Résolu',      color: '#2E7D32', bg: '#E8F5E9', icon: CheckCircle },
  dismissed:     { label: 'Rejeté',      color: '#C62828', bg: '#FDECEA', icon: XCircle },
};

function TicketCard({ report }: { report: Report }) {
  const cfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const date = new Date(report.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const msgCount = report.messages?.length ?? 0;

  return (
    <Pressable style={styles.card} onPress={() => router.push({ pathname: '/(tabs)/ticket-detail', params: { id: report.id } } as never)}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Icon size={13} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={styles.date}>{date}</Text>
        {msgCount > 0 && (
          <View style={styles.msgBadge}>
            <Text style={styles.msgBadgeText}>{msgCount} msg</Text>
          </View>
        )}
        <ChevronDown size={18} color={COLORS.grayMedium} />
      </View>
      <Text style={styles.reason} numberOfLines={2}>{report.reason}</Text>
    </Pressable>
  );
}

export default function MyTicketsScreen() {
  const token = useAuthStore((s) => s.token)!;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await driverApi.getMyReports(token);
      setReports(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.black} />
        </Pressable>
        <Text style={styles.headerTitle}>Mes signalements</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/report-problem' as never)}
          style={styles.newBtn}
        >
          <Plus size={18} color={COLORS.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <AlertTriangle size={40} color={COLORS.grayMedium} />
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.center}>
          <CheckCircle size={48} color={COLORS.grayLight} />
          <Text style={styles.emptyTitle}>Aucun signalement</Text>
          <Text style={styles.emptyText}>Vous n'avez pas encore soumis de signalement.</Text>
          <Pressable
            onPress={() => router.push('/(tabs)/report-problem' as never)}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Créer un signalement</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />}
        >
          <Text style={styles.listHint}>Appuyez sur un ticket pour voir les détails et la réponse admin.</Text>
          {reports.map((r) => <TicketCard key={r.id} report={r} />)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.grayLight,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  newBtn: { padding: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black },
  emptyText: { fontSize: 14, color: COLORS.grayMedium, textAlign: 'center' },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 12 },
  retryText: { color: COLORS.white, fontWeight: '700' },
  list: { padding: SPACING.md, gap: 12 },
  listHint: { fontSize: 12, color: COLORS.grayMedium, textAlign: 'center', marginBottom: 4 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: SPACING.md,
    gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  date: { flex: 1, fontSize: 12, color: COLORS.grayMedium, textAlign: 'right', marginRight: 4 },
  reason: { fontSize: 14, color: COLORS.grayDark, lineHeight: 20 },
  resolutionBox: {
    backgroundColor: '#E8F5E9', borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#2E7D32', gap: 4,
  },
  resolutionLabel: { fontSize: 11, fontWeight: '700', color: '#2E7D32', textTransform: 'uppercase' },
  resolutionText: { fontSize: 13, color: '#1B5E20', lineHeight: 18 },
  pendingBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF3E0', borderRadius: 8, padding: 10 },
  pendingText: { fontSize: 12, color: '#E65100', flex: 1 },
  msgBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  msgBadgeText: { fontSize: 10, fontWeight: '700', color: '#1565C0' },
});
