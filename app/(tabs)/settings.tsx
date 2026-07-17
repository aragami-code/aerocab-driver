import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Switch, Modal, TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Car, Globe, LogOut, ChevronDown, ChevronUp,
  CheckCircle, Save, Moon, FileText, AlertTriangle, ChevronRight, Star, TrendingUp,
} from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { COUNTRY_CURRENCY } from '../../lib/currency';
import { useAuthStore } from '../../stores/authStore';
import { driverApi } from '../../services/api';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguageStore } from '../../stores/languageStore';
import { useBiometricStore } from '../../stores/biometricStore';
import { getBiometricType, authenticateWithBiometric } from '../../lib/useBiometric';
import type { Lang } from '../../lib/i18n';

const APP_LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'es', label: 'Español' },
  { code: 'zh', label: '中文' },
];

export default function SettingsScreen() {
  const token = useAuthStore((s) => s.token)!;
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const { isDark, toggle: toggleDark } = useThemeStore();
  const biometricEnabled = useBiometricStore((s) => s.enabled);
  const setBiometricEnabled = useBiometricStore((s) => s.setEnabled);
  const markAuthenticated = useBiometricStore((s) => s.markAuthenticated);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | 'none'>('none');
  useEffect(() => { getBiometricType().then(setBiometricType); }, []);
  const { lang: appLang, setLang: setAppLang } = useLanguageStore();

  // Dynamic colors based on theme
  const bg = isDark ? '#0F172A' : COLORS.background;
  const cardBg = isDark ? '#1E293B' : COLORS.white;
  const textColor = isDark ? '#F1F5F9' : COLORS.black;
  const subTextColor = isDark ? '#94A3B8' : COLORS.grayMedium;
  const borderColor = isDark ? '#334155' : COLORS.grayLight;
  const inputBg = isDark ? '#0F172A' : COLORS.background;

  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['fr']);
  const [showLang, setShowLang] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ratingAvg, setRatingAvg] = useState(0);
  const [totalRides, setTotalRides] = useState(0);
  const [currentCountryCode, setCurrentCountryCode] = useState<string | null>(null);
  const [showCountryRequest, setShowCountryRequest] = useState(false);
  const [requestedCountry, setRequestedCountry] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [sendingRequest, setSendingRequest] = useState(false);

  const COUNTRY_OPTIONS = Object.keys(COUNTRY_CURRENCY).map((code) => ({
    code,
    label: `${code} — ${COUNTRY_CURRENCY[code].symbol}`,
  }));

  const load = useCallback(async () => {
    try {
      const [profile, countryReq] = await Promise.all([
        driverApi.getMyProfile(token),
        driverApi.getCountryChangeRequest(token).catch(() => null),
      ]);
      setVehicleBrand(profile.vehicleBrand);
      setVehicleModel(profile.vehicleModel);
      setVehicleColor(profile.vehicleColor);
      setVehiclePlate(profile.vehiclePlate);
      setSelectedLanguages(profile.languages);
      setRatingAvg(profile.ratingAvg);
      setTotalRides(profile.totalRides);
      setCurrentCountryCode(profile.countryCode ?? null);
      setPendingRequest(countryReq);
    } catch (err: any) {
      // 404 = pas encore de profil chauffeur (nouveau compte) → champs vides, pas d'erreur
      if (err?.statusCode !== 404) {
        Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger le profil.' });
      }
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

  const handleSubmitCountryRequest = async () => {
    if (!requestedCountry) {
      Toast.show({ type: 'error', text1: 'Pays requis', text2: 'Sélectionnez le pays demandé.' });
      return;
    }
    if (requestReason.trim().length < 20) {
      Toast.show({ type: 'error', text1: 'Raison trop courte', text2: 'Minimum 20 caractères.' });
      return;
    }
    setSendingRequest(true);
    try {
      const req = await driverApi.requestCountryChange(token, requestedCountry, requestReason.trim());
      setPendingRequest(req);
      setShowCountryRequest(false);
      setRequestedCountry('');
      setRequestReason('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Demande envoyée', text2: 'Un admin examinera votre demande.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: err?.message ?? 'Impossible d\'envoyer la demande.' });
    } finally {
      setSendingRequest(false);
    }
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Bannière profil ───────────────────────────────────────────── */}
        <View style={styles.profileBanner}>
          {/* Fond coloré avec motif */}
          <View style={styles.profileBannerBg} />
          <View style={styles.profileBannerOverlay} />

          {/* Avatar */}
          <View style={styles.profileAvatarLarge}>
            <Text style={styles.profileAvatarInitial}>
              {(user?.name ?? 'C')[0].toUpperCase()}
            </Text>
          </View>

          {/* Nom + badge */}
          <Text style={styles.profileBannerName}>{user?.name ?? 'Chauffeur'}</Text>
          <View style={styles.profileVerifiedBadge}>
            <CheckCircle size={12} color={COLORS.success} />
            <Text style={styles.profileVerifiedText}>Chauffeur vérifié</Text>
          </View>
          <Text style={styles.profileBannerPhone}>{user?.phone}</Text>

          {/* Stats row */}
          <View style={styles.profileStatsRow}>
            <View style={styles.profileStatItem}>
              <Star size={14} color={COLORS.accent} fill={COLORS.accent} />
              <Text style={styles.profileStatValue}>{ratingAvg.toFixed(1)}</Text>
              <Text style={styles.profileStatLabel}>Note</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStatItem}>
              <TrendingUp size={14} color={COLORS.accent} />
              <Text style={styles.profileStatValue}>{totalRides}</Text>
              <Text style={styles.profileStatLabel}>Courses</Text>
            </View>
          </View>
        </View>

        {/* ── PROFIL ───────────────────────────────────────────────────── */}
        <Text style={[styles.sectionGroupLabel, { color: subTextColor }]}>VÉHICULE</Text>
        {/* Vehicle info */}
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <View style={styles.sectionHeader}>
            <Car size={16} color={COLORS.primary} />
            <Text style={[styles.sectionTitle, { color: textColor }]}>Informations véhicule</Text>
          </View>

          {[
            { label: 'Marque', value: vehicleBrand, setter: setVehicleBrand, placeholder: 'Toyota…' },
            { label: 'Modèle', value: vehicleModel, setter: setVehicleModel, placeholder: 'Corolla…' },
            { label: 'Couleur', value: vehicleColor, setter: setVehicleColor, placeholder: 'Blanc…' },
            { label: 'Plaque', value: vehiclePlate, setter: setVehiclePlate, placeholder: 'LT 1234 AB' },
          ].map(({ label, value, setter, placeholder }) => (
            <View key={label} style={styles.field}>
              <Text style={[styles.fieldLabel, { color: subTextColor }]}>{label}</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: inputBg, borderColor, color: textColor }]}
                value={value}
                onChangeText={setter}
                placeholder={placeholder}
                placeholderTextColor={COLORS.grayMedium}
              />
            </View>
          ))}
        </View>

        {/* ── PAYS D'OPÉRATION ─────────────────────────────────────────── */}
        <Text style={[styles.sectionGroupLabel, { color: subTextColor }]}>LOCALISATION</Text>
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <View style={styles.sectionHeader}>
            <Globe size={16} color={COLORS.primary} />
            <Text style={[styles.sectionTitle, { color: textColor }]}>Pays d'opération</Text>
          </View>
          <View style={styles.countryRow}>
            <View>
              <Text style={[styles.fieldLabel, { color: subTextColor }]}>PAYS ACTUEL</Text>
              <Text style={[styles.countryValue, { color: textColor }]}>
                {currentCountryCode
                  ? `${currentCountryCode} — ${COUNTRY_CURRENCY[currentCountryCode]?.symbol ?? '?'}`
                  : 'Non défini'}
              </Text>
            </View>
            {pendingRequest?.status === 'pending' ? (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>En attente</Text>
              </View>
            ) : pendingRequest?.status === 'rejected' ? (
              <View style={[styles.pendingBadge, { backgroundColor: `${COLORS.error}18` }]}>
                <Text style={[styles.pendingBadgeText, { color: COLORS.error }]}>Refusée</Text>
              </View>
            ) : (
              <Pressable
                style={styles.changeCountryBtn}
                onPress={() => setShowCountryRequest(true)}
              >
                <Text style={styles.changeCountryBtnText}>Demander un changement</Text>
                <ChevronRight size={14} color={COLORS.primary} />
              </Pressable>
            )}
          </View>
          {pendingRequest?.status === 'pending' && (
            <Text style={[styles.pendingHint, { color: subTextColor }]}>
              Demande de changement vers {pendingRequest.requestedCountry} en cours de traitement par un admin.
            </Text>
          )}
          {pendingRequest?.status === 'rejected' && (
            <View>
              <Text style={[styles.pendingHint, { color: COLORS.error }]}>
                Demande refusée{pendingRequest.adminNote ? ` : ${pendingRequest.adminNote}` : ''}.
              </Text>
              <Pressable style={styles.changeCountryBtn} onPress={() => setShowCountryRequest(true)}>
                <Text style={styles.changeCountryBtnText}>Faire une nouvelle demande</Text>
                <ChevronRight size={14} color={COLORS.primary} />
              </Pressable>
            </View>
          )}
          {showCountryRequest && (
            <Animated.View entering={FadeIn} style={[styles.countryRequestForm, { backgroundColor: inputBg, borderColor }]}>
              <Text style={[styles.fieldLabel, { color: subTextColor }]}>PAYS DEMANDÉ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {COUNTRY_OPTIONS.map(({ code, label }) => {
                  const sel = requestedCountry === code;
                  return (
                    <Pressable
                      key={code}
                      style={[styles.countryChip, sel && styles.countryChipSelected, { borderColor: sel ? COLORS.primary : borderColor }]}
                      onPress={() => setRequestedCountry(code)}
                    >
                      <Text style={[{ fontSize: 12, color: sel ? COLORS.primary : subTextColor, fontWeight: sel ? '700' : '500' }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={[styles.fieldLabel, { color: subTextColor }]}>RAISON (min 20 caractères)</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: cardBg, borderColor, color: textColor, height: 80, textAlignVertical: 'top', marginBottom: 12 }]}
                value={requestReason}
                onChangeText={setRequestReason}
                placeholder="Ex: Je travaille désormais en France et mes revenus sont en euros..."
                placeholderTextColor={COLORS.grayMedium}
                multiline
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={[styles.changeCountryBtn, { flex: 1, justifyContent: 'center' }]} onPress={() => setShowCountryRequest(false)}>
                  <Text style={[styles.changeCountryBtnText, { color: COLORS.grayMedium }]}>Annuler</Text>
                </Pressable>
                <Pressable
                  style={[styles.changeCountryBtn, { flex: 2, backgroundColor: COLORS.primary, justifyContent: 'center' }]}
                  onPress={handleSubmitCountryRequest}
                  disabled={sendingRequest}
                >
                  {sendingRequest
                    ? <ActivityIndicator size="small" color={COLORS.white} />
                    : <Text style={[styles.changeCountryBtnText, { color: COLORS.white }]}>Envoyer la demande</Text>
                  }
                </Pressable>
              </View>
            </Animated.View>
          )}
        </View>

        <Text style={[styles.sectionGroupLabel, { color: subTextColor }]}>APP</Text>
        {/* App Language */}
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <View style={styles.sectionHeader}>
            <Globe size={16} color={COLORS.primary} />
            <Text style={[styles.sectionTitle, { color: textColor }]}>Langue de l'application</Text>
          </View>
          <View style={styles.langGrid}>
            {APP_LANGUAGES.map(({ code, label, flag }) => {
              const selected = appLang === code;
              return (
                <Pressable
                  key={code}
                  style={[styles.langChip, selected && styles.langChipSelected, { borderColor: selected ? COLORS.primary : borderColor, backgroundColor: selected ? `${COLORS.primary}12` : inputBg }]}
                  onPress={() => setAppLang(code)}
                >
                  <Text style={{ fontSize: 16 }}>{flag}</Text>
                  <Text style={[styles.langChipText, selected && styles.langChipTextSelected, { color: selected ? COLORS.primary : subTextColor }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Dark mode */}
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <View style={styles.sectionHeader}>
            <Moon size={16} color={COLORS.primary} />
            <Text style={[styles.sectionTitle, { color: textColor }]}>Apparence</Text>
          </View>
          <View style={styles.darkModeRow}>
            <View>
              <Text style={[styles.fieldLabel, { color: subTextColor }]}>MODE SOMBRE</Text>
              <Text style={[styles.darkModeHint, { color: subTextColor }]}>{isDark ? 'Activé' : 'Désactivé'}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleDark}
              trackColor={{ false: COLORS.grayLight, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>

          {biometricType !== 'none' && (
            <>
              <View style={[{ height: 1, marginVertical: 8 }, { backgroundColor: borderColor }]} />
              <View style={styles.darkModeRow}>
                <View>
                  <Text style={[styles.fieldLabel, { color: subTextColor }]}>
                    {biometricType === 'face' ? 'FACE ID' : 'EMPREINTE DIGITALE'}
                  </Text>
                  <Text style={[styles.darkModeHint, { color: subTextColor }]}>
                    Déverrouiller sans OTP
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={async (val) => {
                    if (val) {
                      const ok = await authenticateWithBiometric('Confirmer l\'activation');
                      if (ok) {
                        setBiometricEnabled(true);
                        markAuthenticated();
                        Toast.show({ type: 'success', text1: 'Biométrie activée' });
                      } else {
                        Toast.show({ type: 'error', text1: 'Échec de la vérification' });
                      }
                    } else {
                      setBiometricEnabled(false);
                      Toast.show({ type: 'info', text1: 'Biométrie désactivée' });
                    }
                  }}
                  trackColor={{ false: COLORS.grayLight, true: COLORS.success }}
                  thumbColor={COLORS.white}
                />
              </View>
            </>
          )}
        </View>

        {/* Driver language skills */}
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <View style={styles.sectionHeader}>
            <Globe size={16} color={COLORS.primary} />
            <Text style={[styles.sectionTitle, { color: textColor }]}>Langues parlées</Text>
          </View>

          <Pressable style={[styles.langToggle, { backgroundColor: inputBg, borderColor }]} onPress={() => setShowLang((v) => !v)}>
            <Text style={[styles.langToggleText, { color: subTextColor }]}>
              {selectedLanguages.length} langue{selectedLanguages.length > 1 ? 's' : ''} sélectionnée{selectedLanguages.length > 1 ? 's' : ''}
            </Text>
            {showLang ? <ChevronUp size={18} color={subTextColor} /> : <ChevronDown size={18} color={subTextColor} />}
          </Pressable>

          {showLang && (
            <View style={styles.langGrid}>
              {LANGUAGES.map((lang) => {
                const selected = selectedLanguages.includes(lang.code);
                return (
                  <Pressable
                    key={lang.code}
                    style={[styles.langChip, selected && styles.langChipSelected, { borderColor: selected ? COLORS.primary : borderColor, backgroundColor: selected ? `${COLORS.primary}12` : inputBg }]}
                    onPress={() => toggleLang(lang.code)}
                  >
                    {selected && <CheckCircle size={12} color={COLORS.primary} />}
                    <Text style={[styles.langChipText, selected && styles.langChipTextSelected, { color: selected ? COLORS.primary : subTextColor }]}>
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

        <Text style={[styles.sectionGroupLabel, { color: subTextColor }]}>AIDE</Text>
        {/* Signalements */}
        <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
          <Pressable style={styles.menuItem} onPress={() => router.push('/(tabs)/my-tickets' as never)}>
            <FileText size={18} color="#E65100" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: textColor }]}>Mes signalements</Text>
              <Text style={[styles.menuHint, { color: subTextColor }]}>Suivre vos tickets et réponses</Text>
            </View>
            <ChevronRight size={16} color={subTextColor} />
          </Pressable>
          <View style={[styles.sep, { backgroundColor: borderColor }]} />
          <Pressable style={styles.menuItem} onPress={() => router.push('/(tabs)/report-problem' as never)}>
            <AlertTriangle size={18} color={COLORS.error} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: textColor }]}>Signaler un problème</Text>
              <Text style={[styles.menuHint, { color: subTextColor }]}>Contacter l'équipe support</Text>
            </View>
            <ChevronRight size={16} color={subTextColor} />
          </Pressable>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color={COLORS.error} />
          <Text style={styles.logoutBtnText}>Se déconnecter</Text>
        </Pressable>

      </ScrollView>

      {/* Modal déconnexion */}
      <Modal visible={logoutModalVisible} transparent animationType="slide" onRequestClose={() => setLogoutModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setLogoutModalVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <Animated.View entering={FadeIn.duration(200)} style={[styles.modalSheet, { backgroundColor: cardBg }]}>
          <View style={[styles.modalHandle, { backgroundColor: borderColor }]} />
          <View style={styles.modalHeader}>
            <LogOut size={20} color={COLORS.primary} />
            <Text style={[styles.modalTitle, { color: textColor }]}>Se déconnecter ?</Text>
          </View>
          <Text style={{ fontSize: 14, color: subTextColor, marginBottom: SPACING.lg, lineHeight: 20 }}>
            Vous devrez vous reconnecter pour utiliser l'application.
          </Text>
          <TouchableOpacity
            style={[styles.modalConfirmBtn, { backgroundColor: COLORS.error }]}
            onPress={() => { setLogoutModalVisible(false); logout(); router.replace('/(auth)/login'); }}
          >
            <Text style={[styles.modalActionText, { color: COLORS.white }]}>Déconnexion</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: inputBg }]} onPress={() => setLogoutModalVisible(false)}>
            <Text style={[styles.modalActionText, { color: subTextColor }]}>Annuler</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  scroll: { padding: SPACING.md, paddingBottom: 60 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: `${COLORS.primary}12`, alignItems: 'center', justifyContent: 'center',
  },
  profileName: { fontSize: 17, fontWeight: '700' },
  profilePhone: { fontSize: 14, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: {
    flex: 1, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, marginTop: 2 },

  section: {
    borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  menuLabel: { fontSize: 14, fontWeight: '600' },
  menuHint: { fontSize: 12, marginTop: 1 },
  sep: { height: StyleSheet.hairlineWidth, marginVertical: 4 },

  field: { marginBottom: SPACING.sm },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldInput: {
    borderRadius: BORDER_RADIUS.button,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1.5,
  },

  langToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: BORDER_RADIUS.button,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5,
  },
  langToggleText: { fontSize: 14, fontWeight: '500' },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACING.sm },
  langChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5,
  },
  langChipSelected: {},
  langChipText: { fontSize: 13, fontWeight: '500' },
  langChipTextSelected: { fontWeight: '700' },

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
  darkModeHint: { fontSize: 12, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SPACING.lg,
    paddingBottom: 36,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: SPACING.lg, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalConfirmBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: SPACING.sm },
  modalCancelBtn: { marginTop: 4, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalActionText: { fontSize: 15, fontWeight: '600' },

  // Profile banner
  profileBanner: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg, alignItems: 'center',
    marginBottom: SPACING.sm, overflow: 'hidden',
    paddingTop: 28, paddingBottom: SPACING.lg,
  },
  profileBannerBg: {
    position: 'absolute', top: -20, right: -20,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: `${COLORS.accent}20`,
  },
  profileBannerOverlay: {
    position: 'absolute', bottom: -30, left: -30,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: `${COLORS.white}08`,
  },
  profileAvatarLarge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm, borderWidth: 3, borderColor: `${COLORS.white}40`,
  },
  profileAvatarInitial: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  profileBannerName: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
  profileVerifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: `${COLORS.success}22`, paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 12, marginBottom: 4,
  },
  profileVerifiedText: { fontSize: 11, color: COLORS.success, fontWeight: '600' },
  profileBannerPhone: { fontSize: 13, color: `${COLORS.white}80`, marginBottom: SPACING.md },
  profileStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: `${COLORS.white}12`, borderRadius: BORDER_RADIUS.button,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
  },
  profileStatItem: { alignItems: 'center', gap: 2, flex: 1 },
  profileStatValue: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  profileStatLabel: { fontSize: 11, color: `${COLORS.white}70`, fontWeight: '500' },
  profileStatDivider: { width: 1, height: 32, backgroundColor: `${COLORS.white}25` },

  sectionGroupLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    marginBottom: SPACING.xs, marginTop: SPACING.sm, paddingHorizontal: 2,
  },

  countryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  countryValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  changeCountryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.button, borderWidth: 1, borderColor: COLORS.primary,
  },
  changeCountryBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  pendingBadge: {
    backgroundColor: `${COLORS.warning ?? '#F39C12'}18`, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12,
  },
  pendingBadgeText: { fontSize: 12, fontWeight: '700', color: '#F39C12' },
  pendingHint: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  countryRequestForm: {
    marginTop: 12, padding: 12, borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
  },
  countryChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, marginRight: 8,
  },
  countryChipSelected: { backgroundColor: `${COLORS.primary}12` },
});
