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
  default: { fetch: jest.fn(async () => ({ isConnected: true })) },
  useNetInfo: jest.fn(() => ({ isConnected: true })),
}));

// Every test starts signed out with a strict API: a call nobody mocked fails the test loudly.
beforeEach(async () => {
  await resetTestEnvironment();
});

afterEach(() => {
  assertNoUnhandledApiCalls();
});
