import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CheckCircle, Clock, XCircle, AlertCircle, FileText, RefreshCw,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { driverApi, type DriverStatus } from '../../services/api';

type DocStatus = 'pending' | 'approved' | 'rejected';

type DocumentEntry = {
  type: string;
  status: DocStatus;
  rejectionReason: string | null;
  fileUrl: string;
};

const DOC_LABELS: Record<string, string> = {
  cni_front: 'CNI — Recto',
  cni_back: 'CNI — Verso',
  license: 'Permis de conduire',
  registration: 'Carte grise',
  vehicle_photo: 'Photo du véhicule',
};

function DocStatusIcon({ status }: { status: DocStatus }) {
  if (status === 'approved') return <CheckCircle size={20} color={COLORS.success} />;
  if (status === 'rejected') return <XCircle size={20} color={COLORS.error} />;
  return <Clock size={20} color={COLORS.warning} />;
}

function AccountStatusCard({ status }: { status: DriverStatus }) {
  const configs: Record<DriverStatus, { icon: React.ReactNode; title: string; desc: string; bg: string; border: string }> = {
    approved: {
      icon: <CheckCircle size={28} color={COLORS.success} />,
      title: 'Compte approuvé',
      desc: 'Vous pouvez recevoir des courses et être en ligne.',
      bg: '#E8F8EE',
      border: `${COLORS.success}44`,
    },
    pending: {
      icon: <Clock size={28} color={COLORS.warning} />,
      title: 'Vérification en cours',
      desc: 'Nous examinons vos documents. Ce processus peut prendre 24 à 48h.',
      bg: '#FFF8E1',
      border: `${COLORS.warning}44`,
    },
    rejected: {
      icon: <XCircle size={28} color={COLORS.error} />,
      title: 'Dossier rejeté',
      desc: 'Votre dossier n\'a pas été accepté. Vérifiez les détails ci-dessous et re-soumettez.',
      bg: '#FDECEA',
      border: `${COLORS.error}44`,
    },
    suspended: {
      icon: <AlertCircle size={28} color={COLORS.warning} />,
      title: 'Compte suspendu',
      desc: 'Votre compte est temporairement suspendu. Contactez le support.',
      bg: '#FFF3E0',
      border: `${COLORS.warning}44`,
    },
  };

  const cfg = configs[status];
  return (
    <View style={[styles.statusCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      {cfg.icon}
      <View style={styles.statusCardText}>
        <Text style={styles.statusCardTitle}>{cfg.title}</Text>
        <Text style={styles.statusCardDesc}>{cfg.desc}</Text>
      </View>
    </View>
  );
}

export default function StatusScreen() {
  const token = useAuthStore((s) => s.token)!;
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('pending');
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [profile, docs] = await Promise.all([
        driverApi.getMyProfile(token),
        driverApi.getMyDocuments(token),
      ]);
      setDriverStatus(profile.status);
      setDocuments(docs as DocumentEntry[]);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger le statut.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const hasRejectedDocs = documents.some((d) => d.status === 'rejected');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statut du dossier</Text>
        <Pressable style={styles.refreshBtn} onPress={() => load(true)} disabled={refreshing}>
          {refreshing
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <RefreshCw size={20} color={COLORS.primary} />
          }
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <AccountStatusCard status={driverStatus} />

        {/* Documents */}
        <Text style={styles.sectionTitle}>Mes documents</Text>

        {documents.length === 0 ? (
          <View style={styles.emptyDocs}>
            <FileText size={32} color={COLORS.grayMedium} />
            <Text style={styles.emptyDocsText}>Aucun document uploadé</Text>
            <Pressable style={styles.uploadBtn} onPress={() => router.push('/(auth)/upload-documents')}>
              <Text style={styles.uploadBtnText}>Uploader mes documents</Text>
            </Pressable>
          </View>
        ) : (
          documents.map((doc) => (
            <View key={doc.type} style={styles.docCard}>
              <FileText size={20} color={COLORS.grayDark} />
              <View style={styles.docInfo}>
                <Text style={styles.docLabel}>{DOC_LABELS[doc.type] ?? doc.type}</Text>
                <Text style={[
                  styles.docStatus,
                  doc.status === 'approved' && { color: COLORS.success },
                  doc.status === 'rejected' && { color: COLORS.error },
                  doc.status === 'pending' && { color: COLORS.warning },
                ]}>
                  {doc.status === 'approved' ? 'Approuvé' : doc.status === 'rejected' ? 'Rejeté' : 'En attente'}
                </Text>
                {doc.rejectionReason && (
                  <Text style={styles.docRejection}>{doc.rejectionReason}</Text>
                )}
              </View>
              <DocStatusIcon status={doc.status} />
            </View>
          ))
        )}

        {/* Re-upload if rejected */}
        {(driverStatus === 'rejected' || hasRejectedDocs) && (
          <Pressable style={styles.resubmitBtn} onPress={() => router.push('/(auth)/upload-documents')}>
            <Text style={styles.resubmitBtnText}>Corriger et re-soumettre</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black },
  refreshBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.md, paddingBottom: 40 },

  statusCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.card, padding: SPACING.md,
    marginBottom: SPACING.lg, borderWidth: 1.5,
  },
  statusCardText: { flex: 1 },
  statusCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginBottom: 4 },
  statusCardDesc: { fontSize: 13, color: COLORS.grayDark, lineHeight: 18 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.grayDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },

  docCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, marginBottom: 10,
    borderWidth: 1.5, borderColor: COLORS.grayLight,
  },
  docInfo: { flex: 1 },
  docLabel: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  docStatus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  docRejection: { fontSize: 12, color: COLORS.error, marginTop: 4, lineHeight: 16 },

  emptyDocs: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyDocsText: { fontSize: 14, color: COLORS.grayMedium },
  uploadBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.button, paddingVertical: 12, paddingHorizontal: 24, marginTop: SPACING.sm },
  uploadBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  resubmitBtn: { backgroundColor: COLORS.error, borderRadius: BORDER_RADIUS.button, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.md },
  resubmitBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
