import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LayoutDashboard, MessageCircle, ShieldCheck, Settings } from 'lucide-react-native';
import { COLORS } from '../../lib/shared';

export default function TabsLayout() {
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
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Statut',
          tabBarIcon: ({ color, size }) => <ShieldCheck size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />

      {/* Écrans cachés */}
      <Tabs.Screen name="ride-request" options={{ href: null }} />
      <Tabs.Screen name="rate-passenger" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
    </Tabs>
  );
}
