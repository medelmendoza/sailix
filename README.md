# Sailix v2 — multi-tenant platform

Laravel API + React web portal + React Native mobile app, rebuilt from the Flutter app `sailix` (read-only reference, never modified).

| Folder | What | Status |
|---|---|---|
| [`backend/`](backend) | Laravel 13 REST API (`/api/v1`), tenancy, auth, MySQL | see `docs/PROJECT-STATUS.md` |
| [`web/`](web) | React + TypeScript portal (superadmin + tenant admin) | see `docs/PROJECT-STATUS.md` |
| [`mobile/`](mobile) | Expo / React Native crew app (seeded from `sailix-rn` M0) | see `docs/PROJECT-STATUS.md` |
| [`contracts/`](contracts) | OpenAPI contract — source of truth for both clients | Phase B core (auth, me, tenant, platform) |
| [`docs/`](docs) | Architecture, ADRs, plan, status, reference specs | Approved 2026-10-13 |

**Current scope:** Tala-only MVP — see [`docs/13-TALA-MVP-SCOPE-AND-ROADMAP.md`](docs/13-TALA-MVP-SCOPE-AND-ROADMAP.md) (proposed). Original plan: [`docs/12-MASTER-IMPLEMENTATION-PLAN.md`](docs/12-MASTER-IMPLEMENTATION-PLAN.md) and [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md). Standards: [`CONTRIBUTING.md`](CONTRIBUTING.md).

Each project is independent (own dependencies, tooling, CI job). They share only `contracts/`.

## Quality gates
```bash
(cd web    && npm ci && npm run validate && npm run build && npm run gen:api:check)
(cd mobile && npm ci && npm run validate)
(cd backend && composer install && cp .env.example .env && php artisan key:generate && scripts/local-mysql.sh init && composer check)
```

## Secrets
Never commit real secrets. Only `*.example` env files are tracked and hold placeholders.
