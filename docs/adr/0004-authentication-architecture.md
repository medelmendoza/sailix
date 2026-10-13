# ADR-0004 — Authentication architecture
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Context:** Browser SPA and native app; need revocation, per-device sessions, no long-lived secrets in JS.
**Options:** Sanctum cookies (SPA) + tokens (mobile); Passport/OAuth2; JWT (self-managed); Fortify-only sessions.
**Recommended:** Sanctum SPA cookie auth for web (same registrable domain), Sanctum expiring hashed tokens for mobile bound to a membership, separate `platform` guard with mandatory TOTP. No OAuth server.
**Trade-offs:** Cookie topology constrains hostnames; Sanctum tokens are opaque (DB lookup per request) — acceptable at this scale.
**Security implications:** HttpOnly cookies + CSRF; Keychain/Keystore tokens; rotation and revocation on password change/suspension.
**Consequences:** `/auth/*` endpoints per 08; rate limits; reset-link flow (no plaintext passwords).
**Open questions:** password policy (Q-5), token TTLs, forgot-password exposure (Q-34), MFA library (verify at install).
