# contracts

`openapi.yaml` is the single source of truth for `/api/v1` (ADR-0006). Backend contract tests validate responses against it; `web/` and `mobile/` generate TypeScript types from it. Design summary: `docs/08-API-CONTRACTS.md`.
