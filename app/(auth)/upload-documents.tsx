import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS } from '@aerocab/shared';
import { Button } from '@aerocab/mobile-ui';
import { FileText, CreditCard, FileCheck2, Camera, FolderOpen, Check } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

const REQUIRED_DOCS: { type: string; label: string; description: string; icon: LucideIcon }[] = [
  {
    type: 'cni_front',
    label: 'CNI Recto',
    description: "Face avant de votre carte d'identite",
    icon: FileText,
  },
  {
    type: 'cni_back',
    label: 'CNI Verso',
    description: "Face arriere de votre carte d'identite",
    icon: FileText,
  },
  {
    type: 'license',
    label: 'Permis de conduire',
    description: 'Permis de conduire en cours de validite',
    icon: CreditCard,
  },
  {
    type: 'registration',
    label: 'Carte grise',
    description: 'Carte grise du vehicule',
    icon: FileCheck2,
  },
  {
    type: 'vehicle_photo',
    label: 'Photo du vehicule',
    description: 'Photo de face de votre vehicule',
    icon: Camera,
  },
];

export default function UploadDocumentsScreen() {
  const token = useAuthStore((s) => s.token);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();

  const allUploaded =
    REQUIRED_DOCS.every((doc) => uploadedDocs[doc.type]);

  const handleUploadDoc = async (docType: string) => {
    setUploading(docType);

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Toast.show({ type: 'error', text1: 'Permission requise', text2: "Autorisez l'acces a la galerie" });
        setUploading(null);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) {
        setUploading(null);
        return;
      }

      const uri = result.assets[0].uri;
      // TODO: Upload to S3/storage and get real URL
      // For now, use the local URI as placeholder
      const fileUrl = uri;

      await api.uploadDriverDocument(token!, {
        type: docType,
        fileUrl,
      });

      setUploadedDocs((prev) => ({ ...prev, [docType]: true }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Echec de l'upload";
      Toast.show({ type: 'error', text1: 'Erreur', text2: message });
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async () => {
    if (!allUploaded) {
      Toast.show({ type: 'error', text1: 'Documents manquants', text2: 'Veuillez uploader tous les documents requis' });
      return;
    }

    setSubmitting(true);

    try {
      await api.submitDriverForReview(token!);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Echec de la soumission';
      Toast.show({ type: 'error', text1: 'Erreur', text2: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        {/* Header */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <FolderOpen size={32} color={COLORS.accent} />
          </View>
        </View>

        <Text style={styles.title}>Documents requis</Text>
        <Text style={styles.subtitle}>
          Uploadez vos documents pour la verification de votre profil chauffeur
        </Text>

        {/* Progress */}
        <View style={styles.progressRow}>
          <View style={[styles.progressDot, styles.progressDotDone]} />
          <View style={[styles.progressLine, styles.progressLineDone]} />
          <View style={[styles.progressDot, styles.progressDotDone]} />
          <View style={[styles.progressLine, styles.progressLineDone]} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
        </View>
        <Text style={styles.stepText}>Etape 3 sur 3</Text>

        {/* Document list */}
        <View style={styles.docList}>
          {REQUIRED_DOCS.map((doc) => {
            const isUploaded = uploadedDocs[doc.type];
            const isUploading = uploading === doc.type;
            const DocIcon = doc.icon;

            return (
              <Pressable
                key={doc.type}
                style={({ pressed }) => [
                  styles.docCard,
                  isUploaded && styles.docCardDone,
                  pressed && !isUploaded && styles.docCardPressed,
                ]}
                onPress={() => !isUploaded && handleUploadDoc(doc.type)}
                disabled={isUploading}
              >
                <View
                  style={[
                    styles.docIcon,
                    isUploaded && styles.docIconDone,
                  ]}
                >
                  {isUploaded ? (
                    <Check size={20} color={COLORS.success} />
                  ) : (
                    <DocIcon size={20} color={COLORS.primary} />
                  )}
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docLabel}>{doc.label}</Text>
                  <Text style={styles.docDescription}>
                    {isUploaded ? 'Document uploade' : doc.description}
                  </Text>
                </View>
                {!isUploaded && (
                  <View style={styles.uploadBadge}>
                    <Text style={styles.uploadBadgeText}>
                      {isUploading ? '...' : 'Upload'}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Counter */}
        <Text style={styles.counterText}>
          {Object.keys(uploadedDocs).length} / {REQUIRED_DOCS.length} documents uploades
        </Text>

        <Button
          title="Soumettre pour verification"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!allUploaded}
          size="large"
          style={{ marginTop: SPACING.sm }}
        />

        <Pressable
          style={styles.skipButton}
          onPress={() => {
            Alert.alert(
              'Completer plus tard',
              'Sans vos documents, votre profil ne sera pas verifie et vous ne pourrez pas recevoir de demandes. Continuer ?',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Continuer', onPress: () => router.replace('/(tabs)') },
              ]
            );
          }}
        >
          <Text style={styles.skipText}>Completer plus tard</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: 0,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: `${COLORS.accent}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.grayDark,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.grayLight,
  },
  progressDotDone: {
    backgroundColor: COLORS.success,
  },
  progressDotActive: {
    backgroundColor: COLORS.accent,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.grayLight,
  },
  progressLineDone: {
    backgroundColor: COLORS.success,
  },
  stepText: {
    fontSize: 12,
    color: COLORS.grayMedium,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  docList: {
    gap: 10,
    marginBottom: SPACING.md,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  docCardDone: {
    backgroundColor: `${COLORS.success}08`,
    borderWidth: 1,
    borderColor: `${COLORS.success}30`,
  },
  docCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconDone: {
    backgroundColor: `${COLORS.success}15`,
  },
  docIconText: {
    fontSize: 20,
  },
  docInfo: {
    flex: 1,
  },
  docLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 2,
  },
  docDescription: {
    fontSize: 12,
    color: COLORS.grayMedium,
  },
  uploadBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.button,
    backgroundColor: `${COLORS.primary}10`,
  },
  uploadBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  counterText: {
    fontSize: 13,
    color: COLORS.grayMedium,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: `${COLORS.error}10`,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 14,
    color: COLORS.grayMedium,
    fontWeight: '500',
  },
});
