# 00 — Project Discovery

Date: 2026-10-13 · Status: ANALYZED · Legend: **[V]** verified in files/source · **[I]** inferred · **[P]** proposed · **[U]** unresolved

## 1. Selected project

**Sailix** — the Flutter crew portal for a manning agency (client code `SFAI`, "Southfield Agencies, INC"). [V]

Why Sailix and not Tala: [V]
- The new workspace is named `sailix_v2`.
- The only completed specification set (14 numbered docs + master spec + open questions) lives in `claude/sailix-rn/docs` and states it is for Flutter app `sailix` (package `sailix2`, v1.0.30+30).
- `claude/tala3` (Tala LMS, remote `tala-lms/tala-mobile-v3`) has **no** specification documents. It is a different product (learning platform) and is excluded. No Tala rules are used anywhere in this plan.

Residual risk: selection is by strong evidence, not by an explicit statement from you. **Please confirm at the approval gate.**

## 2. Locations

| Item | Path | Notes |
|---|---|---|
| Original Flutter source (READ-ONLY) | `/Users/btsolve/development/claude/sailix` | 104 Dart files, remote `gitlab.com/sailix1/sailix-mobile` |
| Duplicate clone | `/Users/btsolve/development/playground/sailix2` | Same remote, branch, HEAD; `lib/` is byte-identical (diff shows only `.DS_Store`). Not used. [V] |
| Older prototype | `/Users/btsolve/development/playground/sailix` | Capacitor/iOS shell with static `www`. Not used. [V] |
| Existing analysis/spec | `/Users/btsolve/development/claude/sailix-rn/docs/` | `01…14`, `REACT-NATIVE-PLATFORM-DECISION`, `OPEN-QUESTIONS` (35 questions), `MASTER-REBUILD-SPECIFICATION`, raw evidence in `_analysis/01–04` |
| Existing RN app (M0 only) | `/Users/btsolve/development/claude/sailix-rn` | Expo SDK 57 / RN 0.86 foundation, own git repo, **no commits yet**, all files untracked |
| **New project** | `/Users/btsolve/development/claude/sailix_v2` | Was empty; not a git repo. Contains only `docs/` created by this phase |
| Unrelated Laravel skeleton | `/Users/btsolve/development/laravel/backend` | Fresh `laravel/laravel` skeleton (Laravel ^13.8, PHP ^8.3), default users/cache/jobs migrations only, no Sailix code. Not inspected beyond identification; contains a `.env` that was not read. Not reused. [V] |

## 3. Original Flutter repository state (recorded before any work)

- Branch: `medel_dev_march2025`; HEAD `2094806d9484705403beb313008a7f229558108e` ("uploaded code to google&apple"). [V]
- **66 uncommitted changes**: 54 modified, 2 deleted, 10 untracked. [V]
  - Modified `lib/` files include `constants/api_url.dart`, `providers/auth.dart`, `providers/documents/documents.dart`, all payslip/loan providers, dashboard, documents, finance and tab screens.
  - Untracked `lib/` additions: `forgot/`, `registration/`, `providers/dashboard/`, `providers/scanner/`, `providers/todolist/`, `tabs/changepassword/`, `tabs/documents/pending_details/`, `tabs/documents/pendings_arguments.dart`, `tabs/todolist/`.
  - The rest are Android/iOS/macOS/Linux/Windows generated files, `pubspec.*`, and tracked `.cxx` build artifacts.
- **Consequence:** the **working tree**, not HEAD, is the true reference (HEAD lacks registration, to-do, change-password, forgot-password). The existing spec was derived from the working tree. Do not run `git checkout/stash/clean` there.
- This planning phase performed only read-only commands (`ls`, `git status/log/branch/remote`, `grep`, `diff -rq`, `cat`). Nothing in the Flutter repo was modified.

## 4. Existing RN project state (preserve)

`claude/sailix-rn`: untracked files only, no commits. It holds validated M0 work (typecheck, lint, 32 tests, expo-doctor 21/21 per its README — **not re-run by me**). **Do not delete or overwrite.** Reuse decision is D-10 (see §9).

## 5. Verified application purpose [V from spec + spot-checks]

Crew-facing portal: log in; read announcements (with PDF/image attachments, read state); manage compliance documents (upload/scan PDF, track agency approval, resubmit); see agency-assigned to-dos and mark done; view payslips ("allotments": regular/special/final) and cash-advance loan deductions; settings (change password, privacy policy, logout, delete-account stub). A hidden "Services" area (ASTRA tools, Call-It mock) is disabled in the shipped UI.

Spot-checks I ran against Flutter source (all matched the spec):
- Only one `Authorization: Bearer` header in the app: `providers/auth.dart:252` (change password).
- `env = 'dev'` hard-coded (`constants/api_url.dart:6`); every route uses `/sfai-sailix-api-dev/…`; upload/update use `/sfai-sailix-api/…` (`documents.dart:104,146`).
- `'client_code': 'SFAI'` hard-coded (`auth.dart:137`, `todolists.dart:77`).
- Services nav commented out (`tab_screen.dart:120,127,315,318`); `deleteUser()` only calls `notifyListeners()` (`auth.dart:317`).

## 6. Backend, API, schema

- **No backend source and no database schema exist in the workspace.** The Flutter app talks to a legacy API at `https://sailix.btsolve.com` (Laravel-style `public/api` paths, but the code is not available). [V]
- API behaviour is known only from client parsing code (`docs/06-API-SPECIFICATION.md` in sailix-rn). No sample responses, no OpenAPI. [V]
- **No admin/back-office client is in scope of any existing document.** Everything crew read (announcements, to-dos, payslips, loans, document approvals) is produced elsewhere. [V — absence]

Therefore this is a **greenfield backend** that must also supply the producer side of the data. That is the single largest scope item the existing spec does not cover (see gap analysis G-01).

## 7. Integrations and native capabilities to retain [V from spec 09]

Backend-facing: HTTPS JSON API; multipart PDF upload; remote PDF/image files; privacy-policy URL `https://www.btsolve.com/privacy/data-privacy-sailix.html`.
Device (mobile): document scanning → PDF (ML Kit/VisionKit; spike S1), PDF picking, PDF viewing (spike S2), secure storage, biometrics (optional, Q-10), image display, optional audio loop + keep-awake for Services (spike S3), external URL open. None: push, deep links, background tasks, offline persistence, analytics/ads (ATT proposed removal).
Third-party services: none identified. Email delivery is needed by the new platform (registration approval, password reset) — not yet chosen.

## 8. New directory state

`claude/sailix_v2` was empty; no git; no uncommitted work to preserve. `git init` is deferred to Phase A after approval. [V]

Toolchain present on this machine: PHP 8.5.8, Composer, Node 22.23.1, npm. PostgreSQL/MySQL/Redis availability not checked. [V]

## 9. Missing information / decisions needing you

See `01-SPECIFICATION-GAP-ANALYSIS.md` §6 for the full list. The ones that change architecture:

| ID | Decision |
|---|---|
| D-1 | Who produces announcements, to-dos, payslips, loans, document approvals today? Is the new platform the system of record, or does it ingest from payroll/crewing systems? |
| D-2 | Does the legacy API keep serving the shipped Flutter app? Is there data to migrate (users, documents, payslips)? |
| D-3 | Tenant = manning agency (`client_code`)? Is SFAI the only launch tenant? |
| D-4 | Username uniqueness: global, or per agency with an agency code at login? |
| D-5 | Which tenant staff roles exist besides tenant admin? |
| D-6 | Database engine — **DECIDED: MySQL** (user, 2026-10-13). Legacy DB engine still unknown (affects data migration). |
| D-7 | Monorepo vs separate repos (monorepo recommended). |
| D-8 | Behaviour of a suspended tenant (block all vs read-only). |
| D-9 | Data-retention / deletion policy (PII + financial data). |
| D-10 | Seed `mobile/` from existing `sailix-rn` M0, or start clean? |
| D-11 | Hosting, region, email provider. |
| Q-3, Q-10, Q-22, Q-25 | Carried over from existing spec (account deletion, payslip gate, store listing identity, Services scope). |

## 10. Recommended next steps

1. You confirm project selection and answer the D-* decisions (defaults are in each doc and ADR).
2. Approve architecture → Phase A (git init, tooling) → B (backend foundation) → C (tenant isolation gate) → D…
