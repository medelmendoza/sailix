import { createTalaSession, secureStoreStorage, type TalaStorage } from '../auth';

const memory = (): TalaStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    remove: async (k) => void data.delete(k),
  };
};
const login = { accessToken: 'tok', refreshToken: 'ref', userId: 'u1' };
const client = (teams: string[]) => ({
  login: jest.fn(async () => login),
  teamIds: jest.fn(async () => teams),
});

describe('tala session', () => {
  it('stores the login, picks the only team by itself and reports it as current', async () => {
    const s = createTalaSession(memory(), 'org:1:member:2');
    const out = await s.signIn(client(['t1']), 'ann', 'pw');
    expect(out).toEqual({ userId: 'u1', teamIds: ['t1'] });
    expect(await s.current()).toMatchObject({ userId: 'u1', teamId: 't1' });
    expect(await s.token()).toBe('tok');
  });

  it('leaves the team open when there are several, until one is chosen', async () => {
    const s = createTalaSession(memory(), '');
    await s.signIn(client(['t1', 't2']), 'ann', 'pw');
    expect((await s.current())?.teamId).toBeNull();
    await s.setTeam('t2');
    expect((await s.current())?.teamId).toBe('t2');
  });

  it('signs the user out again and clears the tokens when the team lookup fails', async () => {
    const store = memory();
    const s = createTalaSession(store, '');
    const c = { login: jest.fn(async () => login), teamIds: jest.fn(async () => Promise.reject(new Error('x'))) };
    await expect(s.signIn(c, 'a', 'b')).rejects.toThrow('x');
    expect(await s.current()).toBeNull();
    expect(store.data.size).toBe(0);
  });

  it('expire wipes the tokens, tells the listeners once each, and unsubscribe stops them', async () => {
    const s = createTalaSession(memory(), '');
    await s.signIn(client(['t1']), 'a', 'b');
    const a = jest.fn();
    const b = jest.fn();
    s.onSignInAgain(a);
    s.onSignInAgain(b)();
    await s.expire();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(await s.current()).toBeNull();
  });

  it('signOut wipes everything and does not ask the user to sign in again', async () => {
    const store = memory();
    const s = createTalaSession(store, '');
    await s.signIn(client(['t1']), 'a', 'b');
    const cb = jest.fn();
    s.onSignInAgain(cb);
    await s.signOut();
    expect(store.data.size).toBe(0);
    expect(cb).not.toHaveBeenCalled();
  });

  it('keeps two scopes apart', async () => {
    const store = memory();
    const a = createTalaSession(store, 'org:1');
    const b = createTalaSession(store, 'org:2');
    await a.signIn(client(['t1']), 'a', 'b');
    expect(await b.current()).toBeNull();
  });

  it('ignores a damaged stored value', async () => {
    const store = memory();
    const s = createTalaSession(store, 'x');
    await store.set('tala.x.session', '{not json');
    expect(await s.current()).toBeNull();
  });
});

describe('secureStoreStorage', () => {
  it('round-trips through expo-secure-store', async () => {
    await secureStoreStorage.set('tala.k', 'v');
    expect(await secureStoreStorage.get('tala.k')).toBe('v');
    await secureStoreStorage.remove('tala.k');
    expect(await secureStoreStorage.get('tala.k')).toBeNull();
  });
});
