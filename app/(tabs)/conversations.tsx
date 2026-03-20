import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, ChevronRight } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { ApiClient } from '../../lib/api-base';

type ConversationPreview = {
  id: string;
  passengerId: string;
  passengerName: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

class ConvApiClient extends ApiClient {
  async getConversations(token: string) {
    try {
      return await this.request<ConversationPreview[]>('/conversations', { token });
    } catch {
      return [];
    }
  }
}

const convApi = new ConvApiClient();

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'À l\'instant';
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function ConversationsScreen() {
  const token = useAuthStore((s) => s.token)!;
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      const data = await convApi.getConversations(token);
      setConversations(data);
    } catch {
      setLoadError(true);
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger les messages.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.center}>
          <MessageCircle size={40} color={COLORS.grayLight} />
          <Text style={styles.errorText}>Impossible de charger les messages.</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MessageCircle size={48} color={COLORS.grayLight} />
            <Text style={styles.emptyTitle}>Aucun message</Text>
            <Text style={styles.emptySubtitle}>Vos conversations avec les passagers apparaîtront ici.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.convCard}
            onPress={() => router.push({ pathname: '/(tabs)/chat', params: { passengerId: item.passengerId, conversationId: item.id } })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.passengerName ? item.passengerName[0].toUpperCase() : '?'}
              </Text>
            </View>
            <View style={styles.convInfo}>
              <View style={styles.convRow}>
                <Text style={styles.convName}>{item.passengerName ?? 'Passager'}</Text>
                <Text style={styles.convTime}>{formatTime(item.lastMessageAt)}</Text>
              </View>
              <View style={styles.convRow}>
                <Text style={styles.convLast} numberOfLines={1}>
                  {item.lastMessage ?? 'Aucun message'}
                </Text>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
            </View>
            <ChevronRight size={16} color={COLORS.grayLight} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black },
  listContent: { paddingVertical: SPACING.xs },
  emptyContainer: { flex: 1 },

  convCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.grayLight,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: `${COLORS.primary}18`, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  convInfo: { flex: 1 },
  convRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convName: { fontSize: 15, fontWeight: '700', color: COLORS.black },
  convTime: { fontSize: 11, color: COLORS.grayMedium },
  convLast: { flex: 1, fontSize: 13, color: COLORS.grayMedium, marginRight: 8 },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: COLORS.white },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.sm, marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black },
  emptySubtitle: { fontSize: 14, color: COLORS.grayMedium, textAlign: 'center', lineHeight: 20 },

  errorText: { fontSize: 14, color: COLORS.grayDark, marginTop: SPACING.sm, textAlign: 'center' },
  retryBtn: { marginTop: SPACING.md, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.button, paddingVertical: 12, paddingHorizontal: 28 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
