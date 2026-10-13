import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Environment-specific values come from the EAS build profile / local shell
 * (see .env.example). Nothing secret belongs here: everything in the app
 * bundle is public.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Sailix',
  slug: 'sailix',
  version: '1.0.31',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'sailix',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.btsolve.sailix2',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Plain HTTP to a local backend is allowed ONLY in development builds.
      ...(process.env.APP_ENV && process.env.APP_ENV !== 'development'
        ? {}
        : { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } }),
    },
  },
  android: {
    package: 'com.btsolve.sailix2',
    allowBackup: false,
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-font',
    'expo-video',
    [
      'expo-splash-screen',
      { backgroundColor: '#F4F1EA', image: './assets/splash-icon.png', imageWidth: 120 },
    ],
  ],
  extra: {
    appEnv: process.env.APP_ENV ?? 'development',
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:8000',
    apiPrefix: process.env.API_PREFIX ?? '/api/v1',
    demo: process.env.DEMO_MODE === '1',
    privacyUrl:
      process.env.PRIVACY_URL ?? 'https://www.btsolve.com/privacy/data-privacy-sailix.html',
  },
});
