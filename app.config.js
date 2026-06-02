// app.config.js — remplace app.json pour permettre les variables d'environnement.
// Clé Google Maps : définir GOOGLE_MAPS_API_KEY dans EAS Secrets (prod) ou .env local (dev).
// Ne jamais commiter la clé en clair dans ce fichier.

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

if (!googleMapsApiKey) {
  console.warn(
    '[app.config] GOOGLE_MAPS_API_KEY non définie — la carte native ne fonctionnera pas. ' +
    'Définir via EAS Secret (prod) ou .env local (dev).',
  );
}

export default {
  expo: {
    name: 'AeroGo 24 Chauffeur',
    slug: 'aerogo24-driver',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'aerogo24-driver',
    userInterfaceStyle: 'light',
    icon: './assets/images/logo.png',
    splash: {
      image: './assets/images/logo.png',
      resizeMode: 'contain',
      backgroundColor: '#FFFFFF',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.aerogo24.driver',
      config: {
        googleMapsApiKey,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/logo.png',
        backgroundColor: '#FFFFFF',
      },
      package: 'com.aerogo24.driver',
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'REQUEST_INSTALL_PACKAGES',
      ],
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    plugins: [
      'expo-router',
      [
        'react-native-maps',
        {
          googleMapsApiKey,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/logo.png',
          color: '#1D2C4D',
          sounds: [],
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'AeroGo 24 Pro a besoin de votre position pour signaler votre disponibilité aux passagers.',
          locationWhenInUsePermission:
            'AeroGo 24 Pro a besoin de votre position pour montrer votre disponibilité.',
          isIosBackgroundLocationEnabled: true,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            "AeroGo 24 Pro a besoin d'accéder à vos photos pour uploader vos documents.",
        },
      ],
      'expo-web-browser',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: '71d85950-e5fb-43f0-9ba8-03665a120d76',
      },
    },
  },
};
