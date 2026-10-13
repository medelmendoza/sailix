import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, Paths } from 'expo-file-system';
import { ROOT_DIR_NAME } from './paths';

/** Key prefix of every Tala record kept on the device (cache, download index, outbox). */
export const KEY_PREFIX = 'tala:v1:';

/**
 * Removes Tala data from the device. With a scope, only that organization+membership; without, everything
 * (sign-out). It never depends on the session store so it can run while the session is being torn down.
 */
export async function wipeOfflineData(scope?: string): Promise<void> {
  const prefix = scope ? `${KEY_PREFIX}${scope}:` : KEY_PREFIX;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  } catch {
    // best effort: a storage failure must never block sign-out
  }
  try {
    const dir = scope
      ? new Directory(Paths.document, ROOT_DIR_NAME, scope)
      : new Directory(Paths.document, ROOT_DIR_NAME);
    if (dir.exists) dir.delete();
  } catch {
    // best effort
  }
}
