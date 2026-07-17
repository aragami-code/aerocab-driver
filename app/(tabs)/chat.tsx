import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
  Modal, Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, Globe, ImageIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useLanguageStore } from '../../stores/languageStore';
import { translateText } from '../../lib/translate';
import { ApiClient, API_BASE_URL } from '../../lib/api-base';

const API_HOST = API_BASE_URL.replace(/\/api$/, '');
const resolveMediaUrl = (url: string) =>
  url.startsWith('http') || url.startsWith('file') ? url : API_HOST + url;
import { chatSocket } from '../../services/chatSocket';
import { useChatStore } from '../../stores/chatStore';

type Message = {
  id: string;
  senderId: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  createdAt: string;
};

class ChatApiClient extends ApiClient {
  async getOrCreateConversation(token: string, passengerId: string) {
    try {
      return await this.request<{ id: string }>('/chat/conversations', {
        method: 'POST', body: { otherUserId: passengerId }, token,
      });
    } catch {
      return null;
    }
  }

  async getMessages(token: string, conversationId: string) {
    try {
      return await this.request<Message[]>(`/chat/conversations/${conversationId}/messages`, { token });
    } catch {
      return [];
    }
  }

  async sendMessage(token: string, conversationId: string, content: string, mediaUrl?: string, mediaType?: string) {
    return await this.request<Message>(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST', body: { content, mediaUrl, mediaType }, token,
    });
  }

  async uploadMedia(token: string, conversationId: string, uri: string): Promise<{ url: string; mediaType: string }> {
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'image.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    (formData as any).append('file', { uri, name: filename, type: mime });
    const res = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error('Échec envoi image');
    return res.json();
  }
}

const chatApi = new ChatApiClient();

const DRIVER_QUICK_REPLIES = [
  'J\'arrive dans 5 min',
  'Je suis devant l\'aérogare',
  'Je vous attends',
  'Appelez-moi',
  'Pouvez-vous sortir ?',
  'Je suis à l\'entrée principale',
  'Retard de 10 min, désolé',
  'OK, je vous vois',
];

export default function ChatScreen() {
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user);
  const { lang } = useLanguageStore();
  const params = useLocalSearchParams<{ passengerId: string; conversationId?: string; bookingId?: string }>();
  const hasBooking = !!params.bookingId;
  const { resetBooking } = useChatStore();

  useEffect(() => {
    if (params.bookingId) resetBooking(params.bookingId);
  }, [params.bookingId]);

  const [conversationId, setConversationId] = useState<string | null>(params.conversationId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const [showTranslated, setShowTranslated] = useState<Record<string, boolean>>({});

  const listRef = useRef<FlatList>(null);

  const init = useCallback(async () => {
    try {
      let convId = conversationId;
      if (!convId) {
        const conv = await chatApi.getOrCreateConversation(token, params.passengerId);
        if (!conv) {
          Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de démarrer la conversation.' });
          setLoading(false);
          return;
        }
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

  // Socket: connexion /chat et écoute des nouveaux messages
  useEffect(() => {
    if (!conversationId || !token) return;
    chatSocket.connect(token);
    chatSocket.joinConversation(conversationId);

    const onNewMessage = (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        if (msg.senderId === user?.id) {
          // Replace the oldest pending temp message with the confirmed one
          const firstTempIdx = prev.findIndex((m) => m.id.startsWith('temp-'));
          if (firstTempIdx !== -1) {
            const next = [...prev];
            next[firstTempIdx] = msg;
            return next;
          }
        }
        return [...prev, msg];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    };
    chatSocket.on('new_message', onNewMessage);

    return () => {
      chatSocket.off('new_message', onNewMessage);
      chatSocket.leaveConversation(conversationId);
    };
  }, [conversationId, token, user?.id]);

  const handleSend = async (textOverride?: string) => {
    const content = (textOverride ?? input).trim();
    if (!content || !conversationId) return;
    if (!textOverride) setInput('');
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId, senderId: user?.id ?? '', content,
      mediaUrl: null, mediaType: null, createdAt: new Date().toISOString(),
    }]);
    try {
      const msg = await chatApi.sendMessage(token, conversationId, content);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Message non envoyé.' });
    } finally {
      setSending(false);
    }
  };

  const handleSendImage = async () => {
    if (sendingImage || !conversationId) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const tempId = `temp-img-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId,
      senderId: user?.id ?? '',
      content: '',
      mediaUrl: asset.uri,
      mediaType: asset.mimeType ?? 'image/jpeg',
      createdAt: new Date().toISOString(),
    }]);

    setSendingImage(true);
    try {
      const uploaded = await chatApi.uploadMedia(token, conversationId, asset.uri);
      const msg = await chatApi.sendMessage(token, conversationId, '', uploaded.url, uploaded.mediaType);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Image non envoyée.' });
    } finally {
      setSendingImage(false);
    }
  };

  const handleTranslate = async (msgId: string, content: string) => {
    if (showTranslated[msgId]) {
      setShowTranslated(prev => ({ ...prev, [msgId]: false }));
      return;
    }
    if (translations[msgId]) {
      setShowTranslated(prev => ({ ...prev, [msgId]: true }));
      return;
    }
    setTranslating(prev => ({ ...prev, [msgId]: true }));
    try {
      const result = await translateText(content, lang);
      setTranslations(prev => ({ ...prev, [msgId]: result }));
      setShowTranslated(prev => ({ ...prev, [msgId]: true }));
    } catch { /* ignore */ }
    finally { setTranslating(prev => ({ ...prev, [msgId]: false })); }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.id;
    const isTranslated = showTranslated[item.id];
    const isTranslating = translating[item.id];
    const isImage = !!item.mediaUrl && item.mediaType?.startsWith('image/');
    const isTemp = item.id.startsWith('temp-');
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
          {isImage && (
            <Pressable
              style={styles.msgImageWrap}
              onPress={() => !isTemp && setFullscreenImage(resolveMediaUrl(item.mediaUrl!))}
            >
              <Image
                source={{ uri: resolveMediaUrl(item.mediaUrl!) }}
                style={styles.msgImage}
                resizeMode="cover"
              />
              {isTemp && (
                <View style={styles.msgImageOverlay}>
                  <ActivityIndicator color={COLORS.white} />
                </View>
              )}
            </Pressable>
          )}
          {item.content ? (
            <>
              <Text style={[styles.msgText, isMe && styles.msgTextMe]}>
                {isTranslated && translations[item.id] ? translations[item.id] : item.content}
              </Text>
              {isTranslated && translations[item.id] && (
                <Text style={[styles.msgOriginal, { color: isMe ? `${COLORS.white}60` : COLORS.grayMedium }]}>
                  {item.content}
                </Text>
              )}
            </>
          ) : null}
          <View style={styles.msgTimeRow}>
            {!isMe && item.content ? (
              <Pressable
                onPress={() => handleTranslate(item.id, item.content)}
                disabled={isTranslating}
                style={styles.translateBtn}
              >
                <Globe size={12} color={isTranslated ? COLORS.primary : COLORS.grayMedium} />
              </Pressable>
            ) : null}
            <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
              {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
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

        {/* Messages prédéfinis — toujours visibles */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickRepliesWrap}
          contentContainerStyle={styles.quickReplies}
        >
          {DRIVER_QUICK_REPLIES.map((msg) => (
            <Pressable
              key={msg}
              style={({ pressed }) => [
                styles.quickChip,
                pressed && { opacity: 0.7 },
                (!hasBooking || sending) && { opacity: 0.4 },
              ]}
              onPress={() => handleSend(msg)}
              disabled={!hasBooking || sending}
            >
              <Text style={styles.quickChipText}>{msg}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* No active booking banner */}
        {!hasBooking && (
          <View style={styles.noBookingBanner}>
            <Text style={styles.noBookingBannerText}>Messagerie disponible pendant une course active</Text>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputBar, !hasBooking && { opacity: 0.5 }]}>
          <Pressable
            style={[styles.imageBtn, (sendingImage || !hasBooking || !conversationId) && { opacity: 0.4 }]}
            onPress={handleSendImage}
            disabled={sendingImage || !hasBooking || !conversationId}
          >
            {sendingImage
              ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <ImageIcon size={18} color={COLORS.primary} />
            }
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={!hasBooking ? 'Messagerie désactivée' : 'Votre message…'}
            placeholderTextColor={COLORS.grayMedium}
            multiline
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit={false}
            editable={hasBooking}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || sending || !hasBooking) && { opacity: 0.4 }]}
            onPress={() => handleSend()}
            disabled={!input.trim() || sending || !hasBooking}
          >
            {sending
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Send size={18} color={COLORS.white} />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Fullscreen image viewer */}
      <Modal
        visible={!!fullscreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImage(null)}
        statusBarTranslucent
      >
        <View style={styles.fullscreenOverlay}>
          <Pressable style={styles.fullscreenClose} onPress={() => setFullscreenImage(null)}>
            <X size={24} color={COLORS.white} />
          </Pressable>
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  msgTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 4 },
  msgTime: { fontSize: 10, color: COLORS.grayMedium },
  msgTimeMe: { color: `${COLORS.white}99` },
  translateBtn: { padding: 2 },
  msgOriginal: { fontSize: 11, fontStyle: 'italic', marginTop: 3, opacity: 0.7 },

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
  imageBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${COLORS.primary}12`,
  },
  msgImageWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 4 },
  msgImage: { width: 190, height: 140, borderRadius: 12 },
  msgImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  quickRepliesWrap: {
    borderTopWidth: 1, borderTopColor: COLORS.grayLight,
    backgroundColor: COLORS.white,
  },
  quickReplies: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 8, gap: 8,
  },
  quickChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1,
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.background,
  },
  quickChipText: {
    fontSize: 12, fontWeight: '500', color: COLORS.primary,
  },
  noBookingBanner: {
    backgroundColor: `${COLORS.grayMedium}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: `${COLORS.grayMedium}30`,
    alignItems: 'center',
  },
  noBookingBannerText: {
    fontSize: 12,
    color: COLORS.grayMedium,
    fontStyle: 'italic',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullscreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
});
