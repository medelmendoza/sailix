import { expect, test } from '@playwright/test';
import { secret, signInTenant } from './support/session';
import { stateFile } from './support/state';

test.describe('my account (implemented flows only: profile and change password)', () => {
  test.use({ storageState: stateFile('admin.acme') });

  test('shows the profile and validates the change-password form', async ({ page }) => {
    await page.goto('/app');
    await page.getByRole('link', { name: 'My account' }).click();
    await expect(page.getByRole('heading', { name: 'My account' })).toBeVisible();
    await expect(page.getByText('admin.acme').first()).toBeVisible();

    await page.getByLabel('Current password').fill(secret('E2E_PASSWORD'));
    await page.getByLabel('New password', { exact: true }).fill('short');
    await page.getByLabel('Repeat the new password').fill('different');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(
      page
        .getByRole('alert')
        .or(page.getByText(/at least|match/i))
        .first(),
    ).toBeVisible();
  });

  test('a wrong current password is refused and nothing changes', async ({ page, browser }) => {
    await page.goto('/app');
    await page.getByRole('link', { name: 'My account' }).click();
    const next = `${secret('E2E_PASSWORD')}-new`;
    await page.getByLabel('Current password').fill('definitely-not-it');
    await page.getByLabel('New password', { exact: true }).fill(next);
    await page.getByLabel('Repeat the new password').fill(next);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText(/current password/i).first()).toBeVisible();
    // the original password still works (fresh browser, no saved session)
    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const fresh = await other.newPage();
    await signInTenant(fresh, 'admin.acme');
    await expect(fresh.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await other.close();
  });
});
