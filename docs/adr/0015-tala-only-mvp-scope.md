# ADR-0015 — Initial MVP integrates Tala only
Status: **PROPOSED (awaiting approval of docs/13)**
**Context:** The user narrowed the MVP: integrate Tala only; SRT, Call-it and Astra are future phases. Phase B (identity, tenancy, lifecycle) is complete. Tala has its own backend/DB and a Flutter app (analysis: docs/reference/tala-analysis).
**Options:** (1) keep the original Sailix crew-portal MVP and add Tala; (2) Tala-only MVP on the Sailix identity platform; (3) replace Sailix identity with Tala's.
**Recommended:** (2). Sailix provides identity, organizations, roles, module access and account linking; Tala content stays in Tala's backend. Sailix crew-portal modules (old D2–D7) are deferred, not deleted.
**Trade-offs:** The crew-portal features already specified wait; the platform is built before any Sailix-native module exists.
**Security implications:** One identity provider (Sailix) in front of Tala's weaker auth (plaintext HTTP, path-scoped ids).
**Consequences:** Roadmap re-based on docs/13; Phase C slimmed; Phase B changes limited to docs/13 §5.
**Open questions:** Q-S1 (confirm crew-portal deferral), D-T1…D-T8.
