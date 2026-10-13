import { create, isAxiosError, type AxiosInstance } from 'axios';
import { env } from '@/app/config/env';
import { toApiError } from './errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Set on calls where 401 means "bad credentials", not "session expired" (login, register, reset). */
    skipUnauthorizedHandler?: boolean;
  }
}

export type ApiClientOptions = {
  baseURL: string;
  timeoutMs?: number;
  getToken: () => string | null;
  /** Organization code of the current session, sent as a hint the server compares with the token (never trusted). */
  getTenantHint?: () => string | null;
  onUnauthorized: () => void;
};

/**
 * Builds the single HTTP client (docs/07): Bearer on every request, 15 s timeout, the credential is read
 * at SEND time (no captured closures, so a late request can never carry a previous session's token),
 * 401 on an authenticated call ⇒ session ended, errors normalised to ApiError.
 */
export function createApiClient(options: ApiClientOptions): AxiosInstance {
  const instance = create({
    baseURL: options.baseURL,
    timeout: options.timeoutMs ?? 15_000,
    headers: { Accept: 'application/json' },
  });

  instance.interceptors.request.use((config) => {
    const token = options.getToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
      const hint = options.getTenantHint?.();
      if (hint) config.headers.set('X-Tenant-Hint', hint);
    }
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

type Handlers = Pick<ApiClientOptions, 'getToken' | 'getTenantHint' | 'onUnauthorized'>;

let handlers: Handlers = { getToken: () => null, onUnauthorized: () => undefined };

/** Wired once by the session store so this module never imports it (no cycle). */
export function configureApi(next: Handlers): void {
  handlers = next;
}

export const api = createApiClient({
  baseURL: `${env.apiBaseUrl}${env.apiPrefix}`,
  getToken: () => handlers.getToken(),
  getTenantHint: () => handlers.getTenantHint?.() ?? null,
  onUnauthorized: () => handlers.onUnauthorized(),
});

/** Config for public calls (login, register, forgot): a 401 here is a wrong answer, not a dead session. */
export const PUBLIC_CALL = { skipUnauthorizedHandler: true } as const;
