import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable,
  ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Car, ChevronDown, ChevronUp } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { driverApi } from '../../services/api';

const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'pidgin', label: 'Pidgin' },
  { code: 'ewondo', label: 'Ewondo' },
  { code: 'douala', label: 'Douala' },
  { code: 'fulfulde', label: 'Fulfulde' },
  { code: 'bamileke', label: 'Bamiléké' },
];

export default function CompleteDriverProfileScreen() {
  const token = useAuthStore((s) => s.token);

  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['fr']);
  const [showLang, setShowLang] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleLang = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  };

  const handleSubmit = async () => {
    if (!vehicleBrand || !vehicleModel || !vehicleColor || !vehiclePlate || !vehicleYear) {
      Toast.show({ type: 'error', text1: 'Champs requis', text2: 'Veuillez remplir tous les champs.' });
      return;
    }
    if (!/^\d{4}$/.test(vehicleYear.trim())) {
      Toast.show({ type: 'error', text1: 'Année invalide', text2: 'Entrez une année à 4 chiffres (ex: 2020).' });
      return;
    }
    if (!token) return;
    setLoading(true);
    try {
      await driverApi.registerDriver(token, {
        vehicleBrand: vehicleBrand.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleColor: vehicleColor.trim(),
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        vehicleYear: vehicleYear.trim(),
        languages: selectedLanguages,
      });
      router.push('/(auth)/upload-documents');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? 'Impossible de créer le profil.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color={COLORS.black} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>Étape 2 / 3</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Car size={40} color={COLORS.primary} style={{ marginBottom: SPACING.md }} />
        <Text style={styles.title}>Votre véhicule</Text>
        <Text style={styles.subtitle}>Ces informations seront visibles par les passagers.</Text>

        <View style={styles.fieldGroup}>
          {[
            { label: 'Marque', value: vehicleBrand, setter: setVehicleBrand, placeholder: 'Toyota, Hyundai…' },
            { label: 'Modèle', value: vehicleModel, setter: setVehicleModel, placeholder: 'Corolla, Tucson…' },
            { label: 'Couleur', value: vehicleColor, setter: setVehicleColor, placeholder: 'Blanc, Noir, Gris…' },
            { label: 'Plaque', value: vehiclePlate, setter: setVehiclePlate, placeholder: 'LT 1234 AB' },
            { label: 'Année', value: vehicleYear, setter: setVehicleYear, placeholder: 'Ex: 2020' },
          ].map(({ label, value, setter, placeholder }) => (
            <View key={label} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setter}
                placeholder={placeholder}
                placeholderTextColor={COLORS.grayMedium}
                keyboardType={label === 'Année' ? 'numeric' : 'default'}
                maxLength={label === 'Année' ? 4 : undefined}
              />
            </View>
          ))}
        </View>

        {/* Language selector */}
        <Pressable style={styles.langToggle} onPress={() => setShowLang((v) => !v)}>
          <Text style={styles.langToggleText}>
            Langues parlées ({selectedLanguages.length})
          </Text>
          {showLang ? <ChevronUp size={18} color={COLORS.grayDark} /> : <ChevronDown size={18} color={COLORS.grayDark} />}
        </Pressable>

        {showLang && (
          <View style={styles.langGrid}>
            {LANGUAGES.map((lang) => {
              const selected = selectedLanguages.includes(lang.code);
              return (
                <Pressable
                  key={lang.code}
                  style={[styles.langChip, selected && styles.langChipSelected]}
                  onPress={() => toggleLang(lang.code)}
                >
                  <Text style={[styles.langChipText, selected && styles.langChipTextSelected]}>
                    {lang.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable style={[styles.btn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Continuer →</Text>}
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
  fieldGroup: { gap: 16, marginBottom: SPACING.lg },
  field: {},
  label: { fontSize: 12, fontWeight: '600', color: COLORS.grayDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.button, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.black, borderWidth: 1.5, borderColor: COLORS.grayLight },
  langToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.button, paddingHorizontal: 16, paddingVertical: 14, marginBottom: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.grayLight },
  langToggleText: { fontSize: 14, color: COLORS.grayDark, fontWeight: '500' },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.lg },
  langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.grayLight },
  langChipSelected: { backgroundColor: `${COLORS.primary}12`, borderColor: COLORS.primary },
  langChipText: { fontSize: 13, color: COLORS.grayDark, fontWeight: '500' },
  langChipTextSelected: { color: COLORS.primary, fontWeight: '700' },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: SPACING.md },
  btnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
