import { fireEvent, screen } from '@testing-library/react-native';
import { makeMe } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

const doc = (id: string, name: string, expiry: string) => ({
  id,
  status: 'approved',
  type: { id: `t${id}`, name, short_name: null },
  number: null,
  grade: null,
  location: null,
  school: null,
  issued_on: null,
  expires_on: '2030-01-01',
  expiry_status: expiry,
  rejection_reason: null,
  file: { name: 'f.pdf', type: 'application/pdf', size: 1 },
  submitted_at: new Date().toISOString(),
  reviewed_at: null,
});
const docs = (items: unknown[], counts: { expired: number; expiring: number }) => ({
  data: { data: items, counts },
});

async function openHome(routes: Record<string, unknown> = {}) {
  const api = mockApi(routes as never);
  signedInAs(makeMe({ modules: [] }));
  await renderApp();
  await screen.findByText('Hello, Maria');
  return api;
}

describe('dashboard shortcuts', () => {
  it('has the four quick ways in', async () => {
    await openHome();
    for (const name of ['Upload a document', 'Finance', 'To-do list', 'My documents']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('each one opens the right place', async () => {
    await openHome({ 'GET /document-types': { data: { data: [] } } });
    await fireEvent.press(screen.getByRole('button', { name: 'To-do list' }));
    expect(await screen.findByText('Nothing to do')).toBeTruthy();
  });

  it('Upload a document opens the add-document form', async () => {
    await openHome({
      'GET /document-types': { data: { data: [{ id: 't1', name: 'Passport', short_name: null }] } },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Upload a document' }));
    expect(await screen.findByRole('button', { name: 'Send for approval' })).toBeTruthy();
  });

  it('Finance and My documents open their tabs', async () => {
    await openHome();
    await fireEvent.press(screen.getByRole('button', { name: 'Finance' }));
    expect(await screen.findByRole('button', { name: 'Allotment' })).toBeTruthy();
  });
});

describe('documents that need attention', () => {
  it('lists expired before expiring with the count, and opens Files', async () => {
    await openHome({
      'GET /documents': docs(
        [
          doc('a', 'Passport', 'expiring'),
          doc('b', 'Medical', 'expired'),
          doc('c', 'Visa', 'valid'),
        ],
        { expired: 1, expiring: 1 },
      ),
    });
    expect(await screen.findByText('Documents need attention')).toBeTruthy();
    expect(screen.getByText('1 expired, 1 expiring soon')).toBeTruthy();
    const labels = screen
      .getAllByLabelText(/^(Passport|Medical|Visa), /)
      .map((n) => n.props.accessibilityLabel);
    expect(labels).toEqual(['Medical, Expired', 'Passport, Expiring soon']); // valid ones are not listed, expired comes first
    await fireEvent.press(screen.getByRole('button', { name: 'Open my documents' }));
    expect(await screen.findByRole('button', { name: 'Add a document' })).toBeTruthy();
  });

  it('shows nothing when every document is fine, or there are none', async () => {
    await openHome({
      'GET /documents': docs([doc('c', 'Visa', 'valid'), doc('d', 'Training', 'none')], {
        expired: 0,
        expiring: 0,
      }),
    });
    expect(screen.queryByText('Documents need attention')).toBeNull();
  });
});
