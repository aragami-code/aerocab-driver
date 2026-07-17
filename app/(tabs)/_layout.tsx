import { useEffect, useRef } from 'react';
import { Tabs, router } from 'expo-router';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Home, Car, CreditCard, Zap, User } from 'lucide-react-native';
import { COLORS } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { driverApi } from '../../services/api';

export default function TabsLayout() {
  const token = useAuthStore((s) => s.token);
  const notifListener = useRef<Notifications.EventSubscription | null>(null);

  // Guard : vérifie à chaque montage que le driver est bien approuvé
  useEffect(() => {
    if (!token) { router.replace('/(auth)/login'); return; }
    driverApi.getMyProfile(token)
      .then((profile) => {
        if (profile.status !== 'approved') {
          router.replace('/pending-review' as never);
        }
      })
      .catch(() => router.replace('/pending-review' as never));
  }, [token]);

  // Listener : tap sur notification → pending-review si document rejeté / approuvé
  useEffect(() => {
    notifListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.type === 'document_rejected' || data?.type === 'document_approved') {
        router.push('/pending-review' as never);
      }
    });
    return () => { notifListener.current?.remove(); };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.grayMedium,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.grayLight,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
      screenListeners={{
        tabPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trajets',
          tabBarIcon: ({ color, size }) => <Car size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="payment"
        options={{
          title: 'Paiement',
          tabBarIcon: ({ color, size }) => <CreditCard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="points"
        options={{
          title: 'Points',
          tabBarIcon: ({ color, size }) => <Zap size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />

      {/* Écrans cachés */}
      <Tabs.Screen name="ride-request"  options={{ href: null }} />
      <Tabs.Screen name="rate-passenger" options={{ href: null }} />
      <Tabs.Screen name="trip-detail"   options={{ href: null }} />
      <Tabs.Screen name="trip-receipt"  options={{ href: null }} />
      <Tabs.Screen name="chat"          options={{ href: null }} />
      <Tabs.Screen name="flight-details" options={{ href: null }} />
      <Tabs.Screen name="flight-map"    options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="trip-map"      options={{ href: null }} />
      <Tabs.Screen name="withdraw"      options={{ href: null }} />
      <Tabs.Screen name="conversations" options={{ href: null }} />
      <Tabs.Screen name="status"        options={{ href: null }} />
      <Tabs.Screen name="my-tickets"    options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="ticket-detail" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="heatmap"      options={{ href: null }} />
    </Tabs>
  );
}
