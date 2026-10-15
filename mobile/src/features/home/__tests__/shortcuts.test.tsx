import { fireEvent, screen } from '@testing-library/react-native';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { dashboardReady } from '@/test-utils/steps';

const docs = (counts: { expired: number; expiring: number }) => ({ data: { data: [], counts } });

async function openHome(
  routes: Record<string, unknown> = {},
  modules = [] as ReturnType<typeof TALA>[],
) {
  const api = mockApi(routes as never);
  signedInAs(makeMe({ modules }));
  await renderApp();
  await dashboardReady();
  return api;
}

describe('the dashboard, as in the original Sailix', () => {
  it('welcomes you by first name above the organization, in its own header', async () => {
    await openHome();
    expect(screen.getByText(/^Good (morning|afternoon|evening),$/)).toBeTruthy(); // by the phone's clock
    expect(screen.getByRole('header', { name: 'Maria' })).toBeTruthy();
    expect(screen.getByText('Southfield Agencies')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy(); // the Account button lives in the header
  });

  it('has four round shortcuts, and the To-do list and Documents counters on the Today card', async () => {
    await openHome();
    for (const name of ['Upload documents', 'Scan a document', 'View finances', 'Services'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^To-do list/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Documents/ })).toBeTruthy();
  });

  it('has nothing from a service on it, even when Tala is linked', async () => {
    const api = await openHome({ 'GET /modules/tala/courses': { data: { data: [] } } }, [
      TALA('linked'),
    ]);
    expect(screen.queryByText('My learning')).toBeNull();
    expect(screen.queryByText('My courses')).toBeNull();
    expect(api.callsTo('GET /modules/tala/courses')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Tala service' })).toBeNull(); // services live under the Services tab
  });

  it('shows your initials in the Account badge', async () => {
    await openHome();
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy();
    expect(screen.getByText('MS', { includeHiddenElements: true })).toBeTruthy(); // Maria Santos; the label "Account" speaks for it
  });
});

describe('where each shortcut goes', () => {
  it('Upload documents opens the add-document form', async () => {
    await openHome({
      'GET /document-types': { data: { data: [{ id: 't1', name: 'Passport', short_name: null }] } },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Upload documents' }));
    expect(await screen.findByRole('button', { name: 'Send for approval' })).toBeTruthy();
  });

  it('View finances opens the Finance tab', async () => {
    await openHome();
    await fireEvent.press(screen.getByRole('button', { name: 'View finances' }));
    expect(await screen.findByRole('button', { name: 'Allotment' })).toBeTruthy();
  });

  it('Services opens the Services tab', async () => {
    await openHome();
    await fireEvent.press(screen.getByRole('button', { name: 'Services' }));
    expect(await screen.findByLabelText('SRT, coming soon')).toBeTruthy();
  });

  it('the To-do list tile opens the to-do list', async () => {
    await openHome();
    await fireEvent.press(screen.getByRole('button', { name: /^To-do list/ }));
    expect(await screen.findByText('Nothing to do')).toBeTruthy();
  });

  it('the Documents tile opens Files', async () => {
    await openHome();
    await fireEvent.press(screen.getByRole('button', { name: /^Documents/ }));
    expect(await screen.findByRole('button', { name: 'Add a document' })).toBeTruthy();
  });

  it('the Account button opens Account', async () => {
    await openHome();
    await fireEvent.press(screen.getByRole('button', { name: 'Account' }));
    expect(await screen.findByText('Maria Santos')).toBeTruthy();
  });
});

describe('the Today card', () => {
  it('counts the new announcements and opens them', async () => {
    await openHome({
      'GET /announcements': {
        data: {
          data: [],
          links: {},
          meta: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
          unread_count: 2,
        },
      },
    });
    expect(await screen.findByRole('button', { name: 'Notices, 2 new' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Notices, 2 new' }));
    expect(await screen.findByText('Announcements')).toBeTruthy();
  });
});

describe('the scanner shortcut', () => {
  it('Scan a document opens the scanner', async () => {
    await openHome();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a document' }));
    expect(await screen.findByRole('button', { name: 'Make a PDF of the pages' })).toBeTruthy();
  });
});

describe('the Documents tile', () => {
  it('says how many documents are expired or expiring, so a problem is not buried in the Files tab', async () => {
    await openHome({ 'GET /documents': docs({ expired: 1, expiring: 2 }) });
    expect(
      await screen.findByRole('button', { name: 'Documents, 1 expired, 2 expiring soon' }),
    ).toBeTruthy();
  });

  it('says nothing extra when all documents are fine', async () => {
    await openHome({ 'GET /documents': docs({ expired: 0, expiring: 0 }) });
    expect(screen.getByRole('button', { name: 'Documents' })).toBeTruthy();
  });
});
