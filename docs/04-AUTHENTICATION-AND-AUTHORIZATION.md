# 04 — Authentication and Authorization

Status: PROPOSED. Package versions/behaviour (Sanctum, Fortify) must be verified against the installed Laravel release at Phase B — not assumed from memory.

## 1. Authentication

### Mechanisms
| Client | Mechanism | Why |
|---|---|---|
| Web (superadmin + tenant admin) | **Laravel Sanctum SPA cookie auth** (session cookie, `HttpOnly`, `Secure`, `SameSite=Lax`), CSRF via `/sanctum/csrf-cookie` + `X-XSRF-TOKEN` | No long-lived credential in JS. Requires portal and API on the same registrable domain (`portal.example.com` / `api.example.com`). |
| Mobile (crew) | **Sanctum personal access tokens**: opaque, hashed at rest, **expiring**, bound to `membership_id`, one per device, stored in Keychain/Keystore | Simple, revocable per device; no OAuth server needed (not justified). |
| Superadmin | Separate guard `platform` and separate cookie name; **TOTP MFA mandatory** | Isolation from tenant sessions. |

Passport/OAuth server: **not used** (no third-party clients, no delegated access). ADR-0004.

### Identifier & credentials
- Login identifier: `username` (existing behaviour); email accepted as alternate. Uniqueness scope: D-4 (default global unique so mobile login needs no agency code; agency code accepted and, if provided, narrows lookup).
- Password: hashed (bcrypt/argon2 via Laravel hasher). Policy default: min 8, breached-password check optional; **Q-5 says legacy minimum is 5 — you decide**; policy lives in platform settings, tenants may only tighten.
- Registration (mobile): `POST /auth/register` with agency code → pending membership; tenant admin activates (BR-02). Response is uniform to avoid account enumeration where feasible (duplicate-username message is a UX trade-off, Q-5).
- Password reset: **emailed single-use signed link/token (60 min)**, never a plaintext password (G-42). Exposed only after Q-34 answer; endpoint built either way behind a flag.
- Email verification: required for tenant admins and superadmins; for crew, activation by admin is the gate (default).
- MFA: mandatory for superadmin; available (recommended) for tenant admin; none for crew by default.

### Token / session lifecycle
- Mobile token TTL default **30 days sliding**, rotated by `POST /auth/token/refresh` (issues new token, revokes old); absolute max 90 days → re-login. [P, values are placeholders for your approval]
- Web session idle 120 min, absolute 12 h; superadmin 30 min idle.
- Logout: mobile `DELETE /auth/token` revokes the current token; web destroys session. "Log out everywhere" revokes all tokens/sessions of the user.
- Revocation triggers: password change/reset (all other tokens), membership suspended/removed, tenant suspended/deactivated (all tenant tokens), account deletion.
- Multiple devices: allowed; device list/revoke endpoints (`/me/sessions`).
- Rate limiting: login 5/min per (identifier + IP) and 20/min per IP with exponential backoff and temporary lockout; register/reset 5/hour per IP; generic API 60/min per token (higher for file endpoints separately). Uniform error bodies for unknown user vs wrong password.
- Account/tenant suspended: `403` with machine code (`account_suspended`, `tenant_suspended`) — clients show a message and clear the session.
- Auth failures: `401 unauthenticated` (client clears session, BR-05); `403 forbidden`; `419` CSRF mismatch (web); `429` throttled with `Retry-After`.

### CORS / CSRF
CORS allow-list = exact web portal origin(s) per environment, `supports_credentials=true` for the web; mobile (native) is not subject to CORS and **must not** be accommodated with wildcard origins. CSRF protection is on for all cookie-authenticated routes; token routes use `Authorization: Bearer` and are CSRF-exempt by design but never accept cookies.

### Payslip step-up (Q-10) [P]
Server-enforced optional step-up: `POST /auth/step-up` (password re-entry, or biometric unlock on the device followed by password-less *device-bound* proof if later designed) returns a 10-minute `finance` capability on the token; `/payslips*` return `403 step_up_required` without it. Tenant setting `payslip_step_up = none | password` (default `password`, replacing the client-only birthdate check; birthdate fallback only if you insist). Device biometrics remain a UX convenience on top, not the security control.

## 2. Authorization

Rule: **backend is the only enforcement point; hiding UI is cosmetic.** Every controller action calls a policy/gate; unauthorized-but-existing resources in another tenant return `404` (don't confirm existence), same-tenant forbidden returns `403`.

### Roles (v1, fixed set; code-defined)
| Context | Role | Capabilities |
|---|---|---|
| Platform | `superadmin` | CRUD/lifecycle of tenants; provision/invite tenant admins; platform settings; view platform audit log; view tenant status/health. **No** business-record access except via explicit, audited platform endpoints; **no** impersonation. |
| Tenant | `tenant_admin` | Tenant settings/profile; manage memberships (invite, activate, suspend, assign roles ≤ `tenant_admin`); manage announcements, to-dos, document types; review documents; manage payslips/loans (per D-1); view tenant audit log. Cannot touch platform routes or other tenants. |
| Tenant | `crew` | Own profile, own documents (view/upload/resubmit per Q-13), own to-dos (toggle), announcements (read), own payslips/loans. No web access by default. |
| Tenant [U D-5] | e.g. `document_reviewer`, `payroll_officer` | Subsets of tenant_admin abilities. Only if you confirm. |

Implementation: `Gate::before` is **not** used to grant blanket superadmin access (superadmin is a different guard and never reaches tenant policies). Policies per model: `viewAny/view/create/update/delete` + custom (`approve`, `reject`, `activate`). Role→ability mapping in one enum/class so it is testable as a matrix. Upgrade path to table-driven custom roles is open if D-5 requires it. ADR-0005.

Ownership checks for crew: `record.membership_id === ctx.membership_id` in addition to tenant equality. Role assignment cannot elevate above the actor's own rank; last active tenant admin cannot be removed/suspended.

### Authorization failure modes to test
Tenant admin → platform routes (403); crew → tenant admin routes (403); crew A → crew B record in same tenant (404); tenant A admin → tenant B record (404); suspended membership → 403; modified `X-Tenant-Hint` → 409; switched membership → new token, old one valid only for old tenant until revoked.

## 3. Implementation notes and deviations (Phase B, 2026-10-13)

| Topic | Implemented | Difference from the design above |
|---|---|---|
| Superadmin session | Separate `platform` guard and `platform_admins` table; TOTP mandatory with replay protection (`totp_last_step`); 30 min idle timeout; `platform:create-admin` CLI creates the admin and prints the TOTP secret once | **One session cookie, not two.** A browser session holds either a tenant login or a platform login; logging into one logs out the other. Guard separation, not cookie separation. |
| Superadmin enrolment | CLI only; no web enrolment/recovery codes yet | Recovery/rotation flow is a Phase E item |
| Token lifecycle | 30-day token, rotation via `/auth/token/refresh`, 90-day absolute chain (`chain_started_at`), revoked on suspend/deactivate/archive, member suspension, role change | Values are config (`config/sailix.php`), not yet platform settings |
| Tenant context | `ResolveTenantContext` (token `membership_id` or server session) re-validates user, membership, tenant status on **every** request; `X-Tenant-Hint` mismatch ⇒ 409; context cleared at end of request | – |
| Invitations | Platform invites a tenant admin: user + `invited` membership + single-use 72 h token (hash stored). Email via Laravel mail (log driver locally); token is echoed in the response only when `SAILIX_EXPOSE_INVITATION_TOKEN=true` (local/testing) | Provider/templates pending D-11 |
| Password policy | Platform floor (default 8) in settings; tenant may only raise it (validated + resolved as max) | Invitation acceptance applies the platform floor only (tenant context absent on that public route) |
| Rate limits | login 5/min per username+IP, 20/min per IP; platform login 5/min; invitation 10/h; API 120/min per principal | – |
| Not yet built | forgot/reset password, registration, MFA for tenant admins, step-up, device/session list, email verification | Phase D1 / E |
| `users.display_name` | Added to the login identity so admins without a crew profile have a label | Small addition to docs/03 |

## 4. Module gateway security rules (M1; enforced from M3)
1. **Never trust client-supplied `userId`, `teamId`, organization id or role.** Gateway identity comes only from the established context (token → membership → tenant) and the stored link; tests assert query/body/header spoofing has no effect and `X-Tenant-Hint` mismatches are `409`.
2. **Per-request checks** (`tenant.context` then `module:<code>`): tenant active → module provisioned+enabled (`403 module_disabled`) → role ability (`403 module_forbidden`) → approved upstream configured (`503 module_unavailable`). Suspending an organization or disabling the module blocks the next request with an existing token.
3. **Upstream address is platform-controlled.** `tala_api_base_url` is settable only by a superadmin, only as an `https://` bare origin whose host is on the deployment allow-list (`SAILIX_TALA_ALLOWED_HOSTS`, env, not editable via API; empty ⇒ nothing allowed) and resolves only to public unicast addresses (private, loopback, link-local/metadata, CGNAT, ULA, mapped/NAT64 and documentation ranges rejected). Tenants cannot set it (`422 unknown setting`).
4. **M3 obligations** (documented because no HTTP client exists yet): call `TalaEndpointGuard::assertSafe()` per request, connect to a returned address (IP pinning), disable redirects, enforce timeouts/size limits, never send Tala credentials unless the endpoint passed the guard, never log credentials or tokens.
5. **HTTPS unverified (D-T2)** ⇒ the default state is closed: no allow-listed host and no configured URL means every gateway route answers `503 module_unavailable`, and account linking cannot start.
6. **Credential custody:** Tala passwords are never stored or logged; tokens (M3) are stored encrypted, never returned to clients. Key rotation procedure still to be designed.

## 5. M2 implementation notes — registration, activation, reset, change password, deletion request
| Flow | Behaviour |
|---|---|
| Register `POST /auth/register` | Agency code → active tenant only (`422 invalid_agency_code` for unknown *and* inactive). Creates login identity (`active`), **pending** `crew` membership, per-organization profile. Role, status, tenant are server-fixed; extra client fields are ignored. **No token.** Same `202` body whether or not the email already has an account: an existing mailbox gets a notice email and no account is created. Taken username ⇒ `422` on `username` (accepted enumeration trade-off, Q-5; emails are never revealed). Policy = platform floor raised by the target organization's minimum. Throttled 5/h per IP and 3/h per email |
| Activation | Existing `PATCH /tenant/users/{id}` (`pending → active`); the admin sees the profile (name, mobile) in the list; activation emails the member. Rejecting = `suspended` (stays blocked) |
| Forgot `POST /auth/forgot-password` | Always `202`; only **active** accounts get a link (single-use, 60 min, hashed in `password_reset_tokens`); link targets `SAILIX_RESET_URL` (default `<web origin>/reset-password`); **never emails a password**. 3/h per email, 5/h per IP |
| Reset `POST /auth/reset-password` | Unknown email, inactive account, wrong/expired/used token ⇒ one identical `422 invalid_reset_token`. Success revokes **every** mobile token and browser session, sets the mailbox as verified, deletes the token |
| Change `PUT /me/password` | Needs current password; new must differ and meet the policy (platform floor ∨ strictest organization of the user); revokes all **other** tokens and sessions, keeps the caller's; 5/min per user |
| Deletion request `POST /me/deletion-request` | Records one request per membership (idempotent) and mails the organization's active admins; **nothing is deleted**, access unchanged (Q-3 open). Admins list requests at `GET /tenant/deletion-requests` |
| Mail | Plain-text mail through the configured Laravel driver (`MAIL_MAILER`, default `log`; provider undecided, D-11). `SafeMailer` logs a failed delivery without recipient/content and never fails the API call. Values in text templates are rendered **unescaped** on purpose (an HTML-escaped `&` once broke the emailed link; covered by `MailTemplatesTest`) |
