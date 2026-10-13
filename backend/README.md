# backend — Laravel API (`/api/v1`)

Laravel 13 · PHP ≥ 8.3 (developed on 8.5) · MySQL 8.4+/9.x · Sanctum · Larastan · PHPUnit. Design: `../docs/05`, tenancy: `../docs/02-04`, contract: `../contracts/openapi.yaml`.

## First run

```bash
composer install
cp .env.example .env && php artisan key:generate
scripts/local-mysql.sh init          # project-local MySQL on 127.0.0.1:3308 (data in .local/, git-ignored)
php artisan migrate --seed           # demo tenants SFAI + ACME (local only): admin.sfai / crew.sfai, password in DatabaseSeeder
php artisan platform:create-admin you@example.com "Your Name"   # superadmin; TOTP secret is printed ONCE
php artisan serve                    # http://localhost:8000
```

`scripts/local-mysql.sh {start|stop|status|shell|reset}` manages the local database. Use your own MySQL instead by editing `DB_*` in `.env` (and creating `sailix_test` for tests). The credentials in `.env.example`/`phpunit.xml` are local-only placeholders.

## Quality gates

```bash
composer check        # pint --test, phpstan (level 6), php artisan test
php artisan test --testsuite=Isolation    # tenant isolation (merge gate)
php artisan test --testsuite=Contract     # responses vs ../contracts/openapi.yaml
composer audit
```

Suites: `Unit`, `Feature`, `Isolation`, `Contract` (tests run against real MySQL, database `sailix_test`).

## Layout

`app/Support/Tenancy` (context, fail-closed scope, trait) · `app/Identity` (login, tokens, invitations — cross-tenant by nature) · `app/Platform` (tenant lifecycle, invitations) · `app/Http` (controllers `Api/V1/{Auth,Tenant,Platform}`, requests, resources, middleware) · `app/Policies` · `routes/api_v1.php`.

Module/Tala safety: `SAILIX_TALA_ALLOWED_HOSTS` (comma-separated exact hosts; empty = nothing allowed) is deployment config. A superadmin sets `tala_api_base_url` through `PATCH /platform/settings`; until that succeeds every Tala route answers `503 module_unavailable`. No code or test contacts Tala (`Http::preventStrayRequests()` and a fake DNS resolver are installed in every test).

Mail: transactional mail uses the Laravel driver in `MAIL_MAILER` (default `log` writes to `storage/logs/laravel.log`; production provider undecided, D-11). `SAILIX_RESET_URL` is the web page the reset link opens (default `<first web origin>/reset-password`).

Rules: never accept a tenant id as authority; `withoutTenantScope()` only in `app/Platform` and `app/Identity` (enforced by `tests/Unit/TenancyStaticChecksTest.php`); raw SQL on tenant tables is security-sensitive (no RLS on MySQL, see `../docs/03` §3.6).

## Auth quick reference

| Client | Flow |
|---|---|
| Mobile | `POST /auth/token` → bearer token bound to one membership (selection ticket if several) · `POST /auth/token/refresh` · `DELETE /auth/token` |
| Web tenant admin | `GET /sanctum/csrf-cookie` → `POST /auth/session` (cookie session) |
| Superadmin | `POST /platform/auth/session` with email + password + TOTP |
