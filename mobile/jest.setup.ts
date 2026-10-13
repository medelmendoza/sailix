/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must load modules lazily */
import { resetTestEnvironment } from './src/test-utils/environment';
import { assertNoUnhandledApiCalls } from './src/test-utils/mockApi';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
    __store: store,
  };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.31',
      extra: {
        appEnv: 'development',
        apiBaseUrl: 'https://api.example.test',
        apiPrefix: '/api/v1',
        privacyUrl: 'https://example.test/privacy',
      },
    },
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({ isConnected: true })),
    addEventListener: jest.fn(() => () => undefined),
  },
  useNetInfo: jest.fn(() => ({ isConnected: true })),
  addEventListener: jest.fn(() => () => undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Native viewers are not run in unit tests; the screens only need these to exist.
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { __esModule: true, WebView: View, default: View };
});
jest.mock('expo-video', () => {
  const { View } = require('react-native');
  const listeners: Record<string, () => void> = {};
  return {
    __esModule: true,
    useVideoPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), __listeners: listeners })),
    VideoView: View,
  };
});
jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  useEventListener: jest.fn(),
}));

// In-memory stand-in for the app's file storage (expo-file-system, SDK 57 object API).
jest.mock('expo-file-system', () => {
  const files = new Map<string, { size: number }>(); // uri -> file
  const dirs = new Set<string>();
  const join = (parts: unknown[]) => {
    const joined = parts
      .map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri))
      .join('/');
    const m = /^(file:\/\/\/)(.*)$/.exec(joined);
    return m ? m[1] + m[2]!.replace(/\/+/g, '/') : joined.replace(/\/+/g, '/');
  };
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return dirs.has(this.uri);
    }
    create() {
      dirs.add(this.uri);
    }
    delete() {
      dirs.delete(this.uri);
      for (const u of [...files.keys()]) if (u.startsWith(this.uri + '/')) files.delete(u);
      for (const d of [...dirs]) if (d.startsWith(this.uri + '/')) dirs.delete(d);
    }
  }
  const state = { failNextDownload: false };
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    get size() {
      return files.get(this.uri)?.size ?? 0;
    }
    delete() {
      files.delete(this.uri);
    }
    static async downloadFileAsync(url: string, dest: Directory) {
      if (state.failNextDownload) {
        state.failNextDownload = false;
        throw new Error('network down');
      }
      const name = url.split('/').pop() || 'file';
      const f = new File(dest, name);
      files.set(f.uri, { size: 1234 });
      return f;
    }
  }
  return {
    File,
    Directory,
    Paths: { document: new Directory('file:///documents') },
    __fs: { files, dirs, state },
  };
});

// Every test starts signed out with a strict API: a call nobody mocked fails the test loudly.
beforeEach(async () => {
  await resetTestEnvironment();
});

afterEach(() => {
  assertNoUnhandledApiCalls();
});
