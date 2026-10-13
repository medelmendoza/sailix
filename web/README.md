# web — Sailix administration portal

React 19 · TypeScript (strict) · Vite · React Router (data router) · TanStack Query · Axios · react-hook-form + Zod · Tailwind CSS 4 · Radix (dialogs) · Vitest + Testing Library + MSW.
One app, two areas: **organization administrators** (`/app/*`) and **platform superadmins** (`/platform/*`). Design: `../docs/06-WEB-PORTAL-ARCHITECTURE.md`. API types are generated from `../contracts/openapi.yaml`.

## Run locally

```bash
# backend (see ../backend/README.md): MySQL up, `php artisan migrate --seed`, then
PHP_CLI_SERVER_WORKERS=4 php artisan serve --port=8000

cd web && npm ci
cp .env.example .env.local     # VITE_API_BASE_URL=http://localhost:8000
npm run dev                    # http://localhost:5173
```

Cookie sessions need the web origin to match the backend's `SAILIX_WEB_ORIGINS` / `SANCTUM_STATEFUL_DOMAINS` (defaults already match `http://localhost:5173`).
Demo accounts (local seeder only): organization admin `admin.sfai` / `admin.acme`, superadmin `root@example.test` (+ authenticator code from the demo TOTP secret documented in `../backend/README.md`). Password: see `../backend/database/seeders/DatabaseSeeder.php`.

## Scripts

| Script                  | What                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| `npm run validate`      | `tsc` + ESLint (`--max-warnings=0`) + Prettier check + Vitest       |
| `npm run build`         | typecheck + production build (superadmin pages are separate chunks) |
| `npm run gen:api`       | regenerate `src/services/api/schema.d.ts` from the OpenAPI contract |
| `npm run gen:api:check` | fail if the committed types drift from the contract (CI)            |

`openapi-typescript` runs through a pinned `npx` because its peer range stops at TypeScript 5; it is not a project dependency.

## Structure

`src/app` (providers, router, config) · `src/components/ui` (design system) · `src/features/{authentication,tenant,platform,shared}` · `src/services/api` (client, typed errors, generated schema) · `tests/` (MSW server, helpers).

## Security notes

- Authentication is the Sanctum SPA **cookie session**; no token is ever stored in JavaScript, `localStorage` or `sessionStorage`. State-changing calls send the XSRF header after `GET /sanctum/csrf-cookie`.
- Route guards and the ability-driven menu are **usability only**; the API enforces every ability and tenant boundary on each request.
- Emailed one-time links (password reset, invitation) are read once and the address bar is cleaned immediately; `<meta name="referrer" content="no-referrer">` keeps them out of `Referer`.
- Logout and any `401` clear every cached record (TanStack Query cache) so one person's data never outlives their session.
- A strict **Content-Security-Policy and security headers belong to the hosting layer** (milestone M6): the Vite dev server needs inline scripts, so a meta CSP here would break development.

## End-to-end tests (Playwright)

```bash
npm run e2e:install   # one-time: downloads Chromium
npm run e2e           # needs the local MySQL (backend/scripts/local-mysql.sh start; database sailix_e2e)
```

Runs against the real Laravel API (port 8010) and Vite (5174) with a dedicated, re-seeded `sailix_e2e` database. Credentials are random per run and exist only in the process environment; traces/videos are off. Failure `error-context.md` files may contain the throwaway password — do not upload `test-results/` or `playwright-report/` as CI artifacts. Sign-in is rate limited by design, so specs reuse saved sessions (`e2e/setup.ts`) except where sign-in itself is under test.
