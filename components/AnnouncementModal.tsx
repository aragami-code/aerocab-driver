import { Modal, View, Text, Image, Pressable, Clipboard } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAnnouncementsStore } from '../stores/announcementsStore';
import { useAuthStore } from '../stores/authStore';
import { resolveMediaUrl } from '../lib/api-base';

export function AnnouncementModal() {
  const token = useAuthStore(s => s.token);
  const announcements = useAnnouncementsStore(s => s.announcements);
  const markSeen = useAnnouncementsStore(s => s.markSeen);
  const current = announcements.find(a => a.priority === 'high' && !a.seen);
  if (!current || !token) return null;

  const onCta = () => {
    if (current.ctaType === 'screen' && current.ctaValue) router.push(current.ctaValue as never);
    else if (current.ctaType === 'promo_code' && current.ctaValue) {
      Clipboard.setString(current.ctaValue);
      Toast.show({ type: 'success', text1: 'Code copié', text2: current.ctaValue });
    }
    markSeen(token, current.id);
  };

  return (
    <Modal transparent animationType="fade" visible>
      <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' }}>
          {resolveMediaUrl(current.imageUrl) ? (
            <Image source={{ uri: resolveMediaUrl(current.imageUrl) }} style={{ width: '100%', height: 160 }} />
          ) : null}
          <View style={{ padding: 20, gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '800' }}>{current.title}</Text>
            <Text style={{ fontSize: 14, color: '#444' }}>{current.body}</Text>
            {current.ctaType !== 'none' && (
              <Pressable onPress={onCta} style={{ backgroundColor: '#1a56db', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{current.ctaLabel ?? 'Voir'}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => markSeen(token, current.id)} style={{ padding: 8, alignItems: 'center' }}>
              <Text style={{ color: '#888' }}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
