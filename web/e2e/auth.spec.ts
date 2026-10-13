import { expect, test } from '@playwright/test';
import { secret, signInTenant } from './support/session';

test.describe('authentication and protected routes', () => {
  test('anonymous visitors are sent to the right sign-in page', async ({ page }) => {
    await page.goto('/app/members');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Administrator sign in' })).toBeVisible();

    await page.goto('/platform/tenants');
    await expect(page).toHaveURL(/\/platform\/login$/);
    await expect(page.getByRole('heading', { name: 'Platform sign in' })).toBeVisible();
  });

  test('empty form is rejected client-side without calling the API', async ({ page }) => {
    const calls: string[] = [];
    page.on('request', (r) => r.url().includes('/auth/session') && calls.push(r.url()));
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter your username or email.')).toBeVisible();
    expect(calls).toHaveLength(0);
  });

  test('a wrong password shows a generic error and keeps the person signed out', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Username or email').fill('admin.sfai');
    await page.getByLabel('Password', { exact: true }).fill(`${secret('E2E_PASSWORD')}-wrong`);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText(/incorrect|invalid/i);
    await expect(page).toHaveURL(/\/login$/);
    // nothing sensitive in the address bar
    expect(page.url()).not.toContain('admin.sfai');
    expect(page.url()).not.toContain(secret('E2E_PASSWORD'));
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sign in, survive a reload, sign out, and stay out after "back"', async ({ page }) => {
    await signInTenant(page, 'admin.sfai');
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Southfield Agencies (demo)').first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/login$/); // the protected page is not shown from history
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
  });

  test('a tenant session is not a platform session', async ({ page }) => {
    await signInTenant(page, 'admin.sfai');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.goto('/platform');
    await expect(page).toHaveURL(/\/platform\/login$/);
  });

  test('platform sign-in needs a valid authenticator code', async ({ page }) => {
    await page.goto('/platform/login');
    await page.getByLabel('Email').fill('root@example.test');
    await page.getByLabel('Password', { exact: true }).fill(secret('E2E_PASSWORD'));
    await page.getByLabel('Authenticator code').fill('000000');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/platform\/login$/);
  });

  test('forgot-password answers the same way for known and unknown accounts', async ({ page }) => {
    const texts: string[] = [];
    for (const email of ['admin.sfai@example.test', 'nobody@example.test']) {
      await page.goto('/forgot-password');
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('button', { name: /send|reset/i }).click();
      await expect(page.getByRole('status').or(page.getByText(/if an account/i))).toBeVisible();
      texts.push((await page.locator('main').innerText()).replace(email, '<email>'));
    }
    expect(texts[0]).toBe(texts[1]);
  });

  test('unknown routes show a not-found page', async ({ page }) => {
    await page.goto('/definitely/not/here');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
