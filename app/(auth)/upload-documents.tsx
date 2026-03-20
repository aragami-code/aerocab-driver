import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { CheckCircle, Upload, ChevronLeft } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { driverApi } from '../../services/api';

type DocType = 'cni_front' | 'cni_back' | 'license' | 'registration' | 'vehicle_photo';

const DOCS: { type: DocType; label: string; desc: string }[] = [
  { type: 'cni_front', label: 'CNI — Recto', desc: 'Face avant de votre carte nationale' },
  { type: 'cni_back', label: 'CNI — Verso', desc: 'Face arrière de votre carte nationale' },
  { type: 'license', label: 'Permis de conduire', desc: 'Permis en cours de validité' },
  { type: 'registration', label: 'Carte grise', desc: 'Document d\'immatriculation du véhicule' },
  { type: 'vehicle_photo', label: 'Photo du véhicule', desc: 'Vue de face du véhicule' },
];

type FileInfo = { uri: string; mimeType: string };

export default function UploadDocumentsScreen() {
  const token = useAuthStore((s) => s.token);
  const [uploads, setUploads] = useState<Record<DocType, FileInfo | null>>({
    cni_front: null, cni_back: null, license: null, registration: null, vehicle_photo: null,
  });
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async (type: DocType) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUploads((prev) => ({
        ...prev,
        [type]: { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' },
      }));
    }
  };

  const allUploaded = Object.values(uploads).every((v) => v !== null);

  const handleSubmit = async () => {
    if (!allUploaded) {
      Toast.show({ type: 'error', text1: 'Documents manquants', text2: 'Veuillez uploader tous les documents.' });
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      // Upload chaque document en multipart FormData
      for (const doc of DOCS) {
        const file = uploads[doc.type]!;
        await driverApi.uploadDocument(token, {
          type: doc.type,
          uri: file.uri,
          mimeType: file.mimeType,
        });
      }
      // Soumettre pour vérification
      await driverApi.submitForReview(token);
      Toast.show({ type: 'success', text1: 'Documents envoyés ✅', text2: 'Votre dossier est en cours de vérification.' });
      router.replace('/(tabs)');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? 'Impossible de soumettre.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color={COLORS.black} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>Étape 3 / 3</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Vos documents</Text>
        <Text style={styles.subtitle}>Requis pour la vérification de votre profil. Formats JPG/PNG acceptés.</Text>

        {DOCS.map((doc) => {
          const uri = uploads[doc.type]; // FileInfo | null
          return (
            <Pressable key={doc.type} style={styles.docCard} onPress={() => pickImage(doc.type)}>
              {uri ? (
                <Image source={{ uri: uri.uri }} style={styles.docPreview} />
              ) : (
                <View style={styles.docPlaceholder}>
                  <Upload size={24} color={COLORS.grayMedium} />
                </View>
              )}
              <View style={styles.docInfo}>
                <Text style={styles.docLabel}>{doc.label}</Text>
                <Text style={styles.docDesc}>{doc.desc}</Text>
              </View>
              {uri && <CheckCircle size={22} color={COLORS.success} />}
            </Pressable>
          );
        })}

        <Pressable
          style={[styles.btn, (!allUploaded || submitting) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!allUploaded || submitting}
        >
          {submitting
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.btnText}>Soumettre mon dossier</Text>
          }
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  stepBadge: { backgroundColor: `${COLORS.primary}12`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  stepText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  content: { padding: SPACING.lg, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.black, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.grayMedium, marginBottom: SPACING.xl, lineHeight: 20 },
  docCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.card, padding: SPACING.md, marginBottom: 12, gap: 14, borderWidth: 1.5, borderColor: COLORS.grayLight },
  docPlaceholder: { width: 56, height: 44, borderRadius: 8, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.grayLight, borderStyle: 'dashed' },
  docPreview: { width: 56, height: 44, borderRadius: 8 },
  docInfo: { flex: 1 },
  docLabel: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  docDesc: { fontSize: 12, color: COLORS.grayMedium, marginTop: 2 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: SPACING.md },
  btnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
