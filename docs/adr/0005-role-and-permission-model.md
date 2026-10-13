# ADR-0005 — Role and permission model
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Context:** Spec shows one crew role; admin roles are inferred.
**Options:** fixed roles in code; table-driven roles/permissions; third-party permission package.
**Recommended:** Fixed role set in code (`superadmin` on platform; `tenant_admin`, `crew`; optional staff roles if D-5), mapped to abilities in a single testable class; Laravel policies for enforcement; ownership checks for crew.
**Trade-offs:** No per-tenant custom roles in v1; adding them later means a migration to table-driven permissions.
**Security implications:** Small, reviewable surface; role matrix test generated from the map; rank check prevents escalation.
**Consequences:** No `Gate::before` superadmin bypass.
**Open questions:** D-5.
