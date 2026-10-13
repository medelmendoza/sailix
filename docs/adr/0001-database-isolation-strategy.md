# ADR-0001 — Database isolation strategy
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Context:** Multiple manning agencies; PII + payroll data; expected scale small-to-medium; one small team; legacy DB engine unknown.
**Options:** (A) shared DB/shared schema + `tenant_id`; (B) schema per tenant; (C) database per tenant.
**Recommended:** A on PostgreSQL 16+, with defence in depth: fail-closed global scope, composite `(tenant_id,id)` FKs, UUIDv7 keys, optional Row-Level Security decided after a Phase C spike.
**Trade-offs:** Simplest ops/migrations/reporting; weakest hard boundary; per-tenant restore/purge is harder.
**Security implications:** Isolation depends on layered controls + mandatory isolation tests (09 §2); RLS adds an independent wall.
**Consequences:** Every tenant table follows one pattern; schema-lint enforces it; revisit C if a tenant needs residency/contractual isolation/per-tenant restore SLA.
**Open questions:** compliance obligations; engine choice (MySQL loses RLS); retention policy.
