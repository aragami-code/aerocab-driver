import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, AppState,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Send, Clock, CheckCircle, XCircle, ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../lib/shared';
import { driverApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:          { label: 'Ouvert',      color: '#E65100', bg: '#FFF3E0' },
  pending:       { label: 'En attente',  color: '#E65100', bg: '#FFF3E0' },
  investigating: { label: 'En cours',    color: '#1565C0', bg: '#E3F2FD' },
  resolved:      { label: 'Résolu',      color: '#2E7D32', bg: '#E8F5E9' },
  dismissed:     { label: 'Rejeté',      color: '#C62828', bg: '#FDECEA' },
};

type Msg = {
  id: string;
  senderRole: 'user' | 'admin' | 'system';
  message: string;
  imageUrl?: string | null;
  createdAt: string;
  sender: { name?: string };
};

type Report = {
  id: string;
  reason: string;
  status: string;
  resolution?: string;
  createdAt: string;
  messages: Msg[];
};

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthStore(s => s.token)!;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await driverApi.getReportById(token, id);
      setReport(data);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  const silentRefresh = useCallback(async () => {
    try {
      const data = await driverApi.getReportById(token, id);
      setReport(data);
    } catch { /* silencieux */ }
  }, [token, id]);

  // Polling toutes les 15s quand ticket ouvert — reçoit les réponses admin
  useEffect(() => {
    const isTicketOpen = report?.status === 'open' || report?.status === 'investigating';
    if (!isTicketOpen) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }

    pollingRef.current = setInterval(silentRefresh, 15000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      } else {
        silentRefresh();
        pollingRef.current = setInterval(silentRefresh, 15000);
      }
    });

    return () => {
      sub.remove();
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [report?.status, silentRefresh]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [report?.messages?.length]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie pour joindre une photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingImage(result.assets[0].uri);
    }
  };

  const sendMessage = async () => {
    if ((!message.trim() && !pendingImage) || sending || !report) return;
    setSending(true);
    try {
      let imageUrl: string | undefined;
      if (pendingImage) {
        const res = await driverApi.uploadTicketImage(token, pendingImage);
        imageUrl = res.url;
      }
      const msg = await driverApi.addReportMessage(token, report.id, message.trim() || ' ', imageUrl);
      setReport(prev => prev ? {
        ...prev,
        status: prev.status === 'open' ? 'investigating' : prev.status,
        messages: [...prev.messages, msg],
      } : null);
      setMessage('');
      setPendingImage(null);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Erreur envoi');
    } finally {
      setSending(false);
    }
  };

  const getImageFullUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    const base = (driverApi as any).baseUrl as string;
    const host = base.replace(/\/api$/, '');
    // Legacy URLs: /api/uploads/ticket-xxx → rewrite to public endpoint
    const normalized = url.replace('/api/uploads/ticket-', '/api/ticket-images/ticket-')
                         .replace('/api/uploads/public/ticket-', '/api/ticket-images/ticket-');
    return `${host}${normalized}`;
  };

  const isOpen = report && (report.status === 'open' || report.status === 'investigating');
  const cfg = report ? (STATUS_CONFIG[report.status] ?? STATUS_CONFIG.open) : null;

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.black} />
        </Pressable>
        <Text style={styles.headerTitle}>Ticket de signalement</Text>
        {cfg && (
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : report ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {/* Initial report bubble */}
            <View style={styles.dateSep}>
              <Text style={styles.dateSepText}>{formatTime(report.createdAt)}</Text>
            </View>
            <View style={styles.bubbleRow}>
              <View style={[styles.bubble, styles.bubbleUser]}>
                <Text style={styles.bubbleSender}>Votre signalement initial</Text>
                <Text style={styles.bubbleText}>{report.reason}</Text>
              </View>
            </View>

            {/* Messages */}
            {report.messages.map(msg => {
              if (msg.senderRole === 'system') {
                return (
                  <View key={msg.id} style={styles.systemMsgRow}>
                    <Text style={styles.systemMsgText}>{msg.message}</Text>
                  </View>
                );
              }
              const isAdmin = msg.senderRole === 'admin';
              return (
                <View key={msg.id} style={[styles.bubbleRow, isAdmin ? styles.rowAdmin : styles.rowUser]}>
                  <View style={[styles.bubble, isAdmin ? styles.bubbleAdmin : styles.bubbleUser]}>
                    <Text style={[styles.bubbleSender, isAdmin && { color: '#fff9' }]}>
                      {isAdmin ? 'Équipe support' : 'Vous'}
                    </Text>
                    {msg.message.trim() ? (
                      <Text style={[styles.bubbleText, isAdmin && { color: '#fff' }]}>{msg.message}</Text>
                    ) : null}
                    {msg.imageUrl ? (
                      <Image
                        source={{
                          uri: getImageFullUrl(msg.imageUrl),
                          headers: { Authorization: `Bearer ${token}` },
                        }}
                        style={styles.bubbleImage}
                        resizeMode="cover"
                      />
                    ) : null}
                    <Text style={[styles.bubbleTime, isAdmin && { color: '#ffffff88' }]}>
                      {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Resolution */}
            {report.resolution && !isOpen && (
              <View style={[styles.resolutionBox, { borderLeftColor: report.status === 'resolved' ? '#2E7D32' : '#C62828', backgroundColor: report.status === 'resolved' ? '#E8F5E9' : '#FDECEA' }]}>
                <Text style={[styles.resolutionLabel, { color: report.status === 'resolved' ? '#2E7D32' : '#C62828' }]}>
                  {report.status === 'resolved' ? 'Résolution' : 'Motif de rejet'}
                </Text>
                <Text style={styles.resolutionText}>{report.resolution}</Text>
              </View>
            )}

            {!isOpen && (
              <View style={styles.closedBanner}>
                {report.status === 'resolved'
                  ? <CheckCircle size={16} color="#2E7D32" />
                  : <XCircle size={16} color="#C62828" />}
                <Text style={[styles.closedText, { color: report.status === 'resolved' ? '#2E7D32' : '#C62828' }]}>
                  Ce ticket est {report.status === 'resolved' ? 'résolu' : 'rejeté'}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          {isOpen && (
            <View style={styles.inputArea}>
              {pendingImage && (
                <View style={styles.pendingImageRow}>
                  <Image source={{ uri: pendingImage }} style={styles.pendingThumb} />
                  <Pressable onPress={() => setPendingImage(null)} style={styles.removeImg}>
                    <XCircle size={16} color="#C62828" />
                  </Pressable>
                </View>
              )}
              <View style={styles.inputRow}>
                <Pressable onPress={pickImage} style={styles.imageBtn}>
                  <ImageIcon size={20} color={COLORS.primary} />
                </Pressable>
                <TextInput
                  style={styles.input}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Votre message..."
                  placeholderTextColor={COLORS.grayMedium}
                  multiline
                  maxLength={500}
                />
                <Pressable
                  onPress={sendMessage}
                  disabled={(!message.trim() && !pendingImage) || sending}
                  style={[styles.sendBtn, ((!message.trim() && !pendingImage) || sending) && { opacity: 0.4 }]}
                >
                  {sending
                    ? <ActivityIndicator size={18} color="#fff" />
                    : <Send size={18} color="#fff" />}
                </Pressable>
              </View>
            </View>
          )}
          {!isOpen && (
            <View style={styles.closedInput}>
              <Clock size={14} color={COLORS.grayMedium} />
              <Text style={styles.closedInputText}>Ce ticket est fermé — impossible d'ajouter des messages</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.grayLight,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black, flex: 1, marginLeft: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: COLORS.grayMedium, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 12 },
  retryText: { color: COLORS.white, fontWeight: '700' },
  messageList: { padding: SPACING.md, gap: 8, paddingBottom: 16 },
  dateSep: { alignItems: 'center', marginVertical: 8 },
  dateSepText: { fontSize: 11, color: COLORS.grayMedium, backgroundColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  bubbleRow: { flexDirection: 'row', marginBottom: 4 },
  rowUser: { justifyContent: 'flex-start' },
  rowAdmin: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: 18, padding: 12, gap: 4 },
  bubbleUser: { backgroundColor: COLORS.white, borderTopLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  bubbleAdmin: { backgroundColor: COLORS.primary, borderTopRightRadius: 4 },
  bubbleSender: { fontSize: 11, fontWeight: '700', color: COLORS.grayMedium },
  bubbleText: { fontSize: 14, color: COLORS.grayDark, lineHeight: 20 },
  bubbleTime: { fontSize: 10, color: COLORS.grayMedium, alignSelf: 'flex-end' },
  bubbleImage: { width: 200, height: 150, borderRadius: 10, marginTop: 4 },
  resolutionBox: { borderRadius: 12, padding: 14, borderLeftWidth: 3, marginTop: 8, gap: 4 },
  resolutionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  resolutionText: { fontSize: 13, color: COLORS.grayDark, lineHeight: 18 },
  closedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 12, padding: 10 },
  closedText: { fontSize: 13, fontWeight: '600' },
  inputArea: {
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.grayLight,
  },
  pendingImageRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, gap: 8 },
  pendingThumb: { width: 60, height: 60, borderRadius: 8 },
  removeImg: { padding: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: SPACING.md, paddingTop: 8,
  },
  imageBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, backgroundColor: '#F5F7FA', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
    color: COLORS.black, maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  closedInput: {
    flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center',
    padding: 14, backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.grayLight,
  },
  closedInputText: { fontSize: 12, color: COLORS.grayMedium },
  systemMsgRow: { alignItems: 'center', marginVertical: 8 },
  systemMsgText: {
    fontSize: 11, color: '#6B7280', fontStyle: 'italic',
    backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, textAlign: 'center',
  },
});
