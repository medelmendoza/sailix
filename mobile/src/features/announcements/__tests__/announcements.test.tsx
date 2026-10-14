import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { makeMe } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { dashboardReady, goToTab } from '@/test-utils/steps';

const ann = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id,
  title,
  body: `Body of ${title}`,
  is_active: true,
  expires_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_read: false,
  ...over,
});
const page = (items: unknown[], unread = items.length, over: Record<string, unknown> = {}) => ({
  data: {
    data: items,
    links: {},
    meta: { current_page: 1, per_page: 20, total: items.length, last_page: 1 },
    unread_count: unread,
    ...over,
  },
});

async function openTab(routes: Record<string, unknown>) {
  const api = mockApi({ 'GET /announcements': page([]), ...routes } as never);
  signedInAs(makeMe({ modules: [] }));
  await renderApp();
  return api;
}

describe('announcements list', () => {
  it('shows each announcement with its title, a preview and how long ago, and marks the unread ones', async () => {
    await openTab({
      'GET /announcements': page([
        ann('a1', 'Drill on Friday'),
        ann('a2', 'Old news', {
          is_read: true,
          created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        }),
      ]),
    });
    await goToTab('Announcements');

    expect(
      await screen.findByRole('button', { name: /^Unread: Drill on Friday, Today/ }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Old news, 3 days ago/ })).toBeTruthy(); // read: no "Unread" prefix
    expect(screen.getAllByText('Body of Drill on Friday').length).toBeGreaterThan(0);
  });

  it('shows the unread count on the tab', async () => {
    await openTab({ 'GET /announcements': page([ann('a1', 'One'), ann('a2', 'Two')]) });
    expect(await screen.findByText('2')).toBeTruthy();
  });

  it('says so when there are none', async () => {
    await openTab({});
    await goToTab('Announcements');
    expect(await screen.findByText('No announcements')).toBeTruthy();
  });

  it('offers a retry when it cannot load', async () => {
    await openTab({ 'GET /announcements': problem(500, 'server_error') });
    await goToTab('Announcements');
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('loads the next page on request', async () => {
    const api = await openTab({
      'GET /announcements': (call: { params?: Record<string, unknown> }) => {
        const n = Number(call.params?.page ?? 1);
        const p = page([ann(`a${n}`, `Item ${n}`)], 2);
        p.data.meta = { current_page: n, per_page: 1, total: 2, last_page: 2 };
        return p;
      },
    });
    await goToTab('Announcements');
    await fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('button', { name: /Item 2/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Item 1/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull(); // no further page
    expect(api.callsTo('GET /announcements').some((c) => c.params?.page === 2)).toBe(true);
  });
});

describe('announcement detail', () => {
  it('shows the full text as plain text and marks it read once', async () => {
    const api = await openTab({
      'GET /announcements': page([ann('a1', 'Drill on Friday <b>now</b>')]),
      'GET /announcements/a1': { data: { data: ann('a1', 'Drill on Friday <b>now</b>') } },
      'PUT /announcements/a1/read': { data: { data: ann('a1', 'x', { is_read: true }) } },
    });
    await goToTab('Announcements');
    await fireEvent.press(await screen.findByRole('button', { name: /^Unread: Drill on Friday/ }));

    expect(await screen.findByText('Body of Drill on Friday <b>now</b>')).toBeTruthy(); // not interpreted
    await waitFor(() => expect(api.callsTo('PUT /announcements/a1/read')).toHaveLength(1));
  });

  it('does not mark an already-read announcement again', async () => {
    const api = await openTab({
      'GET /announcements': page([ann('a1', 'Seen', { is_read: true })], 0),
      'GET /announcements/a1': { data: { data: ann('a1', 'Seen', { is_read: true }) } },
    });
    await goToTab('Announcements');
    await fireEvent.press(await screen.findByRole('button', { name: /^Seen/ }));
    expect(await screen.findByText('Body of Seen')).toBeTruthy();
    expect(api.callsTo('PUT /announcements/a1/read')).toHaveLength(0);
  });

  it('says plainly when it is no longer available, with no retry loop', async () => {
    await openTab({
      'GET /announcements': page([ann('a1', 'Gone soon')]),
      'GET /announcements/a1': problem(404, 'not_found'),
    });
    await goToTab('Announcements');
    await fireEvent.press(await screen.findByRole('button', { name: /^Unread: Gone soon/ }));
    expect(await screen.findByText('This announcement is no longer available.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('still lets the person read when marking it read fails', async () => {
    await openTab({
      'GET /announcements': page([ann('a1', 'Notice')]),
      'GET /announcements/a1': { data: { data: ann('a1', 'Notice') } },
      'PUT /announcements/a1/read': problem(500, 'server_error'),
    });
    await goToTab('Announcements');
    await fireEvent.press(await screen.findByRole('button', { name: /^Unread: Notice/ }));
    expect(await screen.findByText('Body of Notice')).toBeTruthy();
  });
});

describe('home announcements card', () => {
  it('shows the latest three with a new-count and a bell that opens the tab', async () => {
    await openTab({
      'GET /announcements': page(
        [ann('a1', 'A'), ann('a2', 'B'), ann('a3', 'C'), ann('a4', 'D')],
        4,
      ),
    });
    expect(await screen.findByText('4 new')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Announcements' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Unread: D/ })).toBeNull(); // only the latest three
    await fireEvent.press(screen.getByRole('button', { name: 'Open announcements' }));
    expect(await screen.findByRole('button', { name: /^Unread: A/ })).toBeTruthy();
  });

  it('says there are none yet instead of hiding the card', async () => {
    await openTab({});
    await dashboardReady();
    expect(await screen.findByText('No announcements yet.')).toBeTruthy();
  });
});
