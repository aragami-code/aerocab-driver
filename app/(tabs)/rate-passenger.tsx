import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle, X, Star } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { COLORS, SPACING, BORDER_RADIUS, RATING_MAX, RATING_COMMENT_MAX_LENGTH } from '@aerocab/shared';
import { Button, ScreenHeader, useHaptic } from '@aerocab/mobile-ui';
import Toast from 'react-native-toast-message';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

const STAR_LABELS = ['', 'Mauvais', 'Moyen', 'Bien', 'Tres bien', 'Excellent'];

function AnimatedStar({ index, score, onPress }: { index: number; score: number; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(1.3, { damping: 4, stiffness: 300 }, () => {
      scale.value = withSpring(1);
    });
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.starButton}>
      <Animated.View style={animStyle}>
        <Star
          size={36}
          color={index + 1 <= score ? COLORS.accent : COLORS.grayMedium}
          fill={index + 1 <= score ? COLORS.accent : 'transparent'}
          strokeWidth={2}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function RatePassengerScreen() {
  const { passengerId, passengerName, conversationId } = useLocalSearchParams<{
    passengerId: string;
    passengerName?: string;
    conversationId: string;
  }>();
  const { selection, success: hapticSuccess } = useHaptic();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const token = useAuthStore((s) => s.token);

  const handleSubmit = async () => {
    if (score === 0 || !token || !passengerId || !conversationId) return;
    setLoading(true);
    try {
      await api.submitRating(token, {
        toUserId: passengerId,
        conversationId,
        score,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
      hapticSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'envoi';
      Toast.show({ type: 'error', text1: 'Erreur', text2: message });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Evaluation" />
        <View style={styles.successContainer}>
          <View style={{ marginBottom: SPACING.lg }}>
            <CheckCircle size={56} color={COLORS.success} />
          </View>
          <Text style={styles.successTitle}>Merci !</Text>
          <Text style={styles.successText}>
            Votre evaluation aide a maintenir la qualite du service.
          </Text>
          <Button
            title="Retour"
            onPress={() => router.back()}
            size="large"
            style={styles.backButton}
          />
        </View>
      </View>
    );
  }

  return (
    <>
      <ScreenHeader title="Evaluation" />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <X size={24} color={COLORS.black} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(passengerName || 'V')[0].toUpperCase()}
            </Text>
          </View>

          <Text style={styles.title}>Evaluez le voyageur</Text>
          <Text style={styles.userName}>{passengerName || 'Voyageur'}</Text>

          {/* Stars with spring animation */}
          <View style={styles.starsContainer}>
            {Array.from({ length: RATING_MAX }, (_, i) => (
              <AnimatedStar
                key={i}
                index={i}
                score={score}
                onPress={() => {
                  selection();
                  setScore(i + 1);
                }}
              />
            ))}
          </View>

          {score > 0 && (
            <Text style={styles.scoreLabel}>{STAR_LABELS[score]}</Text>
          )}

          <View style={styles.commentSection}>
            <Text style={styles.commentLabel}>Commentaire (optionnel)</Text>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Votre retour..."
              placeholderTextColor={COLORS.grayMedium}
              multiline
              maxLength={RATING_COMMENT_MAX_LENGTH}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>
              {comment.length}/{RATING_COMMENT_MAX_LENGTH}
            </Text>
          </View>

          <Button
            title="Envoyer l'evaluation"
            onPress={handleSubmit}
            loading={loading}
            disabled={score === 0}
            size="large"
            style={styles.submitBtn}
          />

          <Pressable onPress={() => router.back()} style={styles.skipBtn}>
            <Text style={styles.skipText}>Passer</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1 },
  header: {
    paddingTop: 0,
    paddingHorizontal: SPACING.md,
    alignItems: 'flex-end',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: COLORS.primaryDark },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.xl,
  },
  starsContainer: { flexDirection: 'row', gap: 8, marginBottom: SPACING.sm },
  starButton: { padding: 4 },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: SPACING.lg,
  },
  commentSection: { width: '100%', marginBottom: SPACING.lg },
  commentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.grayDark,
    marginBottom: SPACING.sm,
  },
  commentInput: {
    width: '100%',
    minHeight: 100,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md,
    fontSize: 15,
    color: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.grayMedium,
    textAlign: 'right',
    marginTop: 4,
  },
  submitBtn: { width: '100%' },
  skipBtn: { marginTop: SPACING.md, paddingVertical: 8 },
  skipText: { fontSize: 14, color: COLORS.grayMedium, fontWeight: '500' },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    color: COLORS.grayDark,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  backButton: { width: '100%' },
});
