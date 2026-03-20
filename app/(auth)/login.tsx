import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, G } from 'react-native-svg';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { Button, Input } from '../../lib/mobile-ui';
import { ChevronUp, ChevronDown, Check, ChevronLeft } from 'lucide-react-native';
import { api } from '../../services/api';
import { useLanguageStore } from '../../stores/languageStore';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../../stores/authStore';
import type { User } from '../../lib/shared';


// ─── Country list ────────────────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: '+93',   country: 'Afghanistan',              flag: '🇦🇫' },
  { code: '+355',  country: 'Albanie',                  flag: '🇦🇱' },
  { code: '+213',  country: 'Algérie',                  flag: '🇩🇿' },
  { code: '+376',  country: 'Andorre',                  flag: '🇦🇩' },
  { code: '+244',  country: 'Angola',                   flag: '🇦🇴' },
  { code: '+54',   country: 'Argentine',                flag: '🇦🇷' },
  { code: '+374',  country: 'Arménie',                  flag: '🇦🇲' },
  { code: '+61',   country: 'Australie',                flag: '🇦🇺' },
  { code: '+43',   country: 'Autriche',                 flag: '🇦🇹' },
  { code: '+994',  country: 'Azerbaïdjan',              flag: '🇦🇿' },
  { code: '+973',  country: 'Bahreïn',                  flag: '🇧🇭' },
  { code: '+880',  country: 'Bangladesh',               flag: '🇧🇩' },
  { code: '+32',   country: 'Belgique',                 flag: '🇧🇪' },
  { code: '+501',  country: 'Belize',                   flag: '🇧🇿' },
  { code: '+229',  country: 'Bénin',                    flag: '🇧🇯' },
  { code: '+975',  country: 'Bhoutan',                  flag: '🇧🇹' },
  { code: '+591',  country: 'Bolivie',                  flag: '🇧🇴' },
  { code: '+387',  country: 'Bosnie-Herzégovine',       flag: '🇧🇦' },
  { code: '+267',  country: 'Botswana',                 flag: '🇧🇼' },
  { code: '+55',   country: 'Brésil',                   flag: '🇧🇷' },
  { code: '+673',  country: 'Brunei',                   flag: '🇧🇳' },
  { code: '+359',  country: 'Bulgarie',                 flag: '🇧🇬' },
  { code: '+226',  country: 'Burkina Faso',             flag: '🇧🇫' },
  { code: '+257',  country: 'Burundi',                  flag: '🇧🇮' },
  { code: '+855',  country: 'Cambodge',                 flag: '🇰🇭' },
  { code: '+237',  country: 'Cameroun',                 flag: '🇨🇲' },
  { code: '+1',    country: 'Canada',                   flag: '🇨🇦' },
  { code: '+238',  country: 'Cap-Vert',                 flag: '🇨🇻' },
  { code: '+236',  country: 'Centrafrique',             flag: '🇨🇫' },
  { code: '+56',   country: 'Chili',                    flag: '🇨🇱' },
  { code: '+86',   country: 'Chine',                    flag: '🇨🇳' },
  { code: '+357',  country: 'Chypre',                   flag: '🇨🇾' },
  { code: '+57',   country: 'Colombie',                 flag: '🇨🇴' },
  { code: '+269',  country: 'Comores',                  flag: '🇰🇲' },
  { code: '+242',  country: 'Congo',                    flag: '🇨🇬' },
  { code: '+243',  country: 'Congo (RDC)',              flag: '🇨🇩' },
  { code: '+82',   country: 'Corée du Sud',             flag: '🇰🇷' },
  { code: '+850',  country: 'Corée du Nord',            flag: '🇰🇵' },
  { code: '+506',  country: 'Costa Rica',               flag: '🇨🇷' },
  { code: '+225',  country: "Côte d'Ivoire",            flag: '🇨🇮' },
  { code: '+385',  country: 'Croatie',                  flag: '🇭🇷' },
  { code: '+53',   country: 'Cuba',                     flag: '🇨🇺' },
  { code: '+45',   country: 'Danemark',                 flag: '🇩🇰' },
  { code: '+253',  country: 'Djibouti',                 flag: '🇩🇯' },
  { code: '+20',   country: 'Égypte',                   flag: '🇪🇬' },
  { code: '+971',  country: 'Émirats arabes unis',      flag: '🇦🇪' },
  { code: '+593',  country: 'Équateur',                 flag: '🇪🇨' },
  { code: '+291',  country: 'Érythrée',                 flag: '🇪🇷' },
  { code: '+34',   country: 'Espagne',                  flag: '🇪🇸' },
  { code: '+372',  country: 'Estonie',                  flag: '🇪🇪' },
  { code: '+268',  country: 'Eswatini',                 flag: '🇸🇿' },
  { code: '+251',  country: 'Éthiopie',                 flag: '🇪🇹' },
  { code: '+679',  country: 'Fidji',                    flag: '🇫🇯' },
  { code: '+358',  country: 'Finlande',                 flag: '🇫🇮' },
  { code: '+33',   country: 'France',                   flag: '🇫🇷' },
  { code: '+241',  country: 'Gabon',                    flag: '🇬🇦' },
  { code: '+220',  country: 'Gambie',                   flag: '🇬🇲' },
  { code: '+995',  country: 'Géorgie',                  flag: '🇬🇪' },
  { code: '+233',  country: 'Ghana',                    flag: '🇬🇭' },
  { code: '+30',   country: 'Grèce',                    flag: '🇬🇷' },
  { code: '+502',  country: 'Guatemala',                flag: '🇬🇹' },
  { code: '+224',  country: 'Guinée',                   flag: '🇬🇳' },
  { code: '+245',  country: 'Guinée-Bissau',            flag: '🇬🇼' },
  { code: '+240',  country: 'Guinée équatoriale',       flag: '🇬🇶' },
  { code: '+592',  country: 'Guyana',                   flag: '🇬🇾' },
  { code: '+509',  country: 'Haïti',                    flag: '🇭🇹' },
  { code: '+504',  country: 'Honduras',                 flag: '🇭🇳' },
  { code: '+36',   country: 'Hongrie',                  flag: '🇭🇺' },
  { code: '+91',   country: 'Inde',                     flag: '🇮🇳' },
  { code: '+62',   country: 'Indonésie',                flag: '🇮🇩' },
  { code: '+98',   country: 'Iran',                     flag: '🇮🇷' },
  { code: '+964',  country: 'Irak',                     flag: '🇮🇶' },
  { code: '+353',  country: 'Irlande',                  flag: '🇮🇪' },
  { code: '+972',  country: 'Israël',                   flag: '🇮🇱' },
  { code: '+39',   country: 'Italie',                   flag: '🇮🇹' },
  { code: '+1876', country: 'Jamaïque',                 flag: '🇯🇲' },
  { code: '+81',   country: 'Japon',                    flag: '🇯🇵' },
  { code: '+962',  country: 'Jordanie',                 flag: '🇯🇴' },
  { code: '+7',    country: 'Kazakhstan',               flag: '🇰🇿' },
  { code: '+254',  country: 'Kenya',                    flag: '🇰🇪' },
  { code: '+996',  country: 'Kirghizistan',             flag: '🇰🇬' },
  { code: '+965',  country: 'Koweït',                   flag: '🇰🇼' },
  { code: '+856',  country: 'Laos',                     flag: '🇱🇦' },
  { code: '+266',  country: 'Lesotho',                  flag: '🇱🇸' },
  { code: '+371',  country: 'Lettonie',                 flag: '🇱🇻' },
  { code: '+961',  country: 'Liban',                    flag: '🇱🇧' },
  { code: '+231',  country: 'Libéria',                  flag: '🇱🇷' },
  { code: '+218',  country: 'Libye',                    flag: '🇱🇾' },
  { code: '+423',  country: 'Liechtenstein',            flag: '🇱🇮' },
  { code: '+370',  country: 'Lituanie',                 flag: '🇱🇹' },
  { code: '+352',  country: 'Luxembourg',               flag: '🇱🇺' },
  { code: '+261',  country: 'Madagascar',               flag: '🇲🇬' },
  { code: '+265',  country: 'Malawi',                   flag: '🇲🇼' },
  { code: '+60',   country: 'Malaisie',                 flag: '🇲🇾' },
  { code: '+960',  country: 'Maldives',                 flag: '🇲🇻' },
  { code: '+223',  country: 'Mali',                     flag: '🇲🇱' },
  { code: '+356',  country: 'Malte',                    flag: '🇲🇹' },
  { code: '+212',  country: 'Maroc',                    flag: '🇲🇦' },
  { code: '+222',  country: 'Mauritanie',               flag: '🇲🇷' },
  { code: '+230',  country: 'Maurice',                  flag: '🇲🇺' },
  { code: '+52',   country: 'Mexique',                  flag: '🇲🇽' },
  { code: '+373',  country: 'Moldavie',                 flag: '🇲🇩' },
  { code: '+377',  country: 'Monaco',                   flag: '🇲🇨' },
  { code: '+976',  country: 'Mongolie',                 flag: '🇲🇳' },
  { code: '+382',  country: 'Monténégro',               flag: '🇲🇪' },
  { code: '+258',  country: 'Mozambique',               flag: '🇲🇿' },
  { code: '+264',  country: 'Namibie',                  flag: '🇳🇦' },
  { code: '+977',  country: 'Népal',                    flag: '🇳🇵' },
  { code: '+505',  country: 'Nicaragua',                flag: '🇳🇮' },
  { code: '+227',  country: 'Niger',                    flag: '🇳🇪' },
  { code: '+234',  country: 'Nigéria',                  flag: '🇳🇬' },
  { code: '+47',   country: 'Norvège',                  flag: '🇳🇴' },
  { code: '+64',   country: 'Nouvelle-Zélande',         flag: '🇳🇿' },
  { code: '+968',  country: 'Oman',                     flag: '🇴🇲' },
  { code: '+256',  country: 'Ouganda',                  flag: '🇺🇬' },
  { code: '+998',  country: 'Ouzbékistan',              flag: '🇺🇿' },
  { code: '+92',   country: 'Pakistan',                 flag: '🇵🇰' },
  { code: '+970',  country: 'Palestine',                flag: '🇵🇸' },
  { code: '+507',  country: 'Panama',                   flag: '🇵🇦' },
  { code: '+675',  country: 'Papouasie-Nvl-Guinée',    flag: '🇵🇬' },
  { code: '+595',  country: 'Paraguay',                 flag: '🇵🇾' },
  { code: '+31',   country: 'Pays-Bas',                 flag: '🇳🇱' },
  { code: '+51',   country: 'Pérou',                    flag: '🇵🇪' },
  { code: '+63',   country: 'Philippines',              flag: '🇵🇭' },
  { code: '+48',   country: 'Pologne',                  flag: '🇵🇱' },
  { code: '+351',  country: 'Portugal',                 flag: '🇵🇹' },
  { code: '+974',  country: 'Qatar',                    flag: '🇶🇦' },
  { code: '+40',   country: 'Roumanie',                 flag: '🇷🇴' },
  { code: '+44',   country: 'Royaume-Uni',              flag: '🇬🇧' },
  { code: '+7',    country: 'Russie',                   flag: '🇷🇺' },
  { code: '+250',  country: 'Rwanda',                   flag: '🇷🇼' },
  { code: '+966',  country: 'Arabie Saoudite',          flag: '🇸🇦' },
  { code: '+221',  country: 'Sénégal',                  flag: '🇸🇳' },
  { code: '+381',  country: 'Serbie',                   flag: '🇷🇸' },
  { code: '+232',  country: 'Sierra Leone',             flag: '🇸🇱' },
  { code: '+65',   country: 'Singapour',                flag: '🇸🇬' },
  { code: '+421',  country: 'Slovaquie',                flag: '🇸🇰' },
  { code: '+386',  country: 'Slovénie',                 flag: '🇸🇮' },
  { code: '+252',  country: 'Somalie',                  flag: '🇸🇴' },
  { code: '+249',  country: 'Soudan',                   flag: '🇸🇩' },
  { code: '+211',  country: 'Soudan du Sud',            flag: '🇸🇸' },
  { code: '+94',   country: 'Sri Lanka',                flag: '🇱🇰' },
  { code: '+46',   country: 'Suède',                    flag: '🇸🇪' },
  { code: '+41',   country: 'Suisse',                   flag: '🇨🇭' },
  { code: '+597',  country: 'Suriname',                 flag: '🇸🇷' },
  { code: '+963',  country: 'Syrie',                    flag: '🇸🇾' },
  { code: '+992',  country: 'Tadjikistan',              flag: '🇹🇯' },
  { code: '+255',  country: 'Tanzanie',                 flag: '🇹🇿' },
  { code: '+235',  country: 'Tchad',                    flag: '🇹🇩' },
  { code: '+420',  country: 'Tchéquie',                 flag: '🇨🇿' },
  { code: '+66',   country: 'Thaïlande',                flag: '🇹🇭' },
  { code: '+228',  country: 'Togo',                     flag: '🇹🇬' },
  { code: '+1868', country: 'Trinité-et-Tobago',        flag: '🇹🇹' },
  { code: '+216',  country: 'Tunisie',                  flag: '🇹🇳' },
  { code: '+993',  country: 'Turkménistan',             flag: '🇹🇲' },
  { code: '+90',   country: 'Turquie',                  flag: '🇹🇷' },
  { code: '+380',  country: 'Ukraine',                  flag: '🇺🇦' },
  { code: '+598',  country: 'Uruguay',                  flag: '🇺🇾' },
  { code: '+1',    country: 'États-Unis',               flag: '🇺🇸' },
  { code: '+58',   country: 'Venezuela',                flag: '🇻🇪' },
  { code: '+84',   country: 'Vietnam',                  flag: '🇻🇳' },
  { code: '+967',  country: 'Yémen',                    flag: '🇾🇪' },
  { code: '+260',  country: 'Zambie',                   flag: '🇿🇲' },
  { code: '+263',  country: 'Zimbabwe',                 flag: '🇿🇼' },
];

// ─── Google logo SVG ─────────────────────────────────────────────────────────
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <Path fill="none" d="M0 0h48v48H0z"/>
    </Svg>
  );
}

// ─── Apple logo SVG ──────────────────────────────────────────────────────────
function AppleLogo({ size = 20, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 384 512">
      <Path
        fill={color}
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(
    COUNTRY_CODES.find((c) => c.code === '+237') ?? COUNTRY_CODES[0]
  );
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const { t } = useLanguageStore();

  const setAuth = useAuthStore((s) => s.setAuth);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const deepLink = Linking.createURL('auth/google/callback');
      const startUrl = `${process.env.EXPO_PUBLIC_API_URL}/auth/google/start?deepLink=${encodeURIComponent(deepLink)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, deepLink);

      if (result.type === 'success') {
        const url = result.url;
        const params = new URLSearchParams(url.split('?')[1] || '');
        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');
        const userId = params.get('userId');
        const userName = params.get('userName');
        const userRole = params.get('userRole');
        const error = params.get('error');

        if (error || !accessToken || !userId) {
          setError('Échec connexion Google');
          return;
        }

        const isNewUser = params.get('isNewUser') === '1';
        const user: User = {
          id: userId,
          phone: '',
          name: userName || null,
          role: (userRole || 'passenger') as User['role'],
          email: null,
          avatarUrl: null,
          status: 'active',
          language: 'fr',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        setAuth(user, accessToken, refreshToken!, isNewUser);

        if (isNewUser) {
          router.replace('/(auth)/complete-profile');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Échec connexion Google');
    } finally {
      setLoading(false);
    }
  };

  const filteredCountries = COUNTRY_CODES.filter((c) =>
    c.country.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search)
  );

  const handleSendOtp = async () => {
    const trimmedPhone = phone.replace(/\s/g, '');
    if (!trimmedPhone || trimmedPhone.length < 6) {
      setError(t.auth.phoneError);
      return;
    }
    const fullPhone = `${selectedCountry.code}${trimmedPhone}`;
    setError('');
    setLoading(true);
    try {
      await api.sendOtp(fullPhone);
      router.push({ pathname: '/verify-otp', params: { phone: fullPhone } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.auth.sendError);
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
        <View style={styles.inner}>
          {/* Title */}
          <Text style={styles.title}>{t.auth.title}</Text>
          <Text style={styles.subtitle}>
            {t.auth.subtitle}
          </Text>

          {/* Phone row: country + input */}
          <View style={styles.phoneRow}>
            {/* Country selector */}
            <Pressable
              style={styles.countrySelector}
              onPress={() => { setShowPicker(!showPicker); setSearch(''); }}
            >
              <Text style={styles.flag}>{selectedCountry.flag}</Text>
              <Text style={styles.countryCode}>{selectedCountry.code}</Text>
              {showPicker
                ? <ChevronUp size={14} color={COLORS.grayMedium} />
                : <ChevronDown size={14} color={COLORS.grayMedium} />}
            </Pressable>

            {/* Phone input */}
            <View style={styles.phoneInputWrapper}>
              <Input
                placeholder="Numéro de téléphone"
                value={phone}
                onChangeText={(t) => { setPhone(t); setError(''); }}
                keyboardType="phone-pad"
                error={error}
              />
            </View>
          </View>

          {/* Country dropdown */}
          {showPicker && (
            <View style={styles.pickerDropdown}>
              {/* Search */}
              <View style={styles.searchRow}>
                <Input
                  placeholder={t.auth.searchCountry}
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                />
              </View>
              <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                {filteredCountries.map((cc, idx) => (
                  <Pressable
                    key={`${cc.code}-${idx}`}
                    style={[
                      styles.pickerOption,
                      cc.code === selectedCountry.code &&
                        cc.country === selectedCountry.country &&
                        styles.pickerOptionSelected,
                    ]}
                    onPress={() => { setSelectedCountry(cc); setShowPicker(false); setSearch(''); }}
                  >
                    <Text style={styles.flag}>{cc.flag}</Text>
                    <Text style={styles.pickerOptionText}>{cc.country}</Text>
                    <Text style={styles.pickerOptionCode}>{cc.code}</Text>
                    {cc.code === selectedCountry.code && cc.country === selectedCountry.country && (
                      <Check size={16} color={COLORS.accent} strokeWidth={3} />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Continue button */}
          <Pressable
            style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.continueBtnText}>{t.auth.continue}</Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t.auth.or}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* SSO buttons — Google en premier sur Android, Apple en premier sur iOS */}
          {Platform.OS === 'ios' ? (
            <>
              <Pressable style={styles.ssoBtn}>
                <AppleLogo size={20} color={COLORS.black} />
                <Text style={styles.ssoBtnText}>{t.auth.apple}</Text>
              </Pressable>
              <Pressable style={styles.ssoBtn} onPress={handleGoogleLogin} disabled={loading}>
                <GoogleLogo size={20} />
                <Text style={styles.ssoBtnText}>{t.auth.google}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.ssoBtn} onPress={handleGoogleLogin} disabled={loading}>
                <GoogleLogo size={20} />
                <Text style={styles.ssoBtnText}>{t.auth.google}</Text>
              </Pressable>
              <Pressable style={styles.ssoBtn}>
                <AppleLogo size={20} color={COLORS.black} />
                <Text style={styles.ssoBtnText}>{t.auth.apple}</Text>
              </Pressable>
            </>
          )}

          {/* CGU */}
          <Text style={styles.cguText}>
            {t.auth.cgu}{' '}
            <Text style={styles.cguLink}>{t.auth.terms}</Text>
            {' '}{t.auth.and}{' '}
            <Text style={styles.cguLink}>{t.auth.privacy}</Text>.
          </Text>
        </View>

        {/* Back button */}
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(onboarding)');
            }
          }}
        >
          <ChevronLeft size={18} color={COLORS.black} strokeWidth={2.5} />
          <Text style={styles.backBtnText}>{t.auth.back}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  inner: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.grayDark,
    marginBottom: SPACING.xl,
    lineHeight: 22,
    textAlign: 'center',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: SPACING.md,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
    backgroundColor: COLORS.white,
    minHeight: 52,
  },
  flag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.black,
  },
  phoneInputWrapper: {
    flex: 1,
  },
  pickerDropdown: {
    borderRadius: BORDER_RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    maxHeight: 320,
  },
  searchRow: {
    padding: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayLight,
  },
  pickerScroll: {
    maxHeight: 240,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayLight,
  },
  pickerOptionSelected: {
    backgroundColor: `${COLORS.accent}15`,
  },
  pickerOptionText: {
    fontSize: 14,
    color: COLORS.black,
    flex: 1,
  },
  pickerOptionCode: {
    fontSize: 13,
    color: COLORS.grayMedium,
    fontWeight: '500',
  },
  continueBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.button,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  continueBtnDisabled: {
    opacity: 0.6,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.grayLight,
  },
  dividerText: {
    fontSize: 13,
    color: COLORS.grayMedium,
  },
  ssoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.button,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  ssoBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.black,
  },
  cguText: {
    fontSize: 12,
    color: COLORS.grayMedium,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  cguLink: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    margin: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
  },
});
