# 12 — Master Implementation Plan

Status: PLANNED (awaiting approval). Nothing below is started. "Complete" means acceptance criteria met **and** checks executed with results recorded in `PROJECT-STATUS.md`.

Ordering rule: backend contracts + tenant security first; Phase C gates everything else; web/mobile follow module by module; mobile may start Phase G scaffolding in parallel after the contract for auth/me is stable (Phase B), because the existing M0 foundation is reusable.

## Phase A — Foundation
- Dependencies: your approval, D-7 (repo), D-10 (mobile seed).
- Deliverables: `git init` in `sailix_v2`; layout `backend/ web/ mobile/ contracts/ docs/`; copy (not move) reference specs to `docs/reference/`; tooling (Pint, PHPStan, ESLint, Prettier, editorconfig); CI skeleton with path filters; `.env.example`s; `CONTRIBUTING`/coding standards; ADRs finalised.
- Acceptance: fresh clone builds each project's empty skeleton; CI green; no secrets in repo.
- Risks: toolchain drift (PHP 8.5 vs supported range) → pin versions. Tests: CI smoke.

## Phase B — Backend foundation (**IMPLEMENTED + TESTED 2026-10-13**; see PROJECT-STATUS for evidence and deviations)
- Dependencies: A, D-4, D-6, Q-5.
- Deliverables: Laravel init; MySQL config; migrations for platform + identity (`tenants, users, platform_admins, memberships, tenant_settings, tokens, audit_logs, stored_files`); Sanctum token + SPA flows; `ResolveTenantContext`; role map + policies; tenant lifecycle actions; API versioning, problem+json handler, rate limiters; audit logging; `contracts/openapi.yaml` (auth/me/platform/tenant core) + contract tests.
- Acceptance: auth, authorization, lifecycle tests pass; OpenAPI lint passes; migrations run on fresh dev DB.
- Risks: Sanctum cookie topology (same registrable domain) → verify in staging; MFA library choice. Tests: unit + feature + auth.

## Phase C — Tenant isolation (hard gate)
- Dependencies: B.
- Deliverables: `BelongsToTenant` + fail-closed scope; composite-FK helper macros for migrations; schema-lint test; `TenantAwareJob`; `TenantCache`; tenant-scoped `FileStore`; RLS spike **dropped** (MySQL decided, D-6): compensating static checks implemented instead; isolation suite scaffolding with two seeded tenants and a **sample tenant-owned module** used only for the harness (replaced by real modules in D).
- Acceptance: all 15 isolation checks (09 §2) green including forgotten-filter and cross-tenant FK tests; static checks for scope escape hatch pass.
- Risks: raw-SQL bypass risk without RLS; performance of composite indexes. **No business module starts before this passes.**

## Phase D — Core business modules (in dependency order)
Each module delivers: migration, endpoints, rules, policies, tenant ownership, **isolation tests**, OpenAPI update, web admin screens (if applicable), mobile screens, docs.

| # | Module | Depends on | Key content | Blocking decisions |
|---|---|---|---|---|
| D1 | Identity & profile | B,C | register, activate, `/me`, password, sessions, deletion-request | D-4, Q-3, Q-5, Q-34 |
| D2 | Announcements | D1 | list/read state/attachments (files) + admin CRUD | G-03 |
| D3 | Documents | D1 | types, upload/resubmit/review, files, expiry status | G-04, Q-13/14/16 |
| D4 | To-do | D1 | assign/toggle | – |
| D5 | Finance | D1 | loans, payslips, step-up, import/management | **D-1/G-02**, Q-6/7/8/10 |
| D6 | Dashboard | D2–D4 | combined summary | Q-27 |
| D7 | Services (ASTRA) flag | – | mobile-only content, tenant flag | Q-25 |
Acceptance per module: backend tests + isolation tests green, OpenAPI conforms, UI states complete. Priority default: D1 → D2/D3/D4 → D5 → D6 → D7 (D5 may start earlier if payroll ingestion is the business priority).

## Phase E — Superadmin portal
Dependencies: B, C. Deliverables: auth + MFA, platform layout, organization CRUD/lifecycle with reasons, tenant-admin invites, platform settings, audit view, route guards. Acceptance: Playwright flows; tenant-admin cannot reach/act on platform routes. Risks: scope creep (billing) — excluded.

## Phase F — Tenant administration portal
Dependencies: B, C, modules D1–D5 as they land. Deliverables: tenant layout/navigation from abilities, dashboard, users, announcements, to-dos, document review, finance data, settings, audit. Acceptance: role-matrix tests, E2E per module, a11y checks.

## Phase G — Mobile application
Dependencies: B (auth), D modules incrementally; spikes S1–S3 before documents/services. Deliverables: adopt M0 (D-10), tenant-aware session store, API client for `/api/v1`, screens per spec, native features, error mapping, tests. Acceptance: tsc/lint/jest pass; device-verified scanner/PDF; session wipe tests; iOS/Android builds where environment allows (else reported *not run*).

## Phase H — Cross-platform integration
Verify API compatibility via contract tests against both clients, consistent rules, auth/session behaviour, isolation re-run with real clients, file handling, reports, E2E workflows (10 §4). Acceptance: all E2E green; no contract drift.

## Phase I — Production readiness
Security review (threat model re-walk, dependency audit, pen-test-style abuse tests), performance (index/EXPLAIN review, load sample), accessibility, deployment validation on staging, **backup/restore drill**, monitoring, runbooks, store checklists, release checklist. Acceptance: checklist signed off; open critical defects = 0.

## Cross-cutting
- Status tracking in `docs/PROJECT-STATUS.md`; decision log appended per session.
- Estimates deliberately omitted (no team/velocity data); sizing after D-1/D-7 answers.
- Stop-and-ask triggers: D-1, D-8, D-9, any destructive migration, any production access, store submission.
