# ADR-0003 — Membership model and tenancy implementation
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Context:** Users may someday belong to multiple agencies; superadmin must be separate; need a small auditable tenancy layer.
**Options:** user.tenant_id single FK; explicit memberships; tenancy package (e.g. a general-purpose multi-tenancy library); custom minimal layer.
**Recommended:** `users` (identity) + `memberships` (tenant, role, status) + tenant-owned `crew_profiles`; `platform_admins` separate. Custom ~6-class `Support/Tenancy` layer, no package.
**Trade-offs:** Slightly more joins; we own the code (and its tests) instead of depending on a package's model.
**Security implications:** Roles evaluated per membership, never global; superadmin cannot be reached via tenant paths.
**Consequences:** Policies read `TenantContext`; migrations use composite-FK helpers.
**Open questions:** D-3, D-4, D-5.
