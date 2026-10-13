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

function setup(
  status: number,
  data: unknown,
  token: string | null = 'tok',
  hint: string | null = 'SFAI',
) {
  const onUnauthorized = jest.fn();
  const client = createApiClient({
    baseURL: 'https://example.test',
    getToken: () => token,
    getTenantHint: () => hint,
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
  it('sends the Bearer token and the organization hint when a session exists', async () => {
    const { client, seen } = setup(200, {});
    await client.get('/x');
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer tok');
    expect(seen[0]?.headers.get('X-Tenant-Hint')).toBe('SFAI');
    expect(seen[0]?.headers.get('Accept')).toBe('application/json');
  });

  it('sends neither without a session (public calls)', async () => {
    const { client, seen } = setup(200, {}, null);
    await client.get('/x');
    expect(seen[0]?.headers.get('Authorization')).toBeUndefined();
    expect(seen[0]?.headers.get('X-Tenant-Hint')).toBeUndefined();
  });

  it('reads the credential at SEND time, never a captured value', async () => {
    let token: string | null = 'first';
    const client = createApiClient({
      baseURL: 'https://example.test',
      getToken: () => token,
      onUnauthorized: jest.fn(),
    });
    const seen: string[] = [];
    client.defaults.adapter = (config) => {
      seen.push(String(config.headers.get('Authorization')));
      return adapterReturning(200, {})(config);
    };
    await client.get('/x');
    token = 'second';
    await client.get('/x');
    token = null;
    await client.get('/x');
    expect(seen).toEqual(['Bearer first', 'Bearer second', 'undefined']);
  });

  it('normalises errors and signals a dead session on 401', async () => {
    const { client, onUnauthorized } = setup(401, { code: 'unauthenticated', detail: 'No.' });
    await expect(client.get('/x')).rejects.toMatchObject({
      kind: 'unauthorized',
      code: 'unauthenticated',
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not treat a 401 as a dead session on public calls (wrong credentials)', async () => {
    const { client, onUnauthorized } = setup(401, { code: 'invalid_credentials' });
    await expect(
      client.post('/auth/token', {}, { skipUnauthorizedHandler: true }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('reports a network failure with its own kind', async () => {
    const client = createApiClient({
      baseURL: 'https://example.test',
      getToken: () => null,
      onUnauthorized: jest.fn(),
    });
    client.defaults.adapter = () => Promise.reject(new AxiosError('offline', 'ERR_NETWORK'));
    await expect(client.get('/x')).rejects.toMatchObject({ kind: 'network' });
  });
});
