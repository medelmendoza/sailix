import { rmSync } from 'node:fs';
import { test as teardown } from '@playwright/test';
import { AUTH_DIR } from './support/state';

teardown('remove saved sessions', () => {
  rmSync(AUTH_DIR, { recursive: true, force: true });
});
