# ADR-0002 — Tenant resolution method
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Context:** Web has a hostname, mobile does not; a client-supplied tenant id is not proof of authorization.
**Options:** per-tenant subdomains; custom domains; tenant-selection flow; authenticated org context; API tenant header; combination.
**Recommended:** Authenticated organization context derived server-side: token/session bound to `membership_id`; selection step only when a user has several memberships; optional `X-Tenant-Hint` compared and rejected on mismatch. No subdomains/custom domains (no evidence needed them).
**Trade-offs:** No vanity URLs per agency; every request re-validates membership (small cost).
**Security implications:** Eliminates header/path/body spoofing as an attack vector; tenant suspension takes effect immediately.
**Consequences:** `ResolveTenantContext` middleware, token schema with membership binding, switch = new token.
**Open questions:** D-4 username scope (agency code at login?); whether agencies want branded URLs.
