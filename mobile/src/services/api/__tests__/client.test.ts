import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import { createApiClient } from '../client';
import { ApiError } from '../errors';

function adapterReturning(status: number, data: unknown): AxiosAdapter {
  return (config: InternalAxiosRequestConfig) => {
    const response = { data, status, statusText: '', headers: {}, config } as AxiosResponse;
    if (status >= 200 && status < 300) return Promise.resolve(response);
    return Promise.reject(new AxiosError('failed', String(status), config, null, response));
  };
}

function setup(status: number, data: unknown, token: string | null = 'tok') {
  const onUnauthorized = jest.fn();
  const client = createApiClient({
    baseURL: 'https://example.test',
    getToken: () => token,
    onUnauthorized,
  });
  const seen: InternalAxiosRequestConfig[] = [];
  const inner = adapterReturning(status, data);
  client.defaults.adapter = (config) => {
    seen.push(config);
    return inner(config);
  };
  return { client, onUnauthorized, seen };
}

describe('api client', () => {
  it('sends the Bearer token when a session exists', async () => {
    const { client, seen } = setup(200, {});
    await client.get('/x');
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('omits Authorization without a token', async () => {
    const { client, seen } = setup(200, {}, null);
    await client.get('/x');
    expect(seen[0]?.headers.get('Authorization')).toBeUndefined();
  });

  it('turns 401 into an unauthorized ApiError and signals session expiry', async () => {
    const { client, onUnauthorized } = setup(401, { error: 'Unauthorised' });
    await expect(client.get('/x')).rejects.toMatchObject({
      kind: 'unauthorized',
      status: 401,
      message: 'Unauthorised',
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not signal expiry for login-style calls (bad credentials)', async () => {
    const { client, onUnauthorized } = setup(401, { error: 'Invalid credentials' });
    await expect(
      client.post('/login', {}, { skipUnauthorizedHandler: true }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('prefers body.message for 400 and falls back to a generic message', async () => {
    const a = setup(400, { message: 'Username taken' });
    await expect(a.client.get('/x')).rejects.toMatchObject({
      kind: 'http',
      message: 'Username taken',
    });
    const b = setup(500, '<html>');
    await expect(b.client.get('/x')).rejects.toMatchObject({ kind: 'http', status: 500 });
  });

  it('reports network failures', async () => {
    const client = createApiClient({
      baseURL: 'https://example.test',
      getToken: () => null,
      onUnauthorized: jest.fn(),
    });
    client.defaults.adapter = (config) =>
      Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));
    await expect(client.get('/x')).rejects.toMatchObject({ kind: 'network' });
  });
});
