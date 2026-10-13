import * as SecureStore from 'expo-secure-store';
import type { Session } from '@/models/user';
import { sessionSchema } from '@/schemas/user';

const TOKEN_KEY = 'sailix.token';
const PROFILE_KEY = 'sailix.profile';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Token and profile are written together; a partial session is treated as no session. */
export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, session.token, OPTIONS);
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(session.user), OPTIONS);
}

export async function loadSession(): Promise<Session | null> {
  try {
    const [token, profile] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY, OPTIONS),
      SecureStore.getItemAsync(PROFILE_KEY, OPTIONS),
    ]);
    if (!token || !profile) return null;
    const parsed = sessionSchema.safeParse({ token, user: JSON.parse(profile) });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY, OPTIONS),
    SecureStore.deleteItemAsync(PROFILE_KEY, OPTIONS),
  ]);
}
