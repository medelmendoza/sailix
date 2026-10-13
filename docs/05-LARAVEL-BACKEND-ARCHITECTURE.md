# 05 — Laravel Backend Architecture

Status: PROPOSED. Target: current stable Laravel (a local skeleton shows Laravel ^13.8 / PHP ^8.3; PHP 8.5.8 is installed here). Verify supported PHP/Laravel versions and package compatibility at install; do not copy the unrelated skeleton at `~/development/laravel/backend`.

## 1. Principles
Laravel conventions first; modular by domain; **no empty abstraction layers** (no generic repositories/interfaces). Controllers thin → Form Request validates → Action/Service performs a use case → Resource shapes output. Business rules live here only.

## 2. Structure

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/V1/
│   │   │   ├── Auth/            # token, session, register, password, step-up, me
│   │   │   ├── Crew/            # announcements, documents, todos, payslips, loans, dashboard
│   │   │   ├── Tenant/          # tenant-admin endpoints
│   │   │   └── Platform/        # superadmin endpoints
│   │   ├── Middleware/          # ResolveTenantContext, EnsurePlatformContext, TenantHintGuard, ForceJson
│   │   ├── Requests/            # one FormRequest per write action
│   │   └── Resources/           # API resources (stable contract)
│   ├── Models/                  # Eloquent; tenant models use BelongsToTenant
│   ├── Policies/
│   ├── Actions/                 # RegisterCrew, SubmitCrewDocument, ReviewDocument, ImportPayslips…
│   ├── Support/Tenancy/         # TenantContext, BelongsToTenant, TenantScope, TenantAwareJob, TenantCache
│   ├── Modules/                 # module registry, entitlements; Modules/Tala = Tala adapter (guard now, gateway in M3)
│   ├── Identity/                # login/token/invitation resolution (cross-tenant by nature)
│   ├── Platform/                # tenant lifecycle, invitations; with Identity/ the ONLY code allowed to use withoutTenantScope()
│   ├── Jobs/  Events/  Listeners/  Notifications/
├── database/{migrations,factories,seeders}
├── routes/api_v1.php  (+ web.php for Sanctum cookie routes)
├── tests/{Unit,Feature,Isolation,Contract}
└── docs/                        # generated OpenAPI served in non-prod
```
Domain grouping inside `Actions/` and `Models/` by feature (Announcements, Documents, Todos, Finance, Identity, Tenancy) as the module count grows; no premature package split.

## 3. API conventions (v1)

| Topic | Convention |
|---|---|
| Base | `/api/v1`; identity never in path; kebab-case plural resources |
| Methods | `GET` read, `POST` create/commands, `PATCH` partial update, `PUT` replace (rare), `DELETE`; multipart uploads use `POST` (also for update, avoiding `_method` spoofing hacks) |
| Success | `{ "data": …, "meta": {…}, "links": {…} }` (Laravel resources) |
| Errors | RFC 9457 `application/problem+json`: `type`, `title`, `status`, `code` (stable machine code), `detail`, `errors{field:[msgs]}`, `request_id`. No stack traces. |
| Validation | `422` with `errors`; backend rules are authoritative; React/RN mirror for UX only |
| Pagination | `?page`, `?per_page` (default 20, max 100) with `meta.total` etc.; cursor pagination for large append-only lists (payslips, audit) |
| Filtering/sorting | `filter[field]=`, `sort=-created_at`; whitelist per endpoint |
| Auth/authz failures | 401 / 403 / 404-for-foreign-tenant / 419 / 429 as in 04 |
| Rate limits | Named limiters (`auth`, `api`, `uploads`), headers `RateLimit-*`/`Retry-After` |
| Uploads | PDF/image only by **content sniffing** (not extension), size limits from settings, stored private, virus-scan hook point; response returns file resource id |
| Dates/money | ISO 8601 UTC dates; money as decimal strings; booleans are booleans |
| Compatibility | Additive changes only within v1; `Deprecation`/`Sunset` headers when retiring; breaking change → `/v2` |
| Idempotency | `Idempotency-Key` honoured on upload/create-submission to make mobile retries safe |
| Contract | `contracts/openapi.yaml` is the source of truth (ADR-0006); contract tests assert responses conform; TS types generated for web and mobile |

## 4. Cross-cutting services
- **Audit:** `Auditable` observer + explicit `Audit::record()` for security events (login, role change, tenant state change, document review, export). Stores actor, tenant, subject, redacted diff, IP, UA; append-only.
- **Files:** `FileStore` wrapper over Laravel filesystem (S3-compatible disk in prod, local in dev): put/stream/temporary-URL, enforcing the `tenants/{tenant_id}/` prefix and policy check.
- **Queues:** Redis (or database for small installs) queue; `TenantAwareJob`; separate queues `default`, `mail`, `imports`; failed-job table; retry/backoff documented.
- **Scheduler:** per-tenant fan-out (e.g. prune expired tokens, expiry reminders if approved later).
- **Mail:** Laravel Mailables via configurable SMTP/API driver (provider chosen by D-11), queued, tenant branding from settings.
- **Settings:** typed `SettingsRegistry` (platform/tenant), cached with tenant-prefixed keys.
- **Observability:** structured JSON logs to stdout; request id middleware; health at `/up` (+ readiness checking DB/cache/queue).

## 5. Module map (derived from approved-for-analysis spec; endpoints in 08)

| Module | Spec ref | Tenant ownership | Crew API | Admin API (inferred) |
|---|---|---|---|---|
| Identity & profile | AUTH-01..08 | users global; profile tenant | login/register/me/password/delete-request | user mgmt, activation |
| Announcements | ANN | tenant | list, show, mark read | CRUD + attachment |
| Documents | DOC | tenant | list, upload, resubmit, file | review, types |
| To-do | TODO | tenant | list, toggle | assign/CRUD |
| Finance | FIN | tenant | loans, payslips | import/manage (D-1) |
| Dashboard | DASH | tenant | combined summary | tenant dashboard |
| Services (ASTRA) | SVC | none (static content) | flag only | tenant setting |
| Tenancy/Platform | new | — | — | tenants, platform settings, audit |

## 6. Dependencies (justify each; add only when needed)
`laravel/sanctum` (auth) · S3 Flysystem adapter (storage) · `predis`/phpredis (queue/cache/throttle) · `laravel/pint` (style) · PHPStan/Larastan (static analysis) · PHPUnit or Pest (tests) · optional `laravel/fortify` for headless 2FA/reset (decide in Phase B) · an OpenAPI request/response validator for contract tests. No tenancy package: the ~6 small classes in `Support/Tenancy` are simpler to audit than a general framework (ADR-0003).

## 7. Migrations & seeding
Version-controlled migrations; seeders for local dev only (one platform admin placeholder password from env, two demo tenants for isolation tests, clearly flagged as non-production). No production DB access during development.

## M1 note
`app/Modules` holds the module registry (`Module` enum), `ModuleAccess`, `SetModuleEnabled`, and `Tala/` (`TalaEndpointGuard`, `ApprovedTalaEndpoint`). `app/Support/Net` holds the DNS seam (`HostResolver`) and `PublicAddress`. Platform provisioning lives in `app/Platform/TenantModules`.
