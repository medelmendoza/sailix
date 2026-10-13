import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import {
  asAnonymous,
  asPlatformAdmin,
  asTenantAdmin,
  makeMe,
  pageOf,
  problem,
  renderApp,
  V1,
} from '../../../tests/helpers';
import { server } from '../../../tests/server';

/** Dashboard data calls every tenant session makes. */
function dashboardData() {
  server.use(
    http.get(`${V1}/tenant/users`, () => HttpResponse.json(pageOf([], { total: 3 }))),
    http.get(`${V1}/tenant/feedback`, () => HttpResponse.json(pageOf([]))),
    http.get(`${V1}/tenant/deletion-requests`, () => HttpResponse.json(pageOf([], { total: 1 }))),
    http.get(`${V1}/tenant/modules`, () =>
      HttpResponse.json({
        data: [
          { code: 'tala', label: 'Tala', entitled: true, enabled: true, external_team_id: 'T-1' },
        ],
      }),
    ),
    http.get(`${V1}/tenant/audit-logs`, () => HttpResponse.json(pageOf([]))),
  );
}

describe('route guards', () => {
  it('sends an anonymous visitor of the tenant area to the sign-in page', async () => {
    asAnonymous();
    renderApp('/app/members');
    expect(
      await screen.findByRole('heading', { name: 'Administrator sign in' }),
    ).toBeInTheDocument();
  });

  it('sends an anonymous visitor of the platform area to the platform sign-in page', async () => {
    asAnonymous();
    renderApp('/platform/tenants');
    expect(await screen.findByRole('heading', { name: 'Platform sign in' })).toBeInTheDocument();
  });

  it('does not treat a tenant-admin session as a platform session', async () => {
    asTenantAdmin();
    renderApp('/platform');
    expect(await screen.findByRole('heading', { name: 'Platform sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Platform administration')).not.toBeInTheDocument();
  });

  it('does not treat a platform session as a tenant session', async () => {
    asPlatformAdmin();
    renderApp('/app');
    expect(
      await screen.findByRole('heading', { name: 'Administrator sign in' }),
    ).toBeInTheDocument();
  });

  it('renders the tenant app for a tenant admin and shows every menu entry their abilities allow', async () => {
    asTenantAdmin();
    dashboardData();
    renderApp('/app');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    for (const label of [
      'Dashboard',
      'To-dos',
      'Announcements',
      'Members',
      'Deletion requests',
      'Feedback',
      'Modules',
      'Settings',
      'Audit log',
      'My account',
    ]) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Southfield Agencies').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Organizations' })).not.toBeInTheDocument();
  });

  it('hides menu entries the abilities do not grant, and blocks the page when its URL is opened directly', async () => {
    asTenantAdmin(makeMe({ abilities: ['tenant.view', 'users.view'] }));
    server.use(http.get(`${V1}/tenant/users`, () => HttpResponse.json(pageOf([]))));
    renderApp('/app/settings');

    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Members' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Deletion requests' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Feedback' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Announcements' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'To-dos' })).not.toBeInTheDocument();
  });

  it.each([
    ['tenant_suspended', 'Your organization is not active'],
    ['web_access_denied', 'cannot use the web portal'],
    ['membership_suspended', 'access to this organization is suspended'],
    ['account_suspended', 'account is suspended'],
  ])('explains a blocked credential (%s) instead of showing the app', async (code, text) => {
    server.use(http.get(`${V1}/me`, () => problem(403, code)));
    renderApp('/app');
    expect(
      await screen.findByRole('heading', { name: 'You cannot use the portal right now' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(new RegExp(text, 'i'));
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('shows a retryable error when the session check fails for another reason', async () => {
    server.use(http.get(`${V1}/me`, () => problem(500, 'server_error')));
    renderApp('/app');
    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders the platform area for a platform admin', async () => {
    asPlatformAdmin();
    server.use(
      http.get(`${V1}/platform/tenants`, () => HttpResponse.json(pageOf([], { total: 2 }))),
      http.get(`${V1}/platform/audit-logs`, () => HttpResponse.json(pageOf([]))),
    );
    renderApp('/platform');
    expect(await screen.findByRole('heading', { name: 'Platform dashboard' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Platform' });
    expect(within(nav).getByRole('link', { name: 'Organizations' })).toBeInTheDocument();
    expect(screen.getByText('Root Admin')).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', async () => {
    asAnonymous();
    renderApp('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
