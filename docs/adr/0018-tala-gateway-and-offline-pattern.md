# ADR-0018 — Tala integration via Sailix gateway; offline model
Status: **PROPOSED**
**Context:** Tala API facts F1–F10 (docs/13 §2): plaintext HTTP, ids in URL paths, client-side scoring, snapshot sync, download-first offline model.
**Options:** (A) mobile calls Tala directly; (B) Sailix backend gateway (typed thin proxy under `/api/v1/modules/tala/*`); (C) migrate Tala data into Sailix.
**Recommended:** (B). The gateway derives `userId`/`teamId` from the link (never from the request), enforces entitlement/role/tenant status, calls Tala server-side (HTTPS-only, allow-listed platform-configured host, timeouts, bounded retries, redacted logs), validates response shapes, and returns media URLs as Tala provides them. Mobile offline store: `expo-sqlite` with real keys, scoped per user+membership, download-first like Tala, snapshot upload of COMPLETED items via the gateway (manual + on reconnect), wipe on logout/401/suspension.
**Trade-offs:** Gateway code and Tala-availability coupling vs. credential safety and immediate org control. (C) rejected: contradicts reuse of the existing backend/DB and risks production data.
**Security implications:** SSRF prevented (host is platform-level setting, not tenant-supplied); confused-deputy prevented (ids fixed from link); upstream plaintext HTTP is a production blocker until confirmed HTTPS (D-T2); client-submitted scores and on-device answer keys remain (D-T8).
**Consequences:** Contract tests use recorded sanitized fixtures; **no test or build calls production Tala**; verification spike T0 requires explicit approval and a non-production environment.
**Open questions:** D-T1, D-T2, D-T8; sync idempotency/merge semantics (T0).
