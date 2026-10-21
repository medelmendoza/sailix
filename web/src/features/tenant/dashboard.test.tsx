import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { asTenantAdmin, capture, makeMe, pageOf, renderApp, V1 } from '../../../tests/helpers';
import { server } from '../../../tests/server';
import type { Crew } from '../../services/api/types';

const pendingCrew = (id: string, first: string, last: string, over: Partial<Crew> = {}) =>
  ({
    id,
    status: 'pending',
    username: `user-${id}`,
    email: `${id}@example.test`,
    first_name: first,
    middle_name: null,
    last_name: last,
    suffix: null,
    mobile: null,
    crew_number: '09977',
    rank: 'AB',
    fleet: 'Fleet B',
    vessel: null,
    employment_status: null,
    date_arrive: null,
    date_depart: null,
    ...over,
  }) as Crew;

const doc = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  status: 'pending',
  type: { id: 'dt1', name: "Seaman's Book", short_name: null },
  number: 'SB-1',
  grade: null,
  location: null,
  school: null,
  issued_on: null,
  expires_on: null,
  expiry_status: 'none',
  rejection_reason: null,
  file: { name: 'a.pdf', type: 'application/pdf', size: 1 },
  submitted_at: '2026-10-19T08:00:00+00:00',
  reviewed_at: null,
  owner: {
    id: 'c1',
    user: { id: 'u1', username: 'user-c1', email: 'c1@example.test' },
    profile: { first_name: 'Jaycob', last_name: 'Bustamante', crew_number: '09977' },
  },
  ...over,
});

const announcement = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id,
  title,
  body: 'Body',
  is_active: true,
  expires_at: null,
  created_at: '2026-10-18T08:00:00+00:00',
  updated_at: '2026-10-18T08:00:00+00:00',
  author: { name: 'Alex Admin' },
  ...over,
});

function dashboardApi(extra: Parameters<typeof server.use> = []) {
  server.use(
    ...extra,
    http.get(`${V1}/tenant/crew`, () =>
      HttpResponse.json(
        pageOf(
          [
            pendingCrew('c1', 'Jaycob', 'Bustamante'),
            pendingCrew('c2', 'Gian', 'Gatdula', { crew_number: '09988', rank: 'OS' }),
          ],
          { total: 7 },
        ),
      ),
    ),
    http.get(`${V1}/tenant/documents`, () => HttpResponse.json(pageOf([doc('d1')], { total: 3 }))),
    http.get(`${V1}/tenant/announcements`, () =>
      HttpResponse.json(
        pageOf([
          announcement('a1', 'February allotment is out'),
          announcement('a2', 'Training for COP', { is_active: false, author: null }),
        ]),
      ),
    ),
    http.get(`${V1}/tenant/deletion-requests`, () => HttpResponse.json(pageOf([]))),
    http.get(`${V1}/tenant/audit-logs`, () => HttpResponse.json(pageOf([]))),
  );
}

// the sidebar has links with the same names, so the tiles are looked up inside the page itself
const main = () => within(screen.getByRole('main'));
const findTile = async (name: RegExp) => {
  await screen.findByRole('main'); // the page appears once the session is known
  return main().findByRole('link', { name });
};

describe('Dashboard: the summary tiles', () => {
  it('show the figures and open the area they come from', async () => {
    asTenantAdmin();
    dashboardApi([
      http.get(`${V1}/tenant/deletion-requests`, () => HttpResponse.json(pageOf([], { total: 2 }))),
    ]);
    renderApp('/app');

    const crew = await findTile(/^Crew/);
    await waitFor(() => expect(crew).toHaveTextContent('7')); // everyone: the stub answers 7 for every crew request
    expect(crew).toHaveAttribute('href', '/app/crew');
    expect(await findTile(/Documents to review/)).toHaveTextContent('3');
    expect(main().getByRole('link', { name: /Documents to review/ })).toHaveAttribute(
      'href',
      '/app/documents',
    );
    expect(main().getByRole('link', { name: /^Announcements/ })).toHaveAttribute(
      'href',
      '/app/announcements',
    );
    const requests = main().getByRole('link', { name: /Deletion requests/ });
    await waitFor(() => expect(requests).toHaveTextContent('2'));
    expect(requests).toHaveTextContent('open, to review');
  });

  it('only for the areas the person may see and the organization has', async () => {
    asTenantAdmin(makeMe({ feature_access: { documents: false, announcements: false } }));
    dashboardApi();
    renderApp('/app');

    await findTile(/^Crew/);
    expect(main().queryByRole('link', { name: /Documents to review/ })).not.toBeInTheDocument();
    expect(main().queryByRole('link', { name: /^Announcements/ })).not.toBeInTheDocument();
    // the hero offers no shortcut to a switched-off area either
    expect(screen.queryByRole('button', { name: 'Review documents' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Write an announcement' })).not.toBeInTheDocument();
  });

  it('shimmer until they arrive', async () => {
    asTenantAdmin();
    dashboardApi([http.get(`${V1}/tenant/crew`, () => new Promise<never>(() => {}))]);
    renderApp('/app');

    const crew = await findTile(/^Crew/);
    expect(crew.querySelectorAll('.shimmer').length).toBeGreaterThanOrEqual(2); // the figure and its line
  });
});

describe('Dashboard', () => {
  it('shows the three working panels with how many wait in each', async () => {
    asTenantAdmin();
    dashboardApi();
    renderApp('/app');

    const apps = await screen.findByRole('region', { name: /User application/ });
    expect(await within(apps).findByLabelText('7 waiting')).toBeInTheDocument();
    expect(within(apps).getByText('Bustamante, Jaycob')).toBeInTheDocument();
    expect(within(apps).getByText('09988')).toBeInTheDocument();
    expect(
      within(apps).getByRole('link', { name: 'See details of Gatdula, Gian' }),
    ).toHaveAttribute('href', '/app/crew/c2');

    const docs = screen.getByRole('region', { name: /Document approval/ });
    expect(await within(docs).findByLabelText('3 waiting')).toBeInTheDocument();
    expect(within(docs).getByText('Bustamante, Jaycob')).toBeInTheDocument();
    expect(within(docs).getByText("Seaman's Book")).toBeInTheDocument();
    expect(
      within(docs).getByRole('link', { name: "Review Seaman's Book of Bustamante, Jaycob" }),
    ).toHaveAttribute('href', '/app/documents?member=c1');

    const news = screen.getByRole('region', { name: 'Announcements' });
    expect(await within(news).findByText('February allotment is out')).toBeInTheDocument();
    expect(within(news).getByText('Alex Admin')).toBeInTheDocument();
    expect(within(news).getByText('Showing')).toBeInTheDocument();
    expect(within(news).getByText('Hidden')).toBeInTheDocument();
  });

  it('asks only for pending applications, five at a time, and searches by name', async () => {
    asTenantAdmin();
    const urls: URL[] = [];
    dashboardApi([
      http.get(
        `${V1}/tenant/crew`,
        ({ request }) => (
          urls.push(new URL(request.url)),
          HttpResponse.json(pageOf([pendingCrew('c1', 'Jaycob', 'Bustamante')]))
        ),
      ),
    ]);
    const { user } = renderApp('/app');
    const apps = await screen.findByRole('region', { name: /User application/ });
    await within(apps).findByText('Bustamante, Jaycob');
    expect(urls[0]?.searchParams.get('filter[status]')).toBe('pending');
    expect(urls[0]?.searchParams.get('per_page')).toBe('5');

    await user.type(within(apps).getByLabelText('Name'), ' maria ');
    await user.click(within(apps).getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('filter[name]')).toBe('maria'));
    expect(urls.at(-1)?.searchParams.get('page')).toBe('1');

    await user.click(within(apps).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.has('filter[name]')).toBe(false));
  });

  it('asks only for documents waiting for review', async () => {
    asTenantAdmin();
    const urls: URL[] = [];
    dashboardApi([
      http.get(
        `${V1}/tenant/documents`,
        ({ request }) => (urls.push(new URL(request.url)), HttpResponse.json(pageOf([]))),
      ),
    ]);
    renderApp('/app');
    expect(await screen.findByText('Nothing waiting for review')).toBeInTheDocument();
    expect(urls[0]?.searchParams.get('status')).toBe('pending');
    expect(urls[0]?.searchParams.get('per_page')).toBe('5');
  });

  it('says so when a panel is empty and falls back to the username when there is no name', async () => {
    asTenantAdmin();
    dashboardApi([
      http.get(`${V1}/tenant/crew`, () => HttpResponse.json(pageOf([]))),
      http.get(`${V1}/tenant/documents`, () =>
        HttpResponse.json(
          pageOf([
            doc('d1', {
              owner: {
                id: 'c9',
                user: { id: 'u9', username: 'only.username', email: 'x@example.test' },
                profile: null,
              },
            }),
          ]),
        ),
      ),
    ]);
    renderApp('/app');
    expect(await screen.findByText('No applications waiting')).toBeInTheDocument();
    const docs = screen.getByRole('region', { name: /Document approval/ });
    expect(await within(docs).findByText('only.username')).toBeInTheDocument();
  });

  it('shows only the panels the administrator may use', async () => {
    asTenantAdmin(makeMe({ abilities: ['tenant.view', 'users.view'] }));
    dashboardApi();
    renderApp('/app');
    expect(await screen.findByRole('region', { name: /User application/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Document approval/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Announcements' })).not.toBeInTheDocument();
  });

  it('points to open deletion requests only when there are some', async () => {
    asTenantAdmin();
    dashboardApi([
      http.get(`${V1}/tenant/deletion-requests`, () =>
        HttpResponse.json(pageOf([{ id: 'r1' }], { total: 2 })),
      ),
    ]);
    renderApp('/app');
    expect(await screen.findByText(/2 account deletion requests are open/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      '/app/deletion-requests',
    );
  });
});

describe('Approving an application from the profile', () => {
  const crewApi = (status: string, extra: Parameters<typeof server.use> = []) =>
    server.use(
      ...extra,
      http.get(`${V1}/tenant/crew/c1`, () =>
        HttpResponse.json({
          data: { ...pendingCrew('c1', 'Jaycob', 'Bustamante'), status, birthday: null },
        }),
      ),
      http.get(`${V1}/tenant/todos`, () => HttpResponse.json(pageOf([]))),
      http.get(`${V1}/tenant/crew/c1/documents`, () => HttpResponse.json({ data: [] })),
      http.get(`${V1}/tenant/documents`, () => HttpResponse.json(pageOf([]))),
    );

  it('approves a pending member with one click', async () => {
    asTenantAdmin();
    const patched = capture<Record<string, unknown>>();
    crewApi('pending', [
      http.patch(
        `${V1}/tenant/users/c1`,
        async ({ request }) => (
          await patched.record(request),
          HttpResponse.json({
            data: {
              id: 'c1',
              role: 'crew',
              status: 'active',
              created_at: '2026-10-01T08:00:00+00:00',
            },
          })
        ),
      ),
    ]);
    const { user } = renderApp('/app/crew/c1');
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(patched.calls).toHaveLength(1));
    expect(patched.calls[0]!.body).toEqual({ status: 'active' });
    expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument(); // not for someone who cannot sign in yet
  });

  it('rejects only after confirming', async () => {
    asTenantAdmin();
    const patched = capture<Record<string, unknown>>();
    crewApi('pending', [
      http.patch(
        `${V1}/tenant/users/c1`,
        async ({ request }) => (
          await patched.record(request),
          HttpResponse.json({
            data: {
              id: 'c1',
              role: 'crew',
              status: 'suspended',
              created_at: '2026-10-01T08:00:00+00:00',
            },
          })
        ),
      ),
    ]);
    const { user } = renderApp('/app/crew/c1');
    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(patched.calls).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(patched.calls).toHaveLength(1));
    expect(patched.calls[0]!.body).toEqual({ status: 'suspended' });
  });

  it('offers no approval for a member who is already active', async () => {
    asTenantAdmin();
    crewApi('active');
    renderApp('/app/crew/c1');
    expect(await screen.findByRole('button', { name: 'Reset password' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});
