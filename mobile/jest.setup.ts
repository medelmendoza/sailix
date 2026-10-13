jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        appEnv: 'development',
        apiBaseUrl: 'https://api.example.test',
        apiPrefix: '/api',
        uploadPrefix: '/upload-api',
        privacyUrl: 'https://example.test/privacy',
        servicesEnabled: false,
      },
    },
  },
}));
