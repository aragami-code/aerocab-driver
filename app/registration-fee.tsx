import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Smartphone, Banknote, CheckCircle, AlertCircle, Clock } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../lib/shared';
import { useAuthStore } from '../stores/authStore';
import { useCurrencySymbol } from '../stores/configStore';
import { driverApi } from '../services/api';

type Provider = 'orange_money_cm' | 'mtn_cm' | 'cash';

const METHODS: { id: Provider; label: string; color: string; bg: string }[] = [
  { id: 'orange_money_cm', label: 'Orange Money', color: '#FF6600', bg: '#FFF3E0' },
  { id: 'mtn_cm',          label: 'MTN MoMo',     color: '#FFCC00', bg: '#FFFDE7' },
  { id: 'cash',            label: 'Espèces',       color: '#2E7D32', bg: '#E8F5E9' },
];

export default function RegistrationFeeScreen() {
  const token = useAuthStore(s => s.token);
  const sym = useCurrencySymbol();

  const [feeInfo, setFeeInfo] = useState<{
    minFee: number; maxFee: number; paid: boolean;
    pendingPayment: any | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<Provider>('orange_money_cm');
  const [paying, setPaying] = useState(false);
  const [cashPending, setCashPending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;
    driverApi.getRegistrationFeeStatus(token)
      .then(res => {
        setFeeInfo(res);
        if (res.paid) router.replace('/(tabs)' as never);
        if (res.pendingPayment?.provider === 'cash') setCashPending(true);
      })
      .catch(() => Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger les informations.' }))
      .finally(() => setLoading(false));

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [token]);

  const startPolling = () => {
    if (!token) return;
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await driverApi.getRegistrationFeeStatus(token);
        if (res.paid) {
          clearInterval(pollRef.current!);
          Toast.show({ type: 'success', text1: 'Paiement reçu !', text2: 'Bienvenue sur AeroCab.' });
          router.replace('/(tabs)' as never);
        }
      } catch { /* ignore */ }
      if (attempts >= 60) {
        clearInterval(pollRef.current!);
        setPaying(false);
        Toast.show({ type: 'error', text1: 'Délai expiré', text2: 'Veuillez vérifier votre paiement.' });
      }
    }, 5000);
  };

  const handlePay = async () => {
    if (!token || paying) return;
    setPaying(true);
    try {
      const result = await driverApi.initiateRegistrationFee(token, selectedMethod);

      if (selectedMethod === 'cash') {
        setCashPending(true);
        setPaying(false);
        Toast.show({
          type: 'info',
          text1: 'Paiement en espèces',
          text2: 'Rendez-vous en agence AeroCab avec votre référence.',
        });
        return;
      }

      if (result.paymentUrl) {
        await WebBrowser.openBrowserAsync(result.paymentUrl, {
          dismissButtonStyle: 'cancel',
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        });
        startPolling();
        return;
      }
    } catch (e: any) {
      setPaying(false);
      Toast.show({ type: 'error', text1: 'Erreur', text2: e?.message ?? 'Échec du paiement' });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const feeAmount = feeInfo?.minFee ?? 5000;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* En-tête */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <CheckCircle size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.heroTitle}>Frais d'inscription</Text>
          <Text style={styles.heroSub}>
            Un paiement unique de {feeAmount.toLocaleString()} {sym} est requis pour activer votre compte chauffeur.
          </Text>
        </View>

        {/* Avantages */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ce que ça inclut</Text>
          <FeatureLine text="Accès complet à la plateforme AeroCab" />
          <FeatureLine text="Dépôt de garantie remboursable (50 %)" />
          <FeatureLine text="Support chauffeur dédié" />
          <FeatureLine text="Badge vérifié sur votre profil" />
        </View>

        {/* Cash en attente */}
        {cashPending && (
          <View style={[styles.card, { borderColor: '#F59E0B', borderWidth: 1.5 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Clock size={18} color="#F59E0B" />
              <Text style={{ fontWeight: '700', color: '#92400E' }}>Paiement espèces en attente</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#78350F', lineHeight: 20 }}>
              Votre dossier est enregistré. Rendez-vous dans une agence AeroCab pour régler les frais en espèces. Votre compte sera activé à confirmation.
            </Text>
          </View>
        )}

        {/* Sélecteur méthode */}
        {!cashPending && (
          <>
            <Text style={styles.sectionTitle}>Choisir un mode de paiement</Text>
            <View style={styles.methodRow}>
              {METHODS.map(m => {
                const selected = selectedMethod === m.id;
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.methodCard, selected && { borderColor: m.color, borderWidth: 2, backgroundColor: m.bg }]}
                    onPress={() => setSelectedMethod(m.id)}
                  >
                    {m.id === 'cash' ? (
                      <Banknote size={24} color={selected ? m.color : COLORS.grayMedium} />
                    ) : (
                      <Smartphone size={24} color={selected ? m.color : COLORS.grayMedium} />
                    )}
                    <Text style={[styles.methodLabel, selected && { color: m.color, fontWeight: '700' }]}>
                      {m.label}
                    </Text>
                    <View style={[styles.radio, selected && { backgroundColor: m.color, borderColor: m.color }]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {selectedMethod === 'cash' && (
              <View style={styles.note}>
                <AlertCircle size={14} color="#78350F" />
                <Text style={styles.noteText}>Le paiement en espèces se fait en agence. Votre compte sera activé après confirmation par un administrateur.</Text>
              </View>
            )}
          </>
        )}

        {/* Montant */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Montant total</Text>
          <Text style={styles.totalAmount}>{feeAmount.toLocaleString()} {sym}</Text>
          <Text style={styles.totalSub}>dont {(feeAmount * 0.5).toLocaleString()} {sym} remboursables</Text>
        </View>

      </ScrollView>

      {/* Footer */}
      {!cashPending && (
        <View style={styles.footer}>
          <Pressable
            style={[styles.btn, paying && { opacity: 0.7 }]}
            onPress={handlePay}
            disabled={paying}
          >
            {paying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {selectedMethod === 'cash' ? 'Enregistrer ma demande' : `Payer ${feeAmount.toLocaleString()} ${sym}`}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

function FeatureLine({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary }} />
      <Text style={{ fontSize: 13, color: '#444', flex: 1 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: SPACING.lg, paddingTop: Platform.OS === 'ios' ? 64 : 40, gap: 16, paddingBottom: 24 },

  hero: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.black },
  heroSub:   { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.grayLight,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.black, marginBottom: 10 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  methodRow: { flexDirection: 'row', gap: 10 },
  methodCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.grayLight, padding: 12, alignItems: 'center', gap: 6,
  },
  methodLabel: { fontSize: 11, fontWeight: '600', color: COLORS.grayDark, textAlign: 'center' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COLORS.grayLight, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },

  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FDE68A' },
  noteText: { flex: 1, fontSize: 12, color: '#78350F', lineHeight: 18 },

  totalCard: {
    backgroundColor: COLORS.primary, borderRadius: 18, padding: 20, alignItems: 'center', gap: 4,
  },
  totalLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  totalAmount: { fontSize: 28, fontWeight: '900', color: '#fff' },
  totalSub:    { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  footer: {
    padding: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
  },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.button,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
