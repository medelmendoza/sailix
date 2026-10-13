import { expect, test } from '@playwright/test';
import { signInPlatform, signInTenant } from './support/session';
import { stateFile } from './support/state';

test('suspending an organization blocks its administrators server-side, even in an open session', async ({
  browser,
}) => {
  // 1. An administrator of ZETA is signed in and working.
  const adminContext = await browser.newContext({ storageState: stateFile('admin.zeta') });
  const admin = await adminContext.newPage();
  await admin.goto('/app');
  await expect(admin.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // 2. The platform suspends ZETA (a reason is mandatory).
  const platformContext = await browser.newContext();
  const platform = await platformContext.newPage();
  await signInPlatform(platform);
  await platform.getByRole('link', { name: 'Organizations' }).click();
  await platform.getByRole('link', { name: 'Zeta Maritime (e2e)' }).click();
  await platform.getByRole('button', { name: 'Suspend' }).click();
  await platform.getByRole('dialog').getByRole('button', { name: 'Suspend' }).click();
  await expect(platform.getByText(/reason/i).first()).toBeVisible(); // empty reason refused
  await platform.getByLabel(/Reason/).fill('e2e: non-payment test');
  await platform.getByRole('dialog').getByRole('button', { name: 'Suspend' }).click();
  await expect(platform.getByText('suspended', { exact: true }).first()).toBeVisible();

  // 3. The open session is blocked on the next request.
  await admin.reload();
  await expect(
    admin.getByRole('heading', { name: 'You cannot use the portal right now' }),
  ).toBeVisible();
  await expect(admin.getByText(/organization is not active/i)).toBeVisible();
  await expect(admin.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);

  // 4. A new sign-in is refused too.
  const freshContext = await browser.newContext();
  const fresh = await freshContext.newPage();
  await signInTenant(fresh, 'admin.zeta');
  await expect(fresh.getByRole('alert')).toBeVisible();
  await expect(fresh.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);

  // 5. Reactivation restores access.
  await platform.getByRole('button', { name: 'Reactivate' }).click();
  await platform.getByRole('dialog').getByRole('button', { name: 'Reactivate' }).click();
  await expect(platform.getByText('active', { exact: true }).first()).toBeVisible();
  await signInTenant(fresh, 'admin.zeta');
  await expect(fresh.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await Promise.all([adminContext.close(), platformContext.close(), freshContext.close()]);
});
