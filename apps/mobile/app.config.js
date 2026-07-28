const RAILWAY_API = 'https://api-production-2057.up.railway.app';

/**
 * Expo app config. Production builds default to the live Railway API.
 * Override with EXPO_PUBLIC_API_URL for local/device testing.
 */
export default ({ config }) => {
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || RAILWAY_API).replace(/\/$/, '');

  return {
    ...config,
    name: 'PlayPK',
    slug: 'playpk-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'playpk',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0B1F3A',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'pk.play.app',
      buildNumber: '1',
      infoPlist: {
        NSCameraUsageDescription:
          'PlayPK may use the camera to scan venue QR codes or upload payment screenshots.',
        NSPhotoLibraryUsageDescription:
          'PlayPK may access photos so you can upload payment proof for bookings.',
      },
    },
    android: {
      package: 'pk.play.app',
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: '#0B1F3A',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: ['CAMERA', 'READ_MEDIA_IMAGES'],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: ['expo-router', 'expo-status-bar'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      apiUrl,
      eas: {
        projectId: process.env.EAS_PROJECT_ID || undefined,
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
  };
};
