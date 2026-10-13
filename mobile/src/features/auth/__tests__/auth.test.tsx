import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useSessionStore } from '@/store/sessionStore';
import { makeGrant, makeMe } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';

const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;

async function openSignIn() {
  useSessionStore.setState({ status: 'unauthenticated' });
  await renderApp();
}

async function fillLogin(username = 'maria', password = 'secret-password') {
  await fireEvent.changeText(screen.getByLabelText('Username or email'), username);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
}

describe('sign in', () => {
  it('validates the form before calling the API', async () => {
    const api = mockApi({});
    await openSignIn();

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your username or email.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('signs in, verifies with /me, stores the credential and opens the app', async () => {
    const api = mockApi({
      'POST /auth/token': { data: { data: makeGrant({ token: '1|abc' }) } },
      'GET /me': { data: { data: makeMe() } },
    });
    await openSignIn();

    await fillLogin();

    expect(await screen.findByText('Hello, Maria')).toBeTruthy();
    expect(api.callsTo('POST /auth/token')[0]?.body).toEqual({
      username: 'maria',
      password: 'secret-password',
      device_name: expect.stringMatching(/^Sailix /),
    });
    expect(api.callsTo('POST /auth/token')[0]?.headers.Authorization).toBeUndefined(); // public call
    expect(store().get('sailix.token')).toBe('1|abc');
  });

  it.each([
    [401, 'invalid_credentials', undefined, 'Incorrect username or password.'],
    [403, 'membership_pending', undefined, 'waiting for approval'],
    [403, 'tenant_suspended', undefined, 'not active'],
    [403, 'account_suspended', undefined, 'suspended'],
    [429, 'throttled', { 'Retry-After': '42' }, 'Try again in 42 seconds'],
  ])(
    'shows a clear message for %s %s and stays on the sign-in screen',
    async (status, code, headers, text) => {
      mockApi({ 'POST /auth/token': problem(status, code, 'x', undefined, headers) });
      await openSignIn();

      await fillLogin();

      expect(await screen.findByText(new RegExp(text))).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
      expect(useSessionStore.getState().status).toBe('unauthenticated');
      expect(useSessionStore.getState().notice).toBeNull(); // a wrong password is not a dead session
    },
  );

  it('explains a missing connection', async () => {
    mockApi({ 'POST /auth/token': { networkError: true } });
    await openSignIn();
    await fillLogin();
    expect(await screen.findByText(/No connection/)).toBeTruthy();
  });

  it('does not keep a credential when /me refuses the new token', async () => {
    mockApi({
      'POST /auth/token': { data: { data: makeGrant() } },
      'GET /me': problem(403, 'tenant_suspended'),
    });
    await openSignIn();

    await fillLogin();

    expect(await screen.findByText(/not active/)).toBeTruthy();
    expect(store().size).toBe(0);
    expect(useSessionStore.getState().credential).toBeNull();
  });

  it('shows why the user was signed out', async () => {
    useSessionStore.setState({
      status: 'unauthenticated',
      notice: 'Your session expired. Please sign in again.',
    });
    await renderApp();
    expect(await screen.findByText('Your session expired. Please sign in again.')).toBeTruthy();
  });

  it('lets people with several organizations choose one with the single-use ticket', async () => {
    const api = mockApi({
      'POST /auth/token': {
        data: {
          data: {
            requires_tenant_selection: true,
            ticket: 'ticket-1',
            memberships: [
              {
                id: 'm-a',
                role: 'crew',
                tenant: { id: 't-a', code: 'AAA', name: 'Alpha Crewing' },
              },
              {
                id: 'm-b',
                role: 'tenant_admin',
                tenant: { id: 't-b', code: 'BBB', name: 'Beta Manning' },
              },
            ],
          },
        },
      },
      'POST /auth/token/select': {
        data: {
          data: makeGrant({
            token: '1|beta',
            membership: {
              id: 'm-b',
              role: 'tenant_admin',
              tenant: { id: 't-b', code: 'BBB', name: 'Beta Manning' },
            },
          }),
        },
      },
      'GET /me': {
        data: {
          data: makeMe({
            membership: { id: 'm-b', role: 'tenant_admin', status: 'active' },
            tenant: { id: 't-b', code: 'BBB', name: 'Beta Manning' },
          }),
        },
      },
    });
    await openSignIn();
    await fillLogin();

    expect(await screen.findByText('Choose an organization')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Beta Manning, Administrator' }));

    expect(await screen.findByText('Beta Manning')).toBeTruthy();
    expect(api.callsTo('POST /auth/token/select')[0]?.body).toEqual({
      ticket: 'ticket-1',
      membership_id: 'm-b',
    });
    expect(useSessionStore.getState().credential).toMatchObject({
      tenantCode: 'BBB',
      membershipId: 'm-b',
    });
  });

  it('an expired ticket sends the person back to sign in with an explanation', async () => {
    mockApi({
      'POST /auth/token': {
        data: {
          data: {
            requires_tenant_selection: true,
            ticket: 't',
            memberships: [
              { id: 'm-a', role: 'crew', tenant: { id: 't-a', code: 'AAA', name: 'Alpha' } },
            ],
          },
        },
      },
      'POST /auth/token/select': problem(401, 'invalid_ticket'),
    });
    await openSignIn();
    await fillLogin();
    await fireEvent.press(await screen.findByRole('button', { name: 'Alpha, Crew' }));

    expect(await screen.findByText(/sign-in step expired/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });
});

describe('registration', () => {
  const FIELDS: [string, string][] = [
    ['Organization code', 'sfai'],
    ['First name', 'Maria'],
    ['Last name', 'Santos'],
    ['Username', 'maria.santos'],
    ['Email', 'maria@example.test'],
  ];

  async function openRegister() {
    await openSignIn();
    await fireEvent.press(screen.getByRole('link', { name: 'Create an account' }));
    await screen
      .findByText('Create an account', { selector: undefined } as never)
      .catch(() => undefined);
  }

  async function fillRegister(overrides: Record<string, string> = {}) {
    for (const [label, value] of FIELDS) {
      await fireEvent.changeText(screen.getByLabelText(label), overrides[label] ?? value);
    }
    await fireEvent.changeText(
      screen.getByLabelText('Password'),
      overrides.Password ?? 'a-long-enough-pass',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Repeat the password'),
      overrides.Repeat ?? 'a-long-enough-pass',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  }

  it('validates required fields locally', async () => {
    const api = mockApi({});
    await openRegister();

    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter your organization code.')).toBeTruthy();
    expect(screen.getByText('Enter your first name.')).toBeTruthy();
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('catches a password mismatch and a short password without calling the API', async () => {
    const api = mockApi({});
    await openRegister();

    await fillRegister({ Password: 'short', Repeat: 'different' });

    expect(await screen.findByText('Use at least 8 characters.')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('submits without blank optional fields and shows the neutral confirmation', async () => {
    const api = mockApi({
      'POST /auth/register': { status: 202, data: { data: { status: 'received' } } },
    });
    await openRegister();

    await fillRegister();

    expect(await screen.findByText('Registration received')).toBeTruthy();
    const body = api.callsTo('POST /auth/register')[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({
      agency_code: 'sfai',
      username: 'maria.santos',
      email: 'maria@example.test',
      first_name: 'Maria',
      last_name: 'Santos',
    });
    expect(body).not.toHaveProperty('middle_name');
    expect(body).not.toHaveProperty('suffix');
    expect(body).not.toHaveProperty('mobile');
    expect(body).not.toHaveProperty('role'); // role/status/tenant are never client-chosen
    expect(useSessionStore.getState().credential).toBeNull(); // registering never signs in
  });

  it('shows server field errors under their fields', async () => {
    mockApi({
      'POST /auth/register': problem(422, 'invalid_agency_code', 'x', {
        agency_code: ['The agency code is not valid.'],
        username: ['The username has already been taken.'],
      }),
    });
    await openRegister();

    await fillRegister();

    expect(await screen.findByText('The agency code is not valid.')).toBeTruthy();
    expect(screen.getByText('The username has already been taken.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
  });

  it('reports throttling', async () => {
    mockApi({
      'POST /auth/register': problem(429, 'throttled', 'x', undefined, { 'Retry-After': '60' }),
    });
    await openRegister();
    await fillRegister();
    expect(await screen.findByText(/Try again in 60 seconds/)).toBeTruthy();
  });
});

describe('forgot password', () => {
  async function openForgot() {
    await openSignIn();
    await fireEvent.press(screen.getByRole('link', { name: 'Forgot your password?' }));
  }

  it('shows the same neutral confirmation for any address', async () => {
    const api = mockApi({
      'POST /auth/forgot-password': { status: 202, data: { data: { status: 'received' } } },
    });
    await openForgot();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'whoever@example.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(screen.getByText(/If an account exists/)).toBeTruthy();
    expect(api.callsTo('POST /auth/forgot-password')[0]?.body).toEqual({
      email: 'whoever@example.test',
    });
  });

  it('validates the address and surfaces throttling', async () => {
    mockApi({
      'POST /auth/forgot-password': problem(429, 'throttled', 'x', undefined, {
        'Retry-After': '30',
      }),
    });
    await openForgot();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@example.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
    await waitFor(() => expect(screen.getByText(/Try again in 30 seconds/)).toBeTruthy());
  });
});

describe('password fields', () => {
  it('hides the password by default and offers an accessible show/hide toggle', async () => {
    await openSignIn();
    const field = screen.getByLabelText('Password');
    expect(field.props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Show Password' }));

    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Hide Password' })).toBeTruthy();
  });
});
