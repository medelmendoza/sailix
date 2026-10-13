# Coding standards

Authoritative design: `docs/`. If code and docs disagree, fix one in the same change.

## Global
- Work only inside this repo. The Flutter project is read-only reference.
- Backend owns business rules and authorization; clients never enforce them alone.
- **Tenancy:** never accept a tenant id from a request as authority; never use `withoutTenantScope()` outside `backend/app/Platform/**`; every tenant-owned table/model follows `docs/03`.
- No secrets, tokens, PII, or production data in code, fixtures, logs, or docs.
- Contract changes: edit `contracts/openapi.yaml` first, then backend + clients in the same PR.
- Tests ship with the change; isolation tests for every tenant-owned module. Don't disable a security control to make a test pass.
- Small, reviewable PRs; Conventional-style commit subjects (`feat(backend): …`).

## Backend (PHP/Laravel)
Pint for style, PHPStan/Larastan, PHPUnit/Pest. Thin controllers → FormRequest → Action → Resource. No generic repositories. `$fillable` allow-lists; never fillable: `tenant_id`, `role`, `status`.

## Web / Mobile (TypeScript)
`strict` + `noUncheckedIndexedAccess`; no `any`; ESLint `--max-warnings=0`; Prettier (single quotes, width 100). Screens never call Axios directly (hooks → services → client). No tokens in `localStorage`; no `dangerouslySetInnerHTML`.

## Definition of done
Relevant gates actually run and green (see README), docs and `docs/PROJECT-STATUS.md` updated, unrun checks reported as *not run*.
