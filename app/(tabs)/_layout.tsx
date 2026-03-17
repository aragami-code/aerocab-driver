import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { LayoutDashboard, MessageCircle, ClipboardList, User } from 'lucide-react-native';
import { TabIcon, useHaptic } from '@aerocab/mobile-ui';
import { COLORS } from '@aerocab/shared';

export default function TabsLayout() {
  const { selection } = useHaptic();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
      screenListeners={{
        tabPress: () => selection(),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={LayoutDashboard} label="Accueil" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={MessageCircle} label="Messages" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="rate-passenger"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ClipboardList} label="Statut" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={User} label="Profil" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 80,
    backgroundColor: COLORS.white,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
    paddingBottom: 8,
    paddingTop: 8,
  },
});