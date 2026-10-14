import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { CALLIT, makeMe } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { goToTab, openService } from '@/test-utils/steps';

const report = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  id,
  status,
  classification: 'unsafe_acts',
  sub_classification: 'people',
  location: 'main_deck',
  location_other: null,
  vessel: 'MV Test',
  details: 'Saw <b>no guard</b>',
  intervened: false,
  intervention_details: null,
  official_report: false,
  file: null,
  submitted_at: status === 'draft' ? null : new Date().toISOString(),
  reviewed_at: null,
  created_at: new Date().toISOString(),
  ...over,
});
const stats = (n = 0, badges: unknown[] = [], next: number | null = 1) => ({
  data: { data: { reports_made: n, badges, next_badge: next } },
});
const list = (items: unknown[]) => ({
  data: {
    data: items,
    links: {},
    meta: { current_page: 1, per_page: 100, total: items.length, last_page: 1 },
  },
});

async function openCallIt(routes: Record<string, unknown>) {
  const api = mockApi({
    'GET /callit/stats': stats(),
    'GET /callit/reports': list([]),
    ...routes,
  } as never);
  signedInAs(makeMe({ modules: [CALLIT()] }));
  await renderApp();
  await openService('Call-it, Available');
  return api;
}

describe('call-it in services', () => {
  it('is a coming-soon placeholder for an organization without the module, and openable with it', async () => {
    mockApi({});
    signedInAs(makeMe({ modules: [] }));
    await renderApp();
    await goToTab('Services');
    expect(await screen.findByLabelText('Call-it, coming soon')).toBeTruthy();
  });
});

describe('call-it dashboard', () => {
  it('shows the reports made and the medals earned, and what the next medal is', async () => {
    await openCallIt({
      'GET /callit/stats': stats(
        12,
        [
          { reports: 1, label: 'First report' },
          { reports: 10, label: '10 reports made' },
        ],
        50,
      ),
    });
    expect(await screen.findByLabelText('12 reports made')).toBeTruthy();
    expect(screen.getByLabelText('Medal: First report')).toBeTruthy();
    expect(screen.getByLabelText('Medal: 10 reports made')).toBeTruthy();
    expect(screen.getByText('Next medal at 50 reports.')).toBeTruthy();
  });

  it('invites the first report when there are no medals yet', async () => {
    await openCallIt({});
    expect(
      await screen.findByText('Send your first report to earn your first medal.'),
    ).toBeTruthy();
  });

  it('explains when the organization has turned the module off', async () => {
    await openCallIt({ 'GET /callit/stats': problem(403, 'module_disabled') });
    expect(
      await screen.findByText('This service is not available for your organization.'),
    ).toBeTruthy();
  });
});

describe('my reports', () => {
  it('lists drafts and sent reports with their state, and opens a draft for editing but a sent report read-only', async () => {
    await openCallIt({
      'GET /callit/reports': list([
        report('d', 'draft'),
        report('s', 'submitted'),
        report('r', 'reviewed'),
      ]),
      'GET /callit/reports/d': { data: { data: report('d', 'draft') } },
      'GET /callit/reports/s': { data: { data: report('s', 'submitted') } },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'My reports' }));
    expect(await screen.findByRole('button', { name: 'Unsafe acts, Draft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unsafe acts, Sent' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unsafe acts, Reviewed' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Unsafe acts, Sent' }));
    expect(await screen.findByText('Sent. Your organization will review it.')).toBeTruthy();
    expect(screen.getByText('Saw <b>no guard</b>')).toBeTruthy(); // plain text
    expect(screen.queryByRole('button', { name: 'Send report' })).toBeNull();
  });

  it('says so when there are none', async () => {
    await openCallIt({});
    await fireEvent.press(await screen.findByRole('button', { name: 'My reports' }));
    expect(await screen.findByText('No reports yet')).toBeTruthy();
  });
});

describe('writing a report', () => {
  async function openForm(routes: Record<string, unknown> = {}) {
    const api = await openCallIt(routes);
    await fireEvent.press(await screen.findByRole('button', { name: 'Create a new report' }));
    return api;
  }
  const yesNo = (name: string) => fireEvent.press(screen.getByRole('radio', { name }));
  const pick = async (field: string, name: string) => {
    await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${field}:`) }));
    await fireEvent.press(await screen.findByRole('radio', { name }));
  };

  it('will not send an incomplete report and says what is missing, but still saves a draft', async () => {
    const api = await openForm({
      'POST /callit/reports': { status: 201, data: { data: report('n', 'draft') } },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Choose the classification.')).toBeTruthy();
    expect(screen.getByText('Enter the vessel.')).toBeTruthy();
    expect(screen.getByText('Say whether you intervened.')).toBeTruthy();
    expect(api.callsTo('POST /callit/reports')).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => expect(api.callsTo('POST /callit/reports')).toHaveLength(1));
    expect(api.callsTo('POST /callit/reports')[0]?.body).toMatchObject({
      classification: null,
      intervened: false,
    });
  });

  it('asks for the other location and for how you intervened only when they apply', async () => {
    await openForm();
    expect(screen.queryByLabelText('Where, exactly?')).toBeNull();
    await pick('Location', 'Others');
    expect(await screen.findByLabelText('Where, exactly?')).toBeTruthy();
    expect(screen.queryByLabelText('How you intervened')).toBeNull();
    await yesNo('Yes');
    expect(await screen.findByLabelText('How you intervened')).toBeTruthy();
  });

  it('sends a complete report after asking about official reporting, and sends the choice with it', async () => {
    const api = await openForm({
      'POST /callit/reports': { status: 201, data: { data: report('n', 'draft') } },
      'PATCH /callit/reports/n': (call: { body: unknown }) => ({
        data: {
          data: report('n', (call.body as { submit?: boolean }).submit ? 'submitted' : 'draft'),
        },
      }),
    });
    await pick('Classification', 'Unsafe acts');
    await pick('Sub-classification', 'People');
    await pick('Location', 'Main deck');
    await fireEvent.changeText(screen.getByLabelText('Vessel'), 'MV Test');
    await fireEvent.changeText(
      screen.getByLabelText('Details of the incident'),
      'Saw a loose rail',
    );
    await yesNo('No');
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByText('Does this incident require official reporting?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send' }).props.accessibilityState?.disabled).toBe(
      true,
    ); // not until it is answered
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Yes' }).at(-1)!);
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(api.callsTo('PATCH /callit/reports/n')).toHaveLength(1));
    expect(api.callsTo('POST /callit/reports')[0]?.body).toMatchObject({
      classification: 'unsafe_acts',
      official_report: true,
    });
    expect(api.callsTo('PATCH /callit/reports/n')[0]?.body).toEqual({ submit: true });
  });

  it('shows the server message when sending fails, and keeps what was written', async () => {
    await openForm({ 'POST /callit/reports': problem(429, 'throttled') });
    await pick('Classification', 'Unsafe acts');
    await pick('Sub-classification', 'People');
    await pick('Location', 'Main deck');
    await fireEvent.changeText(screen.getByLabelText('Vessel'), 'MV Test');
    await fireEvent.changeText(
      screen.getByLabelText('Details of the incident'),
      'Saw a loose rail',
    );
    await yesNo('No');
    await fireEvent.press(screen.getByRole('button', { name: 'Save as draft' }));
    expect(await screen.findByText('Too many attempts. Try again shortly.')).toBeTruthy();
    expect(screen.getByLabelText('Vessel').props.value).toBe('MV Test');
  });
});
