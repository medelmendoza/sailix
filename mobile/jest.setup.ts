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
  const state: { failNextDownload: boolean; hold: Promise<void> | null } = {
    failNextDownload: false,
    hold: null,
  };
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
    static createDownloadTask(
      url: string,
      dest: Directory,
      options: {
        onProgress?: (p: { bytesWritten: number; totalBytes: number }) => void;
        signal?: AbortSignal;
      } = {},
    ) {
      return {
        downloadAsync: async () => {
          if (state.failNextDownload) {
            state.failNextDownload = false;
            throw new Error('network down');
          }
          options.onProgress?.({ bytesWritten: 617, totalBytes: 1234 });
          if (state.hold) {
            await Promise.race([
              state.hold,
              new Promise((_, reject) =>
                options.signal?.addEventListener('abort', () =>
                  reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
                ),
              ),
            ]);
          }
          const name = url.split('/').pop() || 'file';
          const f = new File(dest, name);
          files.set(f.uri, { size: 1234 });
          return f;
        },
      };
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

// Astra's native modules: no real audio, wake lock or asset resolution in tests
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: jest.fn(),
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-audio', () => {
  const player = {
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    loop: false,
    playing: false,
  };
  return {
    useAudioPlayer: jest.fn(() => player),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    __player: player,
  };
});
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      downloadAsync: () =>
        Promise.resolve({ localUri: 'file:///tmp/guide.pdf', uri: 'file:///tmp/guide.pdf' }),
    })),
  },
}));

// The document scanner's native modules
jest.mock('expo-camera', () => {
  const React = require('react');
  const state = { grantOnRequest: true, canAskAgain: true, initialGranted: true, shots: 0 };
  const CameraView = React.forwardRef(function CameraViewMock(
    { onCameraReady }: { onCameraReady?: () => void },
    ref: unknown,
  ) {
    React.useImperativeHandle(ref, () => ({
      takePictureAsync: jest.fn(async () => ({
        uri: `file:///cache/camera-${++state.shots}.jpg`,
        width: 100,
        height: 100,
      })),
    }));
    React.useEffect(() => onCameraReady?.(), [onCameraReady]);
    return null;
  });
  const useCameraPermissions = () => {
    const [p, setP] = React.useState({
      granted: state.initialGranted,
      canAskAgain: state.canAskAgain,
      status: state.initialGranted ? 'granted' : 'undetermined',
    });
    const request = async () => {
      const next = {
        granted: state.grantOnRequest,
        canAskAgain: state.canAskAgain,
        status: state.grantOnRequest ? 'granted' : 'denied',
      };
      setP(next);
      return next;
    };
    return [p, request];
  };
  return { CameraView, useCameraPermissions, __state: state };
});
jest.mock('expo-image-picker', () => {
  const state: { next: { uri: string }[] | null; calls: unknown[] } = {
    next: [{ uri: 'file:///library/1.jpg' }],
    calls: [],
  };
  return {
    launchImageLibraryAsync: jest.fn(async (options: unknown) => {
      state.calls.push(options);
      return state.next
        ? { canceled: false, assets: state.next }
        : { canceled: true, assets: null };
    }),
    __state: state,
  };
});
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn(() => {
      const chain: { resize: jest.Mock; renderAsync: jest.Mock } = {
        resize: jest.fn(() => chain),
        renderAsync: jest.fn(async () => ({
          saveAsync: jest.fn(async () => ({ uri: 'file:///cache/page.jpg', base64: 'QUJD' })),
        })),
      };
      return chain;
    }),
  },
}));
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({
    uri: 'file:///cache/Print/scan.pdf',
    numberOfPages: 1,
  })),
}));
