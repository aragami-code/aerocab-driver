import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@aerocab/shared';
import { Plane, MessageCircle } from 'lucide-react-native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

type ConversationItem = {
  id: string;
  driver: { id: string; name: string | null; avatarUrl: string | null };
  passenger: { id: string; name: string | null; avatarUrl: string | null };
  flight: { flightNumber: string | null; scheduledArrival: string } | null;
  messages: { content: string; createdAt: string; senderId: string; readAt: string | null }[];
};

export default function DriverConversationsScreen() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getConversations(token);
      setConversations(data as ConversationItem[]);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
    if (diffHours < 1) return `${Math.floor((now.getTime() - d.getTime()) / 60000)}min`;
    if (diffHours < 24) return `${Math.floor(diffHours)}h`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const renderConversation = ({ item }: { item: ConversationItem }) => {
    const lastMsg = item.messages[0];
    const passenger = item.passenger;
    const isUnread = lastMsg && lastMsg.senderId !== userId && !lastMsg.readAt;

    return (
      <Pressable
        style={[styles.card, isUnread && styles.cardUnread]}
        onPress={() =>
          router.push({
            pathname: '/(tabs)/chat',
            params: {
              conversationId: item.id,
              passengerName: passenger.name || 'Voyageur',
              passengerId: passenger.id,
            },
          })
        }
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(passenger.name || 'V')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.name, isUnread && styles.nameUnread]} numberOfLines={1}>
              {passenger.name || 'Voyageur'}
            </Text>
            {lastMsg && <Text style={styles.time}>{formatTime(lastMsg.createdAt)}</Text>}
          </View>
          {item.flight?.flightNumber && (
            <View style={styles.flightBadgeRow}>
              <Plane size={11} color={COLORS.primary} />
              <Text style={styles.flightBadge}>
                {item.flight.flightNumber}
              </Text>
            </View>
          )}
          {lastMsg ? (
            <Text style={[styles.lastMessage, isUnread && styles.lastMessageUnread]} numberOfLines={1}>
              {lastMsg.senderId === userId ? 'Vous: ' : ''}{lastMsg.content}
            </Text>
          ) : (
            <Text style={styles.noMessage}>Nouvelle conversation</Text>
          )}
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>
      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MessageCircle size={48} color={COLORS.grayMedium} />
          <Text style={styles.emptyTitle}>Aucun message</Text>
          <Text style={styles.emptyText}>
            Les voyageurs vous contacteront apres avoir achete un acces.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} tintColor={COLORS.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  loadingText: { color: COLORS.grayMedium, fontSize: 14 },
  header: { paddingTop: Platform.OS === 'ios' ? 56 : 44, paddingBottom: 16, paddingHorizontal: SPACING.lg, backgroundColor: COLORS.primary },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white, letterSpacing: -0.5 },
  list: { padding: SPACING.md, gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: COLORS.accent },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.black, flex: 1 },
  nameUnread: { fontWeight: '800' },
  time: { fontSize: 12, color: COLORS.grayMedium, marginLeft: 8 },
  flightBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  flightBadge: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  lastMessage: { fontSize: 13, color: COLORS.grayDark },
  lastMessageUnread: { color: COLORS.black, fontWeight: '600' },
  noMessage: { fontSize: 13, color: COLORS.grayMedium, fontStyle: 'italic' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, gap: SPACING.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.grayDark, textAlign: 'center', lineHeight: 20 },
});
