import { fireEvent, screen } from '@testing-library/react-native';
import { makeMe } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

const doc = (
  id: string,
  name: string,
  status: string,
  expiry: string,
  over: Record<string, unknown> = {},
) => ({
  id,
  status,
  type: { id: `t-${id}`, name, short_name: null },
  number: `N-${id}`,
  grade: null,
  location: 'Manila',
  school: null,
  issued_on: '2024-01-01',
  expires_on: expiry === 'none' ? null : '2030-01-01',
  expiry_status: expiry,
  rejection_reason: null,
  file: { name: `${id}.pdf`, type: 'application/pdf', size: 1000 },
  submitted_at: new Date().toISOString(),
  reviewed_at: null,
  ...over,
});
const list = (items: unknown[], counts = { expired: 0, expiring: 0 }) => ({
  data: { data: items, counts },
});

async function openFiles(routes: Record<string, unknown>) {
  const api = mockApi({ ...routes } as never);
  signedInAs(makeMe({ modules: [] }));
  await renderApp();
  await fireEvent.press(await screen.findByLabelText(/^Files/));
  return api;
}

describe('files list', () => {
  it('shows each approved document with the server-computed expiry state, and a warning count', async () => {
    await openFiles({
      'GET /documents': (call: { params?: Record<string, unknown> }) =>
        call.params?.status === 'review'
          ? list([])
          : list(
              [
                doc('a', 'Medical Certificate', 'approved', 'expired'),
                doc('b', 'Passport', 'approved', 'valid'),
                doc('c', "Seaman's Book", 'approved', 'expiring'),
              ],
              { expired: 1, expiring: 1 },
            ),
    });
    expect(
      await screen.findByRole('button', { name: 'Medical Certificate, Expired' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Passport, Valid' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "Seaman's Book, Expiring soon" })).toBeTruthy();
    expect(screen.getByText('Check your documents: 1 expired, 1 expiring soon.')).toBeTruthy();
  });

  it('shows what is waiting, and why a document was sent back', async () => {
    await openFiles({
      'GET /documents': (call: { params?: Record<string, unknown> }) =>
        call.params?.status === 'review'
          ? list([
              doc('p', 'Yellow Fever', 'pending', 'none'),
              doc('r', 'COC', 'rejected', 'valid', { rejection_reason: 'Scan is cut off' }),
            ])
          : list([]),
    });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Pending' }));
    expect(
      await screen.findByRole('button', { name: 'Yellow Fever, Waiting for review' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'COC, Sent back' })).toBeTruthy();
    expect(screen.getByText('Scan is cut off')).toBeTruthy();
  });

  it('says so when there is nothing, and offers a retry on a failure', async () => {
    await openFiles({ 'GET /documents': list([]) });
    expect(await screen.findByText('No documents yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a document' })).toBeTruthy();
  });

  it('offers a retry when the list cannot load', async () => {
    await openFiles({ 'GET /documents': problem(500, 'server_error') });
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});

describe('document detail', () => {
  async function openDoc(d: unknown) {
    const api = await openFiles({
      'GET /documents': list([d]),
      'GET /documents/x': { data: { data: d } },
    });
    await fireEvent.press(await screen.findByRole('button', { name: /^Medical/ }));
    return api;
  }

  it('lets the owner fix and send again a document that was sent back', async () => {
    await openDoc(doc('x', 'Medical', 'rejected', 'valid', { rejection_reason: 'Blurry photo' }));
    expect(await screen.findByText('Your agency sent this back: Blurry photo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fix and send again' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View file' })).toBeTruthy();
  });

  it('does not offer to edit an approved document', async () => {
    await openDoc(doc('x', 'Medical', 'approved', 'valid'));
    expect(await screen.findByText(/An approved document cannot be changed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /send again/i })).toBeNull();
  });

  it('says plainly when it is no longer there', async () => {
    await openFiles({
      'GET /documents': list([doc('x', 'Medical', 'approved', 'valid')]),
      'GET /documents/x': problem(404, 'not_found'),
    });
    await fireEvent.press(await screen.findByRole('button', { name: /^Medical/ }));
    expect(await screen.findByText('This document is no longer available.')).toBeTruthy();
  });
});

describe('add a document', () => {
  it('does not send without a kind of document and a file', async () => {
    const api = await openFiles({
      'GET /documents': list([]),
      'GET /document-types': { data: { data: [{ id: 't1', name: 'Passport', short_name: null }] } },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add a document' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Send for approval' }));
    expect(await screen.findByText('Choose the kind of document.')).toBeTruthy();
    expect(screen.getByText('Choose the file or photo of the document.')).toBeTruthy();
    expect(api.callsTo('POST /documents')).toHaveLength(0);
  });

  it('refuses a date that is not a real day, or an expiry before the issue date', async () => {
    const api = await openFiles({
      'GET /documents': list([]),
      'GET /document-types': { data: { data: [{ id: 't1', name: 'Passport', short_name: null }] } },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add a document' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Passport' }));
    await fireEvent.changeText(screen.getByLabelText('Issued (YYYY-MM-DD)'), '2024-02-30');
    await fireEvent.press(screen.getByRole('button', { name: 'Send for approval' }));
    expect((await screen.findAllByText(/Use the format YYYY-MM-DD/)).length).toBeGreaterThan(0);

    await fireEvent.changeText(screen.getByLabelText('Issued (YYYY-MM-DD)'), '2024-05-01');
    await fireEvent.changeText(screen.getByLabelText('Expires (YYYY-MM-DD)'), '2024-04-01');
    await fireEvent.press(screen.getByRole('button', { name: 'Send for approval' }));
    expect(
      await screen.findByText('The expiry date cannot be before the issue date.'),
    ).toBeTruthy();
    expect(api.callsTo('POST /documents')).toHaveLength(0);
  });
});
