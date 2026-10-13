import { create } from 'zustand';
import type { Session } from '@/models/user';
import { configureApi } from '@/services/api/client';
import { queryClient } from '@/services/queryClient';
import { clearSession, loadSession, saveSession } from '@/services/storage/secureStore';

export type SessionStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';

type SessionState = {
  status: SessionStatus;
  session: Session | null;
  bootstrap: () => Promise<void>;
  signIn: (session: Session) => Promise<void>;
  /** Single logout path: storage, query cache and in-memory state (BR-06, SR-06). */
  signOut: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set) => ({
  status: 'bootstrapping',
  session: null,

  async bootstrap() {
    const session = await loadSession();
    set(
      session ? { status: 'authenticated', session } : { status: 'unauthenticated', session: null },
    );
  },

  async signIn(session) {
    await saveSession(session);
    set({ status: 'authenticated', session });
  },

  async signOut() {
    set({ status: 'unauthenticated', session: null });
    queryClient.clear();
    await clearSession();
  },
}));

configureApi({
  getToken: () => useSessionStore.getState().session?.token ?? null,
  onUnauthorized: () => {
    if (useSessionStore.getState().status === 'authenticated') {
      void useSessionStore.getState().signOut();
    }
  },
});
