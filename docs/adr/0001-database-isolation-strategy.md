# ADR-0001 — Database isolation strategy
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Context:** Multiple manning agencies; PII + payroll data; expected scale small-to-medium; one small team; legacy DB engine unknown.
**Options:** (A) shared DB/shared schema + `tenant_id`; (B) schema per tenant; (C) database per tenant.
**Recommended:** A with defence in depth: fail-closed global scope, composite `(tenant_id,id)` FKs, UUIDv7 keys, CI static/schema checks. **Amended 2026-10-13 (D-6): engine is MySQL, chosen by the user** — Row-Level Security (the proposed second wall on PostgreSQL) is not available, so the compensating controls in docs/03 §3.6 apply.
**Trade-offs:** Simplest ops/migrations/reporting; weakest hard boundary; per-tenant restore/purge is harder.
**Security implications:** Isolation depends on layered controls + mandatory isolation tests (09 §2); Without RLS there is no database-enforced row filter: a raw-SQL query on a tenant table bypasses the scope (residual risk, mitigated by static checks + review).
**Consequences:** Every tenant table follows one pattern; schema-lint enforces it; revisit C if a tenant needs residency/contractual isolation/per-tenant restore SLA.
**Open questions:** compliance obligations; retention policy; whether the residual raw-SQL risk is acceptable long term (otherwise database-per-tenant).
