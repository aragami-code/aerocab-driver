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
import { ChannelPicker } from '../../components/ChannelPicker';

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

const VEHICLE_CATEGORIES = [
  { code: 'eco',          label: 'Eco',          desc: 'Citadine économique (Clio, Polo…)',       icon: '🚗' },
  { code: 'eco_plus',     label: 'Eco+',         desc: 'Compacte confortable (Corolla, Golf…)',   icon: '🚙' },
  { code: 'standard',     label: 'Standard',     desc: 'Berline standard (Camry, Passat…)',       icon: '🚘' },
  { code: 'confort',      label: 'Confort',      desc: 'Berline premium (BMW, Mercedes…)',        icon: '🛻' },
  { code: 'confort_plus', label: 'Confort+',     desc: 'Grand SUV / Van (V-Class, Alphard…)',    icon: '🚐' },
] as const;

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
  const storeUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const userName = useAuthStore((s) => s.user?.name);

  // Connexion via email/OAuth (Google) → aucun numéro → liaison vérifiée par OTP obligatoire.
  const loginViaEmail = !!storeUser?.email && !storeUser?.phone;
  const [phoneLinked, setPhoneLinked] = useState(!loginViaEmail);
  const [linkStep, setLinkStep] = useState<'phone' | 'code'>('phone');
  const [linkPhone, setLinkPhone] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [linkChannel, setLinkChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [linkLoading, setLinkLoading] = useState(false);

  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['fr']);
  const [showLang, setShowLang] = useState(false);
  const [vehicleCategory, setVehicleCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleLang = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  };

  // Liaison numéro (email/OAuth) — Étape A : envoi de l'OTP de liaison.
  const handleLinkSend = async () => {
    if (!E164_REGEX.test(linkPhone.trim())) {
      Toast.show({ type: 'error', text1: 'Numéro invalide', text2: 'Format requis : +237 6XX XXX XXX.' });
      return;
    }
    if (!token) return;
    setLinkLoading(true);
    try {
      await driverApi.linkPhoneSend(token, linkPhone.trim(), linkChannel);
      setLinkStep('code');
      Toast.show({ type: 'success', text1: 'Code envoyé', text2: `Code envoyé à ${linkPhone.trim()}.` });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? "Échec de l'envoi du code." });
    } finally {
      setLinkLoading(false);
    }
  };

  // Liaison numéro (email/OAuth) — Étape B : vérification de l'OTP et liaison.
  const handleLinkVerify = async () => {
    if (linkCode.trim().length < 6) {
      Toast.show({ type: 'error', text1: 'Code invalide', text2: 'Entrez le code à 6 chiffres.' });
      return;
    }
    if (!token) return;
    setLinkLoading(true);
    try {
      const updated = await driverApi.linkPhoneVerify(token, linkPhone.trim(), linkCode.trim());
      if (storeUser) {
        setUser({ ...storeUser, id: updated.id, phone: updated.phone ?? linkPhone.trim() });
      }
      setPhoneLinked(true);
      Toast.show({ type: 'success', text1: 'Numéro vérifié', text2: 'Vous pouvez continuer.' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? 'Code invalide.' });
    } finally {
      setLinkLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (loginViaEmail && !phoneLinked) {
      Toast.show({ type: 'error', text1: 'Numéro requis', text2: 'Veuillez vérifier votre numéro de téléphone.' });
      return;
    }
    if (!vehicleBrand || !vehicleModel || !vehicleColor || !vehiclePlate || !vehicleYear) {
      Toast.show({ type: 'error', text1: 'Champs requis', text2: 'Veuillez remplir tous les champs.' });
      return;
    }
    if (!vehicleCategory) {
      Toast.show({ type: 'error', text1: 'Catégorie requise', text2: 'Veuillez choisir une catégorie de véhicule.' });
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
        vehicleCategory,
        languages: selectedLanguages,
        ...(userName ? { name: userName } : {}),
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
          <Text style={styles.stepText}>Étape 3 / 4</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Car size={40} color={COLORS.primary} style={{ marginBottom: SPACING.md }} />
        <Text style={styles.title}>Votre véhicule</Text>
        <Text style={styles.subtitle}>Ces informations seront visibles par les passagers.</Text>

        {/* Liaison numéro vérifiée (connexion via email/Google) */}
        {loginViaEmail && !phoneLinked && (
          <View style={styles.linkBox}>
            <Text style={styles.sectionLabel}>Numéro de téléphone</Text>
            <Text style={styles.sectionHint}>Vérification requise pour recevoir les courses.</Text>
            {linkStep === 'phone' ? (
              <>
                <TextInput
                  style={styles.input}
                  value={linkPhone}
                  onChangeText={setLinkPhone}
                  placeholder="Ex: +237 6XX XXX XXX"
                  placeholderTextColor={COLORS.grayMedium}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
                <ChannelPicker
                  channels={['sms', 'whatsapp']}
                  value={linkChannel}
                  onChange={(c) => { if (c === 'sms' || c === 'whatsapp') setLinkChannel(c); }}
                />
                <Pressable
                  style={[styles.linkBtn, linkLoading && { opacity: 0.7 }]}
                  onPress={handleLinkSend}
                  disabled={linkLoading}
                >
                  {linkLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.linkBtnText}>Envoyer le code</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={linkCode}
                  onChangeText={(v) => setLinkCode(v.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  placeholderTextColor={COLORS.grayMedium}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Text style={styles.sectionHint}>Code envoyé à {linkPhone.trim()}</Text>
                <Pressable
                  style={[styles.linkBtn, linkLoading && { opacity: 0.7 }]}
                  onPress={handleLinkVerify}
                  disabled={linkLoading}
                >
                  {linkLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.linkBtnText}>Vérifier</Text>}
                </Pressable>
                <Pressable onPress={() => setLinkStep('phone')}>
                  <Text style={styles.linkBack}>← Modifier le numéro</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
        {loginViaEmail && phoneLinked && (
          <View style={styles.linkBox}>
            <Text style={styles.linkOk}>✓ Numéro vérifié</Text>
          </View>
        )}

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

        {/* Vehicle category selector */}
        <Text style={styles.sectionLabel}>Catégorie du véhicule</Text>
        <Text style={styles.sectionHint}>L'admin validera votre catégorie lors de l'approbation.</Text>
        <View style={styles.categoryGrid}>
          {VEHICLE_CATEGORIES.map((cat) => {
            const selected = vehicleCategory === cat.code;
            return (
              <Pressable
                key={cat.code}
                style={[styles.categoryCard, selected && styles.categoryCardSelected]}
                onPress={() => setVehicleCategory(cat.code)}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>{cat.label}</Text>
                <Text style={[styles.categoryDesc, selected && styles.categoryDescSelected]}>{cat.desc}</Text>
              </Pressable>
            );
          })}
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
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.grayDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  sectionHint: { fontSize: 12, color: COLORS.grayMedium, marginBottom: SPACING.sm },
  categoryGrid: { gap: 10, marginBottom: SPACING.lg },
  categoryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.button, padding: 14, borderWidth: 1.5, borderColor: COLORS.grayLight },
  categoryCardSelected: { backgroundColor: `${COLORS.primary}10`, borderColor: COLORS.primary },
  categoryIcon: { fontSize: 22 },
  categoryLabel: { fontSize: 14, fontWeight: '700', color: COLORS.grayDark },
  categoryLabelSelected: { color: COLORS.primary },
  categoryDesc: { fontSize: 12, color: COLORS.grayMedium, flex: 1 },
  categoryDescSelected: { color: COLORS.primary },
  langToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.button, paddingHorizontal: 16, paddingVertical: 14, marginBottom: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.grayLight },
  langToggleText: { fontSize: 14, color: COLORS.grayDark, fontWeight: '500' },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.lg },
  langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.grayLight },
  langChipSelected: { backgroundColor: `${COLORS.primary}12`, borderColor: COLORS.primary },
  langChipText: { fontSize: 13, color: COLORS.grayDark, fontWeight: '500' },
  langChipTextSelected: { color: COLORS.primary, fontWeight: '700' },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: SPACING.md },
  btnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  linkBox: { backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.button, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1.5, borderColor: COLORS.grayLight },
  linkBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.sm },
  linkBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  linkBack: { fontSize: 13, color: COLORS.grayDark, textAlign: 'center', marginTop: SPACING.sm },
  linkOk: { fontSize: 14, fontWeight: '700', color: COLORS.success },
});
