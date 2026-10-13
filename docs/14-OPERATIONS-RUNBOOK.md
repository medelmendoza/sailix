# 14 — Operations runbook (M6 hardening)

Status: written 2026-10-13 alongside the M6 hardening work. **Nothing here has been run against a production
environment — there is none yet.** Production changes need the product owner's separate approval (docs/13 §10).

## 1. Deployment checklist (backend)
| Item | Requirement |
|---|---|
| Transport | HTTPS only in front of the API (TLS terminated by the host/load balancer). The API sends HSTS on secure requests; set `SAILIX_TRUSTED_PROXIES` to the balancer's addresses/CIDRs (comma-separated) so HTTPS, HSTS and client IPs (rate limits!) are detected correctly behind it. Avoid `*`: it lets any client spoof its IP. |
| `APP_ENV=production`, `APP_DEBUG=false` | The demo seeders refuse to run outside `local`/`testing`. |
| `APP_KEY` | Generated once, stored in the secret manager, **never** committed. Encrypts module tokens: see §3. |
| Database | MySQL 8+/9; app user without DDL rights after migration; backups per §6. Migrations are run deliberately, never on boot. |
| Queue | `QUEUE_CONNECTION=database` (or `redis`) **and a supervised `php artisan queue:work`**. Mail is queued (§4); with no worker nothing is delivered. Local development uses `sync`. |
| Mail | `MAIL_MAILER` set to the chosen provider (D-11 undecided). Mail bodies are encrypted in the queue. |
| CORS / cookies | `SAILIX_WEB_ORIGINS` = the exact web portal origin(s); `SANCTUM_STATEFUL_DOMAINS` likewise; `SESSION_SECURE_COOKIE=true`; `SESSION_DOMAIN` set for the real domain. |
| Tala | `SAILIX_TALA_ALLOWED_HOSTS` = exact approved host(s) (deployment config, not editable through the API); platform setting `tala_api_base_url` set by a superadmin; then run `php artisan sailix:tala:check --live` (§5). |
| PHP | `zend.exception_ignore_args` is forced on by the application; keep `display_errors=Off`. |
| Logs | Ship to a restricted store. The application never logs credentials, tokens, upstream bodies or mail content (tested). |
| Secrets | `.env` is not committed; `backend/.env.tala-t0` (T0 test account) is git-ignored and must not exist on servers. |

## 2. Web portal headers (hosting layer)
The SPA is static; set these on the host serving `web/dist`:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://<api-host>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```
`'unsafe-inline'` for styles is needed by Tailwind/Radix runtime styles; scripts stay strict. **Not verified:** these values were not tested against a built portal in a browser (no hosting layer exists yet) — verify with the Playwright suite pointed at the built site before go-live. The API itself already sends `default-src 'none'`, `nosniff`, `no-store`, `no-referrer`, `X-Frame-Options: DENY`.

## 3. Encryption key rotation (module tokens)
Tala tokens are encrypted with `APP_KEY` (model cast). Rotation, in this order:
1. Generate the new key. Set `APP_KEY=<new>` and `APP_PREVIOUS_KEYS=<old>` (comma-separated, newest-first). Deploy. Everything keeps working: Laravel decrypts with any listed key.
2. Run `php artisan sailix:tokens:reencrypt` — rewrites every stored token under the new key and prints counts only (never a token). Exit code is non-zero if some token could not be decrypted with any configured key.
3. Only after it reports `0` unreadable, remove the old key from `APP_PREVIOUS_KEYS`.
4. If an old key is lost: `php artisan sailix:tokens:reencrypt --invalidate-unreadable` wipes those links; the users see "link again".
Sessions/cookies are also encrypted with `APP_KEY`: rotating it signs web users out (expected). Tested: `ModuleTokenKeeperTest` (tokens survive rotation, move to the new key, old key can then be dropped).

## 4. Mail
All transactional mail is queued, retried 4 times with back-off (30 s, 2 min, 10 min) and **encrypted in the `jobs` table** (single-use links must not sit in the database in clear). A permanent failure is logged as `transactional mail permanently failed` with the mail class and exception class only. Monitor the `failed_jobs` table and the queue depth; `php artisan queue:retry all` after fixing the provider. Account-existence is never revealed by delivery failures.

## 5. Tala integration operations
- **Gate before enabling:** `php artisan sailix:tala:check` (offline: approved, https, allow-listed, public addresses only) and `--live` (one unauthenticated HTTPS request proving a verified certificate; reports HSTS). Run it on every deploy and after DNS changes.
- **Verified 2026-10-13 (T0):** the current host serves HTTPS with a valid certificate and HSTS; it **also** still answers plain HTTP without redirecting. The gateway never uses HTTP.
- **Incident — suspected token leak:** `php artisan sailix:tokens:wipe --tenant=CODE` (or `--all`) deletes stored tokens and forces re-link. **This does not revoke tokens at Tala** (no known revocation endpoint; tokens last ~365 days): also ask the Tala owner to rotate their JWT signing secret if a leak is real. Also rotate `APP_KEY` (§3) if the database *and* key may both be exposed.
- **Outage:** Tala down → the gateway answers `503 module_unavailable` and the apps say "not reachable"; links are **not** marked for re-link by an outage. Reads are throttled to 60/min/user, linking to 5/min/user.
- **Kill switch:** disable the module per organization (tenant admin or platform) or clear the platform `tala_api_base_url` to close the gateway for everyone immediately (next request, fail-closed).

## 6. Backup and restore
- `backend/scripts/db-backup-drill.sh [database]` dumps, restores into a scratch database, compares row counts and content checksums of the identity tables, then deletes the scratch database and the dump. **Drill run 2026-10-13 on the local dev database: passed** (22 tables, identical counts and checksums, 5 migrations recorded). That proves the procedure on a small local dataset, **not** production volumes, point-in-time recovery, or cross-version restore.
- Production: automated daily full backup + binary-log PITR (provider-specific, not configured), encrypted at rest, retention per policy, **a restore drill each quarter**. A dump contains password hashes and encrypted tokens: store it encrypted and **keep `APP_KEY` out of the same store** (tokens are useless without it).
- Account-deletion requests are recorded only; data is not deleted automatically (Q-3 open) — backups inherit that.

## 7. CI
`.github/workflows/ci.yml` jobs: `changes`, `web`, `mobile` (blocking baseline audit gate + report-only full audit), `e2e` (Playwright; no artifact upload), `backend`, `secrets` (gitleaks). **It has never run on a real runner** (the repository has no remote). Before relying on it: push to a remote, run it, fix what breaks, then branch-protect `main`.

## 8. Known gaps (not done in M6)
Store identity/signing (Q-22, needs Apple/Google credentials), automated accessibility audit, on-device verification, production observability (metrics/alerts), Tala-owner sign-off, penetration test.
