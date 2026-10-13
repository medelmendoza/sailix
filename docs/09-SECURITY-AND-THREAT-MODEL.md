# 09 — Security and Threat Model

Status: PROPOSED. Data classes: seafarer PII (name, DOB, phone, email, address), financial (payslips, bank accounts, loans), identity/certification documents, credentials. Carries forward SR-01…SR-17 from the existing spec (`13-SECURITY-REQUIREMENTS`) for the mobile client.

## 1. Threat assessment

| # | Threat | Likelihood / impact | Controls (doc ref) | Verified by |
|---|---|---|---|---|
| T1 | Cross-tenant data access | M / Critical | Layers in 03 §4: bound token, fail-closed scope, composite FKs, RLS, policies | Isolation suite (§2) |
| T2 | Broken object-level authorization (BOLA/IDOR) — the legacy app's known flaw | H / Critical | Identity from token only; UUIDv7 ids; policy on every action; foreign ⇒ 404 | per-endpoint ownership tests |
| T3 | Privilege escalation (crew→admin, admin→superadmin) | M / Critical | Fixed role map; rank check on assignment; separate platform table/guard/MFA; last-admin guard | role matrix tests |
| T4 | Tenant context spoofing (header/body/path/query) | H / Critical | Tenant never accepted as input; `X-Tenant-Hint` mismatch ⇒ 409 | spoof tests |
| T5 | Session hijack / token leakage | M / High | HttpOnly+Secure+SameSite cookies; Keychain/Keystore; hashed tokens at rest; expiry+rotation; per-device revoke; TLS only; no tokens in logs/URLs | token tests, log-scrub test |
| T6 | CSRF | M / High | Sanctum CSRF on cookie routes; token routes reject cookies | web feature tests |
| T7 | XSS | M / High | React escaping, strict CSP, sanitize any rich text (announcement body = plain text/markdown subset, not raw HTML), no `dangerouslySetInnerHTML` | lint rule + CSP test |
| T8 | SQL injection | L / Critical | Eloquent/bindings only; raw SQL banned on tenant tables except reviewed helper | static check |
| T9 | Mass assignment | M / High | `$fillable` allow-lists; `tenant_id`, `role`, `status` never fillable; Form Requests return validated() only | unit tests |
| T10 | Unsafe file uploads | M / High | Content-sniffed PDF/image only, size limit, random storage names, private bucket, no execution path, AV hook | upload tests (spoofed extension) |
| T11 | Unauthorized exports/reports | M / High | Generated in tenant-bound jobs, stored as tenant files, authorized download, short-lived URL | export tests |
| T12 | Sensitive data in logs | M / High | Redaction processor (passwords, tokens, DOB, bank no., request bodies of auth/finance); `APP_DEBUG=false` outside dev | log test |
| T13 | Cache leakage between tenants | M / High | `TenantCache` helper, `t:{id}:` prefixes, lint for raw `Cache::` in tenant code | cache tests |
| T14 | Jobs run under wrong tenant | M / High | `TenantAwareJob` fails closed; per-tenant fan-out; tenant re-validated at run | job tests |
| T15 | Improper CORS | M / Medium | Exact-origin allow-list per env | config test |
| T16 | Excessive API permissions | M / Medium | Abilities per role; least privilege; no wildcard abilities on tokens | policy matrix |
| T17 | Account enumeration | M / Medium | Uniform login/reset responses and timing; register message trade-off documented (Q-5) | tests |
| T18 | Rate-limit bypass / credential stuffing | M / High | Per identifier+IP limits, lockout, `Retry-After`, MFA for admins | throttle tests |
| T19 | Payslip access on stolen unlocked phone | M / High | Server step-up, short capability, background re-lock, app-switcher masking (Q-32) | e2e/manual |
| T20 | Superadmin compromise | L / Critical | Mandatory TOTP, short sessions, audited, no impersonation, minimal accounts | auth tests, ops checklist |
| T21 | Supply chain (JS/PHP deps) | M / High | Lockfiles, `composer audit`/`npm audit` in CI, Dependabot, pinned CI actions | CI |
| T22 | Backup/restore leaks or loss | L / Critical | Encrypted backups, restore drills (11) | drill record |
| T23 | Mobile reverse engineering | H / Low | No secrets in bundle (SR-01) | review |

## 2. Mandatory isolation tests (Phase C gate; extended per module)

Implemented in `backend/tests/Isolation/` with two seeded tenants (A, B), each with admin + two crew, and fixture records for **every** tenant module (announcements, crew documents + files, to-dos, payslips, loans, settings, audit, imports).

1. A cannot list B's records (each module).
2. A cannot GET B's record by guessed/valid id → 404.
3. A cannot update/delete B's record.
4. A cannot attach its record to B's parent (FK/validation rejects: doc type, file, membership, import row).
5. A cannot download B's files (direct id, signed-URL reuse after expiry, URL from another user).
6. A cannot reach B's reports/exports.
7. A cannot trigger or read B's background operations (imports, exports); job without tenant context fails.
8. Tenant admin ⇒ every `/platform/*` route 403/404; crew ⇒ every `/tenant/*` route 403.
9. Modified `X-Tenant-Hint`, body `tenant_id`, route model binding with foreign ids, forged ticket/membership id ⇒ rejected; cannot switch to a membership one does not own.
10. Switching membership: old token only sees old tenant; new token only new; cache keys/state differ; old token revoked.
11. **Forgotten-filter test:** a test-only route/query intentionally written without `where tenant_id` still returns only current-tenant rows (global scope) and throws without context; with RLS enabled, raw SQL without predicate returns only current-tenant rows.
12. **Schema lint:** every table with `tenant_id` has leading-tenant indexes and composite FKs; every model of such a table uses `BelongsToTenant`.
13. Suspended tenant: all its tokens/sessions fail immediately; reactivation restores; other tenants unaffected.
14. Cache poisoning: same logical key in two tenants returns separate values.
15. Platform-only scope escape hatch not referenced outside `app/Platform/**` (static check).

No claim of "complete isolation" is made from middleware existing; the claim is bounded by these tests plus the periodic review in Phase I.

## 3. Secure development & operations
Secrets only in environment/secret manager; `.env*` ignored; example files with placeholders only. CI: Pint, PHPStan, PHPUnit (incl. Isolation), `composer audit`, ESLint/tsc/Vitest, `npm audit`, secret scanning. Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy). Audit log for auth events, role changes, tenant state, document review, finance access/exports. Incident basics: token revocation switch, tenant suspend, key rotation procedure (documented in 11).

## 4. Known risks accepted pending your decision
Legacy API remains exposed if it stays online (D-2) — out of this project's control but should be escalated; client-supplied identity in the old app means compat shims must **ignore** path identity and use the token.
