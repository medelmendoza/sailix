import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import {
  asCrew,
  asTenantAdmin,
  capture,
  makeMe,
  pageOf,
  pickDate,
  problem,
  renderApp,
  V1,
} from '../../../tests/helpers';
import { server } from '../../../tests/server';

const note = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id,
  title,
  body: 'Muster at 10:00.',
  is_active: true,
  expires_at: null,
  created_at: '2026-10-18T08:00:00+00:00',
  updated_at: '2026-10-18T08:00:00+00:00',
  is_read: false,
  attachment: null,
  ...over,
});

const todo = (id: string, description: string, over: Record<string, unknown> = {}) => ({
  id,
  description,
  due_date: '2030-01-01',
  is_done: false,
  done_at: null,
  created_at: '2026-10-01T08:00:00+00:00',
  ...over,
});

const doc = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  status: 'approved',
  type: { id: 'dt1', name: "Seaman's Book", short_name: null },
  number: 'SB-1',
  grade: null,
  location: 'MANILA',
  school: null,
  issued_on: '2020-01-01',
  expires_on: '2026-11-01',
  expiry_status: 'expiring',
  rejection_reason: null,
  file: { name: 'a.pdf', type: 'application/pdf', size: 2048 },
  submitted_at: '2026-10-19T08:00:00+00:00',
  reviewed_at: null,
  ...over,
});

function portalApi(extra: Parameters<typeof server.use> = []) {
  server.use(
    ...extra,
    http.get(`${V1}/announcements`, () =>
      HttpResponse.json({
        ...pageOf([
          note('a1', 'February allotment is out'),
          note('a2', 'Training', { is_read: true }),
        ]),
        unread_count: 1,
      }),
    ),
    http.get(`${V1}/todos`, () =>
      HttpResponse.json({
        ...pageOf([todo('t1', 'Renew your passport', { due_date: '2020-01-01' })]),
        open_count: 1,
        overdue_count: 1,
      }),
    ),
    http.get(`${V1}/documents`, () =>
      HttpResponse.json({ data: [doc('d1')], counts: { expired: 0, expiring: 1 } }),
    ),
    http.get(`${V1}/document-requests`, () =>
      HttpResponse.json({
        data: [{ type: { id: 'dt2', name: 'US Visa', short_name: null }, requested_at: null }],
      }),
    ),
    http.get(`${V1}/document-types`, () =>
      HttpResponse.json({
        data: [
          { id: 'dt1', name: "Seaman's Book", short_name: null },
          { id: 'dt2', name: 'US Visa', short_name: null },
        ],
      }),
    ),
  );
}

describe('Client portal: getting in', () => {
  it('has its own crew sign-in page', async () => {
    server.use(http.get(`${V1}/me`, () => problem(401, 'unauthenticated')));
    renderApp('/portal/login');
    expect(await screen.findByRole('heading', { name: 'Crew sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Administrator\? Sign in here/ })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('sends a signed-out visitor of the portal to the crew sign-in', async () => {
    server.use(http.get(`${V1}/me`, () => problem(401, 'unauthenticated')));
    renderApp('/portal/files');
    expect(await screen.findByRole('heading', { name: 'Crew sign in' })).toBeInTheDocument();
  });

  it('sends a crew member who opens the admin portal to the client portal, and an administrator the other way', async () => {
    asCrew();
    portalApi();
    const crew = renderApp('/app');
    expect(await screen.findByRole('heading', { name: 'Welcome back, Maria' })).toBeInTheDocument();
    expect(crew.router.state.location.pathname).toBe('/portal');
    crew.unmount();

    asTenantAdmin(makeMe());
    server.use(
      http.get(`${V1}/tenant/dashboard`, () =>
        HttpResponse.json({ data: { deletion_requests: { open: 0 } } }),
      ),
    );
    const admin = renderApp('/portal');
    await waitFor(() => expect(admin.router.state.location.pathname).toBe('/app'));
  });
});

describe('Client portal: dashboard', () => {
  it('shows what is new, what is due and what is asked, and has no Services', async () => {
    asCrew();
    portalApi();
    renderApp('/portal');

    expect(await screen.findByRole('heading', { name: 'Welcome back, Maria' })).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(await main.findByRole('link', { name: /Unread announcements/ })).toHaveTextContent('1');
    expect(main.getByRole('link', { name: /Open to-dos/ })).toHaveTextContent('1 overdue');
    expect(main.getByRole('link', { name: /Documents to renew/ })).toHaveTextContent('1');
    expect(main.getByRole('link', { name: /Asked of you/ })).toHaveTextContent('1');
    expect(await main.findByText('February allotment is out')).toBeInTheDocument();
    expect(main.getByText('Renew your passport')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Services' })).not.toBeInTheDocument();
  });

  it('leaves out what the platform switched off for the organization', async () => {
    asCrew({ feature_access: { finance: false, todos: false } });
    portalApi();
    renderApp('/portal');

    await screen.findByRole('heading', { name: 'Welcome back, Maria' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: 'Finance' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'To-do list' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Files' })).toBeInTheDocument();
  });
});

describe('Client portal: announcements', () => {
  it('opens one, marks it read, and shows the unread ones', async () => {
    asCrew();
    const read = capture<unknown>();
    portalApi([
      http.put(`${V1}/announcements/a1/read`, async ({ request }) => {
        await read.record(request);
        return new HttpResponse(null, { status: 204 });
      }),
    ]);
    const { user } = renderApp('/portal/announcements');

    await user.click(await screen.findByRole('button', { name: 'Read February allotment is out' }));
    const dialog = await screen.findByRole('dialog', { name: 'February allotment is out' });
    expect(within(dialog).getByText('Muster at 10:00.')).toBeInTheDocument();
    await waitFor(() => expect(read.calls).toHaveLength(1));
  });
});

describe('Client portal: tables like the admin portal', () => {
  it('shows announcements and to-dos as tables with column headings and icon buttons', async () => {
    asCrew();
    portalApi();
    const { user } = renderApp('/portal/announcements');

    await screen.findByRole('button', { name: 'Read February allotment is out' }); // the data is here
    const table = screen.getByRole('table', { name: 'Announcements' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Title', 'Date', '']);
    expect(
      within(table).getByRole('button', { name: 'Read February allotment is out' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Showing 1-2 of 2/)).toBeInTheDocument(); // the same paging bar as the admin tables

    await user.click(screen.getByRole('link', { name: 'To-do list' }));
    await screen.findByRole('button', { name: 'Mark as done: Renew your passport' });
    const todos = screen.getByRole('table', { name: 'To-dos' });
    expect(
      within(todos)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Task', 'Due date', 'Status', '']);
    expect(within(todos).getByText('Overdue')).toBeInTheDocument();
  });

  it('searches the announcements by title on the server', async () => {
    asCrew();
    const asked: URL[] = [];
    portalApi([
      http.get(`${V1}/announcements`, ({ request }) => {
        asked.push(new URL(request.url));
        return HttpResponse.json({
          ...pageOf([note('a1', 'February allotment is out')]),
          unread_count: 0,
        });
      }),
    ]);
    const { user } = renderApp('/portal/announcements');
    await screen.findByText('February allotment is out');

    await user.type(screen.getByLabelText('Search announcements'), 'allot');
    await waitFor(() => expect(asked.at(-1)?.searchParams.get('filter[title]')).toBe('allot'));
    expect(asked.at(-1)?.searchParams.get('page')).toBe('1');
  });
});

describe('Client portal: files', () => {
  it('lists approved documents with their expiry, warns, and shows what is under review', async () => {
    asCrew();
    portalApi([
      http.get(`${V1}/documents`, ({ request }) =>
        new URL(request.url).searchParams.get('status') === 'review'
          ? HttpResponse.json({
              data: [
                doc('d2', {
                  status: 'rejected',
                  rejection_reason: 'Scan is blurry',
                  expiry_status: 'none',
                }),
              ],
              counts: { expired: 0, expiring: 0 },
            })
          : HttpResponse.json({ data: [doc('d1')], counts: { expired: 0, expiring: 1 } }),
      ),
    ]);
    const { user } = renderApp('/portal/files');

    expect(await screen.findByText("Seaman's Book")).toBeInTheDocument();
    expect(screen.getByText('Expiring soon')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 document expires soon.');
    expect(screen.getByText('US Visa')).toBeInTheDocument(); // what the organization asked for

    await user.selectOptions(screen.getByLabelText('Show'), 'review');
    expect(await screen.findByText('Sent back')).toBeInTheDocument();
    expect(screen.getByText('Scan is blurry')).toBeInTheDocument();
  });

  it('sends a document in with its file', async () => {
    asCrew();
    const sent = capture<unknown>();
    portalApi([
      http.post(`${V1}/documents`, async ({ request }) => {
        await sent.record(request);
        return HttpResponse.json({ data: doc('d9', { status: 'pending' }) }, { status: 201 });
      }),
    ]);
    const { user } = renderApp('/portal/files');

    await user.click(await screen.findByRole('button', { name: 'Add a document' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a document' });

    await user.click(within(dialog).getByRole('button', { name: 'Send in' }));
    expect(await within(dialog).findByText('Choose the kind of document.')).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('Kind of document'), 'dt2');
    await user.type(within(dialog).getByLabelText('Number'), 'V-9');
    await pickDate(user, within(dialog).getByLabelText('Date it expires'), '2031-01-01');
    await user.click(within(dialog).getByRole('button', { name: 'Send in' }));
    expect(await within(dialog).findByText('Choose the file.')).toBeInTheDocument();

    await user.upload(
      dialog.querySelector('input[type="file"]')!,
      new File(['%PDF-1.4'], 'visa.pdf', { type: 'application/pdf' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Send in' }));
    await waitFor(() => expect(sent.calls).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Client portal: to-dos', () => {
  it('shows the open tasks and ticks one off', async () => {
    asCrew();
    const patched = capture<Record<string, unknown>>();
    portalApi([
      http.patch(`${V1}/todos/t1`, async ({ request }) => {
        await patched.record(request);
        return HttpResponse.json({ data: todo('t1', 'Renew your passport', { is_done: true }) });
      }),
    ]);
    const { user } = renderApp('/portal/todos');

    expect(await screen.findByText('Renew your passport')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark as done: Renew your passport' }));
    await waitFor(() => expect(patched.calls).toHaveLength(1));
    expect(patched.calls[0]!.body).toEqual({ is_done: true });
  });
});

describe('Client portal: finance', () => {
  const slip = {
    id: 'p1',
    kind: 'regular',
    pay_date: '2026-10-15',
    period_label: 'October 2026',
    vessel_name: 'MV Aurora',
    net_amount: '1234.50',
    is_dollar: false,
  };

  it('asks for the password first, then shows the payslips and a payslip in full', async () => {
    asCrew();
    let unlocked = false;
    server.use(
      http.get(`${V1}/payslips`, () =>
        unlocked
          ? HttpResponse.json({ data: [slip] })
          : problem(403, 'step_up_required', 'Type your password.'),
      ),
      http.post(`${V1}/finance/unlock`, async () => {
        unlocked = true;
        return HttpResponse.json({
          data: { step_up: 'password', unlocked: true, unlock_seconds: 300 },
        });
      }),
      http.get(`${V1}/payslips/p1`, () =>
        HttpResponse.json({
          data: {
            ...slip,
            full_vessel_name: 'MV Aurora I',
            position: 'AB',
            deductions: [{ description: 'SSS', amount: '100.00' }],
            net_amount: '1234.50',
          },
        }),
      ),
    );
    const { user } = renderApp('/portal/finance');

    const unlock = await screen.findByRole('heading', { name: 'Type your password' });
    expect(unlock).toBeInTheDocument();
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText('October 2026')).toBeInTheDocument();
    expect(screen.getByText('₱1,234.50')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open the payslip of October 2026' }));
    const dialog = await screen.findByRole('dialog', { name: 'Payslip' });
    expect(await within(dialog).findByText('SSS')).toBeInTheDocument();
    expect(within(dialog).getByText('₱100.00')).toBeInTheDocument();
  });

  it('shows the cash advances with the balance owed', async () => {
    asCrew();
    server.use(
      http.get(`${V1}/loans`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'l1',
              code: 'CA-1',
              description: 'Emergency loan',
              loan_amount: '5000.00',
              deduct_amount: '500.00',
              paid_amount: '1500.00',
              balance: '3500.00',
              is_dollar: false,
              is_stopped: false,
            },
          ],
          totals: { php: '3500.00', usd: '0.00' },
        }),
      ),
      http.get(`${V1}/payslips`, () => HttpResponse.json({ data: [] })),
    );
    const { user } = renderApp('/portal/finance');

    await user.click(await screen.findByRole('tab', { name: 'Cash advance' }));
    expect(await screen.findByText('Emergency loan')).toBeInTheDocument();
    expect(screen.getByText('Deducting')).toBeInTheDocument();
    expect(screen.getByText(/Balance owed/)).toHaveTextContent('₱3,500.00');
  });
});

describe('Client portal: account', () => {
  it('shows who they are, changes the password, sends feedback and asks for deletion', async () => {
    asCrew();
    const changed = capture<Record<string, unknown>>();
    const feedback = capture<Record<string, unknown>>();
    const deletion = capture<unknown>();
    server.use(
      http.put(`${V1}/me/password`, async ({ request }) => {
        await changed.record(request);
        return new HttpResponse(null, { status: 204 });
      }),
      http.post(`${V1}/me/feedback`, async ({ request }) => {
        await feedback.record(request);
        return HttpResponse.json({ data: { id: 'f1' } }, { status: 201 });
      }),
      http.post(`${V1}/me/deletion-request`, async ({ request }) => {
        await deletion.record(request);
        return HttpResponse.json({ data: { id: 'r1', status: 'pending' } }, { status: 202 });
      }),
    );
    const { user } = renderApp('/portal/account');

    expect(await screen.findByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('10041')).toBeInTheDocument();
    expect(screen.getByText('Fleet A')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Current password'), 'old-pass-123');
    await user.type(screen.getByLabelText('New password'), 'Another-pass-456');
    await user.type(screen.getByLabelText('Repeat the new password'), 'Different-789');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText(/not the same/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Repeat the new password'));
    await user.type(screen.getByLabelText('Repeat the new password'), 'Another-pass-456');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(changed.calls).toHaveLength(1));
    expect(changed.calls[0]!.body).toEqual({
      current_password: 'old-pass-123',
      password: 'Another-pass-456',
      password_confirmation: 'Another-pass-456',
    });

    await user.type(screen.getByLabelText('Your message'), 'Please add dark mode');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(feedback.calls).toHaveLength(1));
    expect(feedback.calls[0]!.body).toEqual({ category: 'idea', message: 'Please add dark mode' });

    await user.click(screen.getByRole('button', { name: 'Request account deletion' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(deletion.calls).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: 'Send the request' }));
    await waitFor(() => expect(deletion.calls).toHaveLength(1));
  });
});
