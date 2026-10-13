import { create } from 'zustand';
import type { Credential } from '@/models/session';
import { configureApi, api } from '@/services/api/client';
import { describeError, toApiError } from '@/services/api/errors';
import type { Envelope, Me, TokenGrant } from '@/services/api/types';
import { queryClient } from '@/services/queryClient';
import { clearCredential, loadCredential, saveCredential } from '@/services/storage/secureStore';

/**
 * - bootstrapping: reading the stored credential / verifying it with the server
 * - authenticated: a verified credential and the caller's `me`
 * - unauthenticated: show sign-in (optionally with a notice explaining why)
 * - unreachable: a stored credential exists but the server could not be reached; NOT signed out
 */
export type SessionStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated' | 'unreachable';

type SessionState = {
  status: SessionStatus;
  credential: Credential | null;
  me: Me | null;
  /** Why the user was sent back to sign-in (expired, organization suspended...). */
  notice: string | null;
  bootstrap: () => Promise<void>;
  completeSignIn: (grant: TokenGrant) => Promise<void>;
  refreshMe: () => Promise<void>;
  refreshTokenIfNeeded: () => Promise<void>;
  /** Single logout path: memory, query cache, secure storage and (best effort) the server-side token. */
  signOut: (options?: { notice?: string; revoke?: boolean }) => Promise<void>;
  clearNotice: () => void;
  setNotice: (message: string) => void;
};

const REFRESH_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_ENDED = 'Your session expired. Please sign in again.';
/** 403 codes meaning "this credential is valid but may not be used": sign out and explain. */
const BLOCKING_CODES = [
  'tenant_suspended',
  'membership_suspended',
  'account_suspended',
  'tenant_mismatch',
];

async function fetchMe(): Promise<Me> {
  return (await api.get<Envelope<Me>>('/me')).data.data;
}

let refreshing: Promise<void> | null = null;

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'bootstrapping',
  credential: null,
  me: null,
  notice: null,

  async bootstrap() {
    const stored = await loadCredential();
    if (!stored) {
      set({ status: 'unauthenticated', credential: null, me: null });
      return;
    }
    set({ status: 'bootstrapping', credential: stored });
    try {
      const me = await fetchMe();
      if (get().credential?.token !== stored.token) return; // signed out while we waited
      set({ status: 'authenticated', me });
      void get().refreshTokenIfNeeded();
    } catch (error) {
      const e = toApiError(error);
      if (e.kind === 'unauthorized') {
        await get().signOut({ notice: SESSION_ENDED, revoke: false });
      } else if (e.status === 403 && e.code && BLOCKING_CODES.includes(e.code)) {
        await get().signOut({ notice: describeError(e), revoke: false });
      } else {
        set({ status: 'unreachable' }); // keep the credential: being offline is not being signed out
      }
    }
  },

  async completeSignIn(grant) {
    const token = grant.token;
    // The token must be usable for the /me call below; nothing is persisted until /me succeeds.
    set({
      credential: {
        token,
        expiresAt: grant.expires_at,
        membershipId: grant.membership.id,
        tenantId: grant.membership.tenant.id ?? '',
        tenantCode: grant.membership.tenant.code,
      },
      notice: null,
    });
    try {
      const me = await fetchMe();
      const credential: Credential = {
        token,
        expiresAt: grant.expires_at,
        membershipId: me.membership.id,
        tenantId: me.tenant.id,
        tenantCode: me.tenant.code,
      };
      await saveCredential(credential);
      set({ status: 'authenticated', credential, me });
    } catch (error) {
      set({ credential: null, me: null, status: 'unauthenticated' });
      throw error;
    }
  },

  async refreshMe() {
    const token = get().credential?.token;
    if (!token) return;
    const me = await fetchMe();
    // A response that arrives after sign-out (or for another credential) must not resurrect state.
    if (get().credential?.token === token) set({ me });
  },

  refreshTokenIfNeeded() {
    const credential = get().credential;
    if (!credential?.expiresAt || refreshing) return refreshing ?? Promise.resolve();
    if (new Date(credential.expiresAt).getTime() - Date.now() > REFRESH_WITHIN_MS) {
      return Promise.resolve();
    }
    refreshing = (async () => {
      try {
        const grant = (await api.post<Envelope<TokenGrant>>('/auth/token/refresh')).data.data;
        if (get().credential?.token !== credential.token) return; // signed out meanwhile
        const next: Credential = { ...credential, token: grant.token, expiresAt: grant.expires_at };
        await saveCredential(next);
        set({ credential: next });
      } catch {
        // 401 is handled by the API client (session ends); anything else retries on the next foreground
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  },

  async signOut(options = {}) {
    const { notice = null, revoke = true } = options;
    const token = get().credential?.token;
    // 1. The UI leaves the authenticated area immediately and nothing from this session can be read again.
    set({ status: 'unauthenticated', credential: null, me: null, notice });
    await queryClient.cancelQueries();
    queryClient.clear();
    await clearCredential();
    // 2. Best effort: ask the server to revoke this device's token (never blocks or fails the sign-out).
    if (revoke && token) {
      try {
        await api.delete('/auth/token', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
          skipUnauthorizedHandler: true,
        });
      } catch {
        // offline or already revoked: the local session is gone either way
      }
    }
  },

  clearNotice() {
    set({ notice: null });
  },

  setNotice(message) {
    set({ notice: message });
  },
}));

configureApi({
  getToken: () => useSessionStore.getState().credential?.token ?? null,
  getTenantHint: () => useSessionStore.getState().credential?.tenantCode ?? null,
  onUnauthorized: () => {
    if (useSessionStore.getState().status === 'authenticated') {
      void useSessionStore.getState().signOut({ notice: SESSION_ENDED, revoke: false });
    }
  },
});
