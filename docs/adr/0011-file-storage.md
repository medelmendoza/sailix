# ADR-0011 — File storage
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Options:** public bucket + obscure URLs; private bucket + proxy streaming; private bucket + short-lived signed URLs.
**Recommended:** Private S3-compatible bucket, keys `tenants/{tenant_id}/…`, metadata in `stored_files`, access only after a policy check, via streaming or ≤5-minute signed URLs; content-sniffed type validation; local disk in dev.
**Trade-offs:** Mobile PDF viewer must handle expiring URLs.
**Security implications:** No public objects; per-tenant prefix aids audits/purges; signed URLs minted post-authorization.
**Consequences:** `FileStore` wrapper, isolation tests for downloads.
**Open questions:** size/type limits (Q-16), AV scanning, provider/region (D-11).
