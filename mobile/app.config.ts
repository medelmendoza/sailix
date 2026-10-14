import { withAndroidManifest } from 'expo/config-plugins';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const isDevelopmentBuild = !process.env.APP_ENV || process.env.APP_ENV === 'development';

/** Plain HTTP to a local backend (the emulator's 10.0.2.2) is allowed ONLY in development builds, as on iOS. */
const allowLocalHttp = (config: ExpoConfig): ExpoConfig =>
  withAndroidManifest(config, (m) => {
    const app = m.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'true';
    return m;
  });

/**
 * Environment-specific values come from the EAS build profile / local shell
 * (see .env.example). Nothing secret belongs here: everything in the app
 * bundle is public.
 */
const build = ({ config }: ConfigContext): ExpoConfig => ({
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
    // The document scanner: the camera (no microphone, no barcode reading) and the photo library picker
    [
      'expo-camera',
      {
        cameraPermission: 'Sailix uses the camera to scan your documents.',
        microphonePermission: false,
        recordAudioAndroid: false,
        barcodeScannerEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Sailix lets you choose photos of your documents from your library.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    // Astra's background sounds play only while its screen is open, so no background audio and no microphone are declared
    ['expo-audio', { microphonePermission: false, enableBackgroundPlayback: false }],
    [
      'expo-splash-screen',
      { backgroundColor: '#F4F7FB', image: './assets/splash-icon.png', imageWidth: 120 },
    ],
  ],
  extra: {
    appEnv: process.env.APP_ENV ?? 'development',
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:8000',
    apiPrefix: process.env.API_PREFIX ?? '/api/v1',
    demo: process.env.DEMO_MODE === '1',
    demoTour: process.env.DEMO_TOUR === '1', // with DEMO_MODE=1: the screens open one after another by themselves
    privacyUrl:
      process.env.PRIVACY_URL ?? 'https://www.btsolve.com/privacy/data-privacy-sailix.html',
  },
});

export default (context: ConfigContext): ExpoConfig => {
  const config = build(context);
  return isDevelopmentBuild ? allowLocalHttp(config) : config;
};
