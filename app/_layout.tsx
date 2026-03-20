import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../stores/authStore';
import { driverApi } from '../services/api';
import { OfflineBanner } from '../components/OfflineBanner';

// Afficher les notifications même quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerPushNotifications() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  // Canal Android pour les demandes de course (priorité MAX avec vibration)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('rides', {
      name: 'Demandes de course',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const authToken = useAuthStore.getState().token;
    if (authToken && tokenData.data) {
      await driverApi.savePushToken(authToken, tokenData.data);
    }
  } catch (e) {
    // Non critique (échoue hors Expo Go ou sans projectId configuré)
    console.log('[Push] Enregistrement token échoué:', e);
  }
}

export default function RootLayout() {
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Enregistrer les push notifications dès que l'utilisateur est authentifié
  useEffect(() => {
    if (token) {
      registerPushNotifications();
    }
  }, [token]);

  if (!hasHydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
