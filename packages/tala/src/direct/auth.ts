import * as SecureStore from 'expo-secure-store';
import type { TalaClient } from './client';

/** Where the Tala tokens are kept. The app uses the phone's secure storage; tests use a map. */
export interface TalaStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const secureStoreStorage: TalaStorage = {
  get: (k) => SecureStore.getItemAsync(k),
  set: (k, v) => SecureStore.setItemAsync(k, v),
  remove: (k) => SecureStore.deleteItemAsync(k),
};

interface Stored {
  accessToken: string;
  refreshToken: string | null;
  userId: string;
  teamId: string | null;
}

/**
 * The Tala session of one scope (a Sailix member, or the standalone app). Tala has no refresh endpoint, so when it stops
 * accepting the token the only way on is to sign in again: `expire` wipes the tokens and tells the listeners.
 */
export function createTalaSession(storage: TalaStorage, scope: string) {
  // SecureStore keys allow only letters, digits, '.', '-' and '_'
  const key = `tala.${scope.replace(/[^A-Za-z0-9._-]/g, '_')}.session`;
  const listeners = new Set<() => void>();

  async function current(): Promise<Stored | null> {
    const raw = await storage.get(key);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as Stored;
      return typeof s.accessToken === 'string' && typeof s.userId === 'string' ? s : null;
    } catch {
      return null;
    }
  }

  return {
    current,
    token: async () => (await current())?.accessToken ?? null,

    async signIn(client: Pick<TalaClient, 'login' | 'teamIds'>, username: string, password: string) {
      const login = await client.login(username, password);
      await storage.set(key, JSON.stringify({ ...login, teamId: null } satisfies Stored));
      try {
        const teamIds = await client.teamIds(login.userId);
        if (teamIds.length === 1) await storage.set(key, JSON.stringify({ ...login, teamId: teamIds[0] }));
        return { userId: login.userId, teamIds };
      } catch (e) {
        await storage.remove(key);
        throw e;
      }
    },

    async setTeam(teamId: string) {
      const s = await current();
      if (s) await storage.set(key, JSON.stringify({ ...s, teamId }));
    },

    /** Tala no longer accepts the token. */
    async expire() {
      await storage.remove(key);
      listeners.forEach((cb) => cb());
    },

    /** The user chose to sign out. */
    signOut: () => storage.remove(key),

    onSignInAgain(cb: () => void) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
  };
}

export type TalaSession = ReturnType<typeof createTalaSession>;
