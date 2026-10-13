# ADR-0006 — API conventions and contract-first
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Context:** Two clients must share one contract; legacy API is inconsistent (Y/N strings, identity in path, two prefixes).
**Options:** code-first generated spec; hand-written OpenAPI as source of truth; GraphQL; tRPC-like shared types.
**Recommended:** REST `/api/v1`, `contracts/openapi.yaml` as source of truth, contract tests on the backend, generated TS types for web and mobile, problem+json errors, additive-only evolution.
**Trade-offs:** Spec maintenance discipline needed; avoids drift that code-first docs allow.
**Security implications:** Explicit auth/scope per operation in the spec; consistent error shapes avoid information leaks.
**Consequences:** CI fails if responses diverge from the spec.
**Open questions:** whether to provide a legacy-compat layer (D-2).
