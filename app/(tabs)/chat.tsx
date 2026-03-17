import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@aerocab/shared';
import { ArrowLeft, Phone, Star, Send, Check, CheckCheck } from 'lucide-react-native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

type MessageItem = {
  id: string;
  content: string;
  senderId: string;
  readAt: string | null;
  createdAt: string;
};

export default function DriverChatScreen() {
  const { conversationId, passengerName, passengerId } = useLocalSearchParams<{
    conversationId: string;
    passengerName?: string;
    passengerId?: string;
  }>();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);

  const loadMessages = useCallback(async () => {
    if (!token || !conversationId) return;
    try {
      const data = await api.getChatMessages(token, conversationId);
      setMessages(data as MessageItem[]);
    } catch {}
  }, [token, conversationId]);

  useEffect(() => {
    loadMessages();
    if (token && conversationId) api.markChatRead(token, conversationId).catch(() => {});
  }, [loadMessages, token, conversationId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !token || !conversationId) return;
    setSending(true);
    setInput('');

    const tempMsg: MessageItem = {
      id: `temp-${Date.now()}`,
      content: text,
      senderId: userId || '',
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const msg = await api.sendChatMessage(token, conversationId, text);
      setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? (msg as MessageItem) : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: MessageItem }) => {
    const isMine = item.senderId === userId;
    return (
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        <View style={[styles.msgBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
          <View style={styles.msgTimeRow}>
            <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>
              {formatTime(item.createdAt)}
            </Text>
            {isMine && item.readAt ? (
              <CheckCheck size={12} color={isMine ? 'rgba(255,255,255,0.5)' : COLORS.grayMedium} />
            ) : isMine ? (
              <Check size={12} color={isMine ? 'rgba(255,255,255,0.5)' : COLORS.grayMedium} />
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={18} color={COLORS.white} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{passengerName || 'Voyageur'}</Text>
          <Text style={styles.headerStatus}>En ligne</Text>
        </View>
        <Pressable style={styles.callBtn}>
          <Phone size={18} color={COLORS.primaryDark} />
        </Pressable>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>En attente du voyageur...</Text>
          </View>
        }
      />

      {/* Rate passenger link */}
      {conversationId && passengerId && (
        <Pressable
          style={styles.rateBar}
          onPress={() => router.push({
            pathname: '/(tabs)/rate-passenger',
            params: { passengerId, passengerName: passengerName || 'Voyageur', conversationId },
          } as never)}
        >
          <View style={styles.rateBarContent}>
            <Star size={14} color={COLORS.accent} />
            <Text style={styles.rateBarText}>Evaluer ce voyageur</Text>
          </View>
        </Pressable>
      )}

      <View style={styles.inputBar}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Votre message..." placeholderTextColor={COLORS.grayMedium} multiline maxLength={1000} />
        <Pressable style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]} onPress={handleSend} disabled={!input.trim() || sending}>
          <Send size={18} color={COLORS.primaryDark} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 12, paddingHorizontal: SPACING.md, backgroundColor: COLORS.primary, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  headerStatus: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  callBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  messageList: { padding: SPACING.md, paddingBottom: 8, flexGrow: 1 },
  msgRow: { marginBottom: 8, alignItems: 'flex-start' },
  msgRowMine: { alignItems: 'flex-end' },
  msgBubble: { maxWidth: '78%', padding: 12, borderRadius: 18 },
  bubbleMine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  msgText: { fontSize: 15, color: COLORS.black, lineHeight: 20 },
  msgTextMine: { color: COLORS.white },
  msgTimeRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4, gap: 3 },
  msgTime: { fontSize: 10, color: COLORS.grayMedium },
  msgTimeMine: { color: 'rgba(255,255,255,0.5)' },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyChatText: { fontSize: 15, color: COLORS.grayMedium },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: SPACING.sm, paddingBottom: Platform.OS === 'ios' ? 28 : SPACING.sm, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.grayLight, gap: 8 },
  input: { flex: 1, minHeight: 42, maxHeight: 100, backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.button, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: COLORS.black },
  sendBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  rateBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: `${COLORS.accent}15`,
    borderTopWidth: 1,
    borderTopColor: `${COLORS.accent}30`,
  },
  rateBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rateBarText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
  },
});
