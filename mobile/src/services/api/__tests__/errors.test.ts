import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { ApiError, describeError, toApiError } from '../errors';

function httpError(status: number, data: unknown, headers: Record<string, string> = {}) {
  const config = {} as InternalAxiosRequestConfig;
  return new AxiosError('x', String(status), config, null, {
    status,
    data,
    headers,
    config,
    statusText: '',
  } as AxiosResponse);
}

describe('toApiError', () => {
  it('reads a problem+json body', () => {
    const e = toApiError(
      httpError(
        422,
        { code: 'validation', detail: 'Bad.', errors: { email: ['Taken.'] } },
        { 'retry-after': '7' },
      ),
    );
    expect(e).toBeInstanceOf(ApiError);
    expect([e.kind, e.status, e.code, e.message, e.field('email'), e.retryAfter]).toEqual([
      'http',
      422,
      'validation',
      'Bad.',
      'Taken.',
      7,
    ]);
  });

  it('reads Retry-After whatever its casing', () => {
    for (const name of ['retry-after', 'Retry-After', 'RETRY-AFTER']) {
      expect(toApiError(httpError(429, { code: 'throttled' }, { [name]: '12' })).retryAfter).toBe(
        12,
      );
    }
    expect(
      toApiError(httpError(429, { code: 'throttled' }, { 'Retry-After': 'soon' })).retryAfter,
    ).toBeUndefined();
  });

  it('marks 401 as unauthorized and a missing response as a network error', () => {
    expect(toApiError(httpError(401, { code: 'unauthenticated' })).kind).toBe('unauthorized');
    expect(toApiError(new AxiosError('offline', 'ERR_NETWORK')).kind).toBe('network');
  });

  it('survives bodies that are not problems', () => {
    const e = toApiError(httpError(500, '<html>oops</html>'));
    expect([e.code, e.fieldErrors]).toEqual([undefined, {}]);
    expect(toApiError(new Error('boom')).kind).toBe('parse');
  });
});

describe('describeError', () => {
  const err = (status: number, code?: string, message = 'server detail', retryAfter?: number) =>
    new ApiError(status === 401 ? 'unauthorized' : 'http', message, { status, code, retryAfter });

  it('maps stable codes to friendly text', () => {
    expect(describeError(err(401, 'invalid_credentials'))).toBe('Incorrect username or password.');
    expect(describeError(err(403, 'membership_pending'))).toMatch(/waiting for approval/);
    expect(describeError(err(403, 'tenant_suspended'))).toMatch(/not active/);
    expect(describeError(err(400, 'unknown_code', 'Specific detail.'))).toBe('Specific detail.');
  });

  it('never shows server internals for 5xx and explains throttling', () => {
    expect(describeError(err(500, 'server_error', 'SQLSTATE secret'))).toMatch(
      /Something went wrong/,
    );
    expect(describeError(err(429, 'throttled', 'x', 30))).toBe(
      'Too many attempts. Try again in 30 seconds.',
    );
    expect(describeError(err(429, 'throttled'))).toBe('Too many attempts. Try again shortly.');
    expect(describeError(err(422, 'validation'))).toBe('Please check the highlighted fields.');
  });

  it('gives only the content-free module_unavailable 503 its own text, never the server detail', () => {
    expect(describeError(err(503, 'module_unavailable', 'upstream host 10.0.0.5 refused'))).toBe(
      'This service is not reachable right now. Try again later.',
    );
    expect(describeError(err(503, 'other', 'internal detail'))).toMatch(/Something went wrong/);
  });

  it('has a dedicated message for no connection', () => {
    expect(describeError(new AxiosError('offline', 'ERR_NETWORK'))).toMatch(/No connection/);
  });
});
