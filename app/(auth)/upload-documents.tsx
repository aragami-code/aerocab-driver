import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { CheckCircle, Upload, ChevronLeft, FileText, X, AlertTriangle } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDriverConfigStore } from '../../stores/configStore';
import { driverApi } from '../../services/api';

type DocConfig = {
  type: string; label: string; required: boolean; enabled: boolean;
  description?: string; acceptedExtensions?: string[];
};

const DEFAULT_DOCS: DocConfig[] = [
  { type: 'cni_front',     label: 'CNI — Recto',        required: true,  enabled: true, description: 'Face avant de votre carte nationale',        acceptedExtensions: ['jpg','png','pdf'] },
  { type: 'cni_back',      label: 'CNI — Verso',         required: true,  enabled: true, description: "Face arrière de votre carte nationale",       acceptedExtensions: ['jpg','png','pdf'] },
  { type: 'license',       label: 'Permis de conduire',  required: true,  enabled: true, description: 'Permis en cours de validité',                 acceptedExtensions: ['jpg','png','pdf'] },
  { type: 'registration',  label: 'Carte grise',         required: true,  enabled: true, description: "Document d'immatriculation du véhicule",      acceptedExtensions: ['jpg','png','pdf'] },
  { type: 'vehicle_photo', label: 'Photo du véhicule',   required: true,  enabled: true, description: 'Vue de face du véhicule',                     acceptedExtensions: ['jpg','png'] },
];

const DOC_DESCS: Record<string, string> = {
  cni_front:          'Face avant de votre carte nationale',
  cni_back:           'Face arrière de votre carte nationale',
  license:            'Permis en cours de validité',
  registration:       "Document d'immatriculation du véhicule",
  vehicle_photo:      'Vue de face du véhicule',
  insurance:          'Attestation couvrant le transport de personnes',
  technical_control:  'Contrôle technique en cours de validité',
  vtc_license:        'Autorisation officielle de transport VTC',
  passport:           'Passeport en cours de validité',
  portrait:           'Selfie face caméra, fond neutre',
  selfie:             'Photo de vous tenant votre CNI',
  criminal_record:    'Bulletin n°3 daté de moins de 3 mois',
  proof_of_address:   'Facture ou relevé de moins de 3 mois',
  medical_certificate:'Attestation d\'aptitude à la conduite',
  vaccination_card:   'Carnet de vaccination à jour',
  border_pass:        'Document frontalier valide',
};

const MIN_WIDTH  = 400;
const MIN_HEIGHT = 300;
const MAX_SIDE   = 1920;
const MAX_PDF_MB = 10;

type FileInfo = { uri: string; mimeType: string; name: string; isPdf: boolean; width?: number; height?: number; sizeKb?: number };
type PickState = 'idle' | 'choosing' | 'processing';

export default function UploadDocumentsScreen() {
  const token = useAuthStore((s) => s.token);
  const getSetting = useDriverConfigStore(s => s.getSetting);

  const [docs, setDocs] = useState<DocConfig[]>(DEFAULT_DOCS);
  const [uploads, setUploads]   = useState<Record<string, FileInfo | null>>({});
  const [pickState, setPickState] = useState<Record<string, PickState>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Charger la config depuis le configStore (driver_document_config est dans /config)
  useEffect(() => {
    const raw = getSetting('driver_document_config', '');
    if (raw) {
      try {
        const parsed: DocConfig[] = JSON.parse(raw);
        const enabled = parsed.filter(d => d.enabled);
        if (enabled.length > 0) {
          setDocs(enabled);
          const initUploads: Record<string, FileInfo | null> = {};
          const initPick: Record<string, PickState> = {};
          enabled.forEach(d => { initUploads[d.type] = null; initPick[d.type] = 'idle'; });
          setUploads(initUploads);
          setPickState(initPick);
          return;
        }
      } catch { /* fallback */ }
    }
    // Fallback defaults
    const initUploads: Record<string, FileInfo | null> = {};
    const initPick: Record<string, PickState> = {};
    DEFAULT_DOCS.forEach(d => { initUploads[d.type] = null; initPick[d.type] = 'idle'; });
    setUploads(initUploads);
    setPickState(initPick);
  }, [getSetting]);

  const setPs = (type: string, state: PickState) =>
    setPickState(prev => ({ ...prev, [type]: state }));

  const pickFile = (type: string) => {
    setPs(type, 'choosing');
    Alert.alert('Type de document', 'Choisissez le format', [
      { text: '🖼  Image (JPG / PNG)', onPress: () => doPickImage(type) },
      { text: '📄  PDF',               onPress: () => doPickPdf(type) },
      { text: 'Annuler', style: 'cancel', onPress: () => setPs(type, 'idle') },
    ]);
  };

  const doPickImage = async (type: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.92, allowsEditing: false, exif: false,
      });
      if (result.canceled) { setPs(type, 'idle'); return; }
      const asset = result.assets[0];
      setPs(type, 'processing');
      const w = asset.width ?? 0;
      const h = asset.height ?? 0;
      if (w < MIN_WIDTH || h < MIN_HEIGHT) {
        const keep = await new Promise<boolean>((resolve) => Alert.alert(
          'Image trop petite',
          `${w}×${h}px — Minimum : ${MIN_WIDTH}×${MIN_HEIGHT}px\nUtiliser quand même ?`,
          [{ text: 'Utiliser quand même', onPress: () => resolve(true) }, { text: 'Choisir une autre', style: 'cancel', onPress: () => resolve(false) }],
        ));
        if (!keep) { setPs(type, 'idle'); return; }
      }
      const needsResize = w > MAX_SIDE || h > MAX_SIDE;
      let finalW = w, finalH = h;
      const transforms: Parameters<typeof manipulateAsync>[1] = [];
      if (needsResize) {
        const ratio = Math.min(MAX_SIDE / w, MAX_SIDE / h);
        finalW = Math.round(w * ratio); finalH = Math.round(h * ratio);
        transforms.push({ resize: { width: finalW, height: finalH } });
      }
      // Toujours passer par manipulateAsync pour forcer un URI file://
      // (content:// Android échoue silencieusement dans fetch FormData)
      let finalUri = asset.uri;
      try {
        const m = await manipulateAsync(asset.uri, transforms, { compress: 0.85, format: SaveFormat.JPEG });
        finalUri = m.uri;
      } catch { /* fallback : uri d'origine */ }
      setUploads(prev => ({ ...prev, [type]: { uri: finalUri, mimeType: 'image/jpeg', name: asset.fileName ?? `${type}.jpg`, isPdf: false, width: finalW, height: finalH } }));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? "Impossible de charger l'image." });
    } finally { setPs(type, 'idle'); }
  };

  const doPickPdf = async (type: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (result.canceled) { setPs(type, 'idle'); return; }
      setPs(type, 'processing');
      const asset = result.assets[0];
      const sizeKb = asset.size ? Math.round(asset.size / 1024) : undefined;
      if (sizeKb && sizeKb > MAX_PDF_MB * 1024) {
        Toast.show({ type: 'error', text1: 'PDF trop volumineux', text2: `${(sizeKb / 1024).toFixed(1)} Mo — max ${MAX_PDF_MB} Mo.` });
        setPs(type, 'idle'); return;
      }
      setUploads(prev => ({ ...prev, [type]: { uri: asset.uri, mimeType: 'application/pdf', name: asset.name ?? `${type}.pdf`, isPdf: true, sizeKb } }));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? 'Impossible de charger le PDF.' });
    } finally { setPs(type, 'idle'); }
  };

  const removeFile = (type: string) => setUploads(prev => ({ ...prev, [type]: null }));

  const requiredDocs   = docs.filter(d => d.required);
  const optionalDocs   = docs.filter(d => !d.required);
  const requiredReady  = requiredDocs.every(d => !!uploads[d.type]);
  const uploadedCount  = Object.values(uploads).filter(Boolean).length;

  const handleSubmit = async () => {
    if (!requiredReady || !token) return;
    setSubmitting(true);
    try {
      const toUpload = docs.filter(d => !!uploads[d.type]);
      for (const doc of toUpload) {
        setUploading(doc.type);
        const file = uploads[doc.type]!;
        await driverApi.uploadDocument(token, { type: doc.type, uri: file.uri, mimeType: file.mimeType, name: file.name });
      }
      setUploading(null);
      await driverApi.submitForReview(token);
      router.replace('/pending-review' as never);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? 'Impossible de soumettre.' });
    } finally { setSubmitting(false); setUploading(null); }
  };

  const renderDoc = (doc: DocConfig) => {
    const file  = uploads[doc.type];
    const state = pickState[doc.type] ?? 'idle';
    const isUpl = uploading === doc.type;
    const busy  = state !== 'idle' || submitting;
    return (
      <View key={doc.type} style={[styles.card, file && styles.cardDone, isUpl && styles.cardUploading, !doc.required && styles.cardOptional]}>
        <Pressable style={styles.cardInner} onPress={() => !busy && pickFile(doc.type)} disabled={busy}>
          <View style={styles.thumbBox}>
            {state !== 'idle' ? <ActivityIndicator color={COLORS.primary} /> :
              file?.isPdf ? <View style={styles.pdfThumb}><FileText size={26} color={COLORS.primary} /></View> :
              file ? <Image source={{ uri: file.uri }} style={styles.imgThumb} resizeMode="cover" /> :
              <View style={styles.emptyThumb}><Upload size={22} color={COLORS.grayMedium} /></View>}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.labelRow}>
              <Text style={styles.cardLabel}>{doc.label}</Text>
              <View style={[styles.badge, doc.required ? styles.badgeRequired : styles.badgeOptional]}>
                <Text style={[styles.badgeText, doc.required ? styles.badgeTextRequired : styles.badgeTextOptional]}>
                  {doc.required ? 'Obligatoire' : 'Facultatif'}
                </Text>
              </View>
            </View>
            {state === 'idle' && !file && (
              <>
                <Text style={styles.cardDesc}>{doc.description ?? DOC_DESCS[doc.type] ?? ''}</Text>
                {doc.acceptedExtensions && doc.acceptedExtensions.length > 0 && (
                  <View style={styles.extRow}>
                    {doc.acceptedExtensions.map(ext => (
                      <View key={ext} style={styles.extBadge}>
                        <Text style={styles.extText}>{ext.toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
            {state !== 'idle' && <Text style={styles.statusText}>{state === 'choosing' ? 'Format…' : 'Traitement…'}</Text>}
            {state === 'idle' && file && !isUpl && (
              <>
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                {file.isPdf && file.sizeKb && <Text style={styles.fileMeta}>{(file.sizeKb / 1024).toFixed(1)} Mo</Text>}
                {!file.isPdf && file.width && <Text style={styles.fileMeta}>{file.width}×{file.height}px</Text>}
              </>
            )}
            {isUpl && <View style={styles.uploadingRow}><ActivityIndicator size="small" color={COLORS.primary} /><Text style={styles.statusText}>Envoi…</Text></View>}
          </View>
          {file && state === 'idle' && !isUpl && <CheckCircle size={22} color={COLORS.success} />}
          {!file && state === 'idle' && <View style={styles.addBadge}><Text style={styles.addBadgeText}>+</Text></View>}
        </Pressable>
        {file && !submitting && <Pressable style={styles.removeBtn} onPress={() => removeFile(doc.type)}><X size={12} color={COLORS.white} /></Pressable>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color={COLORS.black} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.stepBadge}><Text style={styles.stepText}>Étape 4 / 4</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Vos documents</Text>
        <Text style={styles.subtitle}>
          Formats acceptés : JPG, PNG ou PDF (max {MAX_PDF_MB} Mo).{'\n'}
          Images : minimum {MIN_WIDTH}×{MIN_HEIGHT}px.
        </Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { flex: uploadedCount }]} />
          <View style={{ flex: Math.max(docs.length - uploadedCount, 0) }} />
        </View>
        <Text style={styles.progressText}>
          {uploadedCount} / {docs.length} · {requiredDocs.filter(d => !!uploads[d.type]).length}/{requiredDocs.length} obligatoires
        </Text>

        {requiredDocs.length > 0 && (
          <>
            <Text style={styles.groupLabel}>Obligatoires</Text>
            {requiredDocs.map(renderDoc)}
          </>
        )}

        {optionalDocs.length > 0 && (
          <>
            <View style={styles.optionalHeader}>
              <Text style={styles.groupLabel}>Facultatifs</Text>
              <AlertTriangle size={14} color={COLORS.grayMedium} />
            </View>
            <Text style={styles.optionalNote}>Ces documents peuvent accélérer votre validation.</Text>
            {optionalDocs.map(renderDoc)}
          </>
        )}

        <Pressable
          style={[styles.submitBtn, (!requiredReady || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!requiredReady || submitting}
        >
          {submitting ? (
            <View style={styles.row}>
              <ActivityIndicator color={COLORS.white} />
              <Text style={styles.submitText}>
                {uploading ? `Envoi ${docs.findIndex(d => d.type === uploading) + 1}/${docs.filter(d => !!uploads[d.type]).length}…` : 'Finalisation…'}
              </Text>
            </View>
          ) : (
            <Text style={styles.submitText}>
              {requiredReady
                ? 'Soumettre mon dossier'
                : `Encore ${requiredDocs.filter(d => !uploads[d.type]).length} obligatoire(s) manquant(s)`}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.white },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  stepBadge:      { backgroundColor: `${COLORS.primary}12`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  stepText:       { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  content:        { padding: SPACING.lg, paddingBottom: 56 },
  title:          { fontSize: 24, fontWeight: '800', color: COLORS.black, marginBottom: 8 },
  subtitle:       { fontSize: 13, color: COLORS.grayMedium, marginBottom: SPACING.md, lineHeight: 19 },

  progressTrack:  { height: 6, backgroundColor: COLORS.grayLight, borderRadius: 3, flexDirection: 'row', marginBottom: 6, overflow: 'hidden' },
  progressFill:   { backgroundColor: COLORS.primary, borderRadius: 3 },
  progressText:   { fontSize: 12, color: COLORS.grayMedium, textAlign: 'right', marginBottom: SPACING.lg },

  groupLabel:     { fontSize: 12, fontWeight: '700', color: COLORS.grayMedium, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  optionalHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  optionalNote:   { fontSize: 12, color: COLORS.grayMedium, marginBottom: 8, fontStyle: 'italic' },

  card:           { backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.card, marginBottom: 10, borderWidth: 1.5, borderColor: COLORS.grayLight, overflow: 'hidden' },
  cardDone:       { borderColor: '#22c55e60' },
  cardUploading:  { borderColor: `${COLORS.primary}60` },
  cardOptional:   { borderStyle: 'dashed' },
  cardInner:      { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: 14 },

  thumbBox:       { width: 64, height: 52, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  emptyThumb:     { width: 64, height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.grayLight, borderStyle: 'dashed', backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  imgThumb:       { width: 64, height: 52, borderRadius: 10 },
  pdfThumb:       { width: 64, height: 52, borderRadius: 10, backgroundColor: `${COLORS.primary}12`, alignItems: 'center', justifyContent: 'center' },

  cardInfo:       { flex: 1 },
  labelRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardLabel:      { fontSize: 14, fontWeight: '700', color: COLORS.black },
  badge:          { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeRequired:  { backgroundColor: '#fef2f2' },
  badgeOptional:  { backgroundColor: '#eff6ff' },
  badgeText:      { fontSize: 10, fontWeight: '700' },
  badgeTextRequired: { color: '#ef4444' },
  badgeTextOptional: { color: '#3b82f6' },
  cardDesc:       { fontSize: 12, color: COLORS.grayMedium, marginTop: 3 },
  extRow:         { flexDirection: 'row', gap: 4, marginTop: 5, flexWrap: 'wrap' },
  extBadge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: `${COLORS.primary}12`, borderWidth: 1, borderColor: `${COLORS.primary}30` },
  extText:        { fontSize: 9, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.3 },
  fileName:       { fontSize: 12, color: COLORS.primary, marginTop: 2, fontWeight: '500' },
  fileMeta:       { fontSize: 11, color: COLORS.grayMedium, marginTop: 1 },
  statusText:     { fontSize: 12, color: COLORS.primary, marginTop: 2, fontStyle: 'italic' },
  uploadingRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },

  addBadge:       { width: 24, height: 24, borderRadius: 12, backgroundColor: `${COLORS.primary}15`, alignItems: 'center', justifyContent: 'center' },
  addBadgeText:   { fontSize: 18, color: COLORS.primary, lineHeight: 22 },
  removeBtn:      { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },

  submitBtn:      { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: SPACING.md },
  submitDisabled: { opacity: 0.45 },
  submitText:     { fontSize: 16, fontWeight: '700', color: COLORS.white },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
