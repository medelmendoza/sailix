import * as SecureStore from 'expo-secure-store';
import type { Credential } from '@/models/session';
import { credentialSchema } from '@/schemas/session';

const TOKEN_KEY = 'sailix.token';
const META_KEY = 'sailix.credential';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Only the token and the membership it is bound to are stored: no profile, no personal data.
 * Both are written together; a partial credential is treated as no credential.
 */
export async function saveCredential(credential: Credential): Promise<void> {
  const { token, ...meta } = credential;
  await SecureStore.setItemAsync(TOKEN_KEY, token, OPTIONS);
  await SecureStore.setItemAsync(META_KEY, JSON.stringify(meta), OPTIONS);
}

export async function loadCredential(): Promise<Credential | null> {
  try {
    const [token, meta] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY, OPTIONS),
      SecureStore.getItemAsync(META_KEY, OPTIONS),
    ]);
    if (!token || !meta) return null;
    const parsed = credentialSchema.safeParse({ token, ...JSON.parse(meta) });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearCredential(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY, OPTIONS),
    SecureStore.deleteItemAsync(META_KEY, OPTIONS),
  ]);
}
