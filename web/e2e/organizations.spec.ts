import { expect, test } from '@playwright/test';
import { signInTenant } from './support/session';

test.describe('organization selection and access restrictions', () => {
  test('a person in two organizations chooses one, and sees only that organization', async ({
    page,
  }) => {
    await signInTenant(page, 'multi.user');
    await expect(page.getByRole('heading', { name: 'Choose an organization' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Southfield Agencies/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Acme Crewing/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Zeta Maritime/ })).toHaveCount(0); // not a member

    await page.getByRole('button', { name: /Acme Crewing/ }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Acme Crewing (demo)').first()).toBeVisible();

    await page.getByRole('link', { name: 'Members', exact: true }).click();
    await expect(page.getByText('admin.acme').first()).toBeVisible();
    await expect(page.getByText('admin.sfai')).toHaveCount(0); // other organization's people never appear
    await expect(page.getByText('crew.sfai')).toHaveCount(0);
  });

  test('signing in again lets the same person pick the other organization', async ({ page }) => {
    await signInTenant(page, 'multi.user');
    await page.getByRole('button', { name: /Southfield Agencies/ }).click();
    await expect(page.getByText('Southfield Agencies (demo)').first()).toBeVisible();
    await page.getByRole('link', { name: 'Members', exact: true }).click();
    await expect(page.getByText('admin.sfai').first()).toBeVisible();
    await expect(page.getByText('admin.acme')).toHaveCount(0);
  });

  test('an agency code for an organization the person does not belong to is refused', async ({
    page,
  }) => {
    await signInTenant(page, 'admin.sfai', 'ACME');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('crew members are refused by the web portal', async ({ page }) => {
    await signInTenant(page, 'crew.sfai');
    await expect(page.getByRole('alert')).toContainText(/cannot use the web portal/i);
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/app/members');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('administration endpoints answer 401 to a request with no session, whatever the Accept header', async ({
    page,
  }) => {
    for (const accept of ['application/json', '*/*']) {
      for (const path of [
        '/api/v1/tenant/users',
        '/api/v1/tenant/audit-logs',
        '/api/v1/platform/tenants',
      ]) {
        const response = await page.request.get(`http://localhost:8010${path}`, {
          headers: { Accept: accept },
        });
        expect(response.status(), `${path} (${accept})`).toBe(401);
      }
    }
  });
});
