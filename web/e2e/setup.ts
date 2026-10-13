import { mkdirSync } from 'node:fs';
import { expect, test as setup } from '@playwright/test';
import { signInTenant } from './support/session';
import { AUTH_DIR, stateFile } from './support/state';

/**
 * Signs in once per user that merely needs "an administrator session". Sign-in is rate limited by design
 * (5/min per account, 20/min per address), so the suite must not log in for every test; the sign-in
 * behaviour itself is exercised explicitly in auth/organizations specs.
 */
for (const username of ['admin.sfai', 'admin.acme', 'admin.zeta']) {
  setup(`sign in ${username}`, async ({ page }) => {
    mkdirSync(AUTH_DIR, { recursive: true });
    await signInTenant(page, username);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.context().storageState({ path: stateFile(username) });
  });
}
