import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
import { toBase32 } from './e2e/support/totp';

/**
 * Browser end-to-end tests against a REAL backend (Laravel + MySQL) and the real Vite dev server.
 *
 * Isolation: a dedicated database (`sailix_e2e`, dropped and re-seeded on every run), dedicated ports and
 * origins. Nothing here touches the development database or any non-local service.
 *
 * Credentials: the password and the platform-admin TOTP secret are generated randomly per run and exist
 * only in this process's environment (inherited by the servers and the test workers). They are never
 * written to disk, and traces/videos are off so they cannot end up in artifacts.
 */
process.env.E2E_PASSWORD ??= `Pw-${randomBytes(12).toString('hex')}`;
process.env.E2E_TOTP_SECRET ??= toBase32(randomBytes(20));

const API_PORT = 8010;
const WEB_PORT = 5174;
const API = `http://localhost:${API_PORT}`;
const WEB = `http://localhost:${WEB_PORT}`;

const backendEnv = {
  APP_ENV: 'local',
  APP_DEBUG: 'false',
  APP_URL: API,
  DB_DATABASE: 'sailix_e2e',
  SAILIX_WEB_ORIGINS: WEB,
  SANCTUM_STATEFUL_DOMAINS: `localhost:${WEB_PORT}`,
  MAIL_MAILER: 'array',
  SEED_DEMO_PASSWORD: process.env.E2E_PASSWORD,
  SEED_DEMO_TOTP_SECRET: process.env.E2E_TOTP_SECRET,
};

export default defineConfig({
  testDir: './e2e',
  // One worker: platform sign-ins share a TOTP secret whose codes may be used once each (replay protection).
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /setup\.ts/, teardown: 'cleanup' },
    { name: 'cleanup', testMatch: /teardown\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: [/setup\.ts/, /teardown\.ts/],
    },
  ],
  webServer: [
    {
      // Re-create the e2e schema, seed it, then serve the API. The database name is fixed here on purpose.
      command: `php artisan migrate:fresh --seeder=E2eSeeder --force && cd public && PHP_CLI_SERVER_WORKERS=4 php -S 127.0.0.1:${API_PORT} ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php`,
      cwd: '../backend',
      url: `http://127.0.0.1:${API_PORT}/up`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: backendEnv,
      stdout: 'ignore',
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort --host localhost`,
      url: WEB,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_BASE_URL: API },
      stdout: 'ignore',
    },
  ],
});
