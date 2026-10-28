import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The standalone Tala app. Build settings come from the EAS profile / local shell; nothing secret belongs here.
 * Icon and splash are design assets still to be supplied (Expo's defaults until then).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tala',
  slug: 'tala',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  scheme: 'tala',
  ios: { supportsTablet: true, bundleIdentifier: 'com.btsolve.tala', infoPlist: { ITSAppUsesNonExemptEncryption: false } },
  android: { package: 'com.btsolve.tala', allowBackup: false, predictiveBackGestureEnabled: false },
  plugins: [['expo-secure-store', { faceIDPermission: false }], 'expo-font', 'expo-video'],
  extra: {
    appEnv: process.env.APP_ENV ?? 'development',
    // the Tala server; HTTPS only (the app refuses anything else)
    talaBaseUrl: process.env.TALA_API_BASE_URL ?? '',
    talaProgressWrites: process.env.TALA_PROGRESS_WRITES === '1',
  },
});
