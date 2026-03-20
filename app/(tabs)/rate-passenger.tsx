import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS, RATING_COMMENT_MAX_LENGTH } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { driverApi } from '../../services/api';

export default function RatePassengerScreen() {
  const token = useAuthStore((s) => s.token)!;
  const params = useLocalSearchParams<{ passengerId: string; bookingId: string }>();

  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStarPress = (s: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScore(s);
  };

  const handleSubmit = async () => {
    if (score === 0) {
      Toast.show({ type: 'error', text1: 'Note requise', text2: 'Veuillez sélectionner une note.' });
      return;
    }
    setLoading(true);
    try {
      await driverApi.ratePassenger(token, {
        toUserId: params.passengerId,
        conversationId: params.bookingId,
        score,
        comment: comment.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Merci pour votre retour !' });
      router.replace('/(tabs)');
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible d\'envoyer la note.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Passer la notation ?',
      'Vous ne pourrez pas noter ce passager plus tard.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Passer', style: 'destructive', onPress: () => router.replace('/(tabs)') },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>Notez le passager</Text>
        <Text style={styles.subtitle}>Votre avis aide à maintenir la qualité du service.</Text>

        {/* Stars */}
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Pressable key={s} onPress={() => handleStarPress(s)} style={styles.starBtn}>
              <Star
                size={44}
                color={s <= score ? COLORS.accent : COLORS.grayLight}
                fill={s <= score ? COLORS.accent : 'transparent'}
                strokeWidth={1.5}
              />
            </Pressable>
          ))}
        </View>

        <Text style={styles.scoreLabel}>
          {score === 0 ? 'Appuyez sur une étoile' :
            score === 1 ? '😞 Très mauvais' :
            score === 2 ? '😕 Mauvais' :
            score === 3 ? '😐 Correct' :
            score === 4 ? '😊 Bien' :
            '😁 Excellent !'}
        </Text>

        {/* Comment */}
        <View style={styles.commentBox}>
          <Text style={styles.commentLabel}>Commentaire (optionnel)</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Un détail à mentionner ?"
            placeholderTextColor={COLORS.grayMedium}
            multiline
            maxLength={RATING_COMMENT_MAX_LENGTH}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{comment.length}/{RATING_COMMENT_MAX_LENGTH}</Text>
        </View>

        {/* Actions */}
        <Pressable
          style={[styles.submitBtn, (score === 0 || loading) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={score === 0 || loading}
        >
          {loading
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.submitBtnText}>Envoyer la note</Text>
          }
        </Pressable>

        <Pressable style={styles.skipBtn} onPress={handleSkip} disabled={loading}>
          <Text style={styles.skipBtnText}>Passer</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { flex: 1, padding: SPACING.lg, alignItems: 'center' },

  title: { fontSize: 26, fontWeight: '800', color: COLORS.black, marginTop: SPACING.xl, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.grayMedium, textAlign: 'center', marginBottom: SPACING.xl, lineHeight: 20 },

  starsContainer: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  starBtn: { padding: 4 },

  scoreLabel: { fontSize: 16, fontWeight: '600', color: COLORS.grayDark, marginBottom: SPACING.xl, minHeight: 24 },

  commentBox: { width: '100%', marginBottom: SPACING.lg },
  commentLabel: { fontSize: 12, fontWeight: '600', color: COLORS.grayDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  commentInput: {
    backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md, fontSize: 14, color: COLORS.black,
    borderWidth: 1.5, borderColor: COLORS.grayLight,
    minHeight: 100,
  },
  charCount: { fontSize: 11, color: COLORS.grayMedium, textAlign: 'right', marginTop: 4 },

  submitBtn: {
    width: '100%', backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.button, paddingVertical: 16, alignItems: 'center', marginBottom: SPACING.sm,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  skipBtn: { paddingVertical: 12 },
  skipBtnText: { fontSize: 14, color: COLORS.grayMedium, fontWeight: '500' },
});
