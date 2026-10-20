import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { server } from './server';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
// Tests must not inherit a developer's local switches (web/.env.local): start from the defaults every time.
beforeEach(() => {
  vi.stubEnv('VITE_TENANT_SLUG_SWITCH', '');
  vi.stubEnv('VITE_TENANT_APEX_HOSTS', 'localhost,127.0.0.1');
});
afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
