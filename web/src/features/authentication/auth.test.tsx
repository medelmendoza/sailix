import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import {
  API,
  asAnonymous,
  capture,
  makeMe,
  pageOf,
  problem,
  renderApp,
  V1,
} from '../../../tests/helpers';
import { server } from '../../../tests/server';

function signedInAfterLogin() {
  // before login the session probe is 401; after it, /me answers
  let signedIn = false;
  server.use(
    http.get(`${API}/sanctum/csrf-cookie`, () => new HttpResponse(null, { status: 204 })),
    http.get(`${V1}/me`, () =>
      signedIn ? HttpResponse.json({ data: makeMe() }) : problem(401, 'unauthenticated'),
    ),
    http.get(`${V1}/tenant/users`, () => HttpResponse.json(pageOf([]))),
    http.get(`${V1}/tenant/deletion-requests`, () => HttpResponse.json(pageOf([]))),
    http.get(`${V1}/tenant/modules`, () => HttpResponse.json({ data: [] })),
    http.get(`${V1}/tenant/audit-logs`, () => HttpResponse.json(pageOf([]))),
  );
  return () => {
    signedIn = true;
  };
}

describe('tenant sign in', () => {
  it('validates required fields before calling the API', async () => {
    asAnonymous();
    const posted = capture();
    server.use(
      http.post(
        `${V1}/auth/session`,
        async ({ request }) => (await posted.record(request), HttpResponse.json({})),
      ),
    );
    const { user } = renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your username or email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(posted.calls).toHaveLength(0);
  });

  it('fetches the CSRF cookie, signs in and lands on the dashboard', async () => {
    const markSignedIn = signedInAfterLogin();
    const order: string[] = [];
    const posted = capture<Record<string, unknown>>();
    server.use(
      http.get(
        `${API}/sanctum/csrf-cookie`,
        () => (order.push('csrf'), new HttpResponse(null, { status: 204 })),
      ),
      http.post(`${V1}/auth/session`, async ({ request }) => {
        order.push('login');
        await posted.record(request);
        markSignedIn();
        return HttpResponse.json({
          data: {
            membership: { id: 'm', role: 'tenant_admin' },
            tenant: { code: 'SFAI', name: 'Southfield Agencies' },
          },
        });
      }),
    );
    const { user } = renderApp('/login');

    await user.type(await screen.findByLabelText('Username or email'), 'admin1');
    await user.type(screen.getByLabelText('Password'), 'secret-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(order).toEqual(['csrf', 'login']);
    expect(posted.calls[0]!.body).toEqual({ username: 'admin1', password: 'secret-password' });
  });

  it.each([
    [401, 'invalid_credentials', undefined, 'Incorrect credentials'],
    [403, 'membership_pending', undefined, 'waiting for activation'],
    [403, 'tenant_suspended', undefined, 'organization is not active'],
    [403, 'web_access_denied', undefined, 'mobile app'],
    [429, 'throttled', '42', 'Try again in 42 seconds'],
  ])('shows a clear message for %s %s', async (status, code, retry, text) => {
    asAnonymous();
    server.use(
      http.post(`${V1}/auth/session`, () =>
        problem(status, code, 'x', undefined, retry ? { 'Retry-After': retry } : {}),
      ),
    );
    const { user } = renderApp('/login');

    await user.type(await screen.findByLabelText('Username or email'), 'someone');
    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(new RegExp(text, 'i'));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('lets a person with several organizations pick one, using the single-use ticket', async () => {
    const markSignedIn = signedInAfterLogin();
    const selected = capture<Record<string, unknown>>();
    server.use(
      http.post(`${V1}/auth/session`, () =>
        HttpResponse.json({
          data: {
            requires_tenant_selection: true,
            ticket: 'ticket-123',
            memberships: [
              { id: 'm-a', role: 'tenant_admin', tenant: { code: 'AAA', name: 'Alpha Crewing' } },
              { id: 'm-b', role: 'tenant_admin', tenant: { code: 'BBB', name: 'Beta Manning' } },
            ],
          },
        }),
      ),
      http.post(`${V1}/auth/session/select`, async ({ request }) => {
        await selected.record(request);
        markSignedIn();
        return HttpResponse.json({ data: {} });
      }),
    );
    const { user } = renderApp('/login');

    await user.type(await screen.findByLabelText('Username or email'), 'multi');
    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { name: 'Choose an organization' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Beta Manning/ }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(selected.calls[0]!.body).toEqual({ ticket: 'ticket-123', membership_id: 'm-b' });
  });

  it('returns to the sign-in form with a message when the ticket was already spent', async () => {
    asAnonymous();
    server.use(
      http.post(`${V1}/auth/session`, () =>
        HttpResponse.json({
          data: {
            requires_tenant_selection: true,
            ticket: 't',
            memberships: [
              { id: 'm-a', role: 'tenant_admin', tenant: { code: 'AAA', name: 'Alpha' } },
              { id: 'm-b', role: 'tenant_admin', tenant: { code: 'BBB', name: 'Beta' } },
            ],
          },
        }),
      ),
      http.post(`${V1}/auth/session/select`, () => problem(401, 'invalid_ticket')),
    );
    const { user } = renderApp('/login');
    await user.type(await screen.findByLabelText('Username or email'), 'multi');
    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.click(await screen.findByRole('button', { name: /Alpha/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('expired');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('platform sign in', () => {
  it('requires a 6-digit code and clears it after a failed attempt', async () => {
    asAnonymous();
    server.use(http.post(`${V1}/platform/auth/session`, () => problem(401, 'invalid_credentials')));
    const { user } = renderApp('/platform/login');

    await user.type(await screen.findByLabelText('Email'), 'root@example.test');
    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.type(screen.getByLabelText('Authenticator code'), '12');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/6-digit code/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Authenticator code'));
    await user.type(screen.getByLabelText('Authenticator code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect credentials');
    await waitFor(() => expect(screen.getByLabelText('Authenticator code')).toHaveValue(''));
  });

  it('signs in and opens the platform dashboard', async () => {
    let signedIn = false;
    server.use(
      http.get(`${API}/sanctum/csrf-cookie`, () => new HttpResponse(null, { status: 204 })),
      http.get(`${V1}/me`, () => problem(401, 'unauthenticated')),
      http.get(`${V1}/platform/me`, () =>
        signedIn
          ? HttpResponse.json({
              data: {
                id: 'p',
                name: 'Root Admin',
                email: 'root@example.test',
                abilities: ['platform.manage'],
              },
            })
          : problem(401, 'unauthenticated'),
      ),
      http.post(
        `${V1}/platform/auth/session`,
        () => ((signedIn = true), HttpResponse.json({ data: {} })),
      ),
      http.get(`${V1}/platform/tenants`, () => HttpResponse.json(pageOf([], { total: 1 }))),
      http.get(`${V1}/platform/audit-logs`, () => HttpResponse.json(pageOf([]))),
    );
    const { user } = renderApp('/platform/login');

    await user.type(await screen.findByLabelText('Email'), 'root@example.test');
    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.type(screen.getByLabelText('Authenticator code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Platform dashboard' })).toBeInTheDocument();
  });
});

describe('forgot password', () => {
  it('shows the same neutral confirmation for any address', async () => {
    asAnonymous();
    const posted = capture<Record<string, unknown>>();
    server.use(
      http.post(
        `${V1}/auth/forgot-password`,
        async ({ request }) => (
          await posted.record(request),
          HttpResponse.json({ data: { status: 'received' } }, { status: 202 })
        ),
      ),
    );
    const { user } = renderApp('/forgot-password');

    await user.type(await screen.findByLabelText('Email'), 'whoever@example.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/If an account exists/)).toBeInTheDocument();
    expect(posted.calls[0]!.body).toEqual({ email: 'whoever@example.test' });
  });

  it('validates the address and reports throttling', async () => {
    asAnonymous();
    server.use(
      http.post(`${V1}/auth/forgot-password`, () =>
        problem(429, 'throttled', 'x', undefined, { 'Retry-After': '30' }),
      ),
    );
    const { user } = renderApp('/forgot-password');

    await user.type(await screen.findByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'a@example.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 30 seconds');
  });
});

describe('emailed one-time links', () => {
  it('reset: reads the link, removes the secret from the address bar and submits it', async () => {
    asAnonymous();
    const posted = capture<Record<string, unknown>>();
    server.use(
      http.post(
        `${V1}/auth/reset-password`,
        async ({ request }) => (
          await posted.record(request),
          new HttpResponse(null, { status: 204 })
        ),
      ),
    );
    const { user, router } = renderApp(
      '/reset-password?token=secret-token&email=maria%40example.test',
    );

    await user.type(await screen.findByLabelText('New password'), 'a-new-password');
    await user.type(screen.getByLabelText('Repeat the password'), 'a-new-password');
    await waitFor(() => expect(router.state.location.search).toBe(''));
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument();
    expect(posted.calls[0]!.body).toEqual({
      token: 'secret-token',
      email: 'maria@example.test',
      password: 'a-new-password',
      password_confirmation: 'a-new-password',
    });
  });

  it('reset: rejects a mismatch locally and shows the server message for a dead link', async () => {
    asAnonymous();
    server.use(
      http.post(`${V1}/auth/reset-password`, () =>
        problem(422, 'invalid_reset_token', 'x', {
          token: ['The reset link is invalid or has expired.'],
        }),
      ),
    );
    const { user } = renderApp('/reset-password?token=t&email=a%40example.test');

    await user.type(await screen.findByLabelText('New password'), 'a-new-password');
    await user.type(screen.getByLabelText('Repeat the password'), 'different-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Repeat the password'));
    await user.type(screen.getByLabelText('Repeat the password'), 'a-new-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid or has expired');
  });

  it('reset: a link without its parameters is explained, not submitted', async () => {
    asAnonymous();
    renderApp('/reset-password');
    expect(
      await screen.findByRole('heading', { name: 'This link is not valid' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('invitation: activates the account with the emailed token', async () => {
    asAnonymous();
    const posted = capture<Record<string, unknown>>();
    server.use(
      http.post(
        `${V1}/auth/invitations/accept`,
        async ({ request }) => (
          await posted.record(request),
          new HttpResponse(null, { status: 204 })
        ),
      ),
    );
    const { user } = renderApp('/accept-invitation?token=inv-1.secret');

    expect(
      await screen.findByRole('heading', { name: 'Activate your account' }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'a-new-password');
    await user.type(screen.getByLabelText('Repeat the password'), 'a-new-password');
    await user.click(screen.getByRole('button', { name: 'Activate account' }));

    expect(await screen.findByRole('heading', { name: 'Account activated' })).toBeInTheDocument();
    expect(posted.calls[0]!.body).toEqual({
      token: 'inv-1.secret',
      password: 'a-new-password',
      password_confirmation: 'a-new-password',
    });
  });

  it('invitation: maps a server-side password policy error onto the field', async () => {
    asAnonymous();
    server.use(
      http.post(`${V1}/auth/invitations/accept`, () =>
        problem(422, 'validation', 'x', {
          password: ['The password field must be at least 12 characters.'],
        }),
      ),
    );
    const { user } = renderApp('/accept-invitation?token=inv-1.secret');

    await user.type(await screen.findByLabelText('New password'), 'long-enough-8');
    await user.type(screen.getByLabelText('Repeat the password'), 'long-enough-8');
    await user.click(screen.getByRole('button', { name: 'Activate account' }));

    expect(
      await screen.findByText('The password field must be at least 12 characters.'),
    ).toBeInTheDocument();
  });
});
