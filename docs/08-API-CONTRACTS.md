# 08 — API Contracts (design-level)

Status: PROPOSED. Crew endpoints are **derived 1:1 from the observed Flutter operations** (spec 06); admin/platform endpoints are **inferred** (marked `[I]`) and not final until D-1/G-20 are answered. The machine-readable contract (`contracts/openapi.yaml`) is produced in Phase B and supersedes this table; schemas below are summaries.

Global rules: prefix `/api/v1`; JSON; errors `application/problem+json` (05 §3); every protected route requires auth; tenant is derived from credential (never from path/body); foreign-tenant resource ⇒ `404`; role mismatch ⇒ `403`; common failures: `401 unauthenticated`, `403 account_suspended|tenant_suspended|forbidden`, `422 validation`, `429 throttled`.

Legend — **Scope**: P = platform, T = tenant, S = self (own membership within tenant).

## 1. Authentication & account
| Endpoint | Method | Permission | Scope | Request → Response |
|---|---|---|---|---|
| `/auth/token` | POST | public (throttled) | – | `{username, password, device_name, agency_code?}` → `200 {token, expires_at, membership}` · `200 {requires_tenant_selection, ticket, memberships[]}` · `401` generic · `403 account_suspended/membership_pending` |
| `/auth/token/select` | POST | ticket | – | `{ticket, membership_id}` → token |
| `/auth/token/refresh` | POST | token | S | → new token, old revoked |
| `/auth/token` | DELETE | token | S | revoke current → `204` |
| `/auth/token/switch` | POST | token | S | `{membership_id}` (validated against user's active memberships) → new token |
| `/auth/session` (+`/sanctum/csrf-cookie`) | POST / DELETE | public / session | – | web tenant login/logout; `{username,password,otp?}` |
| `/platform/auth/session` | POST / DELETE | public / session | – | superadmin login (MFA required) |
| `/auth/register` | POST | public (throttled) | – | `{agency_code, username, email, password, first_name, middle_name?, last_name, suffix?, mobile, birth_date?}` → `201` pending activation; no auto-login |
| `/auth/forgot-password`, `/auth/reset-password` | POST | public (throttled) | – | link-based; always `202` (flag until Q-34) |
| `/auth/step-up` | POST | token | S | `{password}` → `{expires_at}`; enables `/payslips*` |
| `/me` | GET | any authenticated | S | profile, role, tenant summary (name, branding), abilities, **`modules[]`** (`{code,label,enabled,linked,status}`; M1 replaces the removed `features.services_enabled`) |
| `/me/password` | PUT | self | S | `{current_password, password, password_confirmation}` → `204`; revokes other tokens |
| `/me/sessions`, `/me/sessions/{id}` | GET / DELETE | self | S | device list / revoke |
| `/me/deletion-request` | POST | crew | S | → `202` (Q-3) |

## 2. Crew modules (mobile)
| Endpoint | Method | Scope | Notes |
|---|---|---|---|
| `/dashboard` | GET | S | `{announcements[latest N], document_counts{expired,expiring}, unread_count}` |
| `/announcements` | GET | S | paginated; `is_read` computed per membership; hides inactive/expired |
| `/announcements/{id}` | GET | S | includes `attachment{type,url(expiring)}` |
| `/announcements/{id}/read` | PUT | S | idempotent mark read |
| `/document-types` | GET | T | `[{id,name}]` |
| `/crew-documents` | GET | S | filter `status=approved\|pending\|rejected`, `expiry=expired\|expiring`; `sort=expires_on` |
| `/crew-documents` | POST (multipart) | S | `document_type_id, number, grade, location, school, issued_on, expires_on, file(pdf)`; creates `pending`; `Idempotency-Key` |
| `/crew-documents/{id}` | GET | S | detail + rejection reason |
| `/crew-documents/{id}` | POST (multipart, `_method` not needed) | S | resubmit: only if status allows (Q-13 default Rejected/Pending); file optional (Q-14) |
| `/crew-documents/{id}/file` | GET | S | policy check then stream or `302` signed URL |
| `/todos` | GET | S | sort by due date |
| `/todos/{id}` | PATCH | S | `{is_done: bool}`; only own |
| `/loans` | GET | S (+step-up? no, per BR-46 ungated) | `{data:[loan], meta:{total_php,total_usd}}` |
| `/payslips` | GET | S, **step-up** | `filter[kind]`, `filter[year]`, cursor pagination, default `sort=-date_pro` |
| `/payslips/{id}` | GET | S, **step-up** | full slip incl. `deductions[]`; bank account masked unless Q-6 says otherwise |

## 3. Tenant administration `[I]`
| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `/tenant` | GET / PATCH | tenant_admin | profile, settings (typed registry) |
| `/tenant/users` | GET / POST | `users.manage` | list/search; invite |
| `/tenant/users/{id}` | GET / PATCH | `users.manage` | role, status, profile; approve registration via `POST …/activate` |
| `/tenant/announcements` (+`/{id}`) | CRUD | `announcements.manage` | attachment upload |
| `/tenant/todos` (+`/{id}`) | CRUD | `todos.manage` | assign to membership(s) |
| `/tenant/crew-documents` | GET | `documents.review` | queue; `POST /{id}/approve`, `POST /{id}/reject {reason}` |
| `/tenant/document-types` | CRUD | `documents.manage` | |
| `/tenant/payslips`, `/tenant/loans` | per D-1 | `finance.manage` | import (`POST /tenant/imports`) and/or CRUD |
| `/tenant/audit-logs` | GET | tenant_admin | filter/paginate |
| `/tenant/reports/*` | – | – | **undefined; none assumed** |

## 4. Platform administration `[I]`
| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `/platform/tenants` | GET / POST | superadmin | create → `provisioning` |
| `/platform/tenants/{id}` | GET / PATCH | superadmin | |
| `/platform/tenants/{id}/{activate,suspend,reactivate,deactivate,archive}` | POST | superadmin | `{reason}` required; audited; revokes sessions as needed |
| `/platform/tenants/{id}/admins` | GET / POST | superadmin | invite first/additional tenant admin |
| `/platform/settings` | GET / PATCH | superadmin | |
| `/platform/audit-logs` | GET | superadmin | |
| `/platform/admins` | CRUD | superadmin | MFA enforced |

## 5. Test scenarios per group (see 10 for the full strategy)
Auth: lockout/throttle, uniform failure, suspended tenant/membership, token bound to membership, switch revokes old, step-up required/expired. Crew modules: own-only, foreign-tenant 404, same-tenant other-crew 404, validation, file type spoofing, idempotent upload, mark-read idempotent. Tenant admin: each endpoint 403 for crew, 404 across tenants, cannot grant above rank, cannot remove last admin. Platform: tenant-admin token gets 403/404 on every `/platform/*`; lifecycle transitions legal/illegal matrix; each transition revokes sessions and is audited.

## 6. Changes vs legacy (migration table for mobile)
| Legacy (Flutter) | New |
|---|---|
| `POST /login` → `{userID, token}` + `GET /user/{id}` | `POST /auth/token` → token + `GET /me` |
| `GET /listCrewDocument/{crewId}`, `/user/{crewId}/documents/pending` | `GET /crew-documents?status=` |
| `POST /user/document/upload`, `POST …/pending/{id}` (`_method=PUT`) | `POST /crew-documents`, `POST /crew-documents/{id}` |
| `GET /user/todolist/{userId}`, `PATCH /user/{userId}/todolist/{id}` + `X-*` headers | `GET /todos`, `PATCH /todos/{id}` (no identity headers) |
| `GET /user/{crewId}/payslip*`, `…/datepro/{d}` | `GET /payslips`, `GET /payslips/{id}` |
| `GET /user/{crewId}/deductions` | `GET /loans` |
| `PUT /user/{id}/change/password` | `PUT /me/password` |

## 7. M1 additions (authoritative definition: `contracts/openapi.yaml`)
| Endpoint | Method | Permission | Notes |
|---|---|---|---|
| `/tenant/modules` | GET | `tenant.view` | all registry modules with entitlement state |
| `/tenant/modules/{module}` | PUT `{enabled}` | `module.<code>.manage` | toggle only; `409 module_not_provisioned`; team mapping can NOT be sent here |
| `/platform/tenants/{tenant}/modules` | GET | superadmin | includes `links_count` |
| `/platform/tenants/{tenant}/modules/{module}` | PUT `{external_team_id, enabled?}` | superadmin | `409 team_already_mapped`, `409 links_exist` |
| `/platform/settings` | PATCH | superadmin | new `tala_api_base_url` (https, allow-listed, public destination) |
New problem codes: `module_disabled`, `module_forbidden`, `module_unavailable` (503), `module_not_provisioned`, `links_exist`, `team_already_mapped`. `{module}` is an enum (`tala`); anything else is `404`.
