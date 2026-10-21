import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, vi } from 'vitest';
import {
  API,
  asTenantAdmin,
  capture,
  makeMe,
  pageOf,
  problem,
  renderApp,
  V1,
} from '../../../tests/helpers';
import { server } from '../../../tests/server';

describe('session lifecycle', () => {
  const realLocation = window.location;
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...realLocation, assign },
    });
  });
  afterEach(() =>
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation }),
  );

  it('signing out calls the API with CSRF protection, then hard-navigates to the sign-in page', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant/users`, () => HttpResponse.json(pageOf([]))),
      http.get(`${V1}/tenant/deletion-requests`, () => HttpResponse.json(pageOf([]))),
      http.get(`${V1}/tenant/modules`, () => HttpResponse.json({ data: [] })),
      http.get(`${V1}/tenant/audit-logs`, () => HttpResponse.json(pageOf([]))),
    );
    const order: string[] = [];
    server.use(
      http.get(
        `${API}/sanctum/csrf-cookie`,
        () => (order.push('csrf'), new HttpResponse(null, { status: 204 })),
      ),
      http.delete(
        `${V1}/auth/session`,
        () => (order.push('logout'), new HttpResponse(null, { status: 204 })),
      ),
    );
    const { user, client } = renderApp('/app');

    await user.click(await screen.findByRole('button', { name: /^Account menu/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await user.click(await screen.findByRole('button', { name: 'Sign out' })); // the confirmation

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/login'));
    expect(order).toEqual(['csrf', 'logout']);
    expect(client.getQueryCache().getAll()).toHaveLength(0); // no cached record survives the logout
  });

  it('still leaves the page when the server cannot be reached during sign-out', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant/users`, () => HttpResponse.json(pageOf([]))),
      http.get(`${V1}/tenant/deletion-requests`, () => HttpResponse.json(pageOf([]))),
      http.get(`${V1}/tenant/modules`, () => HttpResponse.json({ data: [] })),
      http.get(`${V1}/tenant/audit-logs`, () => HttpResponse.json(pageOf([]))),
      http.delete(`${V1}/auth/session`, () => HttpResponse.error()),
    );
    const { user } = renderApp('/app');

    await user.click(await screen.findByRole('button', { name: /^Account menu/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await user.click(await screen.findByRole('button', { name: 'Sign out' })); // the confirmation

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/login'));
  });

  it('a 401 in the middle of a session wipes cached data and sends the user to sign in', async () => {
    let signedIn = true;
    server.use(
      http.get(`${API}/sanctum/csrf-cookie`, () => new HttpResponse(null, { status: 204 })),
      http.get(`${V1}/me`, () =>
        signedIn ? HttpResponse.json({ data: makeMe() }) : problem(401, 'unauthenticated'),
      ),
      http.get(`${V1}/platform/me`, () => problem(401, 'unauthenticated')),
      http.get(`${V1}/tenant/users`, () =>
        signedIn ? HttpResponse.json(pageOf([])) : problem(401, 'unauthenticated'),
      ),
    );
    const { user, client } = renderApp('/app/members');
    await screen.findByText('No members match');

    signedIn = false; // the session expired on the server
    await user.selectOptions(screen.getByLabelText('Status'), 'active');

    expect(
      await screen.findByRole('heading', { name: 'Administrator sign in' }),
    ).toBeInTheDocument();
    expect(client.getQueryCache().findAll({ queryKey: ['members'] })).toHaveLength(0);
  });

  it('sends the tenant admin to sign in with the page they wanted remembered', async () => {
    server.use(
      http.get(`${V1}/me`, () => problem(401, 'unauthenticated')),
      http.get(`${V1}/platform/me`, () => problem(401, 'unauthenticated')),
    );
    const { router } = renderApp('/app/audit');

    await screen.findByRole('heading', { name: 'Administrator sign in' });
    expect(router.state.location.pathname).toBe('/login');
    expect((router.state.location.state as { from?: string }).from).toBe('/app/audit');
  });

  it('does not call any data endpoint before the session is known', async () => {
    const hits = capture();
    server.use(
      http.get(`${V1}/me`, () => problem(401, 'unauthenticated')),
      http.get(
        `${V1}/tenant/users`,
        async ({ request }) => (await hits.record(request), HttpResponse.json(pageOf([]))),
      ),
    );
    renderApp('/app/members');

    await screen.findByRole('heading', { name: 'Administrator sign in' });
    expect(hits.calls).toHaveLength(0);
  });
});
