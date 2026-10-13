import { http, HttpResponse } from 'msw';
import { API, problem, V1 } from '../../../tests/helpers';
import { server } from '../../../tests/server';
import { api, ensureCsrf, setUnauthorizedHandler } from './client';
import { ApiError, describeError, toApiError } from './errors';

describe('api client', () => {
  afterEach(() => setUnauthorizedHandler(undefined));

  it('turns a problem+json response into a typed ApiError', async () => {
    server.use(
      http.post(`${V1}/x`, () =>
        problem(422, 'validation', 'Bad.', { email: ['Taken.'] }, { 'Retry-After': '5' }),
      ),
    );

    const error = await api.post('/x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const e = error as ApiError;
    expect([e.status, e.code, e.message, e.field('email'), e.retryAfter, e.requestId]).toEqual([
      422,
      'validation',
      'Bad.',
      'Taken.',
      5,
      'req-test',
    ]);
  });

  it('reports an unreachable server as a network error', async () => {
    server.use(http.get(`${V1}/x`, () => HttpResponse.error()));
    const e = toApiError(await api.get('/x').catch((err: unknown) => err));
    expect([e.status, e.code]).toEqual([0, 'network']);
    expect(describeError(e)).toMatch(/Cannot reach the server/);
  });

  it('signals a session end on 401 for ordinary calls only', async () => {
    const seen: number[] = [];
    setUnauthorizedHandler(() => seen.push(1));
    server.use(
      http.get(`${V1}/tenant/users`, () => problem(401, 'unauthenticated')),
      http.get(`${V1}/me`, () => problem(401, 'unauthenticated')),
      http.post(`${V1}/auth/session`, () => problem(401, 'invalid_credentials')),
    );

    await api.get('/tenant/users').catch(() => undefined);
    expect(seen).toHaveLength(1);

    await api.get('/me').catch(() => undefined); // session probe: an expected 401
    await api.post('/auth/session', {}).catch(() => undefined); // wrong credentials: an expected 401
    expect(seen).toHaveLength(1);
  });

  it('fetches the CSRF cookie from the origin root, not the versioned API', async () => {
    const paths: string[] = [];
    server.use(
      http.get(
        `${API}/sanctum/csrf-cookie`,
        ({ request }) => (
          paths.push(new URL(request.url).pathname),
          new HttpResponse(null, { status: 204 })
        ),
      ),
    );
    await ensureCsrf();
    expect(paths).toEqual(['/sanctum/csrf-cookie']);
  });
});

describe('error messages', () => {
  const err = (status: number, code: string, message = 'server detail', retryAfter?: number) =>
    new ApiError(status, code, message, {}, retryAfter);

  it('maps stable codes to friendly text and falls back to the server detail', () => {
    expect(describeError(err(401, 'invalid_credentials'))).toMatch(/Incorrect credentials/);
    expect(describeError(err(409, 'last_admin'))).toMatch(/last active administrator/);
    expect(describeError(err(400, 'something_new', 'Specific detail.'))).toBe('Specific detail.');
  });

  it('never exposes server internals for 5xx and explains throttling with the wait time', () => {
    expect(describeError(err(500, 'server_error', 'SQLSTATE[HY000] secret'))).toBe(
      'The server had a problem. Try again in a moment.',
    );
    expect(describeError(err(429, 'throttled', 'x', 30))).toBe(
      'Too many attempts. Try again in 30 seconds.',
    );
    expect(describeError(err(429, 'throttled'))).toBe('Too many attempts. Try again shortly.');
  });

  it('points at the form for generic validation failures', () => {
    expect(describeError(err(422, 'validation'))).toBe('Please check the highlighted fields.');
  });
});
