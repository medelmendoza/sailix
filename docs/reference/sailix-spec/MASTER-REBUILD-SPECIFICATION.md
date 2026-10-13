# MASTER REBUILD SPECIFICATION — Sailix (React Native + TypeScript)

**Reference:** Flutter app `sailix` v1.0.30+30, `/Users/btsolve/development/claude/sailix` (READ-ONLY; untouched — `git status` showed 66 pre-existing uncommitted changes and nothing was modified by this work).
**New project:** `/Users/btsolve/development/claude/sailix-rn` (independent git repo, no Flutter code copied).
**Spec status:** SPECIFIED with open questions (running on documented defaults). **Implementation status:** M0 foundation IMPLEMENTED + TESTED (see README); M1–M7 PLANNED.

## 1. What the product is
A crew-facing mobile portal for a manning agency (client `SFAI`). Crew log in to read announcements, manage compliance documents (upload/scan, track approval), see assigned to-dos, and view payslips ("allotments"), final pay and cash-advance deductions. A hidden "Services" area (ASTRA productivity/safety tools, Call-It incident-report mock) exists but is disabled.

## 2. Document map
| Doc | Content |
|---|---|
| 01 Feature inventory | features + KEEP/IMPROVE/REMOVE/UNKNOWN |
| 02 Screens · 03 Navigation · 04 Flows | UI inventory, target nav tree, end-to-end flows |
| 05 Business rules · 06 API · 07 Models · 08 Storage | behaviour contracts |
| 09 Native · 10 Dependencies · REACT-NATIVE-PLATFORM-DECISION | device features, library matrix, Expo decision |
| 11 Known issues · 12 UX · 13 Security | defects, improvements, requirements |
| 14 Architecture · OPEN-QUESTIONS | design, 35 prioritised questions |
| `_analysis/01–04` | raw evidence with file:line citations |

## 3. Headline findings
1. **Security (P0): data endpoints are unauthenticated in the client** — only change-password sends a Bearer token (verified `auth.dart:252`). Identity is a path ID. Needs backend confirmation (Q-1).
2. **Environment confusion (P0):** production host serves `-dev` API path; upload/update use a different path (verified `documents.dart:104,146`). (Q-2)
3. **Delete Account is fake** (verified `auth.dart:317`), a store-compliance risk (Q-3).
4. **Release signed with the debug key** (Q-22).
5. **Reachable app is small:** 4 tabs, ~16 screens. Big chunks of the code are dead (Tasks, Account, scanner demos) or disabled (Services — verified `tab_screen.dart:120,127,315,318`).
6. **Silent-failure design:** uploads always "succeed"; lists have no error states; logout leaks prior user's data.
7. **Heavy duplication** (3× payslip list/detail, 3× PDF viewer, 5× menu tiles) → collapses into ~10 shared components.

## 4. Scope decision (pending Q-25)
- **In scope (M0–M5, M7):** Auth, Dashboard, Announcements, Files (+upload, scan, update), To-do, Finance (Cash Advance, Allotment, Final Pay), Settings/Account.
- **Conditional (M6):** ASTRA tools; Call-It only if a backend is defined.
- **Out:** Tasks, Account-tab legacy, Sparks/Tala tiles, ATT, coach marks (unless approved), dead demos.

## 5. Traceability matrix

| Old feature | Old screen / file | New feature | New screen | Disposition | Status |
|---|---|---|---|---|---|
| Login | `login/login_screen.dart` | AUTH-01 | `LoginScreen` | Improved | SPECIFIED |
| Auto-login | `Auth.tryAutoLogin` | AUTH-02 | `SessionBootstrap` | Improved | SPECIFIED |
| Registration | `registration_screen.dart` | AUTH-03 | `RegistrationScreen` | Improved | SPECIFIED |
| Forgot password | `forgot_screen.dart` (unreachable) | AUTH-04 | `ForgotPasswordScreen` | Pending clarification (Q-34) | ANALYZED |
| Change password | `changepassword_screen.dart` | AUTH-05 | `ChangePasswordScreen` | Rebuilt | SPECIFIED |
| Logout | `tab_screen.dart` menu | AUTH-06 | Settings | Improved | SPECIFIED |
| Delete account | `tab_screen.dart` (fake) | AUTH-07 | Settings | Pending clarification (Q-3) | ANALYZED |
| Privacy policy | menu | AUTH-08 | Settings | Rebuilt | SPECIFIED |
| Dashboard | `dashboard.dart` | DASH-01..05 | `DashboardScreen` | Improved | SPECIFIED |
| Request Appointment | `dashboard.dart` (no-op) | DASH-03 | — | Pending (Q-26) | ANALYZED |
| ATT prompt | `dashboard.dart` | DASH-06 | — | Removed (proposed, Q-4) | ANALYZED |
| Coach marks | `dashboard.dart` (disabled) | DASH-07 | — | Pending (Q-7b) | ANALYZED |
| Announcements list/details/read | `announcements/*` | ANN-01..03 | `AnnouncementsList`, `AnnouncementDetails` | Improved | SPECIFIED |
| Documents list + PDF | `documents_screen/item` | DOC-01,02 | `DocumentsTab`, `PdfViewer` | Improved | SPECIFIED |
| Pending list/details | `pendings_item`, `pending_details` | DOC-03,04 | `PendingTab`, `PendingDetails` | Rebuilt | SPECIFIED |
| Upload document | `documents_screen` dialog | DOC-05,07,08 | `UploadDocument` | Improved | SPECIFIED (needs S1) |
| Update pending | `pendings_item` dialog | DOC-06 | `UpdateDocument` | Improved | SPECIFIED (Q-13/14) |
| To-do list/toggle | `todolist/*` | TODO-01,02 | `TodoList` | Improved | SPECIFIED |
| Finance entry + gate | `finance_screen2.dart` | FIN-01 | `Finance`, gate | Improved (mechanism Q-10) | SPECIFIED |
| Allotment list + details | `payslip/regular*`, `special*` | FIN-02,03 | `PayslipList`, `PayslipDetail` | Improved (merged) | SPECIFIED |
| Final pay | `payslip/final*` | FIN-04 | same, `kind=final` | Improved (merged) | SPECIFIED |
| Cash Advance | `loans/*` | FIN-05 | `CashAdvance` | Rebuilt | SPECIFIED |
| Standalone Special / `/payslip` grid / old finance grid | dead | FIN-06 | — | Removed | ANALYZED |
| "Other services" placeholder | `finance_screen2.dart` | FIN-07 | — | Removed (proposed) | ANALYZED |
| Services landing | `services_screen.dart` (disabled) | SVC-00 | `ServicesHome` (flag) | Pending (Q-25) | ANALYZED |
| Pomodoro / Sounds / Risk / RCA / Scaril / Emails | `astra/*` | SVC-01..06 | `features/services/astra` | Conditional rebuild | SPECIFIED |
| Call-It | `callit/*` (mock) | SVC-07 | — | Pending (Q-21) | ANALYZED |
| Sparks / Tala LMS | tiles | SVC-08 | — | Pending (Q-25) | ANALYZED |
| Tasks module, Account tab, scanner demos, backups | dead | — | — | Removed | ANALYZED |

No important feature disappears silently: every row has a disposition.

## 6. Specification validation (Phase 14 review)

Checked against the raw notes; findings:
- **Screens:** inventory covers all reachable routes. Exact `routeName` strings of non-core screens are not needed (names are internal).
- **Contradictions found & resolved:** (a) the Dashboard "Documents" shortcut label-matching vs tab indices — resolved by explicit navigation; (b) Flutter's two API prefixes — kept as separate config values (Q-2); (c) payslip "Total Deduction" label colour differs by kind — normalised; (d) Pomodoro help text (25 min) vs code (15 min) — code is authoritative, copy fixed.
- **Verified by direct source grep (not just agent claims):** single `Authorization` header; `env='dev'`; non-dev upload/update URLs; Services nav commented out; `deleteUser()` no-op.
- **Not independently verified:** field-level parsing details and exact copy text (taken from agent notes with citations); visual details (derived Material 3 tonal colours — UNKNOWN, will be sampled from the running Flutter app or recreated from brand colours).
- **Gaps that need a runnable reference:** server response samples (none available offline), actual remark/status enums, date formats — requires sample JSON or backend docs (Q-11, Q-12, Q-17). **Recommend capturing real responses from a test account** to build zod fixtures.
- **Offline/permissions/native:** none beyond those listed; no push, deep links, background work.
- **Binary assets not inspected:** the three ASTRA PDFs and images (content unknown, only used as viewers).

## 7. Status vocabulary in use
Currently: ANALYZED (all areas) → SPECIFIED (features with no blocking unknown). Nothing is PLANNED/IMPLEMENTED/TESTED/VERIFIED.

## 8. Next steps
1. **Product/backend owner answers P0 questions** (Q-1, 2, 3, 10, 22, 25).
2. Create test credentials/sample JSON for fixtures.
3. On approval: M0 foundation (Expo project in this repo, tooling, theme, API client) → M1 auth → …, per `14-REACT-NATIVE-ARCHITECTURE.md`, running `tsc`, `eslint`, `jest` after each milestone and spikes S1–S3 before M3.
