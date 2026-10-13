import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { queryClient } from '@/services/queryClient';
import { useSessionStore } from '@/store/sessionStore';
import { resetUnhandled, strictAdapterWithoutMock } from './mockApi';

/** Back to a clean slate: signed out, empty cache and storage, and an API that fails unless mocked. */
export async function resetTestEnvironment(): Promise<void> {
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  queryClient.clear();
  await AsyncStorage.clear();
  const fs = (
    FileSystem as unknown as {
      __fs: {
        files: Map<string, unknown>;
        dirs: Set<string>;
        state: { failNextDownload: boolean };
      };
    }
  ).__fs;
  fs.files.clear();
  fs.dirs.clear();
  fs.state.failNextDownload = false;
  useSessionStore.setState({ status: 'bootstrapping', credential: null, me: null, notice: null });
  resetUnhandled();
  strictAdapterWithoutMock();
}
