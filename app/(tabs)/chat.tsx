import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { ApiClient } from '../../lib/api-base';
import { socketService } from '../../services/socket';

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

class ChatApiClient extends ApiClient {
  async getOrCreateConversation(token: string, passengerId: string) {
    try {
      return await this.request<{ id: string }>('/conversations/find-or-create', {
        method: 'POST', body: { passengerId }, token,
      });
    } catch {
      return { id: `mock-conv-${passengerId}` };
    }
  }

  async getMessages(token: string, conversationId: string) {
    try {
      return await this.request<Message[]>(`/conversations/${conversationId}/messages`, { token });
    } catch {
      return [];
    }
  }

  async sendMessage(token: string, conversationId: string, content: string) {
    try {
      return await this.request<Message>(`/conversations/${conversationId}/messages`, {
        method: 'POST', body: { content }, token,
      });
    } catch {
      return {
        id: `mock-msg-${Date.now()}`,
        senderId: 'me',
        content,
        createdAt: new Date().toISOString(),
      };
    }
  }
}

const chatApi = new ChatApiClient();

export default function ChatScreen() {
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user);
  const params = useLocalSearchParams<{ passengerId: string; conversationId?: string }>();

  const [conversationId, setConversationId] = useState<string | null>(params.conversationId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const listRef = useRef<FlatList>(null);

  const init = useCallback(async () => {
    try {
      let convId = conversationId;
      if (!convId) {
        const conv = await chatApi.getOrCreateConversation(token, params.passengerId);
        convId = conv.id;
        setConversationId(convId);
      }
      const msgs = await chatApi.getMessages(token, convId);
      setMessages(msgs);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger la conversation.' });
    } finally {
      setLoading(false);
    }
  }, [token, params.passengerId, conversationId]);

  useEffect(() => {
    init();
  }, [init]);

  // Socket: listen for incoming messages
  useEffect(() => {
    if (!conversationId) return;
    const socket = socketService.connect();
    socket.emit('join:conversation', conversationId);

    socket.on('message:new', (msg: Message) => {
      if (msg.senderId !== user?.id) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    return () => {
      socket.off('message:new');
      socket.emit('leave:conversation', conversationId);
    };
  }, [conversationId, user?.id]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !conversationId) return;
    setInput('');
    setSending(true);
    try {
      const msg = await chatApi.sendMessage(token, conversationId, content);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Message non envoyé.' });
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.id;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color={COLORS.black} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>Passager</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.msgList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Commencez la conversation…</Text>
            }
            renderItem={renderMessage}
          />
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Votre message…"
            placeholderTextColor={COLORS.grayMedium}
            multiline
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Send size={18} color={COLORS.white} />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black },

  msgList: { padding: SPACING.md, gap: 8, flexGrow: 1 },
  msgRow: { flexDirection: 'row', marginBottom: 8 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgBubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  msgBubbleThem: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.grayLight },
  msgBubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  msgText: { fontSize: 14, color: COLORS.black, lineHeight: 20 },
  msgTextMe: { color: COLORS.white },
  msgTime: { fontSize: 10, color: COLORS.grayMedium, marginTop: 4, textAlign: 'right' },
  msgTimeMe: { color: `${COLORS.white}99` },

  emptyText: { textAlign: 'center', color: COLORS.grayMedium, marginTop: 40, fontSize: 14 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.grayLight,
  },
  input: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15, color: COLORS.black, maxHeight: 120,
    borderWidth: 1.5, borderColor: COLORS.grayLight,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
});
