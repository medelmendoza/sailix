# 01 — Specification Gap Analysis

Reviewed: `claude/sailix-rn/docs/*` (all 17 top-level docs; `_analysis/03-finance.md` and parts of `02-workspace.md` read in detail). Compared against Flutter source by targeted read-only greps (see 00 §5). Result: **the spec is reliable for the crew-facing mobile behaviour and weak/silent on everything a multi-tenant platform needs.** It was written for a mobile-only rebuild against an existing backend; this project replaces that backend.

## 1. Adequacy check against the required list

| Area | Covered? | Note |
|---|---|---|
| Features, screens, navigation, flows | Yes | Strong; every feature has a disposition. |
| Business rules (crew side) | Yes | BR-01…55. |
| API behaviour | Partial | Request shapes known; **no response samples, enums, or error bodies** (Q-7,8,11,12,17). |
| Data models | Partial | Client-side shapes only; no server entities, constraints, or relations. |
| Authentication | Partial | Login/register/change-password known; no refresh, reset semantics, token TTL, lockout. |
| User roles | **No** | Only one role: crew (`ROLE_USER`). No admin/staff role anywhere. |
| Local persistence/offline | Yes | None needed (Q-18). |
| Device capabilities | Yes | Spikes S1–S3 still pending. |
| Notifications/push | Yes (none) | Out of scope (Q-19). Email needs are new. |
| File handling | Partial | Client side only; server limits, storage, access control unknown (Q-16). |
| Validation / errors | Partial | Client rules; server rules unknown. |
| Defects / improvements | Yes | `11`, `12`. |

## 2. Contradictions found

| # | Contradiction | Resolution |
|---|---|---|
| C-1 | Spec Q-20 says "fixed tenant `SFAI`" vs this project's multi-tenant requirement. | Not a conflict: it records Flutter behaviour. `client_code` becomes the natural tenant key (D-3). |
| C-2 | `docs/09` says no direct camera; `google_mlkit_document_scanner` is camera-based. | Wording only; scanner needs the CAMERA permission (already listed). |
| C-3 | `README` of sailix-rn lists M0 "IMPLEMENTED"; it was never run on a device and has no git history. | Treat as unverified scaffolding; re-validate on adoption. |
| C-4 | API spec says "login returns only `token`" and BR-05 requires 401s the legacy backend may not issue. | Moot for new backend, which issues/validates tokens (we own it). |
| C-5 | Flutter HEAD vs working tree differ materially (registration, to-do, change-password exist only uncommitted). | Working tree is authoritative (00 §3). |

## 3. Unverified assumptions (carried; none silently promoted)

- Server enforces nothing today (Q-1) → **we now own enforcement**, so this becomes a design requirement, not a question.
- `date_pro` identifies a payslip (Q-8) → new API identifies payslips by id; list must still show every record.
- Remarks/approval enums, date formats, field semantics (Q-7,11,12,17) → define our own canonical enums; legacy values only matter for migration/import (D-1, D-2).
- Hosts/paths dev vs prod (Q-2) → irrelevant to new backend; relevant only if legacy compatibility is required (D-2).

## 4. Missing requirements

### Backend / producer side (CRITICAL)
- **G-01** Who creates announcements (+ attachments, audience), to-dos (assignment), approves/rejects documents (with reason), activates registered accounts, and loads payslips/loans? Flutter only consumes. Candidate answers: agency staff via web portal **[I]**, import from a payroll system **[I]**, both. Needed for Phase D scope.
- **G-02** Payslip/loan data origin and format: manual entry, CSV import, API from payroll/crewing software? No evidence of any. Payslip money is "server values; client never recomputes" (BR-48) — so the new platform must either store computed values from an upstream system or compute them (payroll engine is **out of scope** unless you say otherwise).
- **G-03** Announcement audience (all crew / selected crew / by vessel?) — `notificationID` per user implies per-recipient rows.
- **G-04** Document type master list ownership: platform-wide vs per tenant (`/pldocument`).
- **G-05** Crew identity fields (`crewID`, `crew_no`, vessel, position) — where do they come from for a new tenant? Registration only collects personal fields; "admin activation" (BR-02) has no admin UI defined.
- **G-06** Email: registration approval, password reset (Q-34), notifications. Provider and templates unknown.
- **G-07** Account deletion semantics (Q-3): deletion vs anonymization vs retention of payroll records (legal retention likely applies to payroll data — confirm with counsel; the app handles Philippine payroll/SSS/PhilHealth/Pag-IBIG data, so the Philippine Data Privacy Act is a likely consideration **[I]**).

### Multi-tenant (all new)
- **G-10** Tenant lifecycle, suspension behaviour (D-8), retention (D-9), branding (company name/logo/footer are hard-coded "Southfield Agencies, INC" in payslips), tenant-configurable settings.
- **G-11** Username scope (D-4), multi-membership (default: one tenant per crew; model supports many), superadmin identity.
- **G-12** Tenant-scoped payslip header/footer, currency rules (`$`/`₱` per record) — per-tenant configurability unknown.

### Web portal (all new — no Flutter equivalent)
- **G-20** Entire tenant-admin feature set is **inferred** from G-01: user management/approvals, announcements, to-dos, document review, payslip/loan data management, settings, audit. Needs your confirmation before build.
- **G-21** Superadmin feature set limited to tenants + tenant-admin provisioning + audit (billing/plans **not** assumed; no evidence).

### Mobile
- **G-30** Tenant context on mobile (new): login must resolve organization without a hostname (02 §6).
- **G-31** Spikes S1 (scanner), S2 (PDF), S3 (audio) are still unrun; native store listing identity (Q-22) open.
- **G-32** Signed-URL based file access changes the PDF viewer contract (authenticated/expiring URLs).

### Security
- **G-40** Legacy IDOR exposure (Q-1) — new backend must derive identity from token and never trust path `crewID`.
- **G-41** Payslip step-up gate (Q-10): client-only birthdate gate is not security; decide on server-enforced step-up.
- **G-42** Forgot-password currently emails a plaintext password — we will not replicate it (reset-link flow).
- **G-43** Release signing with debug key (Q-22).

## 5. Spec items superseded by this architecture

| Spec item | Superseded by |
|---|---|
| Bearer on all calls "harmless if ignored" | Mandatory, enforced server-side. |
| `crewID`/`userID` in URL paths | Derived from authenticated membership; paths carry no identity. |
| Two API prefixes (Q-2) | Single `/api/v1`. |
| `'Y'/'N'` strings, number-or-string | Real booleans/decimal strings in the new contract (mobile zod stays lenient during any legacy migration). |
| `date_pro` as payslip key | Payslip UUID/ULID. |

## 6. Decisions requiring your input

Architecture-shaping: **D-1…D-11** (listed in 00 §9). Carried spec questions that now matter more: Q-3, Q-5 (password policy), Q-10, Q-16 (file limits), Q-22, Q-25, Q-34. Each document states its default so work can proceed on approval with defaults.

## 7. What was *not* regenerated

The 14 existing spec docs are referenced, not copied. Feature/screen/flow/business-rule detail for the crew experience stays in `claude/sailix-rn/docs` until Phase A, when the repo is initialised and the docs are copied under `docs/reference/` (copy, never move).
