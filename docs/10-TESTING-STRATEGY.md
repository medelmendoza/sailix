# 10 — Testing Strategy

Principle: a feature is not done until its tests ran and passed; gates are executed, never assumed. Environment limits (no device, no simulator) are reported as *not run*.

## 1. Backend (PHPUnit or Pest; MySQL in CI and locally, same engine as prod)
| Layer | Scope |
|---|---|
| Unit | Tenancy support classes, settings registry, role→ability map, money/date helpers, expiry-status rules, state machine for tenant lifecycle |
| Feature/API | Every endpoint: success, validation (422), auth (401), authz (403/404), pagination/filter/sort whitelist, idempotency |
| Authentication | Login/throttle/lockout, token bound to membership, refresh/revoke, suspended user/tenant, step-up, reset flow, MFA (platform) |
| Authorization | Policy matrix generated from the role map (role × action × ownership × tenant) |
| **Isolation** | The 15-point suite in 09 §2 for **every** tenant module; runs on every PR; failing it blocks merge |
| Business rules | BR-xx rules turned into tests (expiry colouring inputs, resubmit gating, payslip kind routing, loan totals passthrough, read-state) |
| DB constraints | Composite-FK rejection of cross-tenant links, unique-per-tenant, static tenancy checks (no RLS on MySQL) |
| Files | Type sniffing, size limits, authorized download, signed-URL expiry, tenant path prefix |
| Jobs/scheduler | Tenant context restore, fail-closed, per-tenant fan-out, retry |
| Contract | Responses validated against `contracts/openapi.yaml`; spec lint in CI |
Coverage target: meaningful, not numeric-only; isolation and authz paths 100% of endpoints.

## 2. Web (Vitest + RTL + MSW; Playwright)
Components & form validation · route-guard matrix (anonymous, crew-with-no-access, tenant admin, superadmin) · superadmin permission tests (platform routes unavailable to tenant admin; API 403 handled) · tenant permission tests (menu from abilities, forbidden actions disabled and server-rejected) · tenant context (membership picker, cache cleared on switch/401) · API integration against MSW and, in CI, against the real backend container (smoke).

## 3. Mobile (jest-expo + RNTL + MSW)
Unit (mappers, money, dates, state machines) · component (login incl. tenant selection, registration, upload form, step-up prompt, todo rollback) · navigation (auth gate swap) · authentication/session (bootstrap, 401 wipe, `tenant_suspended`, switch) · API error handling (every problem+json `code`) · local storage (secure-store mocks; verify no data in AsyncStorage) · tenant context (stale response discarded, query keys scoped, caches cleared) · **native integration on real devices** (scanner, PDF, audio, picker, biometrics) — manual checklist per release; marked *not run* when no device available.

## 4. End-to-end workflows (Playwright + API + device checklist)
1. Superadmin creates organization → 2. activates (needs tenant admin invite) → 3. tenant admin provisioned, sets password, MFA optional → 4. authenticates on web → 5. manages announcements/to-dos/doc review/finance data → 6. crew registers on mobile, admin activates → 7. mobile logs in against same backend → 8. crew performs permitted operations (read announcement, upload doc, toggle todo, view payslip after step-up) → 9. tenant admin denied access to other tenant (UI + API) → 10. superadmin performs lifecycle operations; suspended tenant: web and mobile sessions rejected immediately, reactivation restores. Scenarios adjusted after D-1/D-8 answers.

## 5. CI gates
Backend: Pint, PHPStan, tests (incl. Isolation, Contract), migrations on fresh DB, `composer audit`. Web: `tsc`, ESLint, Prettier check, Vitest, build, `npm audit`. Mobile: `tsc`, ESLint `--max-warnings=0`, jest, `expo-doctor`, prebuild smoke. Path-filtered per project; a contract change must pass all three.
