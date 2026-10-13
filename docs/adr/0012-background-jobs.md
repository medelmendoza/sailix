# ADR-0012 — Background jobs
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Options:** sync only; database queue; Redis queue (+ Horizon).
**Recommended:** Laravel queues on Redis (database driver acceptable for small installs), `TenantAwareJob` base that restores context and fails closed, per-tenant scheduler fan-out; queues `default/mail/imports`.
**Trade-offs:** One more infra component (Redis).
**Security implications:** Prevents wrong-tenant execution; tenant re-validated (must be active) at run time.
**Consequences:** All jobs carry `tenant_id`; platform jobs live under `app/Platform`.
**Open questions:** import volume (D-1) may add chunked/batched jobs.
