import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppProviders } from '../src/app/providers/AppProviders';
import { routes } from '../src/app/router/routes';
import type { Me } from '../src/services/api/types';
import { server } from './server';

export const API = 'http://localhost:8000';
export const V1 = `${API}/api/v1`;

export function problem(
  status: number,
  code: string,
  detail = 'Problem.',
  errors?: Record<string, string[]>,
  headers: Record<string, string> = {},
) {
  return HttpResponse.json(
    {
      type: `urn:sailix:problem:${code}`,
      title: 'Problem',
      status,
      code,
      detail,
      request_id: 'req-test',
      ...(errors ? { errors } : {}),
    },
    { status, headers: { 'Content-Type': 'application/problem+json', ...headers } },
  );
}

export const ADMIN_ABILITIES = [
  'tenant.view',
  'tenant.manage',
  'users.view',
  'users.manage',
  'audit.view',
  'announcements.manage',
  'todos.manage',
  'documents.manage',
  'callit.manage',
  'finance.manage',
  'module.tala.use',
  'module.tala.manage',
];

export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    user: {
      id: 'u1',
      username: 'admin1',
      email: 'admin1@example.test',
      display_name: 'Alex Admin',
    },
    membership: { id: 'm-me', role: 'tenant_admin', status: 'active' },
    tenant: { id: 't1', code: 'SFAI', name: 'Southfield Agencies' },
    profile: null,
    abilities: ADMIN_ABILITIES,
    modules: [],
    memberships: [
      {
        id: 'm-me',
        role: 'tenant_admin',
        tenant: { id: 't1', code: 'SFAI', name: 'Southfield Agencies' },
        current: true,
      },
    ],
    ...overrides,
  };
}

/** Wire a signed-in tenant admin (and the CSRF cookie route). */
export function asTenantAdmin(me: Me = makeMe()) {
  server.use(
    http.get(`${API}/sanctum/csrf-cookie`, () => new HttpResponse(null, { status: 204 })),
    http.get(`${V1}/me`, () => HttpResponse.json({ data: me })),
    http.get(`${V1}/platform/me`, () => problem(401, 'unauthenticated')),
  );
}

export function asPlatformAdmin() {
  server.use(
    http.get(`${API}/sanctum/csrf-cookie`, () => new HttpResponse(null, { status: 204 })),
    http.get(`${V1}/platform/me`, () =>
      HttpResponse.json({
        data: {
          id: 'p1',
          name: 'Root Admin',
          email: 'root@example.test',
          abilities: ['platform.manage'],
        },
      }),
    ),
    http.get(`${V1}/me`, () => problem(401, 'unauthenticated')),
  );
}

export function asAnonymous() {
  server.use(
    http.get(`${API}/sanctum/csrf-cookie`, () => new HttpResponse(null, { status: 204 })),
    http.get(`${V1}/me`, () => problem(401, 'unauthenticated')),
    http.get(`${V1}/platform/me`, () => problem(401, 'unauthenticated')),
  );
}

export function pageOf<T>(
  data: T[],
  meta: Partial<{ current_page: number; per_page: number; total: number; last_page: number }> = {},
) {
  return {
    data,
    links: {},
    meta: { current_page: 1, per_page: 20, total: data.length, last_page: 1, ...meta },
  };
}

/** `staleTime` defaults to 0 (data is stale at once); pass the real client's 30 000 to see what a page does with its cache. */
export function renderApp(path: string, staleTime = 0) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime } } });
  const user = userEvent.setup();
  const utils = render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, client, user, ...utils };
}

/** Records the JSON bodies a handler receives. */
export function capture<T = unknown>() {
  const calls: Array<{ body: T; url: URL }> = [];
  return {
    calls,
    async record(request: Request) {
      let body: unknown = null;
      try {
        body = await request.clone().json();
      } catch {
        /* no body */
      }
      calls.push({ body: body as T, url: new URL(request.url) });
    },
  };
}
