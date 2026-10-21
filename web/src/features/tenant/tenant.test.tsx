import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import {
  asTenantAdmin,
  capture,
  makeMe,
  pageOf,
  problem,
  renderApp,
  V1,
} from '../../../tests/helpers';
import { server } from '../../../tests/server';
import type { Membership } from '../../services/api/types';

function member(over: Partial<Membership> & { id: string }): Membership {
  return {
    role: 'crew',
    status: 'active',
    created_at: '2026-10-01T08:00:00+00:00',
    user: {
      id: `u-${over.id}`,
      username: `user-${over.id}`,
      email: `${over.id}@example.test`,
      display_name: null,
    },
    profile: null,
    ...over,
  } as Membership;
}

const MARIA = member({
  id: 'm1',
  status: 'pending',
  profile: {
    first_name: 'Maria',
    last_name: 'Santos',
    middle_name: null,
    suffix: null,
    mobile: '+63 917 000 1111',
  },
});
const ADMIN = member({
  id: 'm-me',
  role: 'tenant_admin',
  profile: {
    first_name: 'Alex',
    last_name: 'Admin',
    middle_name: null,
    suffix: null,
    mobile: null,
  },
});
const JOSE = member({
  id: 'm3',
  profile: {
    first_name: 'Jose',
    last_name: 'Reyes',
    middle_name: null,
    suffix: null,
    mobile: null,
  },
});
const SUSPENDED = member({
  id: 'm4',
  status: 'suspended',
  profile: { first_name: 'Sam', last_name: 'Stone', middle_name: null, suffix: null, mobile: null },
});

function listMembers(rows: Membership[], meta = {}) {
  const urls: URL[] = [];
  server.use(
    http.get(
      `${V1}/tenant/users`,
      ({ request }) => (urls.push(new URL(request.url)), HttpResponse.json(pageOf(rows, meta))),
    ),
  );
  return urls;
}

describe('members', () => {
  beforeEach(() => asTenantAdmin());

  it('shows each member with the personal data an administrator needs to decide', async () => {
    listMembers([MARIA, ADMIN]);
    renderApp('/app/members');

    const row = (await screen.findByText('Maria Santos')).closest('tr')!;
    expect(within(row).getByText('+63 917 000 1111')).toBeInTheDocument();
    expect(within(row).getByText('user-m1')).toBeInTheDocument();
    expect(within(row).getByText('pending')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Approve Maria Santos' })).toBeInTheDocument();
  });

  it('approves a pending registration immediately (no dialog) and refreshes the list', async () => {
    listMembers([MARIA]);
    const patched = capture<Record<string, unknown>>();
    server.use(
      http.patch(
        `${V1}/tenant/users/m1`,
        async ({ request }) => (
          await patched.record(request),
          HttpResponse.json({ data: { ...MARIA, status: 'active' } })
        ),
      ),
    );
    const { user } = renderApp('/app/members');

    await user.click(await screen.findByRole('button', { name: 'Approve Maria Santos' }));

    await waitFor(() => expect(patched.calls).toHaveLength(1));
    expect(patched.calls[0]!.body).toEqual({ status: 'active' });
    expect(await screen.findByText('Member updated.')).toBeInTheDocument();
  });

  it('asks for confirmation before rejecting, and does nothing if cancelled', async () => {
    listMembers([MARIA]);
    const patched = capture<Record<string, unknown>>();
    server.use(
      http.patch(
        `${V1}/tenant/users/m1`,
        async ({ request }) => (await patched.record(request), HttpResponse.json({ data: MARIA })),
      ),
    );
    const { user } = renderApp('/app/members');

    await user.click(await screen.findByRole('button', { name: 'Reject Maria Santos' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Reject Maria Santos?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(patched.calls).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Reject Maria Santos' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reject' }),
    );
    await waitFor(() => expect(patched.calls).toHaveLength(1));
    expect(patched.calls[0]!.body).toEqual({ status: 'suspended' });
  });

  it('offers role changes and suspension for active members, reactivation for suspended ones', async () => {
    listMembers([JOSE, SUSPENDED]);
    renderApp('/app/members');

    const jose = (await screen.findByText('Jose Reyes')).closest('tr')!;
    expect(
      within(jose).getByRole('button', { name: 'Make administrator Jose Reyes' }),
    ).toBeInTheDocument();
    expect(within(jose).getByRole('button', { name: 'Suspend Jose Reyes' })).toBeInTheDocument();
    const sam = screen.getByText('Sam Stone').closest('tr')!;
    expect(within(sam).getByRole('button', { name: 'Reactivate Sam Stone' })).toBeInTheDocument();
    expect(within(sam).queryByRole('button', { name: /Suspend/ })).not.toBeInTheDocument();
  });

  it('sends the role change after confirmation', async () => {
    listMembers([JOSE]);
    const patched = capture<Record<string, unknown>>();
    server.use(
      http.patch(
        `${V1}/tenant/users/m3`,
        async ({ request }) => (await patched.record(request), HttpResponse.json({ data: JOSE })),
      ),
    );
    const { user } = renderApp('/app/members');

    await user.click(await screen.findByRole('button', { name: 'Make administrator Jose Reyes' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Make administrator',
      }),
    );

    await waitFor(() => expect(patched.calls[0]?.body).toEqual({ role: 'tenant_admin' }));
  });

  it('gives no actions on your own row', async () => {
    listMembers([ADMIN]);
    renderApp('/app/members');

    await screen.findByText('You'); // the placeholder is the same table, so wait for a real row
    const row = within(screen.getByRole('table')).getByText('Alex Admin').closest('tr')!;
    expect(within(row).getByText('You')).toBeInTheDocument();
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });

  it('explains a server refusal (last administrator) and keeps the list', async () => {
    listMembers([JOSE]);
    server.use(http.patch(`${V1}/tenant/users/m3`, () => problem(409, 'last_admin')));
    const { user } = renderApp('/app/members');

    await user.click(await screen.findByRole('button', { name: 'Suspend Jose Reyes' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Suspend' }),
    );

    expect(
      await screen.findByText('The last active administrator cannot be removed or suspended.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Jose Reyes')).toBeInTheDocument();
  });

  it('filters on the server and keeps the filter in the address', async () => {
    const urls = listMembers([MARIA]);
    const { user, router } = renderApp('/app/members');
    await screen.findByText('Maria Santos');

    await user.selectOptions(screen.getByLabelText('Status'), 'pending');

    await waitFor(() => expect(urls.at(-1)!.searchParams.get('filter[status]')).toBe('pending'));
    expect(router.state.location.search).toContain('status=pending');
  });

  it('starts from a deep link and pages through results', async () => {
    const urls = listMembers([MARIA], { total: 45, last_page: 3, per_page: 20 });
    const { user } = renderApp('/app/members?status=pending');
    await screen.findByText('Maria Santos');
    expect(urls[0]!.searchParams.get('filter[status]')).toBe('pending');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('page')).toBe('2'));
  });

  it('shows empty and error states', async () => {
    listMembers([]);
    const { unmount } = renderApp('/app/members?status=pending');
    expect(
      await screen.findByText('There are no registrations waiting for approval.'),
    ).toBeInTheDocument();
    unmount();

    server.use(http.get(`${V1}/tenant/users`, () => problem(500, 'server_error')));
    renderApp('/app/members');
    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem');
  });
});

describe('modules', () => {
  const tala = (over = {}) => ({
    code: 'tala',
    label: 'Tala',
    entitled: true,
    enabled: true,
    external_team_id: 'TEAM-7',
    ...over,
  });

  it('explains a module that the platform has not provisioned and offers no toggle', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant/modules`, () =>
        HttpResponse.json({
          data: [tala({ entitled: false, enabled: false, external_team_id: null })],
        }),
      ),
    );
    renderApp('/app/modules');

    expect(await screen.findByText(/has not been provisioned/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enable|Disable/ })).not.toBeInTheDocument();
  });

  it('shows the mapped team as read-only and disables only after confirmation', async () => {
    asTenantAdmin();
    server.use(http.get(`${V1}/tenant/modules`, () => HttpResponse.json({ data: [tala()] })));
    const put = capture<Record<string, unknown>>();
    server.use(
      http.put(
        `${V1}/tenant/modules/tala`,
        async ({ request }) => (
          await put.record(request),
          HttpResponse.json({ data: tala({ enabled: false }) })
        ),
      ),
    );
    const { user } = renderApp('/app/modules');

    expect(await screen.findByText('TEAM-7')).toBeInTheDocument();
    expect(screen.getByText(/cannot be changed here/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/team/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disable Tala' }));
    expect(put.calls).toHaveLength(0);
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Disable' }),
    );
    await waitFor(() => expect(put.calls[0]?.body).toEqual({ enabled: false }));
  });

  it('enables a disabled module with one click', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant/modules`, () =>
        HttpResponse.json({ data: [tala({ enabled: false })] }),
      ),
    );
    const put = capture<Record<string, unknown>>();
    server.use(
      http.put(
        `${V1}/tenant/modules/tala`,
        async ({ request }) => (await put.record(request), HttpResponse.json({ data: tala() })),
      ),
    );
    const { user } = renderApp('/app/modules');

    await user.click(await screen.findByRole('button', { name: 'Enable Tala' }));
    await waitFor(() => expect(put.calls[0]?.body).toEqual({ enabled: true }));
  });

  it('hides the controls from someone without the manage ability', async () => {
    asTenantAdmin(makeMe({ abilities: ['tenant.view'] }));
    server.use(http.get(`${V1}/tenant/modules`, () => HttpResponse.json({ data: [tala()] })));
    renderApp('/app/modules');

    expect(await screen.findByText('TEAM-7')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enable|Disable/ })).not.toBeInTheDocument();
  });
});

describe('settings and account', () => {
  it('saves settings, sending empty text as null and the number as a number', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant`, () =>
        HttpResponse.json({
          data: {
            id: 't1',
            code: 'SFAI',
            name: 'Southfield',
            status: 'active',
            settings: { display_name: null, privacy_policy_url: null, password_min_length: 8 },
          },
        }),
      ),
    );
    const patch = capture<{ settings: Record<string, unknown> }>();
    server.use(
      http.patch(
        `${V1}/tenant`,
        async ({ request }) => (await patch.record(request), HttpResponse.json({ data: {} })),
      ),
    );
    const { user } = renderApp('/app/settings');

    await user.type(await screen.findByLabelText('Display name'), 'Southfield Crewing');
    await user.clear(screen.getByLabelText('Minimum password length'));
    await user.type(screen.getByLabelText('Minimum password length'), '12');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(patch.calls).toHaveLength(1));
    expect(patch.calls[0]!.body.settings).toEqual({
      display_name: 'Southfield Crewing',
      privacy_policy_url: null,
      password_min_length: 12,
    });
  });

  it('shows a server validation error under its field', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant`, () =>
        HttpResponse.json({
          data: {
            id: 't1',
            code: 'SFAI',
            name: 'S',
            status: 'active',
            settings: { password_min_length: 10 },
          },
        }),
      ),
      http.patch(`${V1}/tenant`, () =>
        problem(422, 'validation', 'x', {
          password_min_length: ['May not be lower than the platform minimum (10).'],
        }),
      ),
    );
    const { user } = renderApp('/app/settings');

    await user.clear(await screen.findByLabelText('Minimum password length'));
    await user.type(screen.getByLabelText('Minimum password length'), '9');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('May not be lower than the platform minimum (10).'),
    ).toBeInTheDocument();
  });

  it('blocks a non-https privacy address locally', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant`, () =>
        HttpResponse.json({
          data: { id: 't1', code: 'SFAI', name: 'S', status: 'active', settings: {} },
        }),
      ),
    );
    const { user } = renderApp('/app/settings');

    await user.type(
      await screen.findByLabelText('Privacy policy address'),
      'http://insecure.example',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Use a secure https:// address.')).toBeInTheDocument();
  });

  it('changes the password: validates locally, then maps a wrong current password onto its field', async () => {
    asTenantAdmin();
    server.use(
      http.put(`${V1}/me/password`, () =>
        problem(422, 'invalid_current_password', 'x', {
          current_password: ['The current password is incorrect.'],
        }),
      ),
    );
    const { user } = renderApp('/app/account');

    await user.type(await screen.findByLabelText('Current password'), 'old-password');
    await user.type(screen.getByLabelText('New password'), 'old-password');
    await user.type(screen.getByLabelText('Repeat the new password'), 'old-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Choose a different password.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('New password'));
    await user.clear(screen.getByLabelText('Repeat the new password'));
    await user.type(screen.getByLabelText('New password'), 'brand-new-password');
    await user.type(screen.getByLabelText('Repeat the new password'), 'brand-new-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('The current password is incorrect.')).toBeInTheDocument();
  });

  it('confirms a successful password change', async () => {
    asTenantAdmin();
    const put = capture<Record<string, unknown>>();
    server.use(
      http.put(
        `${V1}/me/password`,
        async ({ request }) => (await put.record(request), new HttpResponse(null, { status: 204 })),
      ),
    );
    const { user } = renderApp('/app/account');

    await user.type(await screen.findByLabelText('Current password'), 'old-password');
    await user.type(screen.getByLabelText('New password'), 'brand-new-password');
    await user.type(screen.getByLabelText('Repeat the new password'), 'brand-new-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText(/other devices were signed out/)).toBeInTheDocument();
    expect(put.calls[0]!.body).toEqual({
      current_password: 'old-password',
      password: 'brand-new-password',
      password_confirmation: 'brand-new-password',
    });
  });

  it('lists deletion requests and says nothing is deleted automatically', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant/deletion-requests`, () =>
        HttpResponse.json(
          pageOf([
            {
              id: 'd1',
              status: 'pending',
              requested_at: '2026-10-02T10:00:00+00:00',
              membership: {
                id: 'm1',
                user: { id: 'u1', username: 'crew1', email: 'crew1@example.test' },
                profile: {
                  first_name: 'Ana',
                  last_name: 'Cruz',
                  middle_name: null,
                  suffix: null,
                  mobile: null,
                },
              },
            },
          ]),
        ),
      ),
    );
    renderApp('/app/deletion-requests');

    expect(await screen.findByText('Ana Cruz')).toBeInTheDocument();
    expect(screen.getByText('crew1@example.test')).toBeInTheDocument();
    expect(screen.getByText(/Nothing is deleted automatically/)).toBeInTheDocument();
  });

  describe('payroll import', () => {
    const csv = () =>
      new File(['username,kind\ncrew1,regular\n'], 'payroll.csv', { type: 'text/csv' });
    const ok = { rows: 2, created: 1, updated: 1, errors: [], imported: false };

    it('checks the file, shows what would happen, and loads it only after the check', async () => {
      asTenantAdmin();
      const commits: string[] = [];
      server.use(
        http.post(`${V1}/tenant/finance/imports/payslips`, async ({ request }) => {
          const form = await request.clone().formData();
          commits.push(String(form.get('commit')));
          return HttpResponse.json({
            data: commits.at(-1) === '1' ? { ...ok, imported: true } : ok,
          });
        }),
      );
      const { user } = renderApp('/app/payroll-import');
      const section = within(
        (await screen.findByRole('heading', { name: 'Payslips' })).closest('section')!,
      );
      await user.upload(section.getByLabelText('Payslips CSV file'), csv());
      await user.click(section.getByRole('button', { name: 'Check the file' }));

      expect(
        await section.findByText(/The file is correct: 2 row\(s\), 1 new and 1 to update/),
      ).toBeInTheDocument();
      expect(commits).toEqual(['0']); // nothing loaded by the check
      await user.click(section.getByRole('button', { name: 'Load 2 row(s)' }));
      await waitFor(() => expect(commits).toEqual(['0', '1']));
    });

    it('lists every problem with its line and offers no load button', async () => {
      asTenantAdmin();
      server.use(
        http.post(`${V1}/tenant/finance/imports/loans`, () =>
          HttpResponse.json({
            data: {
              rows: 3,
              created: 0,
              updated: 0,
              imported: false,
              errors: [
                { line: 3, message: 'The balance format is invalid.' },
                { line: 5, message: 'No member of your organization has the username "ghost".' },
              ],
            },
          }),
        ),
      );
      const { user } = renderApp('/app/payroll-import');
      const section = within(
        (await screen.findByRole('heading', { name: 'Cash advances' })).closest('section')!,
      );
      await user.upload(section.getByLabelText('Cash advances CSV file'), csv());
      await user.click(section.getByRole('button', { name: 'Check the file' }));

      expect(
        await section.findByText(/2 problem\(s\) found. Nothing was loaded/),
      ).toBeInTheDocument();
      expect(section.getByText('The balance format is invalid.')).toBeInTheDocument();
      expect(section.getByText(/ghost/)).toBeInTheDocument();
      expect(section.queryByRole('button', { name: /^Load/ })).toBeNull();
    });

    it('asks for a file before checking', async () => {
      asTenantAdmin();
      const calls = capture();
      server.use(
        http.post(
          `${V1}/tenant/finance/imports/payslips`,
          async ({ request }) => (await calls.record(request), HttpResponse.json({ data: ok })),
        ),
      );
      const { user } = renderApp('/app/payroll-import');
      const section = within(
        (await screen.findByRole('heading', { name: 'Payslips' })).closest('section')!,
      );
      await user.click(section.getByRole('button', { name: 'Check the file' }));
      expect(await section.findByText('Choose a CSV file first.')).toBeInTheDocument();
      expect(calls.calls).toHaveLength(0);
    });

    it('is blocked for someone without the ability', async () => {
      asTenantAdmin(makeMe({ abilities: ['tenant.view', 'users.view'] }));
      renderApp('/app/payroll-import');
      expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
    });
  });

  describe('call-it reports', () => {
    const report = (over: Record<string, unknown> = {}) => ({
      id: 'r1',
      status: 'submitted',
      classification: 'unsafe_acts',
      sub_classification: 'people',
      location: 'others',
      location_other: 'Gangway',
      vessel: 'MV Test',
      details: 'Saw <b>no guard</b> on the shaft',
      intervened: true,
      intervention_details: 'Stopped the work',
      official_report: true,
      file: null,
      submitted_at: '2026-10-02T10:00:00+00:00',
      reviewed_at: null,
      created_at: '2026-10-02T09:00:00+00:00',
      reporter: { id: 'm1', user: { id: 'u1', username: 'crew1', email: 'crew1@example.test' } },
      ...over,
    });

    it('lists what members sent, waiting for review by default', async () => {
      asTenantAdmin();
      const urls: URL[] = [];
      server.use(
        http.get(
          `${V1}/tenant/callit/reports`,
          ({ request }) => (urls.push(new URL(request.url)), HttpResponse.json(pageOf([report()]))),
        ),
      );
      renderApp('/app/callit');
      expect(await screen.findByText('Unsafe acts')).toBeInTheDocument();
      expect(screen.getByText('Others: Gangway')).toBeInTheDocument();
      expect(screen.getByText('Official report')).toBeInTheDocument();
      expect(urls[0]!.searchParams.get('status')).toBe('submitted');
    });

    it('opens a report, shows its text as plain text, and marks it reviewed', async () => {
      asTenantAdmin();
      const reviewed = capture();
      server.use(
        http.get(`${V1}/tenant/callit/reports`, () => HttpResponse.json(pageOf([report()]))),
        http.post(`${V1}/tenant/callit/reports/r1/review`, async ({ request }) => {
          await reviewed.record(request);
          return HttpResponse.json({ data: report({ status: 'reviewed' }) });
        }),
      );
      const { user } = renderApp('/app/callit');
      await user.click(await screen.findByRole('button', { name: /^Open the report from crew1/ }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Saw <b>no guard</b> on the shaft')).toBeInTheDocument();
      expect(within(dialog).getByText('Stopped the work')).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Mark as reviewed' }));
      await waitFor(() => expect(reviewed.calls).toHaveLength(1));
    });

    it('offers no review button for a report that was already reviewed', async () => {
      asTenantAdmin();
      server.use(
        http.get(`${V1}/tenant/callit/reports`, () =>
          HttpResponse.json(pageOf([report({ status: 'reviewed' })])),
        ),
      );
      const { user } = renderApp('/app/callit');
      await user.click(await screen.findByRole('button', { name: /^Open the report from crew1/ }));
      expect(
        within(await screen.findByRole('dialog')).queryByRole('button', {
          name: 'Mark as reviewed',
        }),
      ).toBeNull();
    });

    it('is blocked for someone without the ability', async () => {
      asTenantAdmin(makeMe({ abilities: ['tenant.view', 'users.view'] }));
      renderApp('/app/callit');
      expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
    });
  });

  describe('documents', () => {
    const doc = (over: Record<string, unknown> = {}) => ({
      id: 'd1',
      status: 'pending',
      type: { id: 't1', name: 'Passport', short_name: null },
      number: 'P123',
      grade: null,
      location: null,
      school: null,
      issued_on: '2024-01-01',
      expires_on: '2030-01-01',
      expiry_status: 'valid',
      rejection_reason: null,
      file: { name: 'p.pdf', type: 'application/pdf', size: 100 },
      submitted_at: '2026-10-02T10:00:00+00:00',
      reviewed_at: null,
      owner: { id: 'm1', user: { id: 'u1', username: 'crew1', email: 'crew1@example.test' } },
      ...over,
    });

    it('lists what is waiting for review by default, with who sent it', async () => {
      asTenantAdmin();
      const urls: URL[] = [];
      server.use(
        http.get(
          `${V1}/tenant/documents`,
          ({ request }) => (urls.push(new URL(request.url)), HttpResponse.json(pageOf([doc()]))),
        ),
      );
      renderApp('/app/documents');
      expect(await screen.findByText('Passport')).toBeInTheDocument();
      expect(screen.getByText('crew1@example.test')).toBeInTheDocument();
      expect(within(screen.getByRole('table')).getByText('Waiting for review')).toBeInTheDocument();
      expect(urls[0]!.searchParams.get('status')).toBe('pending');
    });

    it('asks before approving, then approves', async () => {
      asTenantAdmin();
      const approved = capture();
      server.use(
        http.get(`${V1}/tenant/documents`, () => HttpResponse.json(pageOf([doc()]))),
        http.post(`${V1}/tenant/documents/d1/approve`, async ({ request }) => {
          await approved.record(request);
          return HttpResponse.json({ data: doc({ status: 'approved' }) });
        }),
      );
      const { user } = renderApp('/app/documents');
      await user.click(await screen.findByRole('button', { name: /^Approve Passport/ }));
      const confirm = await screen.findByRole('alertdialog');
      expect(approved.calls).toHaveLength(0);
      await user.click(within(confirm).getByRole('button', { name: 'Approve' }));
      await waitFor(() => expect(approved.calls).toHaveLength(1));
    });

    it('needs a reason to send a document back, and sends it', async () => {
      asTenantAdmin();
      const rejected = capture<Record<string, unknown>>();
      server.use(
        http.get(`${V1}/tenant/documents`, () => HttpResponse.json(pageOf([doc()]))),
        http.post(`${V1}/tenant/documents/d1/reject`, async ({ request }) => {
          await rejected.record(request);
          return HttpResponse.json({ data: doc({ status: 'rejected' }) });
        }),
      );
      const { user } = renderApp('/app/documents');
      await user.click(await screen.findByRole('button', { name: /^Send back Passport/ }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Send back' }));
      expect(await within(dialog).findByText('Tell the member what to fix.')).toBeInTheDocument();
      expect(rejected.calls).toHaveLength(0);
      await user.type(within(dialog).getByLabelText('Reason'), 'Scan is cut off');
      await user.click(within(dialog).getByRole('button', { name: 'Send back' }));
      await waitFor(() => expect(rejected.calls).toHaveLength(1));
      expect(rejected.calls[0]!.body).toEqual({ reason: 'Scan is cut off' });
    });

    it('offers no review buttons for an approved document, and shows a reason as plain text', async () => {
      asTenantAdmin();
      server.use(
        http.get(`${V1}/tenant/documents`, () =>
          HttpResponse.json(
            pageOf([
              doc({ status: 'approved' }),
              doc({ id: 'd2', status: 'rejected', rejection_reason: 'Blurry <b>photo</b>' }),
            ]),
          ),
        ),
      );
      renderApp('/app/documents');
      await screen.findAllByText('Passport');
      expect(screen.queryByRole('button', { name: /^Approve Passport/ })).toBeNull();
      expect(screen.getByText('Blurry <b>photo</b>')).toBeInTheDocument();
    });

    it('is blocked for someone without the ability', async () => {
      asTenantAdmin(makeMe({ abilities: ['tenant.view', 'users.view'] }));
      renderApp('/app/documents');
      expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
    });
  });

  describe('document types', () => {
    const type = (over: Record<string, unknown> = {}) => ({
      id: 'ty1',
      name: 'Passport',
      short_name: 'PP',
      is_active: true,
      ...over,
    });

    it('lists the types with their state', async () => {
      asTenantAdmin();
      server.use(
        http.get(`${V1}/tenant/document-types`, () =>
          HttpResponse.json({
            data: [type(), type({ id: 'ty2', name: 'Old visa', is_active: false })],
          }),
        ),
      );
      renderApp('/app/document-types');
      expect(await screen.findByText('Passport')).toBeInTheDocument();
      expect(screen.getByText('In use')).toBeInTheDocument();
      expect(screen.getByText('Switched off')).toBeInTheDocument();
    });

    it('adds a type with only the fields of the form', async () => {
      asTenantAdmin();
      const created = capture<Record<string, unknown>>();
      server.use(
        http.get(`${V1}/tenant/document-types`, () => HttpResponse.json({ data: [] })),
        http.post(`${V1}/tenant/document-types`, async ({ request }) => {
          await created.record(request);
          return HttpResponse.json({ data: type() }, { status: 201 });
        }),
      );
      const { user } = renderApp('/app/document-types');
      await user.click(await screen.findByRole('button', { name: 'New document type' }));
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText('Name'), 'Visa');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(created.calls).toHaveLength(1));
      expect(created.calls[0]!.body).toEqual({ name: 'Visa', short_name: null });
    });

    it('does not save an empty name', async () => {
      asTenantAdmin();
      const created = capture();
      server.use(
        http.get(`${V1}/tenant/document-types`, () => HttpResponse.json({ data: [] })),
        http.post(
          `${V1}/tenant/document-types`,
          async ({ request }) => (
            await created.record(request),
            HttpResponse.json({ data: type() }, { status: 201 })
          ),
        ),
      );
      const { user } = renderApp('/app/document-types');
      await user.click(await screen.findByRole('button', { name: 'New document type' }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save' }),
      );
      expect(await screen.findByText('Enter a name.')).toBeInTheDocument();
      expect(created.calls).toHaveLength(0);
    });
  });

  describe('to-dos', () => {
    const open = {
      id: 't1',
      description: 'Renew passport <b>now</b>',
      due_date: '2099-01-01',
      is_done: false,
      done_at: null,
      created_at: '2026-10-02T10:00:00+00:00',
      assignee: { id: 'm1', user: { id: 'u1', username: 'crew1', email: 'crew1@example.test' } },
    };
    const late = { ...open, id: 't2', description: 'Late task', due_date: '2020-01-01' };
    const done = {
      ...open,
      id: 't3',
      description: 'Finished task',
      is_done: true,
      done_at: '2026-10-03T09:00:00+00:00',
    };

    it('lists tasks with who they are for and their state, as plain text', async () => {
      asTenantAdmin();
      server.use(
        http.get(`${V1}/tenant/todos`, () => HttpResponse.json(pageOf([open, late, done]))),
      );
      renderApp('/app/todos');

      expect(await screen.findByText('Renew passport <b>now</b>')).toBeInTheDocument();
      expect(screen.getAllByText('crew1@example.test').length).toBeGreaterThan(0);
      const table = within(screen.getByRole('table')); // "Open" and "Done" are also options of the filter
      expect(table.getByText('Open')).toBeInTheDocument();
      expect(table.getByText('Overdue')).toBeInTheDocument();
      expect(table.getByText('Done')).toBeInTheDocument();
    });

    it('filters by status', async () => {
      asTenantAdmin();
      const urls: URL[] = [];
      server.use(
        http.get(
          `${V1}/tenant/todos`,
          ({ request }) => (urls.push(new URL(request.url)), HttpResponse.json(pageOf([]))),
        ),
      );
      const { user } = renderApp('/app/todos');
      await screen.findByText('No to-dos');
      await user.selectOptions(screen.getByLabelText('Show'), 'open');
      await waitFor(() => expect(urls.at(-1)?.searchParams.get('status')).toBe('open'));
    });

    it('assigns one task to the chosen members only', async () => {
      asTenantAdmin();
      const created = capture<Record<string, unknown>>();
      server.use(
        http.get(`${V1}/tenant/todos`, () => HttpResponse.json(pageOf([]))),
        http.get(`${V1}/tenant/users`, () =>
          HttpResponse.json(pageOf([member({ id: 'm1' }), member({ id: 'm2' })])),
        ),
        http.post(`${V1}/tenant/todos`, async ({ request }) => {
          await created.record(request);
          return HttpResponse.json({ data: [open, open] }, { status: 201 });
        }),
      );
      const { user } = renderApp('/app/todos');
      await user.click(await screen.findByRole('button', { name: 'New to-do' }));
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText('Task'), 'Sign the form');
      await user.type(within(dialog).getByLabelText('Due date (optional)'), '2030-05-06');
      await user.click(await within(dialog).findByLabelText(/user-m1/));
      await user.click(within(dialog).getByRole('button', { name: 'Assign' }));

      await waitFor(() => expect(created.calls).toHaveLength(1));
      expect(created.calls[0]!.body).toEqual({
        description: 'Sign the form',
        due_date: '2030-05-06',
        membership_ids: ['m1'],
      });
    });

    it('does not send without a task or without anyone chosen', async () => {
      asTenantAdmin();
      const created = capture();
      server.use(
        http.get(`${V1}/tenant/todos`, () => HttpResponse.json(pageOf([]))),
        http.get(`${V1}/tenant/users`, () => HttpResponse.json(pageOf([member({ id: 'm1' })]))),
        http.post(`${V1}/tenant/todos`, async ({ request }) => {
          await created.record(request);
          return HttpResponse.json({ data: [] }, { status: 201 });
        }),
      );
      const { user } = renderApp('/app/todos');
      await user.click(await screen.findByRole('button', { name: 'New to-do' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Assign' }));
      expect(await within(dialog).findByText('Write the task.')).toBeInTheDocument();
      await user.type(within(dialog).getByLabelText('Task'), 'Something');
      await user.click(within(dialog).getByRole('button', { name: 'Assign' }));
      expect(await within(dialog).findByText('Choose at least one member.')).toBeInTheDocument();
      expect(created.calls).toHaveLength(0);
    });

    it('asks before deleting', async () => {
      asTenantAdmin();
      const del = capture();
      server.use(
        http.get(`${V1}/tenant/todos`, () => HttpResponse.json(pageOf([open]))),
        http.delete(`${V1}/tenant/todos/t1`, async ({ request }) => {
          await del.record(request);
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const { user } = renderApp('/app/todos');
      await user.click(await screen.findByRole('button', { name: /^Delete Renew/ }));
      const confirm = await screen.findByRole('alertdialog');
      expect(del.calls).toHaveLength(0);
      await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(del.calls).toHaveLength(1));
    });

    it('is blocked for someone without the ability', async () => {
      asTenantAdmin(makeMe({ abilities: ['tenant.view', 'users.view'] }));
      renderApp('/app/todos');
      expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
    });
  });

  describe('announcements', () => {
    const live = {
      id: 'a1',
      title: 'Drill on Friday <b>x</b>',
      body: 'Muster at 10:00.',
      is_active: true,
      expires_at: null,
      created_at: '2026-10-02T10:00:00+00:00',
      updated_at: '2026-10-02T10:00:00+00:00',
    };
    const off = { ...live, id: 'a2', title: 'Old news', is_active: false };
    const expired = { ...live, id: 'a3', title: 'Past', expires_at: '2020-01-01T00:00:00+00:00' };

    it('lists them with their state, and shows the text as plain text', async () => {
      asTenantAdmin();
      server.use(
        http.get(`${V1}/tenant/announcements`, () =>
          HttpResponse.json(pageOf([live, off, expired])),
        ),
      );
      renderApp('/app/announcements');

      expect(await screen.findByText('Drill on Friday <b>x</b>')).toBeInTheDocument(); // not interpreted as HTML
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByText('Switched off')).toBeInTheDocument();
      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('says so when there are none', async () => {
      asTenantAdmin();
      server.use(http.get(`${V1}/tenant/announcements`, () => HttpResponse.json(pageOf([]))));
      renderApp('/app/announcements');
      expect(await screen.findByText('No announcements yet')).toBeInTheDocument();
    });

    it('publishes a new announcement with only the fields the form owns', async () => {
      asTenantAdmin();
      const created = capture<Record<string, unknown>>();
      server.use(
        http.get(`${V1}/tenant/announcements`, () => HttpResponse.json(pageOf([]))),
        http.get(`${V1}/tenant/crew/fleets`, () => HttpResponse.json({ data: [] })),
        http.post(`${V1}/tenant/announcements`, async ({ request }) => {
          await created.record(request);
          return HttpResponse.json({ data: live }, { status: 201 });
        }),
      );
      const { user } = renderApp('/app/announcements');
      await user.click(await screen.findByRole('button', { name: 'New announcement' }));
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText('Title'), 'Hello crew');
      await user.type(within(dialog).getByLabelText('Message'), 'Welcome aboard.');
      await user.click(within(dialog).getByRole('button', { name: 'Send' }));

      await waitFor(() => expect(created.calls).toHaveLength(1));
      expect(created.calls[0]!.body).toEqual({
        title: 'Hello crew',
        body: 'Welcome aboard.',
        expires_at: null,
        fleets: [], // everyone
      });
    });

    it('does not send an empty announcement', async () => {
      asTenantAdmin();
      const created = capture();
      server.use(
        http.get(`${V1}/tenant/announcements`, () => HttpResponse.json(pageOf([]))),
        http.get(`${V1}/tenant/crew/fleets`, () => HttpResponse.json({ data: [] })),
        http.post(`${V1}/tenant/announcements`, async ({ request }) => {
          await created.record(request);
          return HttpResponse.json({ data: live }, { status: 201 });
        }),
      );
      const { user } = renderApp('/app/announcements');
      await user.click(await screen.findByRole('button', { name: 'New announcement' }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send' }),
      );

      expect(await screen.findByText('Enter a title.')).toBeInTheDocument();
      expect(screen.getByText('Write the announcement.')).toBeInTheDocument();
      expect(created.calls).toHaveLength(0);
    });

    it('switches one off with a single field, and asks before deleting', async () => {
      asTenantAdmin();
      const patch = capture<Record<string, unknown>>();
      const del = capture();
      server.use(
        http.get(`${V1}/tenant/announcements`, () => HttpResponse.json(pageOf([live]))),
        http.patch(`${V1}/tenant/announcements/a1`, async ({ request }) => {
          await patch.record(request);
          return HttpResponse.json({ data: { ...live, is_active: false } });
        }),
        http.delete(`${V1}/tenant/announcements/a1`, async ({ request }) => {
          await del.record(request);
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const { user } = renderApp('/app/announcements');
      await user.click(await screen.findByRole('button', { name: /^Switch off Drill/ }));
      await waitFor(() => expect(patch.calls).toHaveLength(1));
      expect(patch.calls[0]!.body).toEqual({ is_active: false });

      await user.click(screen.getByRole('button', { name: /^Delete Drill/ }));
      const confirm = await screen.findByRole('alertdialog');
      expect(del.calls).toHaveLength(0); // nothing yet
      await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(del.calls).toHaveLength(1));
    });

    it('is blocked for someone without the ability', async () => {
      asTenantAdmin(makeMe({ abilities: ['tenant.view', 'users.view'] }));
      renderApp('/app/announcements');
      expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
    });
  });

  it('lists feedback from members, newest first, as plain text', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant/feedback`, () =>
        HttpResponse.json(
          pageOf([
            {
              id: 'f1',
              category: 'bug',
              message: 'The quiz did not load <b>twice</b>',
              created_at: '2026-10-02T10:00:00+00:00',
              membership: {
                id: 'm1',
                user: { id: 'u1', username: 'crew1', email: 'crew1@example.test' },
              },
            },
          ]),
        ),
      ),
    );
    renderApp('/app/feedback');

    expect(await screen.findByText('The quiz did not load <b>twice</b>')).toBeInTheDocument(); // not interpreted as HTML
    expect(screen.getByText('crew1@example.test')).toBeInTheDocument();
    expect(screen.getByText('Something is wrong')).toBeInTheDocument();
    expect(screen.getByText(/Feedback about the Sailix app/)).toBeInTheDocument();
  });

  it('says so when no feedback has been sent', async () => {
    asTenantAdmin();
    server.use(http.get(`${V1}/tenant/feedback`, () => HttpResponse.json(pageOf([]))));
    renderApp('/app/feedback');
    expect(await screen.findByText('No feedback yet')).toBeInTheDocument();
  });

  it('shows the audit log with a readable actor and filters by action', async () => {
    asTenantAdmin();
    const urls: URL[] = [];
    server.use(
      http.get(
        `${V1}/tenant/audit-logs`,
        ({ request }) => (
          urls.push(new URL(request.url)),
          HttpResponse.json(
            pageOf([
              {
                id: 'a1',
                actor_type: 'user',
                action: 'membership.updated',
                subject_type: 'Membership',
                created_at: '2026-10-03T09:00:00+00:00',
              },
            ]),
          )
        ),
      ),
    );
    const { user } = renderApp('/app/audit');

    expect(await screen.findByText('membership.updated')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Filter by action'), 'tenant.settings_updated');
    await waitFor(() =>
      expect(urls.at(-1)!.searchParams.get('filter[action]')).toBe('tenant.settings_updated'),
    );
  });
});

describe('feature access in the menu', () => {
  it('hides the entries of a feature the platform switched off, and nothing else', async () => {
    asTenantAdmin(makeMe({ feature_access: { crew: false, documents: false, branding: false } }));
    renderApp('/app');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Announcements' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Members' })).toBeInTheDocument();
    for (const gone of ['Crew', 'Documents', 'Document types', 'Branding', 'Domains']) {
      expect(within(nav).queryByRole('link', { name: gone })).not.toBeInTheDocument();
    }
  });

  it('shows everything when the organization has no switched-off features', async () => {
    asTenantAdmin(makeMe());
    renderApp('/app');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    for (const label of ['Crew', 'Documents', 'Branding', 'Domains', 'Announcements']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});

describe('loading placeholders match the admin pages they stand in for', () => {
  const never = () => new Promise<never>(() => {}); // a request that does not answer
  const columns = (el: HTMLElement) =>
    within(el)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);

  it('Members, Crew and Documents: the real column headers, a row shape per cell', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant/users`, never),
      http.get(`${V1}/tenant/crew`, never),
      http.get(`${V1}/tenant/documents`, never),
    );

    const members = renderApp('/app/members');
    const m = await screen.findByRole('status', { name: 'Loading members' });
    expect(columns(m)).toEqual(['Name', 'Account', 'Role', 'Status', 'Joined', 'Actions']);
    expect(within(m).getAllByRole('row')).toHaveLength(1 + 6);
    members.unmount();

    const crew = renderApp('/app/crew');
    const c = await screen.findByRole('status', { name: 'Loading crew' });
    expect(columns(c)).toEqual([
      'Name',
      'Suffix',
      'Crew ID',
      'Rank',
      'Fleet',
      'Employment status',
      'Account',
    ]);
    crew.unmount();

    renderApp('/app/documents');
    const d = await screen.findByRole('status', { name: 'Loading documents' });
    expect(columns(d)).toEqual(['Member', 'Document', 'Expires', 'Status', '']);
  });

  it('Settings: the real labels and hints stay, only the controls shimmer', async () => {
    asTenantAdmin();
    server.use(http.get(`${V1}/tenant`, never));
    renderApp('/app/settings');

    const loading = await screen.findByRole('status', { name: 'Loading settings' });
    for (const label of ['Display name', 'Privacy policy address', 'Minimum password length']) {
      expect(within(loading).getByText(label)).toBeInTheDocument();
    }
    expect(within(loading).getByText(/never lower it/)).toBeInTheDocument();
    expect(within(loading).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('Modules: a card per module with a title and status shape, before the data', async () => {
    asTenantAdmin();
    server.use(http.get(`${V1}/tenant/modules`, never));
    renderApp('/app/modules');

    const loading = await screen.findByRole('status', { name: 'Loading modules' });
    expect(loading.querySelectorAll('section').length).toBe(3);
    expect(loading.querySelectorAll('.shimmer').length).toBeGreaterThan(8);
  });

  it('Crew profile: the form with its real labels, the sections with their headings and the shape of their tables', async () => {
    asTenantAdmin();
    server.use(http.get(`${V1}/tenant/crew/c1`, never));
    renderApp('/app/crew/c1');

    const loading = await screen.findByRole('status', { name: 'Loading crew member' });
    for (const label of ['Last name', 'Crew ID', 'Employment status', 'Birthday']) {
      expect(within(loading).getByText(label)).toBeInTheDocument();
    }
    expect(within(loading).getByText('Assign documents')).toBeInTheDocument();
    expect(within(loading).getByText('To-do list')).toBeInTheDocument();
    expect(columns(within(loading).getByRole('table', { name: 'Tasks' }))).toEqual([
      'Task',
      'Due date',
      'Status',
      '',
    ]);
  });
});
