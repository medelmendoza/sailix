# ADR-0013 — Testing approach
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Recommended:** PHPUnit/Pest on PostgreSQL with a dedicated Isolation suite as a merge gate; contract tests against OpenAPI; Vitest+RTL+MSW (web), jest-expo+RNTL+MSW (mobile); Playwright E2E; manual device checklist for native features.
**Trade-offs:** Slower CI (real Postgres) for realistic constraint/RLS coverage.
**Security implications:** Isolation claims are bounded by executed tests.
**Open questions:** device farm availability.
