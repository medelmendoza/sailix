import { expect, type Page } from '@playwright/test';
import { nextTotp } from './totp';

/** Test credentials come from the environment the runner generated for this run; there is no fallback. */
export function secret(name: 'E2E_PASSWORD' | 'E2E_TOTP_SECRET'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; run the suite through "npm run e2e".`);
  return value;
}

export async function signInTenant(page: Page, username: string, agencyCode?: string) {
  await page.goto('/login');
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(secret('E2E_PASSWORD'));
  if (agencyCode) await page.getByLabel('Agency code (optional)').fill(agencyCode);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signInPlatform(page: Page) {
  await page.goto('/platform/login');
  await page.getByLabel(/email/i).fill('root@example.test');
  await page.getByLabel('Password', { exact: true }).fill(secret('E2E_PASSWORD'));
  await page.getByLabel('Authenticator code').fill(await nextTotp(secret('E2E_TOTP_SECRET')));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}
