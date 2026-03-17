import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS, SPACING } from '@aerocab/shared';
import { Button, Input } from '@aerocab/mobile-ui';
import { Car, Check } from 'lucide-react-native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

const LANGUAGES = [
  { code: 'fr', label: 'Francais' },
  { code: 'en', label: 'Anglais' },
  { code: 'ewondo', label: 'Ewondo' },
  { code: 'duala', label: 'Douala' },
  { code: 'fulfulde', label: 'Fulfulde' },
  { code: 'bamileke', label: 'Bamileke' },
];

export default function CompleteDriverProfileScreen() {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['fr']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code)
        ? prev.filter((l) => l !== code)
        : [...prev, code],
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Entrez votre nom');
      return;
    }
    if (!vehicleBrand.trim() || !vehicleModel.trim()) {
      setError('Entrez la marque et le modele du vehicule');
      return;
    }
    if (!vehicleColor.trim()) {
      setError('Entrez la couleur du vehicule');
      return;
    }
    if (!vehiclePlate.trim()) {
      setError("Entrez la plaque d'immatriculation");
      return;
    }
    if (selectedLanguages.length === 0) {
      setError('Selectionnez au moins une langue');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await api.registerDriver(token!, {
        name: name.trim(),
        vehicleBrand: vehicleBrand.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleColor: vehicleColor.trim(),
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        languages: selectedLanguages,
      });

      setUser(result.user as any);
      router.replace('/(auth)/upload-documents');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Echec de l'inscription";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Car size={32} color={COLORS.primary} />
            </View>
          </View>

          <Text style={styles.title}>Profil Chauffeur</Text>
          <Text style={styles.subtitle}>
            Renseignez vos informations et celles de votre vehicule
          </Text>

          {/* Progress */}
          <View style={styles.progressRow}>
            <View style={[styles.progressDot, styles.progressDotDone]} />
            <View style={[styles.progressLine, styles.progressLineDone]} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
          </View>
          <Text style={styles.stepText}>Etape 2 sur 3</Text>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.sectionLabel}>Informations personnelles</Text>
            <Input
              label="Nom complet"
              placeholder="Ex: Jean Kamga"
              value={name}
              onChangeText={(t) => {
                setName(t);
                setError('');
              }}
              autoCapitalize="words"
            />

            <Text style={[styles.sectionLabel, { marginTop: SPACING.md }]}>
              Vehicule
            </Text>
            <Input
              label="Marque"
              placeholder="Ex: Toyota"
              value={vehicleBrand}
              onChangeText={(t) => {
                setVehicleBrand(t);
                setError('');
              }}
            />
            <Input
              label="Modele"
              placeholder="Ex: Corolla"
              value={vehicleModel}
              onChangeText={(t) => {
                setVehicleModel(t);
                setError('');
              }}
            />
            <Input
              label="Couleur"
              placeholder="Ex: Gris"
              value={vehicleColor}
              onChangeText={(t) => {
                setVehicleColor(t);
                setError('');
              }}
            />
            <Input
              label="Plaque d'immatriculation"
              placeholder="Ex: LT 1234 AB"
              value={vehiclePlate}
              onChangeText={(t) => {
                setVehiclePlate(t);
                setError('');
              }}
              autoCapitalize="characters"
            />

            <Text style={[styles.sectionLabel, { marginTop: SPACING.md }]}>
              Langues parlees
            </Text>
            <View style={styles.languagesGrid}>
              {LANGUAGES.map((lang) => {
                const selected = selectedLanguages.includes(lang.code);
                return (
                  <Pressable
                    key={lang.code}
                    style={[
                      styles.languageChip,
                      selected && styles.languageChipSelected,
                    ]}
                    onPress={() => toggleLanguage(lang.code)}
                  >
                    <Text
                      style={[
                        styles.languageChipText,
                        selected && styles.languageChipTextSelected,
                      ]}
                    >
                      {lang.label}
                    </Text>
                    {selected && (
                      <Check size={12} color={COLORS.primary} strokeWidth={3} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              title="Continuer"
              onPress={handleSubmit}
              loading={loading}
              size="large"
              style={{ marginTop: SPACING.md }}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
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
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
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
  form: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.grayMedium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  languagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
    gap: 6,
  },
  languageChipSelected: {
    backgroundColor: `${COLORS.primary}10`,
    borderColor: COLORS.primary,
  },
  languageChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.grayDark,
  },
  languageChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
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
});
