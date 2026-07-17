import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, AlertTriangle, Send, CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../lib/shared';
import { driverApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

const CATEGORIES = [
  'Comportement du passager',
  'Problème de paiement',
  'Problème technique',
  'Accident / Incident',
  'Autre problème',
];

export default function ReportProblemScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const token = useAuthStore((s) => s.token)!;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCategory || !message.trim()) return;
    setLoading(true);
    try {
      await driverApi.submitReport(token, {
        bookingId: bookingId ?? undefined,
        reason: `${selectedCategory}: ${message}`,
      });
      setSubmitted(true);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible d\'envoyer le signalement.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <CheckCircle size={64} color={COLORS.success} />
          <Text style={styles.successTitle}>Signalement envoyé</Text>
          <Text style={styles.successText}>
            Votre signalement a été transmis à notre équipe. Vous recevrez une réponse dans les meilleurs délais.
          </Text>
          <Pressable style={styles.btn} onPress={() => router.back()}>
            <Text style={styles.btnText}>Fermer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.black} />
          </Pressable>
          <Text style={styles.headerTitle}>Signaler un problème</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.warningCard}>
            <AlertTriangle size={20} color="#D35400" />
            <Text style={styles.warningText}>
              {bookingId
                ? `Problème lors de la course #${bookingId.slice(-6).toUpperCase()} ?`
                : 'Signalez un problème général à notre équipe.'}
              {'\n'}Décrivez la situation pour que nous puissions intervenir rapidement.
            </Text>
          </View>

          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={6}
            placeholder="Décrivez ce qui s'est passé..."
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.btn, (!selectedCategory || !message.trim() || loading) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!selectedCategory || !message.trim() || loading}
          >
            <Send size={18} color={COLORS.white} />
            <Text style={styles.btnText}>{loading ? 'Envoi...' : 'Envoyer le signalement'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.grayLight,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  scrollContent: { padding: SPACING.lg, flexGrow: 1, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  warningCard: {
    flexDirection: 'row', gap: 12, backgroundColor: '#FFF5EB',
    padding: SPACING.md, borderRadius: 12, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: '#FFE0C2',
  },
  warningText: { flex: 1, fontSize: 13, color: '#D35400', lineHeight: 20 },
  label: { fontSize: 15, fontWeight: '700', color: COLORS.black, marginBottom: SPACING.md, marginTop: SPACING.sm },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SPACING.xl },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.grayLight,
  },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryText: { fontSize: 13, color: COLORS.grayDark, fontWeight: '600' },
  categoryTextActive: { color: COLORS.white },
  textInput: {
    backgroundColor: COLORS.background, borderRadius: 16, padding: SPACING.md,
    fontSize: 15, minHeight: 120, borderWidth: 1, borderColor: COLORS.grayLight,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, marginTop: SPACING.xl,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  successTitle: { fontSize: 22, fontWeight: '800', color: COLORS.black, marginTop: 24, marginBottom: 12 },
  successText: { fontSize: 15, color: COLORS.grayMedium, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
});
