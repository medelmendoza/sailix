import * as SecureStore from 'expo-secure-store';
import { queryClient } from '@/services/queryClient';
import { useSessionStore } from '@/store/sessionStore';
import { resetUnhandled, strictAdapterWithoutMock } from './mockApi';

/** Back to a clean slate: signed out, empty cache and storage, and an API that fails unless mocked. */
export async function resetTestEnvironment(): Promise<void> {
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  queryClient.clear();
  useSessionStore.setState({ status: 'bootstrapping', credential: null, me: null, notice: null });
  resetUnhandled();
  strictAdapterWithoutMock();
}
