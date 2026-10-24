import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { asTenantAdmin, capture, pageOf, renderApp, V1 } from '../../../tests/helpers';
import { server } from '../../../tests/server';

const note = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  title: 'February allotment is out',
  body: 'Good day!\nThe allotment has been released.',
  is_active: true,
  expires_at: null,
  created_at: '2026-10-18T08:00:00+00:00',
  updated_at: '2026-10-18T08:00:00+00:00',
  author: { name: 'Alex Admin' },
  fleets: [],
  attachment: null,
  ...over,
});

function api(
  rows: unknown[],
  fleets: string[] = ['Fleet B', 'Fleet C'],
  extra: Parameters<typeof server.use> = [],
) {
  server.use(
    ...extra,
    http.get(`${V1}/tenant/announcements`, () => HttpResponse.json(pageOf(rows))),
    http.get(`${V1}/tenant/crew/fleets`, () => HttpResponse.json({ data: fleets })),
  );
}

describe('Announcements: recipients', () => {
  it('shows who each announcement is for', async () => {
    asTenantAdmin();
    api([note(), note({ id: 'a2', title: 'Fleet news', fleets: ['Fleet B', 'Fleet C'] })]);
    renderApp('/app/announcements');
    await screen.findByText('Fleet news');
    expect(screen.getByText('Everyone')).toBeInTheDocument();
    expect(screen.getByText('Fleet B, Fleet C')).toBeInTheDocument();
  });

  it('sends the chosen fleets, and everyone when none is chosen', async () => {
    asTenantAdmin();
    const created = capture<Record<string, unknown>>();
    api(
      [],
      ['Fleet B', 'Fleet C'],
      [
        http.post(
          `${V1}/tenant/announcements`,
          async ({ request }) => (
            await created.record(request),
            HttpResponse.json({ data: note({ fleets: ['Fleet C'] }) }, { status: 201 })
          ),
        ),
      ],
    );
    const { user } = renderApp('/app/announcements');
    await user.click(await screen.findByRole('button', { name: 'New announcement' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: 'Everyone' })).toBeChecked();
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Fleet C' }));
    expect(within(dialog).getByRole('radio', { name: 'Everyone' })).not.toBeChecked();
    await user.type(within(dialog).getByLabelText('Title'), 'Hello');
    await user.type(within(dialog).getByLabelText('Message'), 'Welcome.');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(created.calls).toHaveLength(1));
    expect((created.calls[0]!.body as { fleets: string[] }).fleets).toEqual(['Fleet C']);
  });

  it('choosing Everyone again clears the fleets', async () => {
    asTenantAdmin();
    const patched = capture<Record<string, unknown>>();
    api(
      [note({ fleets: ['Fleet B'] })],
      ['Fleet B', 'Fleet C'],
      [
        http.patch(
          `${V1}/tenant/announcements/a1`,
          async ({ request }) => (
            await patched.record(request),
            HttpResponse.json({ data: note() })
          ),
        ),
      ],
    );
    const { user } = renderApp('/app/announcements');
    await user.click(await screen.findByRole('button', { name: /^Edit February/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('checkbox', { name: 'Fleet B' })).toBeChecked();
    await user.click(within(dialog).getByRole('radio', { name: 'Everyone' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(patched.calls).toHaveLength(1));
    expect((patched.calls[0]!.body as { fleets: string[] }).fleets).toEqual([]);
  });

  it('says so when no fleets are recorded yet, and keeps a fleet already on the announcement choosable', async () => {
    asTenantAdmin();
    api([note({ fleets: ['Old fleet'] })], []);
    const { user } = renderApp('/app/announcements');
    await user.click(await screen.findByRole('button', { name: /^Edit February/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('checkbox', { name: 'Old fleet' })).toBeChecked(); // not dropped just because no crew uses it now
  });

  it('shows the author, read-only, as the signed-in administrator', async () => {
    asTenantAdmin();
    api([]);
    const { user } = renderApp('/app/announcements');
    await user.click(await screen.findByRole('button', { name: 'New announcement' }));
    const author = within(await screen.findByRole('dialog')).getByLabelText('Author');
    expect(author).toBeDisabled();
    expect((author as HTMLInputElement).value.length).toBeGreaterThan(0);
  });
});

describe('Announcements: attached file', () => {
  const pdf = () => new File(['%PDF-1.4'], 'allotment.pdf', { type: 'application/pdf' });

  it('uploads the chosen file after saving the announcement', async () => {
    asTenantAdmin();
    const uploaded = capture<unknown>();
    api(
      [],
      [],
      [
        http.post(`${V1}/tenant/announcements`, () =>
          HttpResponse.json({ data: note() }, { status: 201 }),
        ),
        http.post(
          `${V1}/tenant/announcements/a1/attachment`,
          async ({ request }) => (
            await uploaded.record(request),
            HttpResponse.json({ data: note() })
          ),
        ),
      ],
    );
    const { user } = renderApp('/app/announcements');
    await user.click(await screen.findByRole('button', { name: 'New announcement' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'With file');
    await user.type(within(dialog).getByLabelText('Message'), 'See attached.');
    await user.upload(within(dialog).getByLabelText(/Attached file/), pdf());
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(uploaded.calls).toHaveLength(1));
  });

  it('keeps the announcement and says so when only the file fails', async () => {
    asTenantAdmin();
    api(
      [],
      [],
      [
        http.post(`${V1}/tenant/announcements`, () =>
          HttpResponse.json({ data: note() }, { status: 201 }),
        ),
        http.post(`${V1}/tenant/announcements/a1/attachment`, () =>
          HttpResponse.json(
            {
              type: 'about:blank',
              title: 'Unprocessable',
              status: 422,
              code: 'validation',
              detail: 'Unsupported file type.',
            },
            { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        ),
      ],
    );
    const { user } = renderApp('/app/announcements');
    await user.click(await screen.findByRole('button', { name: 'New announcement' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'With file');
    await user.type(within(dialog).getByLabelText('Message'), 'See attached.');
    await user.upload(within(dialog).getByLabelText(/Attached file/), pdf());
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));

    expect(
      await within(dialog).findByText(/The announcement was saved, but its file was not/),
    ).toBeInTheDocument();
  });

  it('removes the current file when asked', async () => {
    asTenantAdmin();
    const removed = capture<unknown>();
    api(
      [note({ attachment: { name: 'old.pdf', type: 'application/pdf', size: 2048 } })],
      [],
      [
        http.patch(`${V1}/tenant/announcements/a1`, () => HttpResponse.json({ data: note() })),
        http.delete(
          `${V1}/tenant/announcements/a1/attachment`,
          async ({ request }) => (
            await removed.record(request),
            new HttpResponse(null, { status: 204 })
          ),
        ),
      ],
    );
    const { user } = renderApp('/app/announcements');
    await user.click(await screen.findByRole('button', { name: /^Edit February/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('old.pdf')).toBeInTheDocument();
    expect(within(dialog).getByText(/Current file · 2 KB/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remove the current file' }));
    expect(within(dialog).getByText(/The current file will be removed/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(removed.calls).toHaveLength(1));
  });
});

describe('Announcement details', () => {
  it('shows recipients, author, date, message and the file, read-only', async () => {
    asTenantAdmin();
    api([
      note({
        fleets: ['Fleet B'],
        attachment: { name: 'allotment.pdf', type: 'application/pdf', size: 3 * 1024 * 1024 },
      }),
    ]);
    const { user } = renderApp('/app/announcements');
    await user.click(await screen.findByRole('button', { name: /^View February/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Announcement details' });

    expect(within(dialog).getByText('Fleet B')).toBeInTheDocument();
    expect(within(dialog).getByText('Alex Admin')).toBeInTheDocument();
    expect(within(dialog).getByText('February allotment is out')).toBeInTheDocument();
    expect(within(dialog).getByText(/The allotment has been released/)).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /Open allotment.pdf \(3.0 MB\)/ }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('opens the file from the server when asked', async () => {
    asTenantAdmin();
    const fetched = capture<unknown>();
    api(
      [note({ attachment: { name: 'a.pdf', type: 'application/pdf', size: 10 } })],
      [],
      [
        http.get(
          `${V1}/tenant/announcements/a1/file`,
          async ({ request }) => (
            await fetched.record(request),
            new HttpResponse('%PDF', { headers: { 'Content-Type': 'application/pdf' } })
          ),
        ),
      ],
    );
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => undefined;
    window.open = () => null;
    const { user } = renderApp('/app/announcements');
    await user.click(await screen.findByRole('button', { name: /^View February/ }));
    await user.click(await screen.findByRole('button', { name: /^Open a.pdf/ }));
    await waitFor(() => expect(fetched.calls).toHaveLength(1));
  });

  it('shows "—" when there is no file, and is the same view from the dashboard', async () => {
    asTenantAdmin();
    server.use(
      http.get(`${V1}/tenant/announcements`, () => HttpResponse.json(pageOf([note()]))),
      http.get(`${V1}/tenant/crew`, () => HttpResponse.json(pageOf([]))),
      http.get(`${V1}/tenant/documents`, () => HttpResponse.json(pageOf([]))),
      http.get(`${V1}/tenant/deletion-requests`, () => HttpResponse.json(pageOf([]))),
      http.get(`${V1}/tenant/audit-logs`, () => HttpResponse.json(pageOf([]))),
      http.get(`${V1}/tenant/dashboard`, () =>
        HttpResponse.json({
          data: {
            crew: { total: 0, pending: pageOf([]) },
            documents: { pending: pageOf([]) },
            announcements: { latest: pageOf([note()]) },
            deletion_requests: { open: 0 },
          },
        }),
      ),
    );
    const { user } = renderApp('/app');
    await user.click(await screen.findByRole('button', { name: /^View February/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Announcement details' });
    expect(within(dialog).getByText('Everyone')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Open / })).not.toBeInTheDocument();
  });
});

describe('Announcements: search and server-side paging', () => {
  it('searches by title on the server and pages with Previous and Next', async () => {
    asTenantAdmin();
    const asked: URL[] = [];
    server.use(
      http.get(`${V1}/tenant/announcements`, ({ request }) => {
        const url = new URL(request.url);
        asked.push(url);
        const page = Number(url.searchParams.get('page') ?? 1);
        return HttpResponse.json(
          pageOf([note({ id: `a${page}`, title: `Notice ${page}` })], {
            current_page: page,
            per_page: 1,
            total: 2,
            last_page: 2,
          }),
        );
      }),
    );
    const { user } = renderApp('/app/announcements');

    expect(await screen.findByText('Notice 1')).toBeInTheDocument();
    expect(screen.getByText('Showing 1-1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Notice 2')).toBeInTheDocument();
    expect(asked.at(-1)?.searchParams.get('page')).toBe('2');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.type(screen.getByLabelText('Search announcements'), 'allot');
    await waitFor(() => expect(asked.at(-1)?.searchParams.get('filter[title]')).toBe('allot'));
    expect(asked.at(-1)?.searchParams.get('page')).toBe('1'); // a new search starts from the first page
  });
});
