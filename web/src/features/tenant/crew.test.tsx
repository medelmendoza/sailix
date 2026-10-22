import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { asTenantAdmin, capture, pageOf, problem, renderApp, V1 } from '../../../tests/helpers';
import { server } from '../../../tests/server';
import type { Crew } from '../../services/api/types';

function crew(over: Partial<Crew> & { id: string }): Crew {
  return {
    status: 'active',
    username: `user-${over.id}`,
    email: `${over.id}@example.test`,
    first_name: 'Jaycob',
    middle_name: null,
    last_name: 'Bustamante',
    suffix: null,
    mobile: null,
    crew_number: '09977',
    rank: 'AB',
    fleet: 'Fleet B',
    vessel: null,
    employment_status: 'Onboard',
    date_arrive: null,
    date_depart: null,
    birthday: '1990-05-04',
    ...over,
  } as Crew;
}

const JAYCOB = crew({ id: 'c1' });
const GIAN = crew({
  id: 'c2',
  first_name: 'Gian',
  last_name: 'Gatdula',
  crew_number: '09988',
  rank: 'OS',
  suffix: 'Jr.',
});

describe('Crew list', () => {
  it('lists the crew with their record and links each name to the profile', async () => {
    asTenantAdmin();
    server.use(http.get(`${V1}/tenant/crew`, () => HttpResponse.json(pageOf([JAYCOB, GIAN]))));
    renderApp('/app/crew');

    const link = await screen.findByRole('link', { name: 'Bustamante, Jaycob' });
    expect(link).toHaveAttribute('href', '/app/crew/c1');
    const table = within(screen.getByRole('table'));
    expect(table.getByText('09988')).toBeInTheDocument();
    expect(table.getByText('Jr.')).toBeInTheDocument();
    expect(table.getAllByText('Fleet B').length).toBeGreaterThan(0);
  });

  it('searches by last name, first name and crew ID, and clears the search', async () => {
    asTenantAdmin();
    const urls: URL[] = [];
    server.use(
      http.get(
        `${V1}/tenant/crew`,
        ({ request }) => (urls.push(new URL(request.url)), HttpResponse.json(pageOf([JAYCOB]))),
      ),
    );
    const { user } = renderApp('/app/crew');
    await screen.findByRole('link', { name: 'Bustamante, Jaycob' });

    await user.type(screen.getByLabelText('Last name'), ' Bust ');
    await user.type(screen.getByLabelText('First name'), 'Jay');
    await user.type(screen.getByLabelText('Crew ID'), '0997');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('filter[last_name]')).toBe('Bust'));
    expect(urls.at(-1)?.searchParams.get('filter[first_name]')).toBe('Jay');
    expect(urls.at(-1)?.searchParams.get('filter[crew_number]')).toBe('0997');
    expect(urls.at(-1)?.searchParams.get('page')).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.has('filter[last_name]')).toBe(false));
    expect(screen.getByLabelText('Last name')).toHaveValue('');
  });

  it('says so when nothing matches', async () => {
    asTenantAdmin();
    server.use(http.get(`${V1}/tenant/crew`, () => HttpResponse.json(pageOf([]))));
    renderApp('/app/crew');
    expect(await screen.findByText('No crew found')).toBeInTheDocument();
  });

  it('shows an error with a retry when the list cannot load', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant/crew`, () => problem(500, 'server_error', 'Something went wrong.')),
    );
    renderApp('/app/crew');
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('Crew profile', () => {
  const task = {
    id: 't1',
    description: 'Renew your passport',
    due_date: '2020-01-01',
    is_done: false,
    done_at: null,
    created_at: '2026-10-01T08:00:00+00:00',
    assignee: { id: 'c1', user: { id: 'u1', username: 'user-c1', email: 'c1@example.test' } },
  };

  const DOC_ROWS = [
    {
      type: { id: 'dt1', name: "Seaman's Book", short_name: null },
      document: { id: 'd1', number: 'SB-1', expires_on: '2026-12-01', review_status: 'approved' },
      state: 'expiring',
      requested: true,
    },
    {
      type: { id: 'dt2', name: 'US Visa', short_name: null },
      document: { id: 'd2', number: 'V-9', expires_on: '2031-01-01', review_status: 'approved' },
      state: 'valid',
      requested: false,
    },
    {
      type: { id: 'dt3', name: 'Panama Booklet', short_name: null },
      document: null,
      state: 'missing',
      requested: false,
    },
  ];

  function profileApi(extra: Parameters<typeof server.use> = []) {
    server.use(
      ...extra,
      http.get(`${V1}/tenant/crew/c1`, () => HttpResponse.json({ data: JAYCOB })),
      http.get(`${V1}/tenant/todos`, () => HttpResponse.json(pageOf([task]))),
      http.get(`${V1}/tenant/crew/c1/documents`, () => HttpResponse.json({ data: DOC_ROWS })),
      http.get(`${V1}/tenant/documents`, () => HttpResponse.json(pageOf([]))),
    );
  }

  it("shows the record, the account and the member's tasks", async () => {
    asTenantAdmin();
    profileApi();
    const { user } = renderApp('/app/crew/c1');

    expect(await screen.findByRole('heading', { name: 'Jaycob Bustamante' })).toBeInTheDocument();
    expect(screen.getByText(/user-c1/)).toBeInTheDocument();
    expect(screen.getByLabelText('Crew ID')).toHaveValue('09977');
    expect(screen.getByLabelText('Birthday')).toHaveValue('1990-05-04');
    await user.click(await screen.findByRole('tab', { name: 'To-do list' }));
    expect(await screen.findByText('Renew your passport')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('only asks for the tasks of this member', async () => {
    asTenantAdmin();
    const urls: URL[] = [];
    profileApi([
      http.get(
        `${V1}/tenant/todos`,
        ({ request }) => (urls.push(new URL(request.url)), HttpResponse.json(pageOf([]))),
      ),
    ]);
    renderApp('/app/crew/c1?tab=todos');
    await screen.findByText('No tasks');
    expect(urls[0]?.searchParams.get('membership_id')).toBe('c1');
  });

  it('saves the changed fields, sending empty ones as empty', async () => {
    asTenantAdmin();
    const saved = capture<Record<string, unknown>>();
    profileApi([
      http.patch(`${V1}/tenant/crew/c1`, async ({ request }) => {
        await saved.record(request);
        return HttpResponse.json({ data: { ...JAYCOB, vessel: 'MV Aurora' } });
      }),
    ]);
    const { user } = renderApp('/app/crew/c1');
    await screen.findByRole('heading', { name: 'Jaycob Bustamante' });

    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled(); // nothing changed yet
    await user.type(screen.getByLabelText('Vessel'), 'MV Aurora');
    await user.click(save);

    await waitFor(() => expect(saved.calls).toHaveLength(1));
    const body = saved.calls[0]!.body as Record<string, unknown>;
    expect(body.vessel).toBe('MV Aurora');
    expect(body.middle_name).toBe('');
    expect(await screen.findByText('Crew record saved.')).toBeInTheDocument();
  });

  it('checks the record before sending it', async () => {
    asTenantAdmin();
    const saved = capture<Record<string, unknown>>();
    profileApi([
      http.patch(
        `${V1}/tenant/crew/c1`,
        async ({ request }) => (await saved.record(request), HttpResponse.json({ data: JAYCOB })),
      ),
    ]);
    const { user } = renderApp('/app/crew/c1');
    await screen.findByRole('heading', { name: 'Jaycob Bustamante' });

    await user.clear(screen.getByLabelText('Last name'));
    await user.clear(screen.getByLabelText('Crew ID'));
    await user.type(screen.getByLabelText('Crew ID'), 'bad id!');
    await user.type(screen.getByLabelText('Date arrive'), '2026-05-10');
    await user.type(screen.getByLabelText('Date depart'), '2026-05-01');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Required.')).toBeInTheDocument();
    expect(screen.getByText('Letters, digits and . _ / - only.')).toBeInTheDocument();
    expect(screen.getByText('Departure cannot be before arrival.')).toBeInTheDocument();
    expect(saved.calls).toHaveLength(0);
  });

  it("shows the server's complaint next to the Crew ID when it is already taken", async () => {
    asTenantAdmin();
    profileApi([
      http.patch(`${V1}/tenant/crew/c1`, () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Unprocessable',
            status: 422,
            code: 'validation',
            detail: 'The given data was invalid.',
            errors: { crew_number: ['The crew number has already been taken.'] },
          },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    ]);
    const { user } = renderApp('/app/crew/c1');
    await screen.findByRole('heading', { name: 'Jaycob Bustamante' });
    await user.type(screen.getByLabelText('Crew ID'), '1');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('The crew number has already been taken.')).toBeInTheDocument();
  });

  it('sends a reset link only after confirming, and never shows a password', async () => {
    asTenantAdmin();
    const sent = capture<unknown>();
    profileApi([
      http.post(`${V1}/tenant/crew/c1/password-reset`, async ({ request }) => {
        await sent.record(request);
        return HttpResponse.json({ data: { status: 'sent' } }, { status: 202 });
      }),
    ]);
    const { user } = renderApp('/app/crew/c1');
    await user.click(await screen.findByRole('button', { name: 'Reset password' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(sent.calls).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Send link' }));

    await waitFor(() => expect(sent.calls).toHaveLength(1));
    expect(await screen.findByText(/reset link was emailed/)).toBeInTheDocument();
  });

  it('does not offer a reset for a member who is not active', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant/crew/c1`, () =>
        HttpResponse.json({ data: { ...JAYCOB, status: 'suspended' } }),
      ),
      http.get(`${V1}/tenant/todos`, () => HttpResponse.json(pageOf([]))),
    );
    renderApp('/app/crew/c1?tab=todos');
    expect(await screen.findByRole('button', { name: 'Reset password' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add task' })).toBeDisabled();
  });

  it('adds a task for this member, and deletes one after confirming', async () => {
    asTenantAdmin();
    const created = capture<Record<string, unknown>>();
    const removed = capture<unknown>();
    profileApi([
      http.post(`${V1}/tenant/todos`, async ({ request }) => {
        await created.record(request);
        return HttpResponse.json({ data: [task] }, { status: 201 });
      }),
      http.delete(`${V1}/tenant/todos/t1`, async ({ request }) => {
        await removed.record(request);
        return new HttpResponse(null, { status: 204 });
      }),
    ]);
    const { user } = renderApp('/app/crew/c1?tab=todos');
    await user.click(await screen.findByRole('button', { name: 'Add task' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Task name'), 'Sign the form');
    await user.type(within(dialog).getByLabelText('Due date (optional)'), '2030-05-06');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(created.calls).toHaveLength(1));
    expect(created.calls[0]!.body).toEqual({
      description: 'Sign the form',
      due_date: '2030-05-06',
      membership_ids: ['c1'],
    });

    await user.click(await screen.findByRole('button', { name: 'Delete Renew your passport' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(removed.calls).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(removed.calls).toHaveLength(1));
  });

  it('lists the kinds of documents with their state, and the checklist of what was asked for', async () => {
    asTenantAdmin();
    profileApi();
    renderApp('/app/crew/c1?tab=documents');

    await screen.findByText('SB-1'); // the placeholder is the same table, so wait for a real row
    const table = within(screen.getByRole('table', { name: 'Documents to assign' }));
    expect(table.getByText('Expiring')).toBeInTheDocument();
    expect(table.getByText('Valid')).toBeInTheDocument();
    expect(table.getByText('Not submitted')).toBeInTheDocument();
    expect(table.getByText('SB-1')).toBeInTheDocument();
    const checklist = within(screen.getByLabelText('Document checklist'));
    expect(checklist.getByText("Seaman's Book")).toBeInTheDocument();
    expect(checklist.queryByText('US Visa')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: "Ask for Seaman's Book" })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Ask for US Visa' })).not.toBeChecked();
  });

  it('filters the documents by name and by status', async () => {
    asTenantAdmin();
    profileApi();
    const { user } = renderApp('/app/crew/c1?tab=documents');
    await screen.findByText("Seaman's Book", { selector: 'td' }); // a real row, not the placeholder table

    await user.type(screen.getByLabelText('Document name'), 'visa');
    expect(screen.queryByText("Seaman's Book", { selector: 'td' })).not.toBeInTheDocument();
    expect(screen.getByText('US Visa', { selector: 'td' })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Document name'));
    await user.selectOptions(screen.getByLabelText('Status'), 'missing');
    expect(screen.getByText('Panama Booklet', { selector: 'td' })).toBeInTheDocument();
    expect(screen.queryByText('US Visa', { selector: 'td' })).not.toBeInTheDocument();
  });

  it('asks for a document when ticked and takes the request back when unticked', async () => {
    asTenantAdmin();
    const asked = capture<unknown>();
    const withdrawn = capture<unknown>();
    profileApi([
      http.put(
        `${V1}/tenant/crew/c1/document-requests/dt2`,
        async ({ request }) => (
          await asked.record(request),
          HttpResponse.json({ data: { requested: true } }, { status: 201 })
        ),
      ),
      http.delete(
        `${V1}/tenant/crew/c1/document-requests/dt1`,
        async ({ request }) => (
          await withdrawn.record(request),
          new HttpResponse(null, { status: 204 })
        ),
      ),
    ]);
    const { user } = renderApp('/app/crew/c1?tab=documents');

    await user.click(await screen.findByRole('checkbox', { name: 'Ask for US Visa' }));
    await waitFor(() => expect(asked.calls).toHaveLength(1));
    await user.click(screen.getByRole('checkbox', { name: "Ask for Seaman's Book" }));
    await waitFor(() => expect(withdrawn.calls).toHaveLength(1));
  });

  it('cannot ask a member who is not active', async () => {
    asTenantAdmin();
    profileApi([
      http.get(`${V1}/tenant/crew/c1`, () =>
        HttpResponse.json({ data: { ...JAYCOB, status: 'suspended' } }),
      ),
    ]);
    renderApp('/app/crew/c1?tab=documents');
    expect(await screen.findByRole('checkbox', { name: 'Ask for US Visa' })).toBeDisabled();
  });

  it('shows the uploads waiting for review with a count and a link to review them', async () => {
    asTenantAdmin();
    const urls: URL[] = [];
    const pending = {
      id: 'd7',
      status: 'pending',
      type: { id: 'dt1', name: "Seaman's Book", short_name: null },
      number: 'SB-2',
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
      owner: { id: 'c1', user: { id: 'u1', username: 'user-c1', email: 'c1@example.test' } },
    };
    profileApi([
      http.get(
        `${V1}/tenant/documents`,
        ({ request }) => (urls.push(new URL(request.url)), HttpResponse.json(pageOf([pending]))),
      ),
    ]);
    renderApp('/app/crew/c1?tab=documents');

    const heading = await screen.findByRole('heading', { name: /Document upload requests/ });
    expect(await within(heading).findByText('1')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: "Review Seaman's Book" })).toHaveAttribute(
      'href',
      '/app/documents?member=c1',
    );
    expect(urls[0]?.searchParams.get('membership_id')).toBe('c1');
    expect(urls[0]?.searchParams.get('status')).toBe('pending');
  });

  it('says so when nothing is waiting for review', async () => {
    asTenantAdmin();
    profileApi();
    renderApp('/app/crew/c1?tab=documents');
    expect(await screen.findByText('Nothing waiting for review')).toBeInTheDocument();
  });

  it('says plainly when the member cannot be found', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant/crew/c9`, () => problem(404, 'not_found', 'Crew member not found.')),
    );
    renderApp('/app/crew/c9');
    expect(await screen.findByText('That item no longer exists.')).toBeInTheDocument();
  });
});

describe('Documents page for one member', () => {
  it('narrows the list to the member named in the address', async () => {
    asTenantAdmin();
    const urls: URL[] = [];
    server.use(
      http.get(
        `${V1}/tenant/documents`,
        ({ request }) => (urls.push(new URL(request.url)), HttpResponse.json(pageOf([]))),
      ),
    );
    renderApp('/app/documents?member=c1');

    expect(await screen.findByText(/Showing one member/)).toBeInTheDocument();
    expect(urls[0]?.searchParams.get('membership_id')).toBe('c1');
    expect(screen.getByRole('link', { name: 'Show everyone' })).toHaveAttribute(
      'href',
      '/app/documents',
    );
  });
});
