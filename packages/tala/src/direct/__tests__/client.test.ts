import {
  createTalaClient,
  type TalaError,
  type TalaRequest,
  type TalaResponse,
  type TalaTransport,
} from '../client';

const jwt = (exp: number) =>
  `h.${btoa(JSON.stringify({ exp }))}.s`;
const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const PAST = Math.floor(Date.now() / 1000) - 3600;

/** A transport that answers from a queue and records what it was asked. */
function fakeTransport(...answers: (TalaResponse | Error)[]) {
  const seen: TalaRequest[] = [];
  const transport: TalaTransport = async (req) => {
    seen.push(req);
    const next = answers.shift();
    if (!next) throw new Error('no answer queued');
    if (next instanceof Error) throw next;
    return next;
  };
  return { transport, seen };
}
const ok = (data: unknown): TalaResponse => ({ status: 200, body: JSON.stringify(data) });
const make = (t: TalaTransport, token: string | null = jwt(FUTURE), extra = {}) =>
  createTalaClient(
    { baseUrl: 'https://tala.example.test', transport: t, retryDelayMs: 0, ...extra },
    async () => token,
  );
const kindOf = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as TalaError).kind;

describe('tala client', () => {
  it('refuses a base url that is not https', () => {
    const { transport } = fakeTransport();
    expect(() => createTalaClient({ baseUrl: 'http://tala.example.test', transport }, async () => null)).toThrow(
      /https/i,
    );
  });

  it('logs in and returns the tokens and user id', async () => {
    const { transport, seen } = fakeTransport(
      ok({ accessToken: 'a', refreshToken: 'r', userId: 'u1' }),
    );
    const out = await make(transport).login('ann', 'pw');
    expect(out).toEqual({ accessToken: 'a', refreshToken: 'r', userId: 'u1' });
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: 'https://tala.example.test/api/v1/login',
      data: { username: 'ann', password: 'pw' },
      timeoutMs: 15000,
    });
  });

  it('maps a 4xx login to login_rejected and a malformed login to unavailable', async () => {
    const a = fakeTransport({ status: 401, body: '{}' });
    expect(await kindOf(make(a.transport).login('x', 'y'))).toBe('login_rejected');
    const b = fakeTransport(ok({ accessToken: '', userId: 'u' }));
    expect(await kindOf(make(b.transport).login('x', 'y'))).toBe('unavailable');
  });

  it('sends the bearer token and url-encodes ids', async () => {
    const { transport, seen } = fakeTransport(ok([{ teamId: 't 1' }, { nope: 1 }]));
    const token = jwt(FUTURE);
    expect(await make(transport, token).teamIds('u/1')).toEqual(['t 1']);
    expect(seen[0]?.url).toBe('https://tala.example.test/api/v1/auth/users/u%2F1/teams');
    expect(seen[0]?.headers).toMatchObject({ Authorization: `Bearer ${token}` });
  });

  it('lists the teams with their names, falling back to the id', async () => {
    const { transport } = fakeTransport(ok([{ teamId: 't1', teamName: 'Deck crew' }, { teamId: 't2' }, { nope: 1 }]));
    expect(await make(transport).teams('u')).toEqual([
      { id: 't1', name: 'Deck crew' },
      { id: 't2', name: 't2' },
    ]);
  });

  it('reads only the name from the profile, never the team code or roles it also carries', async () => {
    const { transport, seen } = fakeTransport(
      ok({ firstName: 'Maria', lastName: 'Santos', email: 'm@x.test', teamDetails: [{ teamCode: 'SECRET', roleName: 'admin' }] }),
    );
    const out = await make(transport).profile('u 1');
    expect(out).toEqual({ firstName: 'Maria', lastName: 'Santos' });
    expect(JSON.stringify(out)).not.toMatch(/SECRET|admin|m@x/);
    expect(seen[0]?.url).toBe('https://tala.example.test/api/v1/auth/users/u%201');
  });

  it('builds the course, progress, deck, quiz and material paths', async () => {
    const { transport, seen } = fakeTransport(ok([]), ok({}), ok({ a: 1 }), ok({ a: 1 }), ok({ a: 1 }));
    const c = make(transport);
    await c.courses('u', 't');
    await c.progress('u', 't', 'c', 'a');
    await c.deck('t', 'd');
    await c.quiz('t', 'q');
    await c.material('t', 'pdf', 'm');
    expect(seen.map((r) => r.url.replace('https://tala.example.test', ''))).toEqual([
      '/api/v1/auth/users/u/teams/t/courses',
      '/api/v1/auth/users/u/teams/t/courses/c/sync/a/data',
      '/api/v1/auth/users/teams/t/upgraded_cards/d',
      '/api/v1/auth/users/teams/t/up_quizzes/q',
      '/api/v1/auth/users/teams/t/pdf/m',
    ]);
  });

  it('treats a 404 on progress as nothing stored yet', async () => {
    const { transport } = fakeTransport({ status: 404, body: '{}' });
    expect(await make(transport).progress('u', 't', 'c', 'a')).toEqual({});
  });

  it('rejects a list where an object is expected and the reverse', async () => {
    const a = fakeTransport(ok([1]));
    expect(await kindOf(make(a.transport).quiz('t', 'q'))).toBe('unavailable');
    const b = fakeTransport(ok({ x: 1 }));
    expect(await kindOf(make(b.transport).courses('u', 't'))).toBe('unavailable');
  });

  it('retries a GET once after a connection error but never retries a POST', async () => {
    const a = fakeTransport(new Error('net'), ok([]));
    await make(a.transport).courses('u', 't');
    expect(a.seen).toHaveLength(2);
    const b = fakeTransport(new Error('net'), ok({}));
    expect(await kindOf(make(b.transport).submitSync('u', 't', { id: 1 }))).toBe('unavailable');
    expect(b.seen).toHaveLength(1);
  });

  it('answers 401 and 403 as unauthorized and tells onUnauthorized', async () => {
    const onUnauthorized = jest.fn();
    const { transport } = fakeTransport({ status: 401, body: '' }, { status: 403, body: '' });
    const c = make(transport, jwt(FUTURE), { onUnauthorized });
    expect(await kindOf(c.courses('u', 't'))).toBe('unauthorized');
    expect(await kindOf(c.courses('u', 't'))).toBe('unauthorized');
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
  });

  it('does not sign anyone out for a request that went out without a token, or with one that has since changed', async () => {
    const onUnauthorized = jest.fn();
    const none = fakeTransport({ status: 401, body: '' });
    expect(await kindOf(make(none.transport, null, { onUnauthorized }).courses('u', 't'))).toBe('unauthorized');
    expect(onUnauthorized).not.toHaveBeenCalled();

    let current: string | null = 'old';
    const late = fakeTransport({ status: 401, body: '' });
    const c = createTalaClient(
      { baseUrl: 'https://tala.example.test', transport: late.transport, retryDelayMs: 0, onUnauthorized },
      async () => current,
    );
    const pending = c.courses('u', 't');
    current = 'new'; // the user signed out and in again while the request was away
    expect(await kindOf(pending)).toBe('unauthorized');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('answers a 500 as unauthorized only when the token has expired, otherwise as unavailable', async () => {
    const expired = fakeTransport({ status: 500, body: '' });
    expect(await kindOf(make(expired.transport, jwt(PAST)).courses('u', 't'))).toBe('unauthorized');
    const garbage = fakeTransport({ status: 500, body: '' });
    expect(await kindOf(make(garbage.transport, 'not-a-jwt').courses('u', 't'))).toBe('unavailable');
    const live = fakeTransport({ status: 500, body: '' });
    expect(await kindOf(make(live.transport, jwt(FUTURE)).courses('u', 't'))).toBe('unavailable');
  });

  it('refuses redirects and oversized bodies', async () => {
    const a = fakeTransport({ status: 302, body: '' });
    expect(await kindOf(make(a.transport).courses('u', 't'))).toBe('unavailable');
    const b = fakeTransport({ status: 200, body: 'x'.repeat(5_000_001) });
    expect(await kindOf(make(b.transport).courses('u', 't'))).toBe('unavailable');
  });

  it('posts the sync snapshot and the course code, with the PHP status rules', async () => {
    const { transport, seen } = fakeTransport(ok({}), { status: 400, body: '' }, { status: 500, body: '' });
    const c = make(transport);
    await c.submitSync('u', 't', { id: 'c1' });
    expect(seen[0]).toMatchObject({
      method: 'POST',
      data: { courseList: [{ id: 'c1' }] },
    });
    expect(seen[0]?.url).toMatch(/\/users\/u\/teams\/t\/courses\/sync$/);
    expect(await kindOf(c.applyToCourse('u', 't', 'ABC'))).toBe('course_code_rejected');
    expect(seen[1]?.data).toEqual({ courseCode: 'ABC' });
    expect(await kindOf(c.submitSync('u', 't', {}))).toBe('unavailable');
  });
});
