import axios from 'axios';
import { env } from '../../app/config/env';
import { toApiError } from './errors';

const base = env().apiBaseUrl;

/** Versioned JSON API. Cookie session (Sanctum SPA): credentials + XSRF header; never a bearer token in JS. */
export const api = axios.create({
  baseURL: `${base}/api/v1`,
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
});

/** Un-prefixed origin client, used only for Sanctum's CSRF cookie route. */
const root = axios.create({ baseURL: base, withCredentials: true });

export async function ensureCsrf(): Promise<void> {
  await root.get('/sanctum/csrf-cookie');
}

let onUnauthorized: (() => void) | undefined;

/** Registered once by the app: called when an authenticated request answers 401 (session ended). */
export function setUnauthorizedHandler(handler: (() => void) | undefined): void {
  onUnauthorized = handler;
}

// Endpoints where a 401 is an expected answer (wrong credentials, session probes), not a session end.
const AUTH_PATHS = [
  '/auth/session',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/invitations/accept',
  '/platform/auth/session',
  '/me',
  '/platform/me',
];

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error);
    const url = (axios.isAxiosError(error) ? error.config?.url : undefined) ?? '';
    const method = (axios.isAxiosError(error) ? error.config?.method : undefined) ?? 'get';
    const isAuthCall = AUTH_PATHS.some((p) => url === p) && !(method === 'delete');
    if (apiError.status === 401 && !isAuthCall) onUnauthorized?.();
    return Promise.reject(apiError);
  },
);
