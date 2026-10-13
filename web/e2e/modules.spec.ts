import { expect, test, type Browser } from '@playwright/test';
import { signInPlatform } from './support/session';
import { stateFile } from './support/state';

const TEAM = 'e2e-team-001';

/** Serial: each step builds on the previous one (provision -> use -> restrict). */
test.describe.serial('module visibility, provisioning and authorization', () => {
  async function tenantPage(browser: Browser, username: string) {
    const context = await browser.newContext({ storageState: stateFile(username) });
    const page = await context.newPage();
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.getByRole('link', { name: 'Modules', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible();
    return page;
  }

  test('before provisioning, an organization sees Tala as not provisioned and cannot enable it', async ({
    browser,
  }) => {
    const page = await tenantPage(browser, 'admin.sfai');
    await expect(page.getByText('not provisioned')).toBeVisible();
    await expect(page.getByRole('button', { name: /Enable Tala/ })).toHaveCount(0);
    await page.context().close();
  });

  test('a platform administrator provisions Tala for one organization only', async ({ page }) => {
    await signInPlatform(page);
    await page.getByRole('link', { name: 'Organizations' }).click();
    await page.getByRole('link', { name: 'Southfield Agencies (demo)' }).click();
    await expect(page.getByRole('heading', { name: 'Southfield Agencies (demo)' })).toBeVisible();

    await page.getByLabel('External team ID').fill(TEAM);
    await page.getByLabel('Status').selectOption('true');
    await page.getByRole('button', { name: 'Provision' }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByLabel('External team ID')).toHaveValue(TEAM);
  });

  test('one external team cannot be bound to two organizations', async ({ page }) => {
    await signInPlatform(page);
    await page.getByRole('link', { name: 'Organizations' }).click();
    await page.getByRole('link', { name: 'Acme Crewing (demo)' }).click();
    await page.getByLabel('External team ID').fill(TEAM);
    await page.getByRole('button', { name: 'Provision' }).click();
    await expect(page.getByText(/already|one organization|belongs/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Provision' })).toBeVisible(); // still not provisioned
  });

  test('the provisioned organization sees Tala with its team, and can disable and re-enable it', async ({
    browser,
  }) => {
    const page = await tenantPage(browser, 'admin.sfai');
    await expect(page.getByText(TEAM)).toBeVisible();
    await expect(page.getByText('enabled', { exact: true })).toBeVisible();
    await expect(page.getByText(/cannot be changed here/)).toBeVisible(); // mapping is platform-only: no edit control
    await expect(page.getByLabel('External team ID')).toHaveCount(0);

    await page.getByRole('button', { name: 'Disable Tala' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /Disable/ })
      .click();
    await expect(page.getByText('disabled', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Enable Tala' }).click();
    await expect(page.getByText('enabled', { exact: true })).toBeVisible();
    await page.context().close();
  });

  test("another organization never sees the first organization's team", async ({ browser }) => {
    const page = await tenantPage(browser, 'admin.acme');
    await expect(page.getByText('not provisioned')).toBeVisible();
    await expect(page.getByText(TEAM)).toHaveCount(0);
    await page.context().close();
  });

  test('a tenant administrator cannot call platform provisioning directly', async ({ browser }) => {
    const page = await tenantPage(browser, 'admin.sfai');
    const response = await page.request.get('http://localhost:8010/api/v1/platform/tenants');
    expect([401, 403]).toContain(response.status());
    await page.goto('/platform/tenants');
    await expect(page).toHaveURL(/\/platform\/login$/);
    await page.context().close();
  });
});
