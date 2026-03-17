import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@aerocab/shared';
import { Button, Input } from '@aerocab/mobile-ui';
import { Car, ChevronUp, ChevronDown, Check } from 'lucide-react-native';
import { api } from '../../services/api';

const COUNTRY_CODES = [
  { code: '+237', country: 'CM', flag: 'CM' },
  { code: '+33', country: 'FR', flag: 'FR' },
  { code: '+1', country: 'US', flag: 'US' },
  { code: '+44', country: 'GB', flag: 'GB' },
];

const FLAG_MAP: Record<string, string> = {
  CM: '\u{1F1E8}\u{1F1F2}',
  FR: '\u{1F1EB}\u{1F1F7}',
  US: '\u{1F1FA}\u{1F1F8}',
  GB: '\u{1F1EC}\u{1F1E7}',
};

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    const trimmedPhone = phone.replace(/\s/g, '');

    if (!trimmedPhone || trimmedPhone.length < 6) {
      setError('Entrez un numero de telephone valide');
      return;
    }

    const fullPhone = `${selectedCountry.code}${trimmedPhone}`;
    setError('');
    setLoading(true);

    try {
      await api.sendOtp(fullPhone);
      router.push({
        pathname: '/verify-otp',
        params: { phone: fullPhone },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Echec de l'envoi du code";
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
        {/* Top decorative area */}
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <View style={styles.logoInner}>
                <Car size={32} color={COLORS.primaryDark} />
              </View>
            </View>
          </View>
          <Text style={styles.brandName}>AeroCab Pro</Text>
          <Text style={styles.tagline}>
            Espace chauffeur professionnel{'\n'}Rejoignez notre reseau
          </Text>
        </View>

        {/* Form card */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Connexion Chauffeur</Text>
          <Text style={styles.formSubtitle}>
            Entrez votre numero pour recevoir un code de verification
          </Text>

          {/* Country code selector */}
          <Text style={styles.fieldLabel}>Indicatif pays</Text>
          <Pressable
            style={styles.countrySelector}
            onPress={() => setShowPicker(!showPicker)}
          >
            <Text style={styles.countryFlag}>
              {FLAG_MAP[selectedCountry.flag]}
            </Text>
            <Text style={styles.countryCode}>{selectedCountry.code}</Text>
            <Text style={styles.countrySuffix}>{selectedCountry.country}</Text>
            <View style={styles.chevron}>
              {showPicker ? <ChevronUp size={14} color={COLORS.grayMedium} /> : <ChevronDown size={14} color={COLORS.grayMedium} />}
            </View>
          </Pressable>

          {showPicker && (
            <View style={styles.pickerDropdown}>
              {COUNTRY_CODES.map((cc) => (
                <Pressable
                  key={cc.code}
                  style={[
                    styles.pickerOption,
                    cc.code === selectedCountry.code &&
                      styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedCountry(cc);
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.countryFlag}>{FLAG_MAP[cc.flag]}</Text>
                  <Text style={styles.pickerOptionText}>
                    {cc.country} ({cc.code})
                  </Text>
                  {cc.code === selectedCountry.code && (
                    <Check size={16} color={COLORS.accent} strokeWidth={3} />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Phone input */}
          <Input
            label="Numero de telephone"
            placeholder="6XX XXX XXX"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              setError('');
            }}
            keyboardType="phone-pad"
            error={error}
            leftElement={
              <View style={styles.phonePrefix}>
                <Text style={styles.phonePrefixText}>
                  {selectedCountry.code}
                </Text>
              </View>
            }
          />

          <Button
            title="Recevoir le code"
            onPress={handleSendOtp}
            loading={loading}
            size="large"
            style={styles.submitButton}
          />
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          En continuant, vous acceptez nos{' '}
          <Text style={styles.footerLink}>conditions d'utilisation</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topSection: {
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 40,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  logoContainer: {
    marginBottom: SPACING.lg,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  logoInner: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.5,
    marginBottom: SPACING.sm,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
  formCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: SPACING.lg,
    paddingTop: 32,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: COLORS.grayDark,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.grayDark,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: BORDER_RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
    gap: 8,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  countrySuffix: {
    fontSize: 14,
    color: COLORS.grayMedium,
  },
  chevron: {
    marginLeft: 'auto',
  },
  pickerDropdown: {
    borderRadius: BORDER_RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
    marginTop: -8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayLight,
  },
  pickerOptionSelected: {
    backgroundColor: `${COLORS.accent}15`,
  },
  pickerOptionText: {
    fontSize: 15,
    color: COLORS.black,
    flex: 1,
  },
  phonePrefix: {
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: COLORS.grayLight,
    marginRight: 4,
  },
  phonePrefixText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  submitButton: {
    marginTop: SPACING.sm,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.grayMedium,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  footerLink: {
    color: COLORS.primary,
    fontWeight: '500',
  },
});
