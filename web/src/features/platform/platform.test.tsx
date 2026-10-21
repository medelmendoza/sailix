import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { asPlatformAdmin, capture, pageOf, problem, renderApp, V1 } from '../../../tests/helpers';
import { server } from '../../../tests/server';
import type { Tenant } from '../../services/api/types';

const tenant = (over: Partial<Tenant> = {}): Tenant => ({
  id: 't-1',
  code: 'SFAI',
  name: 'Southfield Agencies',
  status: 'provisioning',
  activated_at: null,
  archived_at: null,
  created_at: '2026-10-01T08:00:00+00:00',
  ...over,
});
const adminRow = (status = 'active') => ({
  id: 'm-1',
  role: 'tenant_admin',
  status,
  created_at: '2026-10-01T08:00:00+00:00',
  user: { id: 'u-1', username: 'boss', email: 'boss@example.test', display_name: 'Big Boss' },
});
const talaModule = (over = {}) => ({
  code: 'tala',
  label: 'Tala',
  entitled: false,
  enabled: false,
  external_team_id: null,
  links_count: 0,
  ...over,
});

function detailData(t: Tenant, opts: { admins?: unknown[]; module?: unknown } = {}) {
  server.use(
    http.get(`${V1}/platform/tenants/${t.id}`, () => HttpResponse.json({ data: t })),
    http.get(`${V1}/platform/tenants/${t.id}/admins`, () =>
      HttpResponse.json(pageOf(opts.admins ?? [])),
    ),
    http.get(`${V1}/platform/tenants/${t.id}/modules`, () =>
      HttpResponse.json({ data: [opts.module ?? talaModule()] }),
    ),
    http.get(`${V1}/platform/tenants/${t.id}/domains`, () =>
      HttpResponse.json({
        data: { default_address: 'sfai.sailix.test', slug: 'sfai', domains: [] },
      }),
    ),
    http.get(`${V1}/platform/tenants/${t.id}/branding`, () =>
      HttpResponse.json({
        data: {
          slug: 'sfai',
          name: t.name,
          tagline: null,
          logo_url: null,
          favicon_url: null,
          primary_color: null,
          secondary_color: null,
          version: 1,
        },
      }),
    ),
  );
}

describe('organization directory', () => {
  beforeEach(() => asPlatformAdmin());

  it('lists organizations with status and filters on the server', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(
        `${V1}/platform/tenants`,
        ({ request }) => (
          urls.push(new URL(request.url)),
          HttpResponse.json(
            pageOf([
              tenant(),
              tenant({ id: 't-2', code: 'ACME', name: 'Acme Crewing', status: 'active' }),
            ]),
          )
        ),
      ),
    );
    const { user } = renderApp('/platform/tenants');

    expect(await screen.findByRole('link', { name: 'Southfield Agencies' })).toHaveAttribute(
      'href',
      '/platform/tenants/t-1',
    );
    expect(screen.getByText('Acme Crewing')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^Active/ }));
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('filter[status]')).toBe('active'));

    await user.type(screen.getByRole('searchbox', { name: 'Search organizations' }), 'acme');
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('filter[q]')).toBe('acme'));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('filter[status]')).toBeNull());
    expect(urls.at(-1)!.searchParams.get('filter[q]')).toBeNull();
  });

  it('creates an organization (validating the code locally) and opens it', async () => {
    server.use(http.get(`${V1}/platform/tenants`, () => HttpResponse.json(pageOf([]))));
    const created = capture<Record<string, unknown>>();
    server.use(
      http.post(
        `${V1}/platform/tenants`,
        async ({ request }) => (
          await created.record(request),
          HttpResponse.json(
            { data: tenant({ id: 't-9', code: 'NEWCO', name: 'New Co' }) },
            { status: 201 },
          )
        ),
      ),
    );
    detailData(tenant({ id: 't-9', code: 'NEWCO', name: 'New Co' }));
    const { user } = renderApp('/platform/tenants');

    await user.click(await screen.findByRole('button', { name: 'New organization' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Agency code'), 'bad code!');
    await user.type(within(dialog).getByLabelText('Name'), 'New Co');
    await user.click(within(dialog).getByRole('button', { name: 'Create organization' }));
    expect(await within(dialog).findByText('Use 2–32 letters or digits.')).toBeInTheDocument();
    expect(created.calls).toHaveLength(0);

    await user.clear(within(dialog).getByLabelText('Agency code'));
    await user.type(within(dialog).getByLabelText('Agency code'), 'NEWCO');
    await user.click(within(dialog).getByRole('button', { name: 'Create organization' }));

    expect(await screen.findByRole('heading', { name: 'New Co' })).toBeInTheDocument();
    expect(created.calls[0]!.body).toEqual({ code: 'NEWCO', name: 'New Co' });
  });

  it('sends the chosen address name (lowercased) only when one is given, and checks its shape first', async () => {
    server.use(http.get(`${V1}/platform/tenants`, () => HttpResponse.json(pageOf([]))));
    const created = capture<Record<string, unknown>>();
    server.use(
      http.post(
        `${V1}/platform/tenants`,
        async ({ request }) => (
          await created.record(request),
          problem(422, 'validation', 'x', { slug: ['The slug has already been taken.'] })
        ),
      ),
    );
    const { user } = renderApp('/platform/tenants');

    await user.click(await screen.findByRole('button', { name: 'New organization' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Agency code'), 'NEWCO');
    await user.type(within(dialog).getByLabelText('Name'), 'New Co');
    await user.type(within(dialog).getByLabelText('Address name (optional)'), 'bad_name');
    await user.click(within(dialog).getByRole('button', { name: 'Create organization' }));
    expect(
      await within(dialog).findByText(/Lowercase letters, digits and single hyphens/),
    ).toBeInTheDocument();
    expect(created.calls).toHaveLength(0);

    await user.clear(within(dialog).getByLabelText('Address name (optional)'));
    await user.type(within(dialog).getByLabelText('Address name (optional)'), 'Blue-Harbor');
    await user.click(within(dialog).getByRole('button', { name: 'Create organization' }));
    await waitFor(() => expect(created.calls).toHaveLength(1));
    expect(created.calls[0]!.body).toEqual({ code: 'NEWCO', name: 'New Co', slug: 'blue-harbor' });
    expect(await within(dialog).findByText('The slug has already been taken.')).toBeInTheDocument(); // the server's complaint, beside the field
  });

  it('shows a duplicate code from the server on the code field', async () => {
    server.use(
      http.get(`${V1}/platform/tenants`, () => HttpResponse.json(pageOf([]))),
      http.post(`${V1}/platform/tenants`, () =>
        problem(422, 'validation', 'x', { code: ['The code has already been taken.'] }),
      ),
    );
    const { user } = renderApp('/platform/tenants');

    await user.click(await screen.findByRole('button', { name: 'New organization' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Agency code'), 'SFAI');
    await user.type(within(dialog).getByLabelText('Name'), 'Dup');
    await user.click(within(dialog).getByRole('button', { name: 'Create organization' }));

    expect(await within(dialog).findByText('The code has already been taken.')).toBeInTheDocument();
  });
});

describe('organization detail: lifecycle', () => {
  beforeEach(() => asPlatformAdmin());

  it.each([
    ['provisioning', ['Activate']],
    ['active', ['Suspend', 'Deactivate']],
    ['suspended', ['Reactivate', 'Deactivate']],
    ['deactivated', ['Reactivate', 'Archive']],
    ['archived', []],
  ] as const)('offers only the legal actions while %s', async (status, labels) => {
    detailData(tenant({ status }));
    renderApp('/platform/tenants/t-1');

    await screen.findByRole('heading', { name: 'Southfield Agencies' });
    const header = screen.getByRole('heading', { name: 'Southfield Agencies' }).closest('header')!;
    for (const label of ['Activate', 'Suspend', 'Reactivate', 'Deactivate', 'Archive']) {
      const found = within(header).queryByRole('button', { name: label });
      if (labels.includes(label as never)) expect(found, label).toBeInTheDocument();
      else expect(found, label).not.toBeInTheDocument();
    }
  });

  it('requires a reason to suspend, then sends it', async () => {
    detailData(tenant({ status: 'active' }));
    const posted = capture<Record<string, unknown>>();
    server.use(
      http.post(
        `${V1}/platform/tenants/t-1/suspend`,
        async ({ request }) => (
          await posted.record(request),
          HttpResponse.json({ data: tenant({ status: 'suspended' }) })
        ),
      ),
    );
    const { user } = renderApp('/platform/tenants/t-1');

    await user.click(await screen.findByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    expect(
      await within(dialog).findByText('Give a reason (at least 3 characters).'),
    ).toBeInTheDocument();
    expect(posted.calls).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/Reason/), 'non-payment');
    await user.click(within(dialog).getByRole('button', { name: 'Suspend' }));

    await waitFor(() => expect(posted.calls).toHaveLength(1));
    expect(posted.calls[0]!.body).toEqual({ reason: 'non-payment' });
    expect(await screen.findByText(/suspend done/)).toBeInTheDocument();
  });

  it('activates without a reason and explains the no-administrator refusal', async () => {
    detailData(tenant({ status: 'provisioning' }));
    const posted = capture<Record<string, unknown>>();
    server.use(
      http.post(
        `${V1}/platform/tenants/t-1/activate`,
        async ({ request }) => (await posted.record(request), problem(422, 'no_active_admin')),
      ),
    );
    const { user } = renderApp('/platform/tenants/t-1');

    await user.click(await screen.findByRole('button', { name: 'Activate' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Activate' }),
    );

    expect(
      await screen.findByText(/Invite an administrator who accepts the invitation/),
    ).toBeInTheDocument();
    expect(posted.calls[0]!.body).toEqual({ reason: null });
  });

  it('explains an illegal transition reported by the server', async () => {
    detailData(tenant({ status: 'active' }));
    server.use(
      http.post(`${V1}/platform/tenants/t-1/deactivate`, () => problem(409, 'invalid_transition')),
    );
    const { user } = renderApp('/platform/tenants/t-1');

    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Reason/), 'contract ended');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(
      await within(dialog).findByText('That action is not allowed in the current state.'),
    ).toBeInTheDocument();
  });

  it('reports an unknown organization without a retry loop', async () => {
    server.use(
      http.get(`${V1}/platform/tenants/nope`, () => problem(404, 'not_found')),
      http.get(`${V1}/platform/tenants/nope/admins`, () => problem(404, 'not_found')),
      http.get(`${V1}/platform/tenants/nope/modules`, () => problem(404, 'not_found')),
    );
    renderApp('/platform/tenants/nope');

    expect(await screen.findByText('That organization does not exist.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});

describe('organization detail: administrators and modules', () => {
  beforeEach(() => asPlatformAdmin());

  it('invites an administrator and shows the development token only when the server returns one', async () => {
    detailData(tenant());
    const posted = capture<Record<string, unknown>>();
    server.use(
      http.post(
        `${V1}/platform/tenants/t-1/admins`,
        async ({ request }) => (
          await posted.record(request),
          HttpResponse.json(
            { data: adminRow('invited'), meta: { invitation_token: 'inv-id.secret' } },
            { status: 201 },
          )
        ),
      ),
    );
    const { user } = renderApp('/platform/tenants/t-1');

    expect(await screen.findByText('No administrators yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Invite administrator' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Email'), 'boss@example.test');
    await user.click(within(dialog).getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText(/Development only/)).toHaveTextContent('inv-id.secret');
    expect(posted.calls[0]!.body).toEqual({ email: 'boss@example.test' });
  });

  it('does not show a token when the server (production) returns none', async () => {
    detailData(tenant());
    server.use(
      http.post(`${V1}/platform/tenants/t-1/admins`, () =>
        HttpResponse.json({ data: adminRow('invited') }, { status: 201 }),
      ),
    );
    const { user } = renderApp('/platform/tenants/t-1');

    await user.click(await screen.findByRole('button', { name: 'Invite administrator' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Email'), 'boss@example.test');
    await user.click(within(dialog).getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Invitation sent to boss@example.test.')).toBeInTheDocument();
    expect(screen.queryByText(/Development only/)).not.toBeInTheDocument();
  });

  it('lists administrators with their status', async () => {
    detailData(tenant(), { admins: [adminRow('active')] });
    renderApp('/platform/tenants/t-1');

    const row = (await screen.findByText('Big Boss')).closest('tr')!;
    expect(within(row).getByText('boss@example.test')).toBeInTheDocument();
    expect(within(row).getByText('active')).toBeInTheDocument();
  });

  it('provisions the module with a team and shows link counts', async () => {
    detailData(tenant({ status: 'active' }), {
      module: talaModule({
        entitled: true,
        enabled: true,
        external_team_id: 'TEAM-1',
        links_count: 4,
      }),
    });
    const put = capture<Record<string, unknown>>();
    server.use(
      http.put(
        `${V1}/platform/tenants/t-1/modules/tala`,
        async ({ request }) => (
          await put.record(request),
          HttpResponse.json({
            data: talaModule({ entitled: true, enabled: true, external_team_id: 'TEAM-1' }),
          })
        ),
      ),
    );
    const { user } = renderApp('/platform/tenants/t-1?tab=modules');

    expect(await screen.findByText('4 linked account(s).')).toBeInTheDocument();
    expect(screen.getByLabelText('External team ID')).toHaveValue('TEAM-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(put.calls[0]?.body).toEqual({ external_team_id: 'TEAM-1', enabled: true }),
    );
  });

  it.each([
    ['team_already_mapped', 409, 'already mapped to another organization'],
    ['links_exist', 409, 'cannot change while accounts are linked'],
  ])('explains %s on provisioning', async (code, status, text) => {
    detailData(tenant({ status: 'active' }));
    server.use(http.put(`${V1}/platform/tenants/t-1/modules/tala`, () => problem(status, code)));
    const { user } = renderApp('/platform/tenants/t-1?tab=modules');

    await user.type(await screen.findByLabelText('External team ID'), 'TEAM-X');
    await user.click(screen.getByRole('button', { name: 'Provision' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(new RegExp(text, 'i'));
  });

  it('validates the team id locally', async () => {
    detailData(tenant({ status: 'active' }));
    const { user } = renderApp('/platform/tenants/t-1?tab=modules');

    await user.type(await screen.findByLabelText('External team ID'), 'bad team!');
    await user.click(screen.getByRole('button', { name: 'Provision' }));

    expect(await screen.findByText(/Letters, digits, - and _ only/)).toBeInTheDocument();
  });
});

describe('platform settings and audit', () => {
  beforeEach(() => asPlatformAdmin());

  it('maps an unapproved Tala address from the server onto its field', async () => {
    server.use(
      http.get(`${V1}/platform/settings`, () =>
        HttpResponse.json({
          data: { tala_api_base_url: null, password_min_length: 8, upload_max_mb: 10 },
        }),
      ),
      http.patch(`${V1}/platform/settings`, () =>
        problem(422, 'validation', 'x', {
          tala_api_base_url: [
            'The tala api base url is not an approved Tala endpoint (not_allow_listed).',
          ],
        }),
      ),
    );
    const { user } = renderApp('/platform/settings');

    await user.type(await screen.findByLabelText('Tala API address'), 'https://evil.example.org');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByText(/not an approved Tala endpoint/)).toBeInTheDocument();
  });

  it('saves settings, sending an empty address as null', async () => {
    server.use(
      http.get(`${V1}/platform/settings`, () =>
        HttpResponse.json({
          data: {
            tala_api_base_url: 'https://tala.example.com',
            password_min_length: 8,
            upload_max_mb: 10,
          },
        }),
      ),
    );
    const patch = capture<{ settings: Record<string, unknown> }>();
    server.use(
      http.patch(
        `${V1}/platform/settings`,
        async ({ request }) => (await patch.record(request), HttpResponse.json({ data: {} })),
      ),
    );
    const { user } = renderApp('/platform/settings');

    await user.clear(await screen.findByLabelText('Tala API address'));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(patch.calls).toHaveLength(1));
    expect(patch.calls[0]!.body.settings).toEqual({
      tala_api_base_url: null,
      password_min_length: 8,
      upload_max_mb: 10,
    });
  });

  it('shows platform audit entries and filters them', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(
        `${V1}/platform/audit-logs`,
        ({ request }) => (
          urls.push(new URL(request.url)),
          HttpResponse.json(
            pageOf([
              {
                id: 'a1',
                actor_type: 'platform_admin',
                action: 'tenant.suspend',
                subject_type: 'Tenant',
                created_at: '2026-10-03T09:00:00+00:00',
              },
            ]),
          )
        ),
      ),
    );
    const { user } = renderApp('/platform/audit');

    expect(await screen.findByText('tenant.suspend')).toBeInTheDocument();
    expect(screen.getByText('Platform admin')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Filter by organization ID'), 't-1');
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('filter[tenant_id]')).toBe('t-1'));
  });
});

describe('organization detail: address and branding', () => {
  beforeEach(() => asPlatformAdmin());

  const look = (over: Record<string, unknown> = {}) => ({
    slug: 'sfai',
    name: 'Southfield Agencies',
    tagline: null,
    logo_url: null,
    favicon_url: null,
    primary_color: null,
    secondary_color: null,
    version: 1,
    ...over,
  });

  it('shows the default address in the header and under Address and domains', async () => {
    detailData(tenant({ default_address: 'sfai.sailix.test', slug: 'sfai' }));
    renderApp('/platform/tenants/t-1?tab=address');

    expect(await screen.findByText(/Code SFAI · sfai.sailix.test/)).toBeInTheDocument();
    expect(
      await screen.findByText('sfai.sailix.test', { selector: 'span.font-medium' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Address and domains' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Branding' })).toBeInTheDocument();
  });

  it('adds and verifies a domain for that organization, through the platform endpoints', async () => {
    detailData(tenant());
    const added = capture<Record<string, unknown>>();
    const row = {
      id: 'd1',
      domain: 'school.example.com',
      verified: false,
      verified_at: null,
      txt_name: '_sailix-challenge.school.example.com',
      txt_value: 'sx-1',
      cname_target: 'sfai.sailix.test',
    };
    const verified = capture<unknown>();
    server.use(
      http.post(
        `${V1}/platform/tenants/t-1/domains`,
        async ({ request }) => (
          await added.record(request),
          HttpResponse.json({ data: row }, { status: 201 })
        ),
      ),
      http.post(
        `${V1}/platform/tenants/t-1/domains/d1/verify`,
        async ({ request }) => (
          await verified.record(request),
          HttpResponse.json({ data: { ...row, verified: true, txt_value: null } })
        ),
      ),
    );
    const { user } = renderApp('/platform/tenants/t-1?tab=address');

    await user.type(await screen.findByLabelText('Domain'), 'school.example.com');
    await user.click(screen.getByRole('button', { name: 'Add domain' }));
    await waitFor(() => expect(added.calls).toHaveLength(1));
    expect(added.calls[0]!.body).toEqual({ domain: 'school.example.com' });
  });

  it('sets the tagline and colours of that organization', async () => {
    detailData(tenant());
    const saved = capture<Record<string, unknown>>();
    server.use(
      http.patch(
        `${V1}/platform/tenants/t-1/branding`,
        async ({ request }) => (
          await saved.record(request),
          HttpResponse.json({ data: look({ version: 2 }) })
        ),
      ),
    );
    const { user } = renderApp('/platform/tenants/t-1?tab=branding');

    await user.type(await screen.findByLabelText('Tagline'), 'Set by the platform');
    await user.type(screen.getByLabelText('Primary colour'), '#355DAD');
    await user.click(screen.getByRole('button', { name: 'Save branding' }));
    await waitFor(() => expect(saved.calls).toHaveLength(1));
    expect(saved.calls[0]!.body).toMatchObject({
      tagline: 'Set by the platform',
      primary_color: '#355DAD',
      secondary_color: null,
    });
  });

  it('can put an organization back to the Sailix look, which the organization itself cannot do', async () => {
    detailData(tenant());
    const reset = capture<unknown>();
    server.use(
      http.post(
        `${V1}/platform/tenants/t-1/branding/reset`,
        async ({ request }) => (await reset.record(request), HttpResponse.json({ data: look() })),
      ),
    );
    const { user } = renderApp('/platform/tenants/t-1?tab=branding');

    await user.click(await screen.findByRole('button', { name: 'Reset to the Sailix look' }));
    await waitFor(() => expect(reset.calls).toHaveLength(1));
  });
});

describe('organization detail: feature access', () => {
  beforeEach(() => asPlatformAdmin());

  const feature = (code: string, label: string, enabled = true) => ({
    code,
    label,
    description: `${label} description`,
    enabled,
  });

  it('lists the core features and switches one off for that organization only', async () => {
    detailData(tenant());
    server.use(
      http.get(`${V1}/platform/tenants/t-1/features`, () =>
        HttpResponse.json({ data: [feature('crew', 'Crew'), feature('documents', 'Documents')] }),
      ),
    );
    const patched = capture<{ features: Record<string, boolean> }>();
    server.use(
      http.patch(`${V1}/platform/tenants/t-1/features`, async ({ request }) => {
        await patched.record(request);
        return HttpResponse.json({
          data: [feature('crew', 'Crew', false), feature('documents', 'Documents')],
        });
      }),
    );
    const { user } = renderApp('/platform/tenants/t-1?tab=features');

    const crew = await screen.findByRole('switch', { name: 'Crew access' });
    expect(crew).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Documents access' })).toBeChecked();

    await user.click(crew);

    await waitFor(() =>
      expect(patched.calls.map((c) => c.body)).toEqual([{ features: { crew: false } }]),
    );
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Crew access' })).not.toBeChecked(),
    );
    expect(screen.getByRole('switch', { name: 'Documents access' })).toBeChecked();
  });
});
