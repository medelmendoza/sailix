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
| **M2 — Identity completion** | **TESTED** — awaiting your review (not VERIFIED: CI never run; PHP 8.5.8 / MySQL 9.7.1 only; mail provider undecided so only the `log` driver exercised) | migration `2026_10_13_000003_create_account_lifecycle_tables`; `app/Identity/{RegisterCrew,PasswordRules,SessionRevoker}`; controllers `Auth/{Register,PasswordReset}Controller`, `Me/{Password,DeletionRequest}Controller`, `Tenant/DeletionRequestController`; `app/Mail/*` + `resources/views/mail/*`; `SafeMailer`; `contracts/openapi.yaml`; docs 03/04/08/09/13 | **321 tests pass** (Unit 134, Feature 133, Isolation 42, Contract 12; 1244 assertions); Pint clean; PHPStan level 6 = 0 errors; `composer audit` clean; OpenAPI valid; real-HTTP smoke (register → pending → activate → /me → change password → deletion request → forgot → reset → reuse) all as expected | docs/13 §12 (8 decisions to confirm) | Your review → M3 needs T0/D-T1 first, or M4 (web) can start |
| **M4 — Web portal (trimmed)** | **TESTED** — awaiting your review (not VERIFIED: CI never run; Playwright E2E not done; no automated a11y audit) | `web/` (app, components/ui, features/{authentication,tenant,platform,shared}, services/api incl. generated `schema.d.ts`, tests/), `web/README.md`, `docs/06` §7, `docs/13` §13; backend: `DatabaseSeeder` demo superadmin + `DemoSeederTest` | **Web: 88 tests pass** (8 files; guards, auth flows, members, modules, settings/account, platform, session lifecycle, API client, network guard), `tsc`, ESLint `--max-warnings=0`, Prettier, production build, contract drift check, `npm audit` 0. **Backend: 324 tests pass** (Unit 134, Feature 136, Isolation 42, Contract 12), Pint, PHPStan 0, `composer audit` clean. Mutation checks: removing the platform guard / ability check makes tests fail. **Live walk-through** on the real backend: sign-in, approve member, platform TOTP sign-in, provision Tala, sign-out | docs/13 §13 | Your review → M3 (needs T0/D-T1) or M5 mobile read-only parts |
| **M5 — Mobile shell** | **TESTED (JS level)** — awaiting your review (not VERIFIED: no native build/simulator run; CI never run; audit step made non-blocking) | `mobile/` (config/env, api client + errors + generated types, SecureStore, session store, auth/home/module/account screens, navigation gate, test-utils), `docs/13` §14 | **114 tests pass** (13 suites), `tsc`, ESLint, Prettier, `gen:api:check`, `expo export` iOS + Android OK; npm audit: dev-tooling advisories only (documented) | docs/13 §14 | Your review → approve native build, T0/D-T1 for M3, or M6 |
| **Follow-up: native build, Playwright, audit gate** | **TESTED (partly)** — awaiting your review. Native Debug build succeeded; **no interactive simulator verification** (touch injection unavailable); CI never run on a real runner | `web/e2e`, `web/playwright.config.ts`, `backend/database/seeders/E2eSeeder.php`, `backend/bootstrap/app.php` (fix), `mobile/scripts/audit-gate.mjs`, `mobile/audit-exceptions.json`, `.github/workflows/ci.yml` (e2e job, audit gate) | **Playwright 26 pass**; **backend 325 pass** (new regression for a real 500→401 bug), Pint, PHPStan 0; web 88 unit tests, tsc, ESLint, Prettier, build, audit 0; mobile 114 tests; audit gate passes with 2 documented exceptions | docs/13 §15 | Your decisions: org switcher (§15.4), second-org join (§15.5), simulator tooling (§15.6), D-T1 |
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
| 2026-10-13 | User asked to start M2 (no change to approved scope/conditions; Q on MVP ordering left at "Tala-only first") | M2 implemented; stopped for review per the M1 pattern |
| 2026-10-13 | M2: no date of birth/crew id collected; username existence revealed on register; no second-organization join flow yet; forgot/reset enabled (link-only); no email verification; deletion request records only | Proposed — confirm in docs/13 §12 |
| 2026-10-13 | User chose M4 (web portal) next | Implemented; stopped for review |
| 2026-10-13 | M4: Playwright not added (browser download needs approval); live verification done manually in the built-in browser; MSW option corrected to `onUnhandledFrame` | Pending your decision on Playwright |
| 2026-10-13 | Local demo superadmin (`root@example.test`) + published placeholder TOTP secret added to the local-only seeder | Done; documented in backend/README |
| 2026-10-13 | **Correction:** `.github/workflows/ci.yml` had been broken since Phase B (an earlier text replacement deleted the `web` and `mobile` jobs and the path-filter step while leaving valid YAML), so earlier "CI job defined" statements were wrong for web/mobile. Rewritten in full and validated structurally (jobs, `needs`, outputs, commands). **Still never executed on a real CI runner** | Fixed (commit 703d017); remains unverified on a runner |
| 2026-10-13 | User chose M5 (mobile app) | Implemented at JS level; stopped for review |
| 2026-10-13 | M5: mobile CI `npm audit` made non-blocking (high advisories are Expo/Metro/Jest build tooling; no non-breaking fix); native build/simulator run not performed (large native downloads need your OK) | Pending your decision |
| 2026-10-13 | User approved native iOS build/simulator, Playwright, and the audit-gate conditions; D-T1 still NOT approved | Done as far as tooling allowed (docs/13 §15); no Tala calls |
| 2026-10-13 | Mobile audit gate redesigned: blocking baseline gate on production deps (fails on any unreviewed high/critical advisory or unavailable audit) + report-only full audit; 2 exceptions expire 2026-12-15 | Replaces the earlier blanket report-only exception |
| 2026-10-13 | Bug found by Playwright: unauthenticated API call without `Accept: application/json` returned 500; fixed + regression test | Fixed |
| 2026-10-13 | Simulator touch injection did not work on iOS 17.5 or 26.3 under Xcode 27, so UI behaviour is NOT verified on a simulator | Open — needs tooling decision |
| 2026-10-13 | User asked to proceed with the next unblocked item; built organization switching (docs/13 §16). M3/T0 still blocked on D-T1 | Implemented; stopped for review |
| 2026-10-13 | **D-T1 approved**: production host `tala-v3-server.btsolve.com` (confirmed production by the owner), dedicated test account, read-only, HTTPS only (owner said HTTP; HTTPS used because credentials must not go over HTTP) | T0 run: 24 requests, shape-only output |
| 2026-10-13 | T0 complete (docs/13 §17, tala-analysis/04): HTTPS available; 365-day JWTs; roles + join code exposed; weak/unclear path-id authorization; quiz answer keys sent to clients | Awaiting review; M3 not started |
| 2026-10-13 | User approved **M3 read-only**. Implemented gateway (link/unlink/courses/detail/material) + mobile screens; live read-only check against the Tala test account passed | Implemented; stopped for review (docs/13 §18) |
| 2026-10-13 | User asked for M6 hardening (and to check the app on mobile). Delivered docs/13 §19 + docs/14. **CI replay from a fresh clone (NOT a real runner; the repo has no remote): web, mobile (blocking audit gate), backend, OpenAPI lint and Playwright all PASS; the report-only full mobile audit fails as documented.** | Awaiting review |
| 2026-10-13 | Found and fixed: Tala password appeared in logged stack traces (`zend.exception_ignore_args=Off`); regression test added | Fixed |
| 2026-10-13 | User asked for offline mode + progress submission. Offline mode built; progress submission built but **OFF**: the production write probe was blocked by the platform permission check and not worked around (docs/13 §20) | Awaiting your decision on the write test |
| 2026-10-13 | User authorized the write probe and a permission rule; added a narrow project-local rule; ran the probes on the test account (restored each time): Tala **replaces** snapshots, validates nothing, accepts the gateway shape (docs/13 §21) | Done |
| 2026-10-13 | Quizzes built with server-side scoring (flag still OFF by default); live-verified through the gateway on the test account | Awaiting review |
| 2026-10-13 | User chose flashcards + video feedback first. Built (flag still OFF by default); live-verified flashcards through the gateway on the test account; found and fixed a defect (404 for never-synced courses) | Awaiting review (docs/13 §22) |
| 2026-10-13 | User chose My Stats and due dates. Built read-only (works with the write flag off); corrected an earlier error (progress shown as a percentage); pinned test env in phpunit.xml | Awaiting review (docs/13 §23) |
| 2026-10-13 | User asked to apply the design of uupm.cc/demo/mental-health. Applied a soft-UI design system to the mobile app (tokens, components, navigation, screens), contrast-tested; added a demo mode used to review real screens; web portal NOT restyled | Awaiting review (docs/07 §7) |

