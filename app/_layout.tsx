import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SplashScreen, toastConfig, ErrorBoundary, OfflineBanner } from '@aerocab/mobile-ui';
import Toast from 'react-native-toast-message';

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return (
      <>
        <StatusBar style="light" backgroundColor="#1D2C4D" />
        <SplashScreen
          appName="AeroCab Pro"
          tagline="Espace chauffeur professionnel"
          onFinish={() => setShowSplash(false)}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" backgroundColor="#1D2C4D" />
      <ErrorBoundary>
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ErrorBoundary>
      <Toast config={toastConfig} />
    </>
  );
}
