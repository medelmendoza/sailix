# 11 — Deployment and Operations

Status: PROPOSED, provider-agnostic. No hosting vendor is chosen or assumed (D-11). Nothing is deployed without explicit approval.

## 1. Runtime topology
| Component | Form | Notes |
|---|---|---|
| API | Container (php-fpm + nginx) behind TLS-terminating load balancer | stateless; horizontally scalable |
| Queue worker(s) | Same image, `php artisan queue:work` | separate queues: default, mail, imports |
| Scheduler | One `schedule:run` instance (or platform cron) | per-tenant fan-out |
| Web portal | Static build (Vite) on any static host/CDN, same registrable domain as the API for cookie auth | CSP + security headers at the edge |
| Database | Managed PostgreSQL 16+ (D-6) | PITR backups, non-owner app role, RLS |
| Cache/queue/throttle | Redis (justified by queue + rate-limit + cache; database driver acceptable for small installs) | tenant-prefixed keys |
| File storage | S3-compatible private bucket, server-side encryption, no public access | keys `tenants/{id}/…` |
| Email | SMTP/API provider via Laravel mail driver (D-11) | SPF/DKIM/DMARC |
| Push | **Not required** (Q-19) | |
| Mobile | EAS Build/Submit → App Store / Google Play | profiles `development`, `staging`, `production`; real release signing (Q-22) |

## 2. Environments
| | Dev | Staging | Production |
|---|---|---|---|
| Data | Seeded fake tenants only | Anonymized/synthetic; never a prod copy with PII | Real |
| Secrets | `.env.local` (ignored) | secret manager | secret manager, rotated |
| Debug | on | off | off |
| Mail | log/mailpit | sandbox | live |
| Storage | local disk | bucket (separate) | bucket (separate) |
| Mobile build | dev client | staging profile → internal testing | production profile |
Environment templates (`.env.example` ×3 projects) contain placeholders only.

## 3. Release & migrations
CI builds immutable images. Deploy order: run migrations (forward-only, backward-compatible expand/contract) → roll API/workers → publish web → mobile via store review (API stays backward compatible across ≥2 app versions; `Deprecation/Sunset` headers). Rollback: previous image; DB rollback only via expand/contract discipline, not `migrate:rollback` in prod. Destructive migrations require approval and a verified backup.

## 4. Backup, restore, DR
Daily full + continuous WAL/PITR; encrypted; storage bucket versioning; **restore drill at least quarterly into an isolated environment with a recorded RTO/RPO** (targets TBD by you). Per-tenant restore is harder in the shared schema — procedure: restore to scratch, extract tenant rows by `tenant_id`, review, import (documented in Phase I; motivation for revisiting DB-per-tenant if per-tenant SLAs arrive).

## 5. Observability
Structured JSON logs (request id, tenant id, membership id; no PII), health `/up` + readiness (DB, cache, queue), uptime check, queue depth/failed-job alerts, error reporting through a provider-agnostic Laravel log channel — **a third-party crash/analytics SDK in the mobile app needs your approval (Q-24)**. Audit log retention per D-9.

## 6. Security operations
TLS everywhere (HSTS), WAF/rate limiting at edge optional, secret rotation runbook, token-revocation and tenant-suspension runbooks, dependency audit cadence, access reviews for platform admins.

## 7. Runbooks to author in Phase I
Deploy/rollback · migration failure · restore drill · tenant suspend/restore · incident (suspected cross-tenant access: suspend tenant(s), revoke tokens, preserve logs) · key rotation · mobile release (store checklists, signing).
