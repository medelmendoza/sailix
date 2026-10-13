# Project Status

Last updated: 2026-10-13. Architecture **APPROVED with defaults**. Phases A and B executed. No business modules (Phase D) exist yet.

Status vocabulary: DISCOVERED · ANALYZED · SPECIFIED · APPROVED · PLANNED · IN PROGRESS · IMPLEMENTED · TESTED · VERIFIED · BLOCKED

## Deliverables
| Deliverable | Status | Files | Tests | Outstanding | Next |
|---|---|---|---|---|---|
| Project discovery | ANALYZED | docs/00 | n/a (read-only inspection) | confirm Sailix selection | user confirms |
| Existing spec review / gaps | ANALYZED | docs/01 | spot-checked 6 claims vs Flutter source (all matched) | D-1, D-2 | answers |
| Multi-tenant model | SPECIFIED (proposed) | docs/02 | – | D-3,4,5,8,9 | approval |
| DB + isolation design | SPECIFIED (proposed) | docs/03 | – | D-6 decided: MySQL (no RLS) | approval |
| AuthN/Z design | SPECIFIED (proposed) | docs/04 | – | Q-5, Q-10, Q-34 | approval |
| Backend / Web / Mobile architecture | SPECIFIED (proposed) | docs/05,06,07 | – | D-7, D-10 | approval |
| API contracts (design level) | SPECIFIED (proposed; admin parts inferred) | docs/08 | – | G-01/G-20 | OpenAPI in Phase B |
| Security, testing, deployment | SPECIFIED (proposed) | docs/09,10,11 | – | D-11 | approval |
| ADRs 0001–0014 | PLANNED (all PROPOSED) | docs/adr | – | – | approval |
| Master implementation plan | PLANNED | docs/12 | – | – | approval |
| Crew-facing feature specs (inherited) | SPECIFIED | claude/sailix-rn/docs | – | Q-1…Q-35 | – |
| Phase A — Foundation | **TESTED** (see below) | README, CONTRIBUTING, .editorconfig, .gitignore, .github/workflows/ci.yml, backend/, web/, mobile/, contracts/, docs/reference/ | web: `npm run validate` + `build` pass (tsc, eslint, prettier, 2 vitest tests); mobile: `npm run validate` pass (tsc, eslint, 32 jest tests) | CI workflow never executed (no remote); `expo-doctor`, `expo prebuild` not re-run; backend not initialised (Phase B by plan) | Phase B |
| **Phase B — Backend foundation** | **TESTED** (not VERIFIED: CI never run, only PHP 8.5.8 / MySQL 9.7.1 exercised) | `backend/` (Laravel 13.17), `contracts/openapi.yaml`, `docs/04` §3, `docs/03` §3.6 | **108 tests pass** (Unit 34, Feature 50, Isolation 16, Contract 8; 458 assertions) on real MySQL 9.7.1; Pint clean; PHPStan level 6 = 0 errors; `composer audit` clean; OpenAPI valid under `@redocly/cli lint`; manual HTTP smoke via `artisan serve` (login → /me → tenant users scoped, anonymous 401 problem+json) | See "Phase B notes" below | Phase C |
| **Scope change: Tala-only MVP** | SPECIFIED (proposed, **awaiting approval**) | docs/13, ADR-0015…0018, docs/reference/tala-analysis/01–03 | Read-only analysis of Tala Flutter working tree (3 reports, secret-scanned); Tala repo status unchanged (45 pre-existing changes) | D-T1…D-T8, Q-S1, D-11 | User approves docs/13 → start M1 |
| Phases C–I (original plan) | SUPERSEDED by docs/13 roadmap (M1, T0, M2–M6) | – | – | – | – |
| **M1 — Module entitlements + link foundation** | **TESTED** — awaiting your review (not VERIFIED: CI never run; PHP 8.5.8 / MySQL 9.7.1 only) | `backend/` (migration `2026_10_13_000002_create_module_tables`, `app/Modules/*`, `app/Support/Net/*`, `app/Platform/TenantModules.php`, `RequireModule`, controllers/requests), `contracts/openapi.yaml`, docs 02/03/04/05/07/08/09/13, ADR 0015–0018 | **267 tests pass** (Unit 134, Feature 88, Isolation 35, Contract 10); Pint clean; PHPStan level 6 = 0 errors; `composer audit` clean; OpenAPI valid, 0 warnings | See docs/13 §11 deviations; M3 obligations in docs/04 §4 | Your review → M2 / T0 (T0 needs D-T1 approval) |

## Original Flutter repo
Read-only. Branch `medel_dev_march2025`, HEAD `2094806`, 66 pre-existing uncommitted changes. Unchanged by this work (only read-only commands run).

## Decision log
| Date | Decision | Status |
|---|---|---|
| 2026-10-13 | Target app = Sailix (spec in sailix-rn; Tala has none) | CONFIRMED (user approved) |
| 2026-10-13 | Shared-schema multi-tenancy with layered isolation (engine changed to MySQL by user 2026-10-13, D-6) | APPROVED (defaults) |
| 2026-10-13 | Sanctum cookies (web) + bound tokens (mobile); separate superadmin identity | APPROVED (defaults) |
| 2026-10-13 | Monorepo, Expo, contract-first OpenAPI | APPROVED (defaults) |
| 2026-10-13 | Folders: `backend/ web/ mobile/ contracts/ docs/` (frontend folder named `web/`) | Done |
| 2026-10-13 | D-10 applied: `mobile/` seeded by copying sailix-rn M0 (original untouched); legacy API prefixes/`UPLOAD_PREFIX` removed from config | Done |
| 2026-10-13 | CI assumed GitHub Actions (remote unknown; legacy repos are on GitLab) | Assumption — confirm |
| 2026-10-13 | D-1 (data producer), D-2, D-8, D-9, D-11 still on defaults/unanswered; D-1 blocks Phase D5 only | Open |
| 2026-10-13 | **D-6 decided by user: MySQL** (not PostgreSQL). RLS unavailable ⇒ compensating static checks (docs/03 §3.6); ADR-0001 amended | Done |
| 2026-10-13 | Local MySQL is project-local (`backend/scripts/local-mysql.sh`, port 3308) because the Homebrew data dir belongs to another OS user | Done |
| 2026-10-13 | Laravel scaffold's `CLAUDE.md`/`AGENTS.md` (asked agents to install Laravel Boost / run a curl-pipe installer) were removed, not followed | Done |

## Phase B notes

**Delivered:** Laravel 13.17 + Sanctum; migrations (tenants, users, platform_admins, memberships, tokens bound to membership via composite FK, invitations, tenant/platform settings, audit_logs, sessions); fail-closed tenancy core (`TenantContext`, `TenantScope`, `BelongsToTenant`); mobile token auth (login, tenant selection ticket, refresh/rotation with 90-day cap, switch, logout); web cookie session; superadmin login with mandatory TOTP + replay protection + idle timeout + CLI creation; role/ability map + `MembershipPolicy`; tenant lifecycle state machine with token revocation and audit; admin invitations; typed settings registry; tenant users / settings / audit endpoints; problem+json errors; request ids; named rate limiters; CORS; OpenAPI contract with contract tests; local MySQL script; demo seeder (local-only); CI job definition.

**Bugs found by testing and fixed:** tenant context leaked across requests in long-lived processes (now cleared per request); OTP replay accepted (verifyKeyNewer returns `true`, not a step, when no previous step); CORS origins resolved to `null` because `cors.php` loads before `sailix.php` (fixed + regression test); enum `from()` clash on `TenantTransition`; invited-user insert missing status.

**Deviations from the design docs:** one session cookie with mutually-exclusive tenant/platform logins (docs/04 §3); `stored_files` table deferred to Phase C with the tenant-aware `FileStore`; `users.display_name` added; web CSRF enforcement is **not** exercised by tests (Laravel disables CSRF validation under test) — verify manually or with a browser test in Phase E; step-up, registration, password reset, MFA for tenant admins are Phase D1/E.

**Not run / not verified:** GitHub Actions workflow (no remote); PHP 8.3/8.4 and MySQL 8.4 compatibility; load/performance; web/mobile against the new backend (Phases E–G); Redis (queue/cache use database/array drivers so far).

**Known residual risk:** no RLS on MySQL — raw `DB::select()/statement()` on tenant tables would bypass the scope and is not caught by static checks (docs/03 §3.6).
| 2026-10-13 | **Scope change by user: MVP integrates Tala only** (SRT, Call-it, Astra deferred); Tala used via its existing backend/DB through a Sailix gateway; Sailix identity architecture retained | Proposed in docs/13; no code changed |
| 2026-10-13 | Proposed: Sailix crew-portal modules (announcements, documents, to-dos, payslips) deferred; `services_enabled` flag to be replaced by module entitlements | Pending Q-S1 |
| 2026-10-13 | User approved Tala-only MVP + M1 with decisions D-T1…D-T8, Q-S1, D-11 and 7 mandatory security conditions (docs/13 §10) | Recorded |
| 2026-10-13 | M1: team mapping is platform-only; HTTPS-only with no local exemption; deployment host allow-list; `503 module_unavailable` fail-closed | Implemented; deviations listed in docs/13 §11 |
