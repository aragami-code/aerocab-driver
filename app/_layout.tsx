import '../tasks/locationTask'; // register background task at startup
import { useEffect, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter, useNavigation } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../stores/authStore';
import { useDriverConfigStore } from '../stores/configStore';
import { driverApi } from '../services/api';
import { OfflineBanner } from '../components/OfflineBanner';
import { useAnnouncementsStore } from '../stores/announcementsStore';
import { AnnouncementModal } from '../components/AnnouncementModal';
import { UpdateGate } from '../components/UpdateGate';
import { registerUnauthorizedHandler, registerTokenRefreshHandlers } from '../lib/api-base';
import { socketService } from '../services/socket';

// Afficher les notifications même quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
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
    // Canal principal (correspond au channelId envoyé par le backend)
    await Notifications.setNotificationChannelAsync('aerogo24_default', {
      name: 'AeroGo 24 Pro',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
    });
    // Canal dédié courses (haute priorité)
    await Notifications.setNotificationChannelAsync('rides', {
      name: 'Demandes de course',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
    });
  }

  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const authToken = useAuthStore.getState().token;
    if (authToken && tokenData.data) {
      await driverApi.savePushToken(authToken, tokenData.data as string);
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
  const logout = useAuthStore((s) => s.logout);
  const setTokens = useAuthStore((s) => s.setTokens);
  const loadConfig = useDriverConfigStore((s) => s.loadConfig);
  const router = useRouter();
  const navigation = useNavigation();
  const prevToken = useRef<string | null | undefined>(undefined);

  // Logout → reset complet du stack vers login (empêche le retour arrière vers les tabs)
  useEffect(() => {
    if (prevToken.current !== undefined && prevToken.current !== null && !token) {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: '(auth)' }] })
      );
    }
    prevToken.current = token;
  }, [token, navigation]);

  // S352 — JWT expiré → auto-refresh, puis logout si refresh échoue
  useEffect(() => {
    registerTokenRefreshHandlers(
      () => useAuthStore.getState().refreshToken,
      (accessToken, refreshToken) => setTokens(accessToken, refreshToken),
    );
    registerUnauthorizedHandler(() => {
      logout();
      router.replace('/(auth)/login' as never);
    });
    socketService.setTokenGetter(() => useAuthStore.getState().token);
  }, [logout, setTokens, router]);

  useEffect(() => {
    setHasHydrated(true);
    loadConfig();
    const timer = setInterval(loadConfig, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Enregistrer les push notifications dès que l'utilisateur est authentifié
  useEffect(() => {
    if (token) {
      registerPushNotifications();
    }
  }, [token]);

  // Annonces — fetch du feed au lancement et à chaque retour au premier plan
  useEffect(() => {
    const fetchAnnouncements = () => {
      const authToken = useAuthStore.getState().token;
      if (authToken) {
        useAnnouncementsStore.getState().fetchFeed(authToken);
        useDriverConfigStore.getState().fetchCountryBundle(authToken);
      }
    };
    fetchAnnouncements();
    let prevState: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if ((prevState === 'background' || prevState === 'inactive') && nextState === 'active') {
        fetchAnnouncements();
      }
      prevState = nextState;
    });
    return () => sub.remove();
  }, []);

  // Deep link : tap sur notification → naviguer vers le bon écran
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;
      const { type, bookingId } = data;
      if (type === 'new_booking' || type === 'wake_up') {
        // Naviguer vers l'onglet home avec flag pour afficher la course / inciter à aller online
        router.push({
          pathname: '/(tabs)/',
          params: { wakeUp: 'true', bookingId: bookingId ?? '' },
        } as never);
      }
    });

    // Notification initiale (app lancée depuis une notif quand elle était fermée)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;
      const { type, bookingId } = data;
      if (type === 'new_booking' || type === 'wake_up') {
        setTimeout(() => {
          router.push({
            pathname: '/(tabs)/',
            params: { wakeUp: 'true', bookingId: bookingId ?? '' },
          } as never);
        }, 500);
      }
    });

    return () => sub.remove();
  }, [router]);

  if (!hasHydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <OfflineBanner />
        <UpdateGate>
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="pending-review" />
            <Stack.Screen name="biometric-lock" options={{ animation: 'fade', gestureEnabled: false }} />
          </Stack>
        </UpdateGate>
        <AnnouncementModal />
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
