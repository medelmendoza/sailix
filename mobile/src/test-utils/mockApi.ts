import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { api } from '@/services/api/client';

export type Call = {
  method: string;
  path: string;
  body: unknown;
  /** Query-string parameters (`params:` of the request). */
  params?: Record<string, unknown>;
  headers: Record<string, unknown>;
};
export type Reply = {
  status?: number;
  data?: unknown;
  headers?: Record<string, string>;
  /** Transport failure: no response at all (offline, DNS, TLS). */
  networkError?: boolean;
};
export type Route = Reply | ((call: Call) => Reply | Promise<Reply>);

let unhandled: string[] = [];

const BACKGROUND: Record<string, Route> = {
  'GET /todos': {
    data: {
      data: [],
      links: {},
      meta: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
      open_count: 0,
      overdue_count: 0,
    },
  },
  'GET /announcements': {
    data: {
      data: [],
      links: {},
      meta: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
      unread_count: 0,
    },
  },
};

function parseBody(data: unknown): unknown {
  if (typeof data !== 'string') return data ?? null;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/**
 * Replaces the lowest level of the real API client (its interceptors still run: Bearer, tenant hint,
 * 401 handling, ApiError). Keys are "METHOD /path". A call without a route is recorded and fails the test.
 */
export function mockApi(routes: Record<string, Route>) {
  const calls: Call[] = [];
  // Every signed-in screen quietly loads the announcement badge. Unless a test sets its own reply, that request gets
  // an empty page and is NOT recorded in `calls`, so tests about other things keep asserting on their own requests.
  const background = Object.keys(BACKGROUND).filter((k) => !(k in routes));
  const table: Record<string, Route> = { ...BACKGROUND, ...routes };

  api.defaults.adapter = async (config) => {
    const method = (config.method ?? 'get').toUpperCase();
    const path = config.url ?? '';
    const key = `${method} ${path}`;
    const call: Call = {
      method,
      path,
      body: parseBody(config.data),
      params: config.params as Record<string, unknown> | undefined,
      headers: config.headers.toJSON(),
    };
    if (!background.includes(key)) calls.push(call);

    const route = table[key];
    if (!route) {
      unhandled.push(key);
      throw new Error(`Unhandled API call in test: ${key}`);
    }
    const reply = typeof route === 'function' ? await route(call) : route;
    if (reply.networkError)
      throw new AxiosError('offline', 'ERR_NETWORK', config as InternalAxiosRequestConfig);
    const status = reply.status ?? 200;
    const response = {
      data: reply.data ?? {},
      status,
      statusText: '',
      headers: reply.headers ?? {},
      config,
    } as AxiosResponse;
    if (status >= 200 && status < 300) return response;
    throw new AxiosError(
      'failed',
      String(status),
      config as InternalAxiosRequestConfig,
      null,
      response,
    );
  };

  return {
    calls,
    callsTo: (key: string) => calls.filter((c) => `${c.method} ${c.path}` === key),
    set: (key: string, route: Route) => void (table[key] = route),
  };
}

export function strictAdapterWithoutMock(): void {
  api.defaults.adapter = async (config) => {
    const key = `${(config.method ?? 'get').toUpperCase()} ${config.url ?? ''}`;
    const quiet = BACKGROUND[key];
    if (quiet && typeof quiet !== 'function') {
      return {
        data: quiet.data,
        status: 200,
        statusText: '',
        headers: {},
        config,
      } as AxiosResponse;
    }
    unhandled.push(key);
    throw new Error(`API called without mockApi(): ${key}`);
  };
}

export function resetUnhandled(): void {
  unhandled = [];
}

export function assertNoUnhandledApiCalls(): void {
  const seen = unhandled;
  unhandled = [];
  if (seen.length > 0) throw new Error(`Unmocked API calls: ${seen.join(', ')}`);
}

/** RFC 9457 problem reply as the API sends it. */
export function problem(
  status: number,
  code: string,
  detail = 'Problem.',
  errors?: Record<string, string[]>,
  headers?: Record<string, string>,
): Reply {
  return {
    status,
    headers,
    data: {
      type: `urn:sailix:problem:${code}`,
      title: 'Problem',
      status,
      code,
      detail,
      ...(errors ? { errors } : {}),
    },
  };
}
