import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The standalone Tala app. Build settings come from the EAS profile / local shell; nothing secret belongs here.
 * The icon is the Lodestar logo (from Sailix's brand assets, upscaled from 256px: replace assets/icon.png with a 1024px
 * original when there is one).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Lodestar',
  slug: 'lodestar',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  scheme: 'lodestar',
  ios: { supportsTablet: true, bundleIdentifier: 'com.btsolve.lodestar', infoPlist: { ITSAppUsesNonExemptEncryption: false } },
  android: {
    package: 'com.btsolve.lodestar',
    allowBackup: false,
    predictiveBackGestureEnabled: false,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon-foreground.png', backgroundColor: '#001435' },
  },
  plugins: [
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-font',
    'expo-video',
    ['expo-splash-screen', { backgroundColor: '#F4F8FC', image: './assets/splash-icon.png', imageWidth: 140 }],
  ],
  extra: {
    appEnv: process.env.APP_ENV ?? 'development',
    // the Tala server; HTTPS only (the app refuses anything else)
    talaBaseUrl: process.env.TALA_API_BASE_URL ?? '',
    talaProgressWrites: process.env.TALA_PROGRESS_WRITES === '1',
  },
});
