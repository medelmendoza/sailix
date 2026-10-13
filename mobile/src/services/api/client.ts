import { create, isAxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { env } from '@/app/config/env';
import { toApiError } from './errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Set on calls where 401 means "bad credentials", not "session expired" (login). */
    skipUnauthorizedHandler?: boolean;
  }
}

export type ApiClientOptions = {
  baseURL: string;
  timeoutMs?: number;
  getToken: () => string | null;
  onUnauthorized: () => void;
};

/**
 * Builds the single HTTP client. Per docs/06: Bearer on every request (the
 * Flutter app only sent it on change-password; backend enforcement is Q-1),
 * 15 s timeout, 401 => session expiry, errors normalised to ApiError.
 */
export function createApiClient(options: ApiClientOptions): AxiosInstance {
  const instance = create({ baseURL: options.baseURL, timeout: options.timeoutMs ?? 15_000 });

  instance.interceptors.request.use((config) => {
    const token = options.getToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const apiError = toApiError(error);
      const config = isAxiosError(error) ? error.config : undefined;
      if (apiError.kind === 'unauthorized' && !config?.skipUnauthorizedHandler) {
        options.onUnauthorized();
      }
      return Promise.reject(apiError);
    },
  );

  return instance;
}

type Handlers = Pick<ApiClientOptions, 'getToken' | 'onUnauthorized'>;

let handlers: Handlers = { getToken: () => null, onUnauthorized: () => undefined };

/** Wired once by the session store so this module never imports it (no cycle). */
export function configureApi(next: Handlers): void {
  handlers = next;
}

export const api = createApiClient({
  baseURL: env.apiBaseUrl,
  getToken: () => handlers.getToken(),
  onUnauthorized: () => handlers.onUnauthorized(),
});

/** Prefix helpers — URL literals live in config only (Q-2: two prefixes). */
export const apiPath = (path: string) => `${env.apiPrefix}${path}`;

export type { AxiosRequestConfig };
