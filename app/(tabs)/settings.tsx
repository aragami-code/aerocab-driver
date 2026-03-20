import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User, Car, Globe, LogOut, ChevronDown, ChevronUp,
  CheckCircle, Save, Moon,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { driverApi } from '../../services/api';
import { useThemeStore } from '../../stores/themeStore';

const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'pidgin', label: 'Pidgin' },
  { code: 'ewondo', label: 'Ewondo' },
  { code: 'douala', label: 'Douala' },
  { code: 'fulfulde', label: 'Fulfulde' },
  { code: 'bamileke', label: 'Bamiléké' },
];

export default function SettingsScreen() {
  const token = useAuthStore((s) => s.token)!;
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const { isDark, toggle: toggleDark } = useThemeStore();

  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['fr']);
  const [showLang, setShowLang] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ratingAvg, setRatingAvg] = useState(0);
  const [totalRides, setTotalRides] = useState(0);

  const load = useCallback(async () => {
    try {
      const profile = await driverApi.getMyProfile(token);
      setVehicleBrand(profile.vehicleBrand);
      setVehicleModel(profile.vehicleModel);
      setVehicleColor(profile.vehicleColor);
      setVehiclePlate(profile.vehiclePlate);
      setSelectedLanguages(profile.languages);
      setRatingAvg(profile.ratingAvg);
      setTotalRides(profile.totalRides);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger le profil.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLang = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  };

  const handleSave = async () => {
    if (!vehicleBrand || !vehicleModel || !vehicleColor || !vehiclePlate) {
      Toast.show({ type: 'error', text1: 'Champs requis', text2: 'Tous les champs sont obligatoires.' });
      return;
    }
    setSaving(true);
    try {
      await driverApi.updateProfile(token, {
        vehicleBrand: vehicleBrand.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleColor: vehicleColor.trim(),
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        languages: selectedLanguages,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Profil mis à jour ✅' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de sauvegarder.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Se déconnecter ?',
      'Vous devrez vous reconnecter pour utiliser l\'application.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: () => {
            logout();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Account info */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <User size={28} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.profileName}>{user?.name ?? 'Chauffeur'}</Text>
            <Text style={styles.profilePhone}>{user?.phone}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{ratingAvg.toFixed(1)} ⭐</Text>
            <Text style={styles.statLabel}>Note moyenne</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalRides}</Text>
            <Text style={styles.statLabel}>Courses totales</Text>
          </View>
        </View>

        {/* Vehicle info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Car size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Informations véhicule</Text>
          </View>

          {[
            { label: 'Marque', value: vehicleBrand, setter: setVehicleBrand, placeholder: 'Toyota…' },
            { label: 'Modèle', value: vehicleModel, setter: setVehicleModel, placeholder: 'Corolla…' },
            { label: 'Couleur', value: vehicleColor, setter: setVehicleColor, placeholder: 'Blanc…' },
            { label: 'Plaque', value: vehiclePlate, setter: setVehiclePlate, placeholder: 'LT 1234 AB' },
          ].map(({ label, value, setter, placeholder }) => (
            <View key={label} style={styles.field}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <TextInput
                style={styles.fieldInput}
                value={value}
                onChangeText={setter}
                placeholder={placeholder}
                placeholderTextColor={COLORS.grayMedium}
              />
            </View>
          ))}
        </View>

        {/* Dark mode */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Moon size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Apparence</Text>
          </View>
          <View style={styles.darkModeRow}>
            <View>
              <Text style={styles.fieldLabel}>MODE SOMBRE</Text>
              <Text style={styles.darkModeHint}>{isDark ? 'Activé' : 'Désactivé'}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleDark}
              trackColor={{ false: COLORS.grayLight, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* Languages */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Globe size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Langues parlées</Text>
          </View>

          <Pressable style={styles.langToggle} onPress={() => setShowLang((v) => !v)}>
            <Text style={styles.langToggleText}>
              {selectedLanguages.length} langue{selectedLanguages.length > 1 ? 's' : ''} sélectionnée{selectedLanguages.length > 1 ? 's' : ''}
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
                    {selected && <CheckCircle size={12} color={COLORS.primary} />}
                    <Text style={[styles.langChipText, selected && styles.langChipTextSelected]}>
                      {lang.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Save */}
        <Pressable style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Save size={18} color={COLORS.white} />
              <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>
            </>
          )}
        </Pressable>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color={COLORS.error} />
          <Text style={styles.logoutBtnText}>Se déconnecter</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black },
  scroll: { padding: SPACING.md, paddingBottom: 60 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: `${COLORS.primary}12`, alignItems: 'center', justifyContent: 'center',
  },
  profileName: { fontSize: 17, fontWeight: '700', color: COLORS.black },
  profilePhone: { fontSize: 14, color: COLORS.grayMedium, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.grayMedium, marginTop: 2 },

  section: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.black },

  field: { marginBottom: SPACING.sm },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.grayDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldInput: {
    backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.button,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.black,
    borderWidth: 1.5, borderColor: COLORS.grayLight,
  },

  langToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.button,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: COLORS.grayLight,
  },
  langToggleText: { fontSize: 14, color: COLORS.grayDark, fontWeight: '500' },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACING.sm },
  langChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.grayLight,
  },
  langChipSelected: { backgroundColor: `${COLORS.primary}12`, borderColor: COLORS.primary },
  langChipText: { fontSize: 13, color: COLORS.grayDark, fontWeight: '500' },
  langChipTextSelected: { color: COLORS.primary, fontWeight: '700' },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.button,
    paddingVertical: 16, marginBottom: SPACING.sm,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: `${COLORS.error}12`, borderRadius: BORDER_RADIUS.button,
    paddingVertical: 14, borderWidth: 1.5, borderColor: `${COLORS.error}33`,
  },
  logoutBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.error },

  darkModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  darkModeHint: { fontSize: 12, color: COLORS.grayMedium, marginTop: 2 },
});
