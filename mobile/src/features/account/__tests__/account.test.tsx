import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { useSessionStore } from '@/store/sessionStore';
import { makeMe } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

type AlertButton = { text?: string; style?: string; onPress?: () => void };

function lastAlert() {
  const call = jest.spyOn(Alert, 'alert').mock.calls.at(-1)!;
  return { title: call[0], buttons: (call[2] ?? []) as AlertButton[] };
}

async function pressAlert(buttons: AlertButton[], text: string) {
  await act(async () => {
    await buttons.find((b) => b.text === text)!.onPress!();
  });
}

async function openAccount() {
  signedInAs();
  await renderApp();
  await fireEvent.press(await screen.findByRole('button', { name: 'Account' }));
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('account', () => {
  it('shows who is signed in, in which organization and role, and the app version', async () => {
    await openAccount();
    expect(await screen.findByText('Maria Santos')).toBeTruthy();
    expect(screen.getByText('maria@example.test')).toBeTruthy();
    expect(screen.getByText('Southfield Agencies')).toBeTruthy();
    expect(screen.getByText('Crew')).toBeTruthy();
    expect(screen.getByText('Version 1.0.31')).toBeTruthy();
  });

  it('asks before signing out, and Cancel changes nothing', async () => {
    await openAccount();
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));

    const { title, buttons } = lastAlert();
    expect(title).toBe('Sign out?');
    expect(buttons.find((b) => b.text === 'Cancel')?.style).toBe('cancel');
    expect(useSessionStore.getState().status).toBe('authenticated');
  });

  it('signing out revokes the device token, wipes the session and returns to sign-in', async () => {
    const api = mockApi({ 'DELETE /auth/token': { status: 204 } });
    await openAccount();
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));

    await pressAlert(lastAlert().buttons, 'Sign out');

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(useSessionStore.getState()).toMatchObject({
      status: 'unauthenticated',
      credential: null,
      me: null,
    });
    await waitFor(() => expect(api.callsTo('DELETE /auth/token')).toHaveLength(1));
    expect(screen.queryByText('Maria Santos')).toBeNull();
  });

  it('requests account deletion only after confirmation and says nothing is deleted yet', async () => {
    const api = mockApi({
      'POST /me/deletion-request': {
        status: 202,
        data: { data: { id: 'd1', status: 'pending', requested_at: '2026-10-01T00:00:00Z' } },
      },
    });
    await openAccount();
    await fireEvent.press(await screen.findByRole('button', { name: 'Request account deletion' }));

    const { title, buttons } = lastAlert();
    expect(title).toBe('Request account deletion?');
    expect(api.calls).toHaveLength(0); // nothing sent before the confirmation

    await pressAlert(buttons, 'Send request');

    expect(
      await screen.findByText('Your deletion request was sent to your organization.'),
    ).toBeTruthy();
    expect(useSessionStore.getState().status).toBe('authenticated'); // access is unchanged
  });

  it('reports a failed deletion request', async () => {
    mockApi({
      'POST /me/deletion-request': problem(429, 'throttled', 'x', undefined, {
        'Retry-After': '90',
      }),
    });
    await openAccount();
    await fireEvent.press(await screen.findByRole('button', { name: 'Request account deletion' }));
    await pressAlert(lastAlert().buttons, 'Send request');
    expect(await screen.findByText(/Try again in 90 seconds/)).toBeTruthy();
  });

  it('opens the privacy policy from configuration and explains a failure', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true);
    await openAccount();
    await fireEvent.press(await screen.findByRole('button', { name: 'Privacy policy' }));
    expect(open).toHaveBeenCalledWith('https://example.test/privacy');

    open.mockRejectedValueOnce(new Error('no browser'));
    await fireEvent.press(screen.getByRole('button', { name: 'Privacy policy' }));
    expect(await screen.findByText(/Could not open the privacy policy/)).toBeTruthy();
  });
});

describe('change password', () => {
  async function openChange() {
    await openAccount();
    await fireEvent.press(await screen.findByRole('button', { name: 'Change password' }));
  }
  const fill = async (current: string, next: string, repeat = next) => {
    await fireEvent.changeText(screen.getByLabelText('Current password'), current);
    await fireEvent.changeText(screen.getByLabelText('New password'), next);
    await fireEvent.changeText(screen.getByLabelText('Repeat the new password'), repeat);
    await fireEvent.press(screen.getByRole('button', { name: 'Change password' }));
  };

  it('validates locally: mismatch, reuse of the current password, short password', async () => {
    const api = mockApi({});
    await openChange();

    await fill('old-password', 'brand-new-password', 'different-password');
    expect(await screen.findByText('The passwords do not match.')).toBeTruthy();

    await fill('old-password', 'old-password');
    expect(await screen.findByText('Choose a different password.')).toBeTruthy();

    await fill('old-password', 'short');
    expect(await screen.findByText('Use at least 8 characters.')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('sends the change, keeps this device signed in and clears the fields', async () => {
    const api = mockApi({ 'PUT /me/password': { status: 204 } });
    await openChange();

    await fill('old-password', 'brand-new-password');

    expect(
      await screen.findByText('Password changed. Your other devices were signed out.'),
    ).toBeTruthy();
    expect(api.callsTo('PUT /me/password')[0]?.body).toEqual({
      current_password: 'old-password',
      password: 'brand-new-password',
      password_confirmation: 'brand-new-password',
    });
    expect(useSessionStore.getState().status).toBe('authenticated');
    expect(screen.getByLabelText('Current password').props.value).toBe('');
  });

  it('maps a wrong current password onto its field', async () => {
    mockApi({
      'PUT /me/password': problem(422, 'invalid_current_password', 'x', {
        current_password: ['The current password is incorrect.'],
      }),
    });
    await openChange();
    await fill('wrong-password', 'brand-new-password');
    expect(await screen.findByText('The current password is incorrect.')).toBeTruthy();
  });

  it('shows a server policy error (organization minimum) on the password field', async () => {
    mockApi({
      'PUT /me/password': problem(422, 'validation', 'x', {
        password: ['The password field must be at least 12 characters.'],
      }),
    });
    await openChange();
    await fill('old-password', 'long-enough-8');
    expect(
      await screen.findByText('The password field must be at least 12 characters.'),
    ).toBeTruthy();
  });
});

it('shows nothing of the previous person after another one signs in on the same device', async () => {
  signedInAs(
    makeMe({
      user: { id: 'x', username: 'previous', email: 'previous@example.test', display_name: null },
      profile: null,
    }),
  );
  await renderApp();
  await screen.findByText('previous');

  await act(async () => {
    await useSessionStore.getState().signOut({ revoke: false });
  });
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();

  await act(async () => signedInAs());
  expect(await screen.findByText('Maria')).toBeTruthy();
  expect(screen.queryByText(/previous/)).toBeNull();
});

describe('switching organization', () => {
  const acme = {
    id: 'm2',
    role: 'tenant_admin' as const,
    tenant: { id: 't2', code: 'ACME', name: 'Acme Crewing' },
  };
  const southfield = {
    id: 'm1',
    role: 'crew' as const,
    tenant: { id: 't1', code: 'SFAI', name: 'Southfield Agencies' },
  };

  it('offers nothing when the person belongs to one organization', async () => {
    await openAccount();
    await screen.findByText('Maria Santos');
    expect(screen.queryByText('Switch organization')).toBeNull();
  });

  it('lists only the other organizations and moves to the chosen one', async () => {
    const acmeMe = makeMe({
      membership: { id: 'm2', role: 'tenant_admin', status: 'active' },
      tenant: acme.tenant,
      memberships: [
        { ...southfield, current: false },
        { ...acme, current: true },
      ],
    });
    mockApi({
      'GET /me': (call) => ({
        data: { data: call.headers.Authorization === 'Bearer 2|acme' ? acmeMe : me1 },
      }),
      'POST /auth/token/switch': {
        data: {
          data: {
            token: '2|acme',
            expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
            membership: acme,
          },
        },
      },
    });
    const me1 = makeMe({
      memberships: [
        { ...southfield, current: true },
        { ...acme, current: false },
      ],
    });
    signedInAs(me1);
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Account' }));

    expect(await screen.findByText('Switch organization')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Southfield Agencies/ })).toBeNull(); // not the current one
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Acme Crewing (Administrator)' }),
    );

    await waitFor(() => expect(useSessionStore.getState().me?.tenant.code).toBe('ACME'));
    expect(await screen.findByText(/Acme Crewing/)).toBeTruthy();
  });

  it('shows why a refused switch failed and stays where it is', async () => {
    const me1 = makeMe({
      memberships: [
        { ...southfield, current: true },
        { ...acme, current: false },
      ],
    });
    mockApi({
      'POST /auth/token/switch': problem(
        403,
        'forbidden',
        'You cannot switch to that organization.',
      ),
    });
    signedInAs(me1);
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Account' }));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Acme Crewing (Administrator)' }),
    );

    // the app returns to Home (the screens are rebuilt during a switch) and says why
    expect(await screen.findByText(/Could not switch organization.*not allowed/)).toBeTruthy();
    expect(useSessionStore.getState().me?.tenant.code).toBe('SFAI');
  });
});

describe('send feedback', () => {
  async function openFeedback() {
    await openAccount();
    await fireEvent.press(await screen.findByRole('button', { name: 'Send feedback' }));
  }

  it('sends the chosen category and the message, then confirms', async () => {
    const api = mockApi({ 'POST /me/feedback': { status: 201, data: { data: { id: 'f1' } } } });
    await openFeedback();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Something is wrong' }));
    await fireEvent.changeText(screen.getByLabelText('Your feedback'), 'The quiz did not load');
    await fireEvent.press(screen.getByRole('button', { name: 'Send feedback' }));

    expect(await screen.findByText(/Thank you/)).toBeTruthy();
    expect(api.callsTo('POST /me/feedback')[0]?.body).toEqual({
      category: 'bug',
      message: 'The quiz did not load',
    });
  });

  it('does not send an empty message', async () => {
    const api = mockApi({});
    await openFeedback();
    await fireEvent.press(screen.getByRole('button', { name: 'Send feedback' }));

    expect(await screen.findByText('Write a few words.')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('shows the server error when it is refused (for example the daily limit)', async () => {
    mockApi({ 'POST /me/feedback': problem(429, 'Too many requests', 'Try again later.') });
    await openFeedback();
    await fireEvent.changeText(screen.getByLabelText('Your feedback'), 'Another idea for you');
    await fireEvent.press(screen.getByRole('button', { name: 'Send feedback' }));

    await waitFor(() => expect(screen.queryByText(/Thank you/)).toBeNull());
    expect(await screen.findByText('Too many attempts. Try again shortly.')).toBeTruthy();
  });
});
