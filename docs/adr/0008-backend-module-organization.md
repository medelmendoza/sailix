# ADR-0008 — Backend module organization
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Options:** layered-by-type only; domain-modular packages; DDD with repositories.
**Recommended:** Laravel-conventional folders with feature grouping inside Actions/Models/Policies; thin controllers; `Support/Tenancy` and `Platform` as the only tenancy-sensitive areas. No generic repositories/interfaces.
**Trade-offs:** Less ceremony; refactor to modules if size demands.
**Security implications:** `withoutTenantScope()` confined to `app/Platform/**` and statically checked.
**Consequences:** One Action per use case; one FormRequest per write.
**Open questions:** none.
