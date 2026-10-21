import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { asTenantAdmin, capture, makeMe, problem, renderApp, V1 } from '../../../tests/helpers';
import { server } from '../../../tests/server';
import { contrastWithWhite } from './BrandingPage';

const branding = (over: Record<string, unknown> = {}) => ({
  slug: 'aaa',
  name: 'Southfield Agencies',
  tagline: null,
  logo_url: null,
  favicon_url: null,
  primary_color: null,
  secondary_color: null,
  short_name: null,
  login_welcome_message: null,
  login_logo_url: null,
  login_background_url: null,
  accent_color: null,
  background_color: null,
  text_color: null,
  font_preset: null,
  version: 1,
  ...over,
});

const EMPTY_SAVE = {
  short_name: null,
  tagline: null,
  login_welcome_message: null,
  primary_color: null,
  secondary_color: null,
  accent_color: null,
  background_color: null,
  text_color: null,
  font_preset: null,
};

const api = (data = branding(), extra: Parameters<typeof server.use> = []) =>
  server.use(
    ...extra,
    http.get(`${V1}/tenant/branding`, () => HttpResponse.json({ data })),
  );

describe('Branding page', () => {
  it('checks contrast the same way the server does', () => {
    expect(contrastWithWhite('#000000')).toBeCloseTo(21, 0);
    expect(contrastWithWhite('#FFFFFF')).toBeCloseTo(1, 1);
    expect(contrastWithWhite('#355DAD')).toBeGreaterThan(4.5);
    expect(contrastWithWhite('#FFFF00')).toBeLessThan(4.5);
  });

  it('shows what is set and saves only what the form owns', async () => {
    asTenantAdmin();
    const saved = capture<Record<string, unknown>>();
    api(branding({ tagline: 'Sailing since 1990', primary_color: '#355DAD', version: 4 }), [
      http.patch(
        `${V1}/tenant/branding`,
        async ({ request }) => (
          await saved.record(request),
          HttpResponse.json({ data: branding({ version: 5 }) })
        ),
      ),
    ]);
    const { user } = renderApp('/app/branding');

    const tagline = await screen.findByLabelText('Tagline');
    expect(tagline).toHaveValue('Sailing since 1990');
    expect(screen.getByLabelText('Primary colour')).toHaveValue('#355DAD');
    await user.clear(tagline);
    await user.type(tagline, 'Fair winds');
    await user.type(screen.getByLabelText('Secondary colour'), '#1F6B4A');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(saved.calls).toHaveLength(1));
    expect(saved.calls[0]!.body).toEqual({
      ...EMPTY_SAVE,
      tagline: 'Fair winds',
      primary_color: '#355DAD',
      secondary_color: '#1F6B4A',
    });
  });

  it('clears a field by sending null when it is emptied', async () => {
    asTenantAdmin();
    const saved = capture<Record<string, unknown>>();
    api(branding({ tagline: 'Old', primary_color: '#355DAD' }), [
      http.patch(
        `${V1}/tenant/branding`,
        async ({ request }) => (
          await saved.record(request),
          HttpResponse.json({ data: branding() })
        ),
      ),
    ]);
    const { user } = renderApp('/app/branding');
    await user.clear(await screen.findByLabelText('Tagline'));
    await user.clear(screen.getByLabelText('Primary colour'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(saved.calls).toHaveLength(1));
    expect(saved.calls[0]!.body).toEqual(EMPTY_SAVE);
  });

  it('refuses a colour that is not a colour or too light for white text, before sending anything', async () => {
    asTenantAdmin();
    const saved = capture<Record<string, unknown>>();
    api(branding(), [
      http.patch(
        `${V1}/tenant/branding`,
        async ({ request }) => (
          await saved.record(request),
          HttpResponse.json({ data: branding() })
        ),
      ),
    ]);
    const { user } = renderApp('/app/branding');

    await user.type(await screen.findByLabelText('Primary colour'), 'red');
    expect(screen.getByText('Use a colour like #355DAD.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Primary colour'));
    await user.type(screen.getByLabelText('Primary colour'), '#FFFF00');
    expect(screen.getByText(/Too light for white button text/)).toBeInTheDocument();
    // Save stays off while a field has a problem, so nothing can be sent
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(saved.calls).toHaveLength(0);
  });

  it("shows the server's complaint when it refuses the tagline", async () => {
    asTenantAdmin();
    api(branding(), [
      http.patch(`${V1}/tenant/branding`, () =>
        problem(422, 'validation', 'The tagline field format is invalid.'),
      ),
    ]);
    const { user } = renderApp('/app/branding');
    await user.type(await screen.findByLabelText('Tagline'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('uploads a logo and removes one', async () => {
    asTenantAdmin();
    const uploaded = capture<unknown>();
    const removed = capture<unknown>();
    api(branding({ logo_url: 'http://x/logo.png' }), [
      http.post(
        `${V1}/tenant/branding/favicon`,
        async ({ request }) => (
          await uploaded.record(request),
          HttpResponse.json({ data: branding({ version: 2 }) })
        ),
      ),
      http.delete(
        `${V1}/tenant/branding/logo`,
        async ({ request }) => (
          await removed.record(request),
          HttpResponse.json({ data: branding({ version: 3 }) })
        ),
      ),
    ]);
    const { user } = renderApp('/app/branding');

    await user.upload(
      await screen.findByLabelText('Favicon'),
      new File(['x'], 'fav.png', { type: 'image/png' }),
    );
    await waitFor(() => expect(uploaded.calls).toHaveLength(1));

    expect(screen.getByAltText('Logo preview')).toHaveAttribute('src', 'http://x/logo.png');
    await user.click(screen.getByRole('button', { name: 'Remove logo' }));
    await waitFor(() => expect(removed.calls).toHaveLength(1));
  });

  it('is for administrators who may manage the organization', async () => {
    asTenantAdmin(makeMe({ abilities: ['tenant.view', 'users.view'] }));
    renderApp('/app/branding');
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
  });
});

describe('Branding page: the rest of the look', () => {
  it('saves short name, welcome message, accent, background, text colour and font style', async () => {
    asTenantAdmin();
    const saved = capture<Record<string, unknown>>();
    api(branding(), [
      http.patch(
        `${V1}/tenant/branding`,
        async ({ request }) => (
          await saved.record(request),
          HttpResponse.json({ data: branding({ version: 2 }) })
        ),
      ),
    ]);
    const { user } = renderApp('/app/branding');

    await user.type(await screen.findByLabelText('Short name'), 'AAA');
    await user.type(screen.getByLabelText('Welcome message'), 'Welcome aboard.');
    await user.type(screen.getByLabelText('Accent colour'), '#0B6E99');
    await user.type(screen.getByLabelText('Background colour'), '#FFFFFF');
    await user.type(screen.getByLabelText('Text colour'), '#0F172A');
    await user.click(screen.getByRole('radio', { name: /Serif/ }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(saved.calls).toHaveLength(1));
    expect(saved.calls[0]!.body).toEqual({
      ...EMPTY_SAVE,
      short_name: 'AAA',
      login_welcome_message: 'Welcome aboard.',
      accent_color: '#0B6E99',
      background_color: '#FFFFFF',
      text_color: '#0F172A',
      font_preset: 'serif',
    });
  });

  it('refuses text that does not read on the background, and markup in the names', async () => {
    asTenantAdmin();
    api();
    const { user } = renderApp('/app/branding');

    await user.type(await screen.findByLabelText('Text colour'), '#F0F0F0');
    expect(await screen.findByText(/Text on this background has only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await user.clear(screen.getByLabelText('Text colour'));
    await user.type(screen.getByLabelText('Short name'), '<b>');
    expect(screen.getByText(/The characters < and > are not allowed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('shows the sign-in page as it will look, as you type', async () => {
    asTenantAdmin();
    api(branding({ login_logo_url: 'http://x/login-logo.png' }));
    const { user } = renderApp('/app/branding');

    await user.type(await screen.findByLabelText('Welcome message'), 'Fair winds');
    const preview = screen.getByRole('complementary', { name: 'Preview' });
    expect(within(preview).getByText('Fair winds')).toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(preview.querySelector('img')).toHaveAttribute('src', 'http://x/login-logo.png');
  });
});

describe('Branding page: the save bar', () => {
  it('says whether anything is unsaved, keeps Save off until something changed, and Discard puts it back', async () => {
    asTenantAdmin();
    api(branding({ tagline: 'Sailing since 1990' }));
    const { user } = renderApp('/app/branding');

    const tagline = await screen.findByLabelText('Tagline');
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument();

    await user.type(tagline, '!');
    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(tagline).toHaveValue('Sailing since 1990');
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('shows the full name as read only, with where to change it', async () => {
    asTenantAdmin();
    api(branding());
    renderApp('/app/branding');

    const name = await screen.findByLabelText('Organization name');
    expect(name).toBeDisabled();
    expect(name).toHaveValue('Southfield Agencies');
    expect(screen.getByText(/set by the platform administrator/)).toBeInTheDocument();
  });
});

describe('Domains page', () => {
  const domains = (list: unknown[]) =>
    http.get(`${V1}/tenant/domains`, () =>
      HttpResponse.json({
        data: { default_address: 'aaa.sailix.test', slug: 'aaa', domains: list },
      }),
    );
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    domain: 'school.example.com',
    verified: false,
    verified_at: null,
    txt_name: '_sailix-challenge.school.example.com',
    txt_value: 'sx-abc123',
    cname_target: 'aaa.sailix.test',
    ...over,
  });

  it('shows the default address and says what to publish for a domain that is not proved yet', async () => {
    asTenantAdmin();
    server.use(domains([row()]));
    renderApp('/app/domains');

    expect(await screen.findByText('aaa.sailix.test')).toBeInTheDocument();
    expect(screen.getByText('school.example.com')).toBeInTheDocument();
    expect(screen.getByText('Waiting for DNS')).toBeInTheDocument();
    expect(screen.getByText('_sailix-challenge.school.example.com')).toBeInTheDocument();
    expect(screen.getByText('sx-abc123')).toBeInTheDocument();
  });

  it('says where to point a verified domain, and no longer shows the token', async () => {
    asTenantAdmin();
    server.use(domains([row({ verified: true, txt_value: null })]));
    renderApp('/app/domains');

    expect(await screen.findByText('Verified')).toBeInTheDocument();
    expect(
      screen.getByText(/aaa\.sailix\.test/, { selector: 'span.font-mono' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('sx-abc123')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Verify/ })).not.toBeInTheDocument();
  });

  it('adds a domain', async () => {
    asTenantAdmin();
    const added = capture<Record<string, unknown>>();
    server.use(
      domains([]),
      http.post(
        `${V1}/tenant/domains`,
        async ({ request }) => (
          await added.record(request),
          HttpResponse.json({ data: row() }, { status: 201 })
        ),
      ),
    );
    const { user } = renderApp('/app/domains');

    await user.type(await screen.findByLabelText('Domain'), 'school.example.com');
    await user.click(screen.getByRole('button', { name: 'Add domain' }));
    await waitFor(() => expect(added.calls).toHaveLength(1));
    expect(added.calls[0]!.body).toEqual({ domain: 'school.example.com' });
  });

  it("does not send an empty domain, and shows the server's reason when it refuses one", async () => {
    asTenantAdmin();
    server.use(
      domains([]),
      http.post(`${V1}/tenant/domains`, () =>
        problem(409, 'domain_taken', 'That domain already belongs to an organization.'),
      ),
    );
    const { user } = renderApp('/app/domains');

    await user.click(await screen.findByRole('button', { name: 'Add domain' }));
    expect(await screen.findByText('Enter a domain.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Domain'), 'taken.example.com');
    await user.click(screen.getByRole('button', { name: 'Add domain' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('verifies, and says why when the record is not there yet', async () => {
    asTenantAdmin();
    let calls = 0;
    server.use(
      domains([row()]),
      http.post(`${V1}/tenant/domains/d1/verify`, () =>
        ++calls === 1
          ? problem(422, 'verification_failed', 'We could not find the record yet.')
          : HttpResponse.json({ data: row({ verified: true, txt_value: null }) }),
      ),
    );
    const { user } = renderApp('/app/domains');

    await user.click(await screen.findByRole('button', { name: 'Verify school.example.com' }));
    const message = await screen.findByRole('alert');
    expect(message).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Verify school.example.com' }));
    await waitFor(() => expect(calls).toBe(2));
  });

  it('removes a domain only after confirming', async () => {
    asTenantAdmin();
    const removed = capture<unknown>();
    server.use(
      domains([row()]),
      http.delete(
        `${V1}/tenant/domains/d1`,
        async ({ request }) => (
          await removed.record(request),
          new HttpResponse(null, { status: 204 })
        ),
      ),
    );
    const { user } = renderApp('/app/domains');

    await user.click(await screen.findByRole('button', { name: 'Remove school.example.com' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(removed.calls).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(removed.calls).toHaveLength(1));
  });

  it('is for administrators who may manage the organization', async () => {
    asTenantAdmin(makeMe({ abilities: ['tenant.view'] }));
    renderApp('/app/domains');
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
  });
});
