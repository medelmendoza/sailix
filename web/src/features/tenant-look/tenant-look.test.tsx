import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  asAnonymous,
  asTenantAdmin,
  capture,
  problem,
  renderApp,
  V1,
} from '../../../tests/helpers';
import { server } from '../../../tests/server';

const look = {
  slug: 'aaa',
  name: 'Southfield Agencies',
  tagline: 'Sailing since 1990',
  logo_url: 'http://localhost:8000/api/v1/public/tenants/aaa/logo?v=2',
  favicon_url: null,
  primary_color: '#1F6B4A',
  secondary_color: null,
  version: 2,
};

const addressedAs = (data: unknown) =>
  server.use(http.get(`${V1}/public/tenant`, () => HttpResponse.json({ data })));

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe("sign-in on an organization's own address", () => {
  it("shows the organization's name, tagline and logo, and asks for no agency code", async () => {
    asAnonymous();
    addressedAs(look);
    renderApp('/login');

    expect(await screen.findByText('Southfield Agencies')).toBeInTheDocument();
    expect(screen.getByText('Sailing since 1990')).toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute('src', look.logo_url);
    expect(screen.queryByLabelText(/Agency code/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--color-brand-700')).toBe('#1F6B4A'),
    );
    expect(document.title).toContain('Southfield Agencies');
  });

  it('sends no agency code: the address names the organization', async () => {
    asAnonymous();
    addressedAs(look);
    const posted = capture<Record<string, unknown>>();
    server.use(
      http.post(
        `${V1}/auth/session`,
        async ({ request }) => (await posted.record(request), problem(401, 'invalid_credentials')),
      ),
    );
    const { user } = renderApp('/login');

    await user.type(await screen.findByLabelText('Username or email'), 'maria');
    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(posted.calls).toHaveLength(1));
    expect(posted.calls[0]!.body).toEqual({ username: 'maria', password: 'pw' });
  });

  it('tells the API which host the page is on with every request', async () => {
    asAnonymous();
    const seen: Array<string | null> = [];
    server.use(
      http.get(
        `${V1}/public/tenant`,
        ({ request }) => (
          seen.push(request.headers.get('x-tenant-host')),
          HttpResponse.json({ data: look })
        ),
      ),
    );
    renderApp('/login');
    await screen.findByText('Southfield Agencies');
    expect(seen[0]).toBe('localhost');
  });
});

describe('sign-in on the shared address', () => {
  it('stays as it is: agency code field, Sailix name, no look', async () => {
    asAnonymous(); // the default test handler answers 404 tenant_not_found
    renderApp('/login');

    expect(await screen.findByLabelText(/Agency code/)).toBeInTheDocument();
    expect(screen.getByText('Sailix')).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--color-brand-700')).toBe('');
  });

  it('works when the look cannot be loaded at all', async () => {
    asAnonymous();
    server.use(http.get(`${V1}/public/tenant`, () => problem(500, 'server_error')));
    renderApp('/login');
    expect(await screen.findByLabelText(/Agency code/)).toBeInTheDocument();
  });
});

describe("an address that is meant to be an organization's", () => {
  it('says so when no organization is set up there', async () => {
    vi.stubEnv('VITE_TENANT_APEX_HOSTS', 'sailix.com'); // localhost is now treated as somebody's own address
    asAnonymous();
    renderApp('/login');

    expect(
      await screen.findByText('No organization is set up at this address.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('says so when the organization is switched off', async () => {
    vi.stubEnv('VITE_TENANT_APEX_HOSTS', 'sailix.com');
    asAnonymous();
    server.use(http.get(`${V1}/public/tenant`, () => problem(403, 'tenant_unavailable')));
    renderApp('/login');

    expect(
      await screen.findByText('This organization is not available right now.'),
    ).toBeInTheDocument();
  });

  it('shows the sign-in as soon as the look is known', async () => {
    vi.stubEnv('VITE_TENANT_APEX_HOSTS', 'sailix.com');
    asAnonymous();
    addressedAs(look);
    renderApp('/login');
    expect(await screen.findByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByText('Southfield Agencies')).toBeInTheDocument();
  });
});

describe('shared-address demo switcher', () => {
  it('?tenant=<slug> picks the organization, sends it as X-Tenant-Slug and leaves the address clean', async () => {
    vi.stubEnv('VITE_TENANT_SLUG_SWITCH', 'true');
    window.history.replaceState(null, '', '/login?tenant=tenant1');
    asAnonymous();
    const seen: Array<string | null> = [];
    server.use(
      http.get(
        `${V1}/public/tenant`,
        ({ request }) => (
          seen.push(request.headers.get('x-tenant-slug')),
          HttpResponse.json({ data: { ...look, slug: 'tenant1', name: 'Tenant One' } })
        ),
      ),
    );
    renderApp('/login');

    expect(await screen.findByText('Tenant One')).toBeInTheDocument();
    expect(seen[0]).toBe('tenant1');
    expect(window.location.search).toBe('');
    window.history.replaceState(null, '', '/');
  });

  it('offers a way to enter another code when the one chosen does not exist', async () => {
    vi.stubEnv('VITE_TENANT_SLUG_SWITCH', 'true');
    localStorage.setItem('sailix.tenant_slug', 'nowhere');
    asAnonymous();
    renderApp('/login');

    expect(
      await screen.findByText('No organization is set up at this address.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Organization code/)).toBeInTheDocument();
  });
});

describe('inside the portal', () => {
  it("shows the organization's name and logo in the side bar", async () => {
    asTenantAdmin();
    addressedAs(look);
    server.use(
      http.get(`${V1}/tenant/crew`, () =>
        HttpResponse.json({
          data: [],
          links: {},
          meta: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
        }),
      ),
    );
    renderApp('/app/account');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByText('Southfield Agencies').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(document.querySelector('aside img')).toHaveAttribute('src', look.logo_url),
    );
  });
});
