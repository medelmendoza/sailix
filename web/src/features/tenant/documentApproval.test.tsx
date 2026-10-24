import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { asTenantAdmin, capture, pageOf, renderApp, V1 } from '../../../tests/helpers';
import { server } from '../../../tests/server';

const doc = {
  id: 'd1',
  status: 'pending',
  type: { id: 'dt1', name: "Seaman's Book (Philippine)", short_name: 'sirb' },
  number: 'SB-2016-0412',
  grade: null,
  location: 'MANILA',
  school: 'MARITIME INDUSTRY AUTHORITY',
  issued_on: '2016-12-19',
  expires_on: '2026-12-17',
  expiry_status: 'valid',
  rejection_reason: null,
  file: { name: 'seamans-book.pdf', type: 'application/pdf', size: 2048 },
  submitted_at: '2026-10-19T08:00:00+00:00',
  reviewed_at: null,
  owner: {
    id: 'c1',
    user: { id: 'u1', username: 'ana.villanueva', email: 'ana@example.test' },
    profile: {
      first_name: 'Ana',
      last_name: 'Villanueva',
      crew_number: '10041',
      rank: '3rd Officer',
    },
  },
};

function api(extra: Parameters<typeof server.use> = []) {
  server.use(
    ...extra,
    http.get(`${V1}/tenant/documents`, () => HttpResponse.json(pageOf([doc], { total: 1 }))),
    http.get(`${V1}/tenant/crew`, () => HttpResponse.json(pageOf([]))),
    http.get(`${V1}/tenant/announcements`, () => HttpResponse.json(pageOf([]))),
    http.get(`${V1}/tenant/deletion-requests`, () => HttpResponse.json(pageOf([]))),
    http.get(`${V1}/tenant/dashboard`, () =>
      HttpResponse.json({
        data: {
          crew: { total: 0, pending: pageOf([]) },
          documents: { pending: pageOf([doc], { total: 1 }) },
          announcements: { latest: pageOf([]) },
          deletion_requests: { open: 0 },
        },
      }),
    ),
  );
}

const open = async (user: ReturnType<typeof renderApp>['user']) => {
  await user.click(
    await screen.findByRole('button', {
      name: "Review Seaman's Book (Philippine) of Villanueva, Ana",
    }),
  );
  return screen.findByRole('dialog', { name: 'Document Approval' });
};

describe('Document approval (from the dashboard panel)', () => {
  it('opens from the eye button with who sent it, what they entered and the file', async () => {
    asTenantAdmin();
    api();
    const { user } = renderApp('/app');
    const dialog = await open(user);

    expect(within(dialog).getByLabelText('Name of requestor')).toHaveValue('Ana Villanueva');
    expect(within(dialog).getByLabelText('Crew No.')).toHaveValue('10041');
    expect(within(dialog).getByLabelText('Rank')).toHaveValue('3rd Officer');
    expect(within(dialog).getByLabelText('Document short name')).toHaveValue('sirb');
    expect(within(dialog).getByLabelText('Document number')).toHaveValue('SB-2016-0412');
    expect(within(dialog).getByLabelText('Location')).toHaveValue('MANILA');
    expect(within(dialog).getByLabelText('Date issued')).toHaveTextContent('Dec 19, 2016');
    expect(within(dialog).getByLabelText('Date expired')).toHaveTextContent('Dec 17, 2026');
    expect(within(dialog).getByText('seamans-book.pdf')).toBeInTheDocument();
    expect(within(dialog).getByText('2 KB')).toBeInTheDocument();
  });

  it('Accept approves the document', async () => {
    asTenantAdmin();
    const approved = capture<unknown>();
    api([
      http.post(`${V1}/tenant/documents/d1/approve`, async ({ request }) => {
        await approved.record(request);
        return HttpResponse.json({ data: { ...doc, status: 'approved' } });
      }),
    ]);
    const { user } = renderApp('/app');
    const dialog = await open(user);

    await user.click(within(dialog).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(approved.calls).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Reject needs both comments, then sends them together as the reason', async () => {
    asTenantAdmin();
    const rejected = capture<Record<string, unknown>>();
    api([
      http.post(`${V1}/tenant/documents/d1/reject`, async ({ request }) => {
        await rejected.record(request);
        return HttpResponse.json({ data: { ...doc, status: 'rejected' } });
      }),
    ]);
    const { user } = renderApp('/app');
    const dialog = await open(user);

    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await within(dialog).findByText(/what to fix in the details/)).toBeInTheDocument();
    expect(within(dialog).getByText(/wrong with the uploaded file/)).toBeInTheDocument();
    expect(rejected.calls).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/Comment for document details/), 'Wrong grade');
    await user.type(
      within(dialog).getByLabelText(/Comment for uploaded document/),
      'Scan is blurry',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(rejected.calls).toHaveLength(1));
    expect(rejected.calls[0]!.body).toEqual({
      reason: 'Document details: Wrong grade\nUploaded document: Scan is blurry',
    });
  });

  it('searches the waiting documents by the sender name', async () => {
    asTenantAdmin();
    const asked: URL[] = [];
    api([
      http.get(`${V1}/tenant/documents`, ({ request }) => {
        asked.push(new URL(request.url));
        return HttpResponse.json(pageOf([doc], { total: 1 }));
      }),
    ]);
    const { user } = renderApp('/app');
    await open(user);
    await user.keyboard('{Escape}');

    const panel = screen.getByRole('region', { name: /Document approval/ });
    await user.type(within(panel).getByLabelText('Name'), ' ana ');
    await user.click(within(panel).getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(asked.some((u) => u.searchParams.get('filter[name]') === 'ana')).toBe(true),
    );
  });
});
