import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { COLORS, SPACING } from '@aerocab/shared';
import { CheckCircle, Clock, XCircle, HelpCircle, Check, X } from 'lucide-react-native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

const DOC_LABELS: Record<string, string> = {
  cni_front: 'CNI Recto',
  cni_back: 'CNI Verso',
  license: 'Permis de conduire',
  registration: 'Carte grise',
  vehicle_photo: 'Photo du vehicule',
};

export default function DriverStatusScreen() {
  const token = useAuthStore((s) => s.token);
  const [profile, setProfile] = useState<{
    status: string;
    documents: {
      id: string;
      type: string;
      status: string;
      rejectionReason: string | null;
    }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getDriverProfile(token!);
      setProfile(data);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const isApproved = profile?.status === 'approved';
  const isPending = profile?.status === 'pending';
  const isRejected = profile?.status === 'rejected';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statut de verification</Text>
      </View>

      {/* Overall status */}
      <View style={styles.section}>
        <View
          style={[
            styles.overallCard,
            isApproved && styles.overallApproved,
            isPending && styles.overallPending,
            isRejected && styles.overallRejected,
          ]}
        >
          <View style={styles.overallIconWrap}>
            {isApproved ? (
              <CheckCircle size={40} color={COLORS.success} />
            ) : isPending ? (
              <Clock size={40} color={COLORS.warning} />
            ) : isRejected ? (
              <XCircle size={40} color={COLORS.error} />
            ) : (
              <HelpCircle size={40} color={COLORS.grayMedium} />
            )}
          </View>
          <Text style={styles.overallTitle}>
            {isApproved
              ? 'Profil approuve'
              : isPending
                ? 'En attente de verification'
                : isRejected
                  ? 'Profil rejete'
                  : 'Statut inconnu'}
          </Text>
          <Text style={styles.overallDesc}>
            {isApproved
              ? 'Votre profil a ete valide. Vous pouvez maintenant recevoir des clients.'
              : isPending
                ? 'Notre equipe examine votre dossier. Cela prend generalement 24-48h.'
                : isRejected
                  ? 'Corrigez les documents signales et resoumettez votre dossier.'
                  : 'Completez votre profil et soumettez vos documents.'}
          </Text>
        </View>
      </View>

      {/* Documents status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documents</Text>
        {profile?.documents.map((doc) => (
          <View key={doc.id} style={styles.docRow}>
            <View
              style={[
                styles.docStatus,
                doc.status === 'approved' && styles.docApproved,
                doc.status === 'pending' && styles.docPendingStatus,
                doc.status === 'rejected' && styles.docRejectedStatus,
              ]}
            >
              {doc.status === 'approved' ? (
                <Check size={14} color={COLORS.success} />
              ) : doc.status === 'rejected' ? (
                <X size={14} color={COLORS.error} />
              ) : (
                <View style={styles.docBullet} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docName}>
                {DOC_LABELS[doc.type] || doc.type}
              </Text>
              {doc.rejectionReason && (
                <Text style={styles.docRejection}>
                  {doc.rejectionReason}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.docBadge,
                doc.status === 'approved' && { color: COLORS.success },
                doc.status === 'pending' && { color: COLORS.warning },
                doc.status === 'rejected' && { color: COLORS.error },
              ]}
            >
              {doc.status === 'approved'
                ? 'Approuve'
                : doc.status === 'pending'
                  ? 'En attente'
                  : 'Rejete'}
            </Text>
          </View>
        ))}

        {(!profile?.documents || profile.documents.length === 0) && !loading && (
          <Text style={styles.emptyText}>
            Aucun document soumis pour le moment
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.grayMedium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  overallCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  overallApproved: {
    backgroundColor: `${COLORS.success}10`,
    borderWidth: 1,
    borderColor: `${COLORS.success}25`,
  },
  overallPending: {
    backgroundColor: `${COLORS.warning}10`,
    borderWidth: 1,
    borderColor: `${COLORS.warning}25`,
  },
  overallRejected: {
    backgroundColor: `${COLORS.error}08`,
    borderWidth: 1,
    borderColor: `${COLORS.error}20`,
  },
  overallIconWrap: {
    marginBottom: SPACING.sm,
  },
  overallTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 4,
    textAlign: 'center',
  },
  overallDesc: {
    fontSize: 13,
    color: COLORS.grayDark,
    textAlign: 'center',
    lineHeight: 18,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  docStatus: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.grayLight,
  },
  docApproved: {
    backgroundColor: `${COLORS.success}15`,
  },
  docPendingStatus: {
    backgroundColor: `${COLORS.warning}15`,
  },
  docRejectedStatus: {
    backgroundColor: `${COLORS.error}12`,
  },
  docBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.warning,
  },
  docName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  docRejection: {
    fontSize: 11,
    color: COLORS.error,
    marginTop: 2,
  },
  docBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.grayMedium,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});
