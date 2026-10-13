# Sailix v2 — multi-tenant platform

Laravel API + React web portal + React Native mobile app, rebuilt from the Flutter app `sailix` (read-only reference, never modified).

| Folder | What | Status |
|---|---|---|
| [`backend/`](backend) | Laravel REST API (`/api/v1`), tenancy, auth | Phase B (not yet initialised) |
| [`web/`](web) | React + TypeScript portal (superadmin + tenant admin) | Phase A skeleton |
| [`mobile/`](mobile) | Expo / React Native crew app (seeded from `sailix-rn` M0) | Phase A, gates green |
| [`contracts/`](contracts) | OpenAPI contract — source of truth for both clients | Phase B |
| [`docs/`](docs) | Architecture, ADRs, plan, status, reference specs | Approved 2026-10-13 |

Start with [`docs/12-MASTER-IMPLEMENTATION-PLAN.md`](docs/12-MASTER-IMPLEMENTATION-PLAN.md) and [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md). Standards: [`CONTRIBUTING.md`](CONTRIBUTING.md).

Each project is independent (own dependencies, tooling, CI job). They share only `contracts/`.

## Quality gates
```bash
(cd web    && npm ci && npm run validate && npm run build)
(cd mobile && npm ci && npm run validate)
# backend: see backend/README.md once initialised (Phase B)
```

## Secrets
Never commit real secrets. Only `*.example` env files are tracked and hold placeholders.
