import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CheckCircle, Clock, XCircle, AlertCircle, FileText, RefreshCw, MinusCircle,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDriverConfigStore } from '../../stores/configStore';
import { driverApi, type DriverStatus } from '../../services/api';

type DocStatus = 'pending' | 'approved' | 'rejected' | 'not_submitted';

type DocumentRow = {
  type: string;
  label: string;
  required: boolean;
  status: DocStatus;
  rejectionReason: string | null;
};

const DOC_LABELS: Record<string, string> = {
  cni_front:           'CNI — Recto',
  cni_back:            'CNI — Verso',
  license:             'Permis de conduire',
  registration:        'Carte grise',
  vehicle_photo:       'Photo du véhicule',
  insurance:           "Attestation d'assurance",
  technical_control:   'Visite technique',
  vtc_license:         'Autorisation VTC',
  passport:            'Passeport',
  portrait:            'Photo portrait',
  selfie:              'Selfie avec CNI',
  criminal_record:     'Casier judiciaire',
  proof_of_address:    'Justificatif de domicile',
  medical_certificate: 'Certificat médical',
  vaccination_card:    'Carte de vaccination',
  border_pass:         'Laissez-passer frontalier',
};

const DEFAULT_DOC_CONFIG = [
  { type: 'cni_front',     required: true,  enabled: true },
  { type: 'cni_back',      required: true,  enabled: true },
  { type: 'license',       required: true,  enabled: true },
  { type: 'registration',  required: true,  enabled: true },
  { type: 'vehicle_photo', required: true,  enabled: true },
];

function DocStatusIcon({ status }: { status: DocStatus }) {
  if (status === 'approved')      return <CheckCircle size={20} color={COLORS.success} />;
  if (status === 'rejected')      return <XCircle size={20} color={COLORS.error} />;
  if (status === 'not_submitted') return <MinusCircle size={20} color={COLORS.grayMedium} />;
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
      desc: "Votre dossier n'a pas été accepté. Vérifiez les détails ci-dessous et re-soumettez.",
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
  const getSetting = useDriverConfigStore(s => s.getSetting);
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('pending');
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const buildRows = useCallback((docs: { type: string; status: string; rejectionReason: string | null }[]) => {
    // Parse admin config
    let configItems = DEFAULT_DOC_CONFIG;
    try {
      const raw = getSetting('driver_document_config', '');
      if (raw) {
        const parsed: { type: string; required: boolean; enabled: boolean }[] = JSON.parse(raw);
        const enabled = parsed.filter(d => d.enabled);
        if (enabled.length > 0) configItems = enabled;
      }
    } catch { /* keep defaults */ }

    // Build uploaded map
    const uploadedMap: Record<string, { status: string; rejectionReason: string | null }> = {};
    docs.forEach(d => { uploadedMap[d.type] = d; });

    // Merge: all configured types + any uploaded types not in config
    const configTypes = configItems.map(c => c.type);
    const extraUploaded = docs.filter(d => !configTypes.includes(d.type));
    const allTypes = [
      ...configItems.map(c => ({
        type: c.type,
        label: DOC_LABELS[c.type] ?? c.type,
        required: c.required,
        uploaded: uploadedMap[c.type] ?? null,
      })),
      ...extraUploaded.map(d => ({
        type: d.type,
        label: DOC_LABELS[d.type] ?? d.type,
        required: false,
        uploaded: d,
      })),
    ];

    return allTypes.map(item => ({
      type: item.type,
      label: item.label,
      required: item.required,
      status: item.uploaded
        ? (item.uploaded.status as DocStatus)
        : ('not_submitted' as DocStatus),
      rejectionReason: item.uploaded?.rejectionReason ?? null,
    }));
  }, [getSetting]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [profile, docs] = await Promise.all([
        driverApi.getMyProfile(token),
        driverApi.getMyDocuments(token),
      ]);
      setDriverStatus(profile.status);
      setRows(buildRows(docs as any[]));
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger le statut.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, buildRows]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const submittedCount = rows.filter(r => r.status !== 'not_submitted').length;
  const approvedCount  = rows.filter(r => r.status === 'approved').length;
  const hasRejectedDocs = rows.some(r => r.status === 'rejected');

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

        {/* Section header avec compteur */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MES DOCUMENTS</Text>
          <View style={styles.counterRow}>
            <Text style={styles.counterText}>
              {submittedCount}/{rows.length} soumis
            </Text>
            {approvedCount > 0 && (
              <View style={styles.approvedBadge}>
                <CheckCircle size={11} color={COLORS.success} />
                <Text style={styles.approvedBadgeText}>{approvedCount} approuvé{approvedCount > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
        </View>

        {rows.length === 0 ? (
          <View style={styles.emptyDocs}>
            <FileText size={32} color={COLORS.grayMedium} />
            <Text style={styles.emptyDocsText}>Aucun document configuré</Text>
            <Pressable style={styles.uploadBtn} onPress={() => router.push('/(auth)/upload-documents')}>
              <Text style={styles.uploadBtnText}>Uploader mes documents</Text>
            </Pressable>
          </View>
        ) : (
          rows.map((row) => {
            const isNotSubmitted = row.status === 'not_submitted';
            return (
              <View
                key={row.type}
                style={[
                  styles.docCard,
                  row.status === 'approved'      && styles.docCardApproved,
                  row.status === 'rejected'      && styles.docCardRejected,
                  isNotSubmitted                 && styles.docCardMissing,
                ]}
              >
                <FileText size={18} color={isNotSubmitted ? COLORS.grayMedium : COLORS.grayDark} />
                <View style={styles.docInfo}>
                  <View style={styles.docLabelRow}>
                    <Text style={[styles.docLabel, isNotSubmitted && { color: COLORS.grayMedium }]}>
                      {row.label}
                    </Text>
                    <View style={[styles.reqBadge, row.required ? styles.reqBadgeRequired : styles.reqBadgeOptional]}>
                      <Text style={[styles.reqBadgeText, row.required ? styles.reqBadgeTextReq : styles.reqBadgeTextOpt]}>
                        {row.required ? 'Obligatoire' : 'Facultatif'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[
                    styles.docStatus,
                    row.status === 'approved'      && { color: COLORS.success },
                    row.status === 'rejected'      && { color: COLORS.error },
                    row.status === 'pending'       && { color: COLORS.warning },
                    isNotSubmitted                 && { color: COLORS.grayMedium },
                  ]}>
                    {row.status === 'approved'      ? 'Approuvé'
                      : row.status === 'rejected'   ? 'Rejeté'
                      : row.status === 'pending'    ? 'En attente'
                      : 'Non soumis'}
                  </Text>
                  {row.rejectionReason && (
                    <Text style={styles.docRejection}>↳ {row.rejectionReason}</Text>
                  )}
                </View>
                <DocStatusIcon status={row.status} />
              </View>
            );
          })
        )}

        {/* Bouton corriger si rejet */}
        {(driverStatus === 'rejected' || hasRejectedDocs) && (
          <Pressable style={styles.resubmitBtn} onPress={() => router.push('/pending-review' as never)}>
            <Text style={styles.resubmitBtnText}>Corriger et re-soumettre</Text>
          </Pressable>
        )}

        {/* Bouton soumettre si docs non soumis et compte pending */}
        {driverStatus !== 'approved' && rows.some(r => r.status === 'not_submitted' && r.required) && (
          <Pressable style={styles.uploadMissingBtn} onPress={() => router.push('/(auth)/upload-documents')}>
            <Text style={styles.uploadMissingBtnText}>Soumettre les documents manquants</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black },
  refreshBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll:      { padding: SPACING.md, paddingBottom: 40 },

  statusCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.card, padding: SPACING.md,
    marginBottom: SPACING.lg, borderWidth: 1.5,
  },
  statusCardText:  { flex: 1 },
  statusCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginBottom: 4 },
  statusCardDesc:  { fontSize: 13, color: COLORS.grayDark, lineHeight: 18 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  sectionTitle:  { fontSize: 12, fontWeight: '700', color: COLORS.grayDark, textTransform: 'uppercase', letterSpacing: 0.5 },
  counterRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterText:   { fontSize: 12, fontWeight: '600', color: COLORS.grayMedium },
  approvedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e8f8ee', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  approvedBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.success },

  docCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, marginBottom: 8,
    borderWidth: 1.5, borderColor: COLORS.grayLight,
  },
  docCardApproved: { borderColor: `${COLORS.success}55`, backgroundColor: '#f0fdf4' },
  docCardRejected: { borderColor: `${COLORS.error}55`,   backgroundColor: '#fef2f2' },
  docCardMissing:  { borderColor: COLORS.grayLight,       backgroundColor: '#fafafa', borderStyle: 'dashed' },

  docLabelRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  docInfo:      { flex: 1 },
  docLabel:     { fontSize: 13, fontWeight: '600', color: COLORS.black },
  docStatus:    { fontSize: 12, fontWeight: '600', marginTop: 3 },
  docRejection: { fontSize: 11, color: COLORS.error, marginTop: 3, lineHeight: 15 },

  reqBadge:         { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  reqBadgeRequired: { backgroundColor: '#fef2f2' },
  reqBadgeOptional: { backgroundColor: '#eff6ff' },
  reqBadgeText:     { fontSize: 9, fontWeight: '700' },
  reqBadgeTextReq:  { color: '#ef4444' },
  reqBadgeTextOpt:  { color: '#3b82f6' },

  emptyDocs:    { alignItems: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyDocsText:{ fontSize: 14, color: COLORS.grayMedium },
  uploadBtn:    { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.button, paddingVertical: 12, paddingHorizontal: 24, marginTop: SPACING.sm },
  uploadBtnText:{ fontSize: 14, fontWeight: '700', color: COLORS.white },

  resubmitBtn:     { backgroundColor: COLORS.error, borderRadius: BORDER_RADIUS.button, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.md },
  resubmitBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  uploadMissingBtn:     { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.button, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.sm },
  uploadMissingBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
