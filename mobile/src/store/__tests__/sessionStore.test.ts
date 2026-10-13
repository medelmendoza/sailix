import * as SecureStore from 'expo-secure-store';
import { api as apiClient } from '@/services/api/client';
import { queryClient } from '@/services/queryClient';
import { loadCredential, saveCredential } from '@/services/storage/secureStore';
import { makeGrant, makeMe } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { scopedKey } from '../scopedKey';
import { useSessionStore } from '../sessionStore';

const state = () => useSessionStore.getState();
const storeSize = () => (SecureStore as unknown as { __store: Map<string, string> }).__store.size;

const stored = {
  token: '1|stored-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  membershipId: 'm1',
  tenantId: 't1',
  tenantCode: 'SFAI',
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('bootstrap', () => {
  it('goes to unauthenticated without a stored credential and calls nothing', async () => {
    const api = mockApi({});
    await state().bootstrap();
    expect(state()).toMatchObject({ status: 'unauthenticated', credential: null, me: null });
    expect(api.calls).toHaveLength(0);
  });

  it('verifies a stored credential with /me, sending the token and the organization hint', async () => {
    await saveCredential(stored);
    const api = mockApi({ 'GET /me': { data: { data: makeMe() } } });

    await state().bootstrap();

    expect(state()).toMatchObject({ status: 'authenticated', me: { user: { username: 'maria' } } });
    expect(api.calls[0]?.headers.Authorization).toBe('Bearer 1|stored-token');
    expect(api.calls[0]?.headers['X-Tenant-Hint']).toBe('SFAI');
  });

  it('an expired session ends with a notice, wipes storage and never calls the server to revoke', async () => {
    await saveCredential(stored);
    const api = mockApi({ 'GET /me': problem(401, 'unauthenticated') });

    await state().bootstrap();

    expect(state()).toMatchObject({ status: 'unauthenticated', credential: null });
    expect(state().notice).toMatch(/session expired/i);
    expect(storeSize()).toBe(0);
    expect(api.callsTo('DELETE /auth/token')).toHaveLength(0);
  });

  it.each(['tenant_suspended', 'membership_suspended', 'account_suspended', 'tenant_mismatch'])(
    'a blocked credential (%s) signs out with an explanation',
    async (code) => {
      await saveCredential(stored);
      mockApi({ 'GET /me': problem(403, code) });

      await state().bootstrap();

      expect(state().status).toBe('unauthenticated');
      expect(state().notice).toBeTruthy();
      expect(storeSize()).toBe(0);
    },
  );

  it.each([
    ['network failure', { networkError: true }],
    ['server error', problem(500, 'server_error')],
  ])(
    '%s keeps the credential and reports "unreachable" instead of signing out',
    async (_name, reply) => {
      await saveCredential(stored);
      mockApi({ 'GET /me': reply });

      await state().bootstrap();

      expect(state().status).toBe('unreachable');
      expect(await loadCredential()).toMatchObject({ token: '1|stored-token' });
    },
  );

  it('retrying after "unreachable" recovers into an authenticated session', async () => {
    await saveCredential(stored);
    const api = mockApi({ 'GET /me': problem(503, 'server_error') });
    await state().bootstrap();
    expect(state().status).toBe('unreachable');

    api.set('GET /me', { data: { data: makeMe() } });
    await state().bootstrap();

    expect(state().status).toBe('authenticated');
  });
});

describe('sign in', () => {
  it('persists the credential only after /me succeeds and takes the organization from /me', async () => {
    mockApi({ 'GET /me': { data: { data: makeMe() } } });

    await state().completeSignIn(
      makeGrant({
        token: '1|new',
        membership: { id: 'm1', role: 'crew', tenant: { code: 'SFAI', name: 'S' } },
      }),
    );

    expect(state()).toMatchObject({
      status: 'authenticated',
      credential: { token: '1|new', tenantId: 't1', membershipId: 'm1', tenantCode: 'SFAI' },
    });
    expect(await loadCredential()).toMatchObject({ token: '1|new', tenantId: 't1' });
  });

  it('stores nothing when /me fails and rethrows the error', async () => {
    mockApi({ 'GET /me': problem(403, 'tenant_suspended') });

    await expect(state().completeSignIn(makeGrant())).rejects.toMatchObject({
      code: 'tenant_suspended',
    });

    expect(state()).toMatchObject({ status: 'unauthenticated', credential: null, me: null });
    expect(storeSize()).toBe(0);
  });

  it('clears an old sign-out notice', async () => {
    useSessionStore.setState({ notice: 'Your session expired.' });
    mockApi({ 'GET /me': { data: { data: makeMe() } } });
    await state().completeSignIn(makeGrant());
    expect(state().notice).toBeNull();
  });
});

describe('sign out', () => {
  async function signedIn() {
    const api = mockApi({
      'GET /me': { data: { data: makeMe() } },
      'DELETE /auth/token': { status: 204 },
    });
    await state().completeSignIn(makeGrant({ token: '1|device-token' }));
    return api;
  }

  it('wipes memory, query cache and secure storage, and revokes this device token on the server', async () => {
    const api = await signedIn();
    queryClient.setQueryData(['t1', 'm1', 'anything'], { secret: 'record' });

    await state().signOut();

    expect(state()).toMatchObject({ status: 'unauthenticated', credential: null, me: null });
    expect(queryClient.getQueryData(['t1', 'm1', 'anything'])).toBeUndefined();
    expect(storeSize()).toBe(0);
    const revoke = api.callsTo('DELETE /auth/token');
    expect(revoke).toHaveLength(1);
    expect(revoke[0]?.headers.Authorization).toBe('Bearer 1|device-token');
  });

  it('still signs out locally when the server cannot be reached', async () => {
    const api = await signedIn();
    api.set('DELETE /auth/token', problem(500, 'server_error'));

    await expect(state().signOut()).resolves.toBeUndefined();

    expect(state().status).toBe('unauthenticated');
    expect(storeSize()).toBe(0);
  });

  it('a forced sign-out (dead session) does not call the server and carries a notice', async () => {
    const api = await signedIn();
    await state().signOut({ notice: 'Your organization is not active.', revoke: false });
    expect(api.callsTo('DELETE /auth/token')).toHaveLength(0);
    expect(state().notice).toBe('Your organization is not active.');
  });

  it('a 401 on any authenticated call ends the session', async () => {
    const api = await signedIn();
    api.set('GET /something', problem(401, 'unauthenticated'));

    await expect(apiClient.get('/something')).rejects.toMatchObject({ kind: 'unauthorized' });
    await new Promise((r) => setTimeout(r, 0));

    expect(state().status).toBe('unauthenticated');
    expect(state().notice).toMatch(/session expired/i);
    expect(api.callsTo('DELETE /auth/token')).toHaveLength(0);
  });

  it('a late /me response after sign-out cannot bring the session back', async () => {
    const api = await signedIn();
    const gate = deferred<void>();
    api.set('GET /me', async () => {
      await gate.promise;
      return {
        data: {
          data: makeMe({
            user: { id: 'u1', username: 'ghost', email: 'g@example.test', display_name: null },
          }),
        },
      };
    });

    const pending = state().refreshMe();
    await state().signOut();
    gate.resolve();
    await pending;

    expect(state()).toMatchObject({ status: 'unauthenticated', me: null, credential: null });
  });
});

describe('token rotation', () => {
  const near = () => new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();

  async function withExpiry(expiresAt: string) {
    const api = mockApi({
      'GET /me': { data: { data: makeMe() } },
      'POST /auth/token/refresh': {
        data: { data: makeGrant({ token: '1|rotated', expires_at: '2027-01-01T00:00:00+00:00' }) },
      },
    });
    await state().completeSignIn(makeGrant({ token: '1|old', expires_at: expiresAt }));
    return api;
  }

  it('rotates a token that is close to expiry and stores the new one', async () => {
    const api = await withExpiry(near());

    await state().refreshTokenIfNeeded();

    expect(api.callsTo('POST /auth/token/refresh')).toHaveLength(1);
    expect(state().credential).toMatchObject({
      token: '1|rotated',
      expiresAt: '2027-01-01T00:00:00+00:00',
      membershipId: 'm1',
    });
    expect(await loadCredential()).toMatchObject({ token: '1|rotated' });
  });

  it('leaves a fresh token alone', async () => {
    const api = await withExpiry(new Date(Date.now() + 25 * 24 * 3600 * 1000).toISOString());
    await state().refreshTokenIfNeeded();
    expect(api.callsTo('POST /auth/token/refresh')).toHaveLength(0);
    expect(state().credential?.token).toBe('1|old');
  });

  it('concurrent triggers produce a single refresh request', async () => {
    const api = await withExpiry(near());
    await Promise.all([
      state().refreshTokenIfNeeded(),
      state().refreshTokenIfNeeded(),
      state().refreshTokenIfNeeded(),
    ]);
    expect(api.callsTo('POST /auth/token/refresh')).toHaveLength(1);
  });

  it('a refresh failure keeps the current session (it retries next time)', async () => {
    const api = await withExpiry(near());
    api.set('POST /auth/token/refresh', problem(500, 'server_error'));
    await state().refreshTokenIfNeeded();
    expect(state()).toMatchObject({ status: 'authenticated', credential: { token: '1|old' } });
  });

  it('refusal after the absolute session limit (401) ends the session', async () => {
    const api = await withExpiry(near());
    api.set('POST /auth/token/refresh', problem(401, 'unauthenticated'));
    await state().refreshTokenIfNeeded();
    await new Promise((r) => setTimeout(r, 0));
    expect(state().status).toBe('unauthenticated');
  });
});

describe('scoped query keys', () => {
  async function signInAs(membershipId: string, tenantId: string) {
    mockApi({
      'GET /me': {
        data: {
          data: makeMe({
            membership: { id: membershipId, role: 'crew', status: 'active' },
            tenant: { id: tenantId, code: tenantId.toUpperCase(), name: tenantId },
          }),
        },
      },
    });
    await state().completeSignIn(
      makeGrant({
        membership: {
          id: membershipId,
          role: 'crew',
          tenant: { id: tenantId, code: tenantId.toUpperCase(), name: tenantId },
        },
      }),
    );
  }

  it('prefixes keys with the organization and membership of the current session', async () => {
    await signInAs('m1', 't1');
    expect(scopedKey('courses')).toEqual(['t1', 'm1', 'courses']);
  });

  it('refuses to build a key without a session', () => {
    expect(() => scopedKey('courses')).toThrow(/authenticated session/);
  });

  it('data cached for one session is invisible under another session key', async () => {
    await signInAs('m1', 't1');
    queryClient.setQueryData(scopedKey('courses'), ['A-course']);
    const first = scopedKey('courses');
    await state().signOut({ revoke: false });

    await signInAs('m2', 't2');

    expect(queryClient.getQueryData(first)).toBeUndefined();
    expect(queryClient.getQueryData(scopedKey('courses'))).toBeUndefined();
  });
});
