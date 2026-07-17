import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Banknote, Clock, CheckCircle, XCircle, ChevronDown } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS, formatCurrency } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { driverApi } from '../../services/api';

const METHODS = [
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'mtn_momo', label: 'MTN Mobile Money' },
  { value: 'bank_transfer', label: 'Virement bancaire' },
];

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pending:  { color: COLORS.warning,  label: 'En attente', icon: <Clock size={14} color={COLORS.warning} /> },
  approved: { color: '#2980B9',       label: 'Approuvé',   icon: <CheckCircle size={14} color="#2980B9" /> },
  rejected: { color: COLORS.error,    label: 'Rejeté',     icon: <XCircle size={14} color={COLORS.error} /> },
  paid:     { color: COLORS.success,  label: 'Payé',       icon: <CheckCircle size={14} color={COLORS.success} /> },
};

export default function WithdrawScreen() {
  const token = useAuthStore((s) => s.token)!;

  const [walletBalance, setWalletBalance] = useState(0);
  const [amount, setAmount]               = useState('');
  const [method, setMethod]               = useState('orange_money');
  const [mobileNumber, setMobileNumber]   = useState('');
  const [showMethods, setShowMethods]     = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  const [history, setHistory]   = useState<any[]>([]);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Solde
  useEffect(() => {
    driverApi.getEarnings(token).then((e) => setWalletBalance((e as any).walletBalance ?? 0)).catch(() => {});
  }, [token]);

  // Historique
  const loadHistory = useCallback(async (p = 1) => {
    setLoadingHistory(true);
    try {
      const res = await driverApi.getWithdrawals(token, p);
      if (p === 1) setHistory(res.data);
      else setHistory((prev) => [...prev, ...res.data]);
      setTotal(res.total);
      setPage(p);
    } catch {
      // silence
    } finally {
      setLoadingHistory(false);
    }
  }, [token]);

  useEffect(() => { loadHistory(1); }, [loadHistory]);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      Toast.show({ type: 'error', text1: 'Montant invalide' });
      return;
    }
    if (!mobileNumber.trim()) {
      Toast.show({ type: 'error', text1: 'Numéro requis' });
      return;
    }
    if (amt > walletBalance) {
      Toast.show({ type: 'error', text1: 'Solde insuffisant' });
      return;
    }
    Alert.alert(
      'Confirmer le retrait',
      `Retirer ${formatCurrency(amt)} via ${METHODS.find((m) => m.value === method)?.label} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setSubmitting(true);
            try {
              await driverApi.requestWithdrawal(token, amt, method, mobileNumber.trim());
              Toast.show({ type: 'success', text1: 'Demande envoyée', text2: 'Traitement sous 24-48h' });
              setAmount('');
              setMobileNumber('');
              loadHistory(1);
            } catch (e: any) {
              Toast.show({ type: 'error', text1: e?.message ?? 'Erreur lors de la demande' });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const selectedMethod = METHODS.find((m) => m.value === method);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={COLORS.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Retirer mes gains</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Solde */}
          <Animated.View entering={FadeIn} style={styles.balanceCard}>
            <Banknote size={24} color={COLORS.accent} />
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <Text style={styles.balanceAmount}>{formatCurrency(walletBalance)}</Text>
          </Animated.View>

          {/* Formulaire */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nouvelle demande</Text>

            {/* Montant */}
            <Text style={styles.fieldLabel}>Montant (XAF)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="Ex: 10000"
              placeholderTextColor={COLORS.grayMedium}
            />

            {/* Méthode */}
            <Text style={styles.fieldLabel}>Méthode</Text>
            <Pressable style={styles.selector} onPress={() => setShowMethods((v) => !v)}>
              <Text style={styles.selectorText}>{selectedMethod?.label}</Text>
              <ChevronDown size={18} color={COLORS.grayMedium} />
            </Pressable>
            {showMethods && (
              <View style={styles.dropdown}>
                {METHODS.map((m) => (
                  <Pressable
                    key={m.value}
                    style={[styles.dropdownItem, method === m.value && styles.dropdownItemActive]}
                    onPress={() => { setMethod(m.value); setShowMethods(false); }}
                  >
                    <Text style={[styles.dropdownText, method === m.value && styles.dropdownTextActive]}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Numéro Mobile Money */}
            <Text style={styles.fieldLabel}>Numéro Mobile Money</Text>
            <TextInput
              style={styles.input}
              value={mobileNumber}
              onChangeText={setMobileNumber}
              keyboardType="phone-pad"
              placeholder="+237 6XX XXX XXX"
              placeholderTextColor={COLORS.grayMedium}
            />

            {/* Résumé net reçu */}
            {!!amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Méthode</Text>
                  <Text style={styles.summaryValue}>{selectedMethod?.label}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Montant demandé</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(parseFloat(amount))}</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryNetRow]}>
                  <Text style={styles.summaryNetLabel}>Vous recevrez</Text>
                  <Text style={styles.summaryNetValue}>{formatCurrency(parseFloat(amount))}</Text>
                </View>
              </View>
            )}

            <Pressable
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.submitBtnText}>Envoyer la demande</Text>
              }
            </Pressable>
          </View>

          {/* Historique */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Historique des retraits</Text>
            {history.length === 0 && !loadingHistory && (
              <Text style={styles.emptyText}>Aucun retrait pour l'instant.</Text>
            )}
            {history.map((item) => {
              const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
              return (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    {cfg.icon}
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.historyAmount}>{formatCurrency(item.amount)}</Text>
                      <Text style={styles.historyMeta}>
                        {METHODS.find((m) => m.value === item.method)?.label ?? item.method}
                      </Text>
                      <Text style={styles.historyDate}>
                        {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { borderColor: cfg.color }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
              );
            })}
            {loadingHistory && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 8 }} />}
            {history.length < total && !loadingHistory && (
              <Pressable style={styles.loadMore} onPress={() => loadHistory(page + 1)}>
                <Text style={styles.loadMoreText}>Charger plus</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 40 },

  balanceCard: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg, alignItems: 'center', gap: 6,
  },
  balanceLabel: { color: COLORS.grayLight, fontSize: 13 },
  balanceAmount: { color: COLORS.accent, fontSize: 28, fontWeight: '800' },

  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, gap: SPACING.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },

  fieldLabel: { fontSize: 13, color: COLORS.grayDark, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: COLORS.grayLight, borderRadius: BORDER_RADIUS.button,
    padding: SPACING.sm, fontSize: 15, color: COLORS.black,
  },

  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.grayLight, borderRadius: BORDER_RADIUS.button,
    padding: SPACING.sm,
  },
  selectorText: { fontSize: 15, color: COLORS.black },
  dropdown: {
    borderWidth: 1, borderColor: COLORS.grayLight, borderRadius: BORDER_RADIUS.button,
    overflow: 'hidden', marginTop: -SPACING.xs,
  },
  dropdownItem: { padding: SPACING.sm, backgroundColor: COLORS.white },
  dropdownItemActive: { backgroundColor: COLORS.primary },
  dropdownText: { fontSize: 14, color: COLORS.black },
  dropdownTextActive: { color: COLORS.white, fontWeight: '600' },

  summaryBox: {
    backgroundColor: `${COLORS.primary}08`, borderRadius: BORDER_RADIUS.button,
    padding: SPACING.sm, gap: 8, marginTop: 4,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: COLORS.grayMedium },
  summaryValue: { fontSize: 13, fontWeight: '600', color: COLORS.black },
  summaryNetRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: `${COLORS.primary}20`, marginTop: 4 },
  summaryNetLabel: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  summaryNetValue: { fontSize: 16, fontWeight: '800', color: COLORS.accent },

  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.button,
    padding: SPACING.md, alignItems: 'center', marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  emptyText: { color: COLORS.grayMedium, textAlign: 'center', paddingVertical: 8 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center' },
  historyAmount: { fontSize: 15, fontWeight: '700', color: COLORS.black },
  historyMeta: { fontSize: 12, color: COLORS.grayMedium },
  historyDate: { fontSize: 11, color: COLORS.grayMedium },
  statusBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 12, fontWeight: '600' },
  loadMore: { alignItems: 'center', padding: SPACING.sm },
  loadMoreText: { color: COLORS.primary, fontWeight: '600' },
});
