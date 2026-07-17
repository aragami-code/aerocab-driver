import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClipboardCheck, RefreshCw, LogOut, Upload, AlertTriangle, CheckCircle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../lib/shared';
import { useAuthStore } from '../stores/authStore';
import { useDriverConfigStore } from '../stores/configStore';
import { driverApi } from '../services/api';

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
  criminal_record:     'Casier judiciaire',
  proof_of_address:    'Justificatif de domicile',
  medical_certificate: 'Certificat médical',
  vaccination_card:    'Carte de vaccination',
  border_pass:         'Laissez-passer frontalier',
};

const MAX_SIDE = 1920;
const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;

type DocStatus = { type: string; status: string; rejectionReason: string | null; fileUrl: string };
type PickState = 'idle' | 'picking' | 'processing' | 'uploading';

export default function PendingReviewScreen() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const getSetting = useDriverConfigStore(s => s.getSetting);

  const getDocConfig = (): Record<string, { required: boolean }> => {
    try {
      const raw = getSetting('driver_document_config', '');
      if (!raw) return {};
      const arr: { type: string; required: boolean }[] = JSON.parse(raw);
      return Object.fromEntries(arr.map(d => [d.type, { required: d.required }]));
    } catch { return {}; }
  };

  const [profileStatus, setProfileStatus] = useState<'pending' | 'rejected' | 'suspended' | null>(null);
  const [documents, setDocuments] = useState<DocStatus[]>([]);
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [pickStates, setPickStates] = useState<Record<string, PickState>>({});
  const [submitting, setSubmitting] = useState(false);

  const rejectedDocs = documents.filter(d => d.status === 'rejected');
  const hasRejected = rejectedDocs.length > 0;
  const allRejectedReuploaded = hasRejected && rejectedDocs.every(d => pickStates[d.type] === 'done' as any);

  useEffect(() => { loadStatus(); }, []);

  const loadStatus = async () => {
    if (!token) return;
    setChecking(true);
    try {
      const [profile, docs] = await Promise.all([
        driverApi.getMyProfile(token),
        driverApi.getMyDocuments(token),
      ]);
      setProfileStatus(profile.status as any);
      setDocuments(docs);
      const hasAnyRejected = docs.some(d => d.status === 'rejected');
      if (profile.status === 'approved' && !hasAnyRejected) router.replace('/(tabs)');
    } catch {
      setStatusMsg('Impossible de vérifier le statut. Vérifiez votre connexion.');
    } finally {
      setChecking(false);
    }
  };

  const setDocPickState = (type: string, state: PickState | 'done') =>
    setPickStates(prev => ({ ...prev, [type]: state as any }));

  const reuploadDoc = (type: string) => {
    Alert.alert(
      'Remplacer le document',
      DOC_LABELS[type] ?? type,
      [
        { text: '🖼  Image (JPG/PNG)', onPress: () => pickImage(type) },
        { text: '📄  PDF',             onPress: () => pickPdf(type) },
        { text: 'Annuler', style: 'cancel' },
      ],
    );
  };

  const pickImage = async (type: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission refusée', text2: 'Autorisez l\'accès à la galerie.' });
      return;
    }
    setDocPickState(type, 'picking');
    // quality < 1 force expo-image-picker à sauvegarder en file:// (content:// casse manipulateAsync)
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.92, allowsEditing: false });
    if (result.canceled) { setDocPickState(type, 'idle'); return; }
    setDocPickState(type, 'processing');
    try {
      const asset = result.assets[0];
      const w = asset.width ?? 0;
      const h = asset.height ?? 0;
      if (w < MIN_WIDTH || h < MIN_HEIGHT) {
        const keep = await new Promise<boolean>((resolve) => {
          Alert.alert('Image trop petite', `${w}×${h}px — minimum ${MIN_WIDTH}×${MIN_HEIGHT}px\n\nUtiliser quand même ?`, [
            { text: 'Oui', onPress: () => resolve(true) },
            { text: 'Choisir une autre', style: 'cancel', onPress: () => resolve(false) },
          ]);
        });
        if (!keep) { setDocPickState(type, 'idle'); return; }
      }
      const needsResize = w > MAX_SIDE || h > MAX_SIDE;
      let finalW = w; let finalH = h;
      const transforms: Parameters<typeof manipulateAsync>[1] = [];
      if (needsResize) {
        const ratio = Math.min(MAX_SIDE / w, MAX_SIDE / h);
        finalW = Math.round(w * ratio); finalH = Math.round(h * ratio);
        transforms.push({ resize: { width: finalW, height: finalH } });
      }
      // Toujours passer par manipulateAsync pour forcer un URI file://
      // (content:// Android échoue silencieusement dans fetch FormData)
      let uri = asset.uri;
      try {
        const m = await manipulateAsync(asset.uri, transforms, { compress: 0.85, format: SaveFormat.JPEG });
        uri = m.uri;
        if (needsResize) Toast.show({ type: 'success', text1: 'Image redimensionnée', text2: `${w}×${h} → ${finalW}×${finalH}px` });
      } catch { /* fallback : uri content:// d'origine */ }
      await uploadDoc(type, uri, 'image/jpeg', `${type}.jpg`);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? 'Impossible de charger l\'image.' });
      setDocPickState(type, 'idle');
    }
  };

  const pickPdf = async (type: string) => {
    setDocPickState(type, 'picking');
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled) { setDocPickState(type, 'idle'); return; }
    setDocPickState(type, 'processing');
    const asset = result.assets[0];
    const sizeKb = asset.size ? asset.size / 1024 : 0;
    if (sizeKb > 10 * 1024) {
      Toast.show({ type: 'error', text1: 'PDF trop volumineux', text2: `${(sizeKb / 1024).toFixed(1)} Mo — max 10 Mo.` });
      setDocPickState(type, 'idle');
      return;
    }
    await uploadDoc(type, asset.uri, 'application/pdf', asset.name ?? `${type}.pdf`);
  };

  const uploadDoc = async (type: string, uri: string, mimeType: string, name: string) => {
    if (!token) return;
    setDocPickState(type, 'uploading');
    try {
      await driverApi.uploadDocument(token, { type: type as any, uri, mimeType, name });
      setDocPickState(type, 'done' as any);
      setDocuments(prev => prev.map(d => d.type === type ? { ...d, status: 'pending' } : d));
      Toast.show({ type: 'success', text1: 'Document envoyé', text2: DOC_LABELS[type] ?? type });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur upload', text2: e?.message ?? 'Réessayez.' });
      setDocPickState(type, 'idle');
    }
  };

  const handleResubmit = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await driverApi.submitForReview(token);
      Toast.show({ type: 'success', text1: 'Dossier soumis', text2: 'Votre dossier est à nouveau en cours de vérification.' });
      await loadStatus();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? 'Impossible de soumettre.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => { logout(); router.replace('/(auth)/login'); };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.springify()} style={styles.card}>
          {/* Icône + titre selon statut */}
          <View style={[styles.iconWrap, hasRejected && styles.iconWrapRejected]}>
            {hasRejected
              ? <AlertTriangle size={48} color="#ef4444" strokeWidth={1.5} />
              : <ClipboardCheck size={48} color={COLORS.accent} strokeWidth={1.5} />
            }
          </View>

          <Text style={styles.title}>
            {hasRejected ? 'Documents refusés' : 'Dossier en cours de vérification'}
          </Text>
          <Text style={styles.body}>
            {hasRejected
              ? 'Certains documents ont été refusés par notre équipe. Veuillez les remplacer ci-dessous.'
              : `Votre dossier est en cours de vérification.\nCe processus prend généralement `
            }
            {!hasRejected && <Text style={styles.bold}>24 à 48 heures</Text>}
            {!hasRejected && `.`}
          </Text>

          {/* Étapes (si pas de rejet) */}
          {!hasRejected && (
            <View style={styles.steps}>
              {[
                { label: 'Inscription', done: true },
                { label: 'Documents soumis', done: true },
                { label: 'Vérification en cours', done: false, active: true },
                { label: 'Compte activé', done: false },
              ].map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepDot, step.done && styles.stepDotDone, step.active && styles.stepDotActive]} />
                  <Text style={[styles.stepLabel, step.done && styles.stepLabelDone, step.active && styles.stepLabelActive]}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Documents rejetés à re-uploader */}
          {hasRejected && (
            <View style={styles.docsSection}>
              {rejectedDocs.map((doc) => {
                const ps = pickStates[doc.type] ?? 'idle';
                const isDone = ps === ('done' as any);
                const isBusy = ps === 'picking' || ps === 'processing' || ps === 'uploading';
                const docConfig = getDocConfig();
                const isRequired = docConfig[doc.type]?.required ?? true;
                return (
                  <View key={doc.type} style={[styles.docRow, isDone && styles.docRowDone]}>
                    <View style={styles.docInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.docLabel}>{DOC_LABELS[doc.type] ?? doc.type}</Text>
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: isRequired ? '#fef2f2' : '#eff6ff' }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isRequired ? '#ef4444' : '#3b82f6' }}>
                            {isRequired ? 'Obligatoire' : 'Facultatif'}
                          </Text>
                        </View>
                      </View>
                      {doc.rejectionReason && !isDone && (
                        <Text style={styles.docReason}>↳ {doc.rejectionReason}</Text>
                      )}
                      {isBusy && (
                        <Text style={styles.docStatus}>
                          {ps === 'picking' ? 'Sélection…' : ps === 'processing' ? 'Traitement…' : 'Envoi en cours…'}
                        </Text>
                      )}
                      {isDone && <Text style={styles.docStatusOk}>✓ Document envoyé</Text>}
                    </View>
                    {isBusy
                      ? <ActivityIndicator color={COLORS.primary} />
                      : isDone
                        ? <CheckCircle size={22} color={COLORS.success} />
                        : (
                          <Pressable style={styles.uploadBtn} onPress={() => reuploadDoc(doc.type)}>
                            <Upload size={16} color={COLORS.white} />
                            <Text style={styles.uploadBtnText}>Remplacer</Text>
                          </Pressable>
                        )
                    }
                  </View>
                );
              })}
            </View>
          )}

          {/* Bouton re-soumettre (après re-upload de tous les docs rejetés) */}
          {hasRejected && rejectedDocs.every(d => (pickStates[d.type] as any) === 'done') && (
            <Pressable
              style={[styles.checkBtn, submitting && { opacity: 0.6 }]}
              onPress={handleResubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <RefreshCw size={16} color={COLORS.white} />
              }
              <Text style={styles.checkBtnText}>
                {submitting ? 'Soumission…' : 'Soumettre à nouveau'}
              </Text>
            </Pressable>
          )}

          {/* Bouton vérifier statut (si pas de rejet) */}
          {!hasRejected && (
            <Pressable
              style={[styles.checkBtn, checking && { opacity: 0.6 }]}
              onPress={loadStatus}
              disabled={checking}
            >
              {checking
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <RefreshCw size={16} color={COLORS.white} />
              }
              <Text style={styles.checkBtnText}>
                {checking ? 'Vérification…' : 'Vérifier le statut'}
              </Text>
            </Pressable>
          )}

          {statusMsg ? (
            <View style={styles.statusBanner}>
              <Text style={styles.statusMsg}>{statusMsg}</Text>
            </View>
          ) : null}

          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={14} color={COLORS.grayMedium} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  scroll:          { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  card:            { backgroundColor: COLORS.white, borderRadius: 24, padding: SPACING.xl, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
  iconWrap:        { width: 88, height: 88, borderRadius: 28, backgroundColor: `${COLORS.accent}15`, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  iconWrapRejected:{ backgroundColor: '#fef2f2' },
  title:           { fontSize: 20, fontWeight: '800', color: COLORS.black, textAlign: 'center', marginBottom: SPACING.md },
  body:            { fontSize: 14, color: COLORS.grayDark, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl },
  bold:            { fontWeight: '700', color: COLORS.black },
  steps:           { alignSelf: 'stretch', marginBottom: SPACING.xl, gap: 12 },
  stepRow:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot:         { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.grayLight },
  stepDotDone:     { backgroundColor: COLORS.accent },
  stepDotActive:   { backgroundColor: COLORS.primary, width: 14, height: 14, borderRadius: 7 },
  stepLabel:       { fontSize: 14, color: COLORS.grayMedium },
  stepLabelDone:   { color: COLORS.accent, fontWeight: '600' },
  stepLabelActive: { color: COLORS.primary, fontWeight: '700' },
  docsSection:     { alignSelf: 'stretch', gap: 10, marginBottom: SPACING.lg },
  docRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: BORDER_RADIUS.card, padding: SPACING.md, gap: 12, borderWidth: 1, borderColor: '#fecaca' },
  docRowDone:      { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  docInfo:         { flex: 1 },
  docLabel:        { fontSize: 13, fontWeight: '700', color: COLORS.black },
  docReason:       { fontSize: 11, color: '#ef4444', marginTop: 2 },
  docStatus:       { fontSize: 11, color: COLORS.primary, marginTop: 2, fontStyle: 'italic' },
  docStatusOk:     { fontSize: 11, color: '#16a34a', marginTop: 2, fontWeight: '600' },
  uploadBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  uploadBtnText:   { fontSize: 12, fontWeight: '700', color: COLORS.white },
  checkBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16, marginBottom: SPACING.md, alignSelf: 'stretch', justifyContent: 'center' },
  checkBtnText:    { fontSize: 15, fontWeight: '700', color: COLORS.white },
  statusBanner:    { backgroundColor: `${COLORS.primary}10`, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.md, alignSelf: 'stretch' },
  statusMsg:       { fontSize: 13, color: COLORS.primary, textAlign: 'center', fontWeight: '500' },
  logoutBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  logoutText:      { fontSize: 13, color: COLORS.grayMedium },
});
