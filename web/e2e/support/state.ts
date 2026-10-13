import { join } from 'node:path';

/** Session cookies of pre-signed-in test users. Git-ignored and deleted by the teardown project after every run. */
export const AUTH_DIR = join(process.cwd(), 'e2e', '.auth');
export const stateFile = (username: string) => join(AUTH_DIR, `${username}.json`);
