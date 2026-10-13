# ADR-0016 — Module registry and tenant entitlements
Status: **APPROVED 2026-10-13 (user approved the Tala-only MVP and M1 with conditions; see docs/13 §10)**
**Context:** Tala is the first of several future modules (SRT, Call-it, Astra). Access must depend on organization entitlement and organization-specific role.
**Options:** feature flags in settings; code-defined module enum + `tenant_modules` table; a plugin framework with module interfaces.
**Recommended:** Code-defined `Module` enum + `tenant_modules(tenant_id, module, status, config json)`; abilities `module.<code>.use|manage` in the existing role map; `RequireModule` middleware; `/me.modules[]`. Module code lives in `app/Modules/<Name>`. **No abstract module interface or plugin loader until a second module exists.**
**Trade-offs:** Adding a module touches a few known places (enum, abilities, adapter, mobile folder) instead of being fully dynamic; avoids speculative abstraction.
**Security implications:** Entitlement + role + tenant status are checked on every module request; platform/tenant separation unchanged. `config` never holds secrets; platform-only settings (e.g. Tala base URL) live in platform settings.
**Consequences:** Replaces the Phase B `services_enabled` flag. Isolation tests cover `tenant_modules`.
**M1 implementation note:** the entitlement row AND its external-team mapping are provisioned by the **platform** (superadmin); the tenant admin can only enable/disable a provisioned module. This is stricter than the first proposal (docs/13 §7 had the tenant admin send `tala_team_id`) and exists so an organization can never point itself at another organization's team (mandatory condition 3). Reversible if you want tenant admins to map teams.
**Open questions:** per-membership module opt-out (not needed for MVP).
