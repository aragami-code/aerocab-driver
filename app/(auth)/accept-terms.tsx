import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, FileText, Check } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { Button } from '../../lib/mobile-ui';

export default function AcceptTermsScreen() {
  const [accepted, setAccepted] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color={COLORS.black} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>Étape 2 / 4</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Conditions Générales{'\n'}Chauffeur AeroGo 24</Text>

        {/* Checkbox */}
        <Pressable style={styles.checkRow} onPress={() => setAccepted(!accepted)}>
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && <Check size={14} color={COLORS.white} strokeWidth={3} />}
          </View>
          <Text style={styles.checkLabel}>
            J'accepte les{' '}
            <Text style={styles.checkLink}>conditions générales d'utilisation</Text>
            {' '}en tant que chauffeur partenaire AeroGo 24
          </Text>
        </Pressable>

        {/* Contenu CGU */}
        <View style={styles.docCard}>
          <View style={styles.docTitleRow}>
            <FileText size={18} color={COLORS.primary} />
            <Text style={styles.docTitle}>Contrat Chauffeur Partenaire</Text>
          </View>
          <Text style={styles.docVersion}>Version 1.0 — Avril 2025</Text>

          <Text style={styles.sectionTitle}>1. Statut du chauffeur partenaire</Text>
          <Text style={styles.sectionBody}>
            En vous inscrivant sur AeroGo 24, vous agissez en tant que prestataire indépendant. Vous n'êtes pas employé par AeroGo 24. Vous êtes seul responsable du respect des lois et réglementations applicables au transport de personnes au Cameroun.
          </Text>

          <Text style={styles.sectionTitle}>2. Conditions d'éligibilité</Text>
          <Text style={styles.sectionBody}>
            Pour être chauffeur partenaire, vous devez disposer d'un permis de conduire valide, d'un véhicule en bon état d'au moins 5 places, d'une carte nationale d'identité valide et d'une carte grise à votre nom ou au nom de votre société. Tout document falsifié entraîne une exclusion définitive et un signalement aux autorités.
          </Text>

          <Text style={styles.sectionTitle}>3. Validation du dossier</Text>
          <Text style={styles.sectionBody}>
            Votre dossier est examiné par notre équipe dans un délai de 24 à 48 heures. AeroGo 24 se réserve le droit de refuser toute candidature sans avoir à en justifier le motif. En cas de refus, vous pouvez soumettre un nouveau dossier après correction des documents.
          </Text>

          <Text style={styles.sectionTitle}>4. Commissions et paiements</Text>
          <Text style={styles.sectionBody}>
            AeroGo 24 prélève une commission sur chaque course effectuée via la plateforme. Le taux de commission en vigueur est affiché dans votre espace chauffeur. Les virements sont effectués selon la périodicité indiquée dans votre tableau de bord.
          </Text>

          <Text style={styles.sectionTitle}>5. Qualité de service</Text>
          <Text style={styles.sectionBody}>
            Vous vous engagez à maintenir un véhicule propre et en bon état, à respecter les passagers, à être ponctuel et à suivre l'itinéraire convenu. Un score de réputation en dessous de 3.5/5 sur 20 courses consécutives peut entraîner la suspension temporaire de votre compte.
          </Text>

          <Text style={styles.sectionTitle}>6. Comportement et éthique</Text>
          <Text style={styles.sectionBody}>
            Tout comportement irrespectueux, discriminatoire ou dangereux envers un passager entraîne la suspension immédiate du compte. AeroGo 24 applique une politique de tolérance zéro pour la conduite sous l'influence de l'alcool ou de substances psychoactives.
          </Text>

          <Text style={styles.sectionTitle}>7. Annulations et disponibilité</Text>
          <Text style={styles.sectionBody}>
            Un taux d'annulation supérieur à 20% des courses acceptées peut entraîner des pénalités. Vous êtes libre de définir vos horaires de disponibilité via l'application. Cependant, accepter une course crée une obligation de service envers le passager.
          </Text>

          <Text style={styles.sectionTitle}>8. Données et confidentialité</Text>
          <Text style={styles.sectionBody}>
            Vos informations personnelles (nom, téléphone, localisation GPS) sont utilisées exclusivement pour la mise en relation avec les passagers et le suivi des courses. AeroGo 24 ne revend aucune donnée à des tiers.
          </Text>

          <Text style={styles.sectionTitle}>9. Résiliation</Text>
          <Text style={styles.sectionBody}>
            Vous pouvez désactiver votre compte à tout moment depuis les paramètres de l'application. AeroGo 24 peut résilier le partenariat en cas de violation des présentes conditions, de fraude avérée ou de plainte grave d'un passager.
          </Text>

          <Text style={styles.sectionTitle}>10. Contact et litiges</Text>
          <Text style={styles.sectionBody}>
            Pour tout litige ou réclamation : support@aerogo24.cm. En cas de désaccord non résolu, les tribunaux compétents de Douala (Cameroun) seront saisis.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom navigation */}
      <View style={styles.bottomNav}>
        <Pressable style={styles.backBtnBottom} onPress={() => router.back()}>
          <ChevronLeft size={18} color={COLORS.black} strokeWidth={2.5} />
          <Text style={styles.backBtnText}>Retour</Text>
        </Pressable>
        <Button
          title="Accepter et continuer"
          onPress={() => router.push('/(auth)/complete-driver-profile')}
          disabled={!accepted}
          style={styles.nextBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayLight,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBadge: {
    backgroundColor: `${COLORS.primary}12`,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  stepText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: COLORS.black,
    lineHeight: 30, marginBottom: SPACING.lg,
  },
  checkRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: SPACING.sm, marginBottom: SPACING.lg,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.grayLight,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxChecked: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  checkLabel: { fontSize: 14, color: COLORS.black, flex: 1, lineHeight: 20 },
  checkLink: { color: COLORS.primary, fontWeight: '500' },
  docCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg,
  },
  docTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  docTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  docVersion: { fontSize: 11, color: COLORS.grayMedium, marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.black,
    marginTop: SPACING.md, marginBottom: 4,
  },
  sectionBody: { fontSize: 13, color: COLORS.grayDark, lineHeight: 20 },
  bottomNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayLight,
    backgroundColor: COLORS.white,
  },
  backBtnBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.button, borderWidth: 1.5,
    borderColor: COLORS.grayLight,
  },
  backBtnText: { fontSize: 14, fontWeight: '500', color: COLORS.black },
  nextBtn: { minWidth: 180 },
});
