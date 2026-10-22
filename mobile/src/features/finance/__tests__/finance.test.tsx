import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { makeMe } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

const slip = (id: string, label: string, net: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: 'regular',
  pay_date: '2026-09-30',
  period_label: label,
  vessel_name: 'MV Test',
  net_amount: net,
  is_dollar: false,
  ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  kind: 'regular',
  pay_date: '2026-09-30',
  period_label: 'September 2026',
  vessel_name: 'MV Test',
  full_vessel_name: null,
  position: 'Able Seaman',
  address: null,
  depart_date: null,
  payroll_date: null,
  payee_name: 'Spouse',
  bank_code: 'BDO',
  account_number: '••••5678',
  is_dollar: false,
  exchange_rate: '56.1250',
  pay_usd: '420.00',
  pay_peso: '23572.50',
  adjustment: null,
  adjustment_detail: null,
  signon_adjustment: null,
  union_dues: null,
  bank_charges: '5.00',
  withholding_tax: null,
  mpfee: null,
  sss_total: null,
  employee_sss: null,
  employee_philhealth: null,
  employee_pagibig: null,
  deductions: [{ description: 'Cash advance', amount: '1750.00' }],
  deductions_total: '1750.00',
  net_amount: '19000.00',
  ...over,
});

async function openFinance(routes: Record<string, unknown>) {
  const api = mockApi(routes as never);
  signedInAs(makeMe({ modules: [] }));
  await renderApp();
  await fireEvent.press(await screen.findByLabelText(/^Finance/));
  return api;
}

describe('finance tab', () => {
  it('offers Allotment, Final pay and Cash advance', async () => {
    await openFinance({});
    for (const name of ['Allotment', 'Final pay', 'Cash advance'])
      expect(await screen.findByRole('button', { name })).toBeTruthy();
  });
});

describe('payslips behind the password step-up', () => {
  it('asks for the password first, and opens the list once the server unlocks it', async () => {
    let unlocked = false;
    const api = await openFinance({
      'GET /payslips': () =>
        unlocked
          ? { data: { data: [slip('p1', 'September 2026', '19000.00')] } }
          : problem(403, 'step_up_required'),
      'POST /finance/unlock': () => (
        (unlocked = true),
        { data: { data: { step_up: 'password', unlocked: true, unlock_seconds: 300 } } }
      ),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Allotment' }));

    expect(await screen.findByText('Enter your password')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Password'), 'my-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Open payslips' }));

    expect(await screen.findByText('September 2026')).toBeTruthy();
    expect(screen.getByText('₱19,000.00')).toBeTruthy();
    expect(api.callsTo('POST /finance/unlock')[0]?.body).toEqual({ password: 'my-password' });
  });

  it('lets you show the password you type to open the payslips, and hide it again', async () => {
    await openFinance({ 'GET /payslips': problem(403, 'step_up_required') });
    await fireEvent.press(await screen.findByRole('button', { name: 'Allotment' }));

    const field = await screen.findByLabelText('Password');
    expect(field.props.secureTextEntry).toBe(true); // hidden to begin with
    await fireEvent.changeText(field, 'my-password');

    await fireEvent.press(screen.getByRole('button', { name: 'Show Password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('Password').props.value).toBe('my-password'); // what was typed is kept

    await fireEvent.press(screen.getByRole('button', { name: 'Hide Password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });

  it('says the password was wrong and does not open anything', async () => {
    await openFinance({
      'GET /payslips': problem(403, 'step_up_required'),
      'POST /finance/unlock': problem(422, 'invalid_password', 'That password is not correct.'),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Allotment' }));
    await fireEvent.changeText(await screen.findByLabelText('Password'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Open payslips' }));
    expect(await screen.findByText('That password is not correct.')).toBeTruthy();
    expect(screen.queryByText('September 2026')).toBeNull();
  });

  it('does not send an empty password', async () => {
    const api = await openFinance({ 'GET /payslips': problem(403, 'step_up_required') });
    await fireEvent.press(await screen.findByRole('button', { name: 'Allotment' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Open payslips' }));
    expect(await screen.findByText('Enter your password.')).toBeTruthy();
    expect(api.callsTo('POST /finance/unlock')).toHaveLength(0);
  });

  it('lists payslips newest first and can reverse the order', async () => {
    await openFinance({
      'GET /payslips': {
        data: {
          data: [slip('p1', 'September 2026', '19000.00'), slip('p2', 'August 2026', '18000.00')],
        },
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Allotment' }));
    await screen.findByText('September 2026');
    const order = () =>
      screen
        .getAllByRole('button')
        .map((b) => b.props.accessibilityLabel)
        .filter((l: string) => /2026,/.test(l ?? ''));
    expect(order()[0]).toMatch(/^September/);
    await fireEvent.press(screen.getByRole('button', { name: 'Showing newest first' }));
    await waitFor(() => expect(order()[0]).toMatch(/^August/));
  });

  it('shows the server figures, hides empty ones, and never shows the full account number', async () => {
    await openFinance({
      'GET /payslips': { data: { data: [slip('p1', 'September 2026', '19000.00')] } },
      'GET /payslips/p1': { data: { data: detail() } },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Allotment' }));
    await fireEvent.press(await screen.findByRole('button', { name: /^September 2026/ }));

    expect(await screen.findByText('₱19,000.00')).toBeTruthy(); // net amount as the server sent it
    expect(screen.getByText('$420.00')).toBeTruthy();
    expect(screen.getByText('BDO ••••5678')).toBeTruthy();
    expect(screen.getByText('Cash advance')).toBeTruthy();
    expect(screen.queryByText('Union dues')).toBeNull(); // empty figures are hidden, never shown as zero
    expect(screen.queryByText('Withholding tax')).toBeNull();
  });

  it('asks for the password again when the unlock ran out on the detail screen', async () => {
    await openFinance({
      'GET /payslips': { data: { data: [slip('p1', 'September 2026', '19000.00')] } },
      'GET /payslips/p1': problem(403, 'step_up_required'),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Allotment' }));
    await fireEvent.press(await screen.findByRole('button', { name: /^September 2026/ }));
    expect(await screen.findByText('Enter your password')).toBeTruthy();
  });
});

describe('cash advance', () => {
  it('shows the totals and each loan without asking for a password', async () => {
    const api = await openFinance({
      'GET /loans': {
        data: {
          data: [
            {
              id: 'l1',
              code: 'MED',
              description: 'Medical advance',
              loan_date: null,
              start_of_deduction: null,
              loan_amount: '10000.00',
              deduct_amount: '1000.00',
              paid_amount: '4000.00',
              balance: '6000.00',
              is_dollar: false,
              is_stopped: false,
              remarks: null,
            },
          ],
          totals: { php: '1000.00', usd: '0.00' },
        },
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Cash advance' }));
    expect(await screen.findByText('Medical advance')).toBeTruthy();
    expect(screen.getAllByText('₱1,000.00').length).toBeGreaterThan(0); // the running total and the loan's own deduction
    expect(screen.getByText('₱6,000.00')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Medical advance paid' })).toBeTruthy();
    expect(api.callsTo('POST /finance/unlock')).toHaveLength(0);
  });
});
