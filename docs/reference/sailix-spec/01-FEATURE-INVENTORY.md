# 01 — Feature Inventory

Source: Flutter app `sailix` (package `sailix2`, v1.0.30+30), **read-only reference**. Raw per-area notes with file:line citations live in `docs/_analysis/`.

**Disposition:** KEEP · IMPROVE · REMOVE · UNKNOWN (needs product decision — see `OPEN-QUESTIONS.md`)
**Status vocabulary (project-wide):** ANALYZED → SPECIFIED → PLANNED → IMPLEMENTED → TESTED → VERIFIED. Every feature below is currently **SPECIFIED** (or ANALYZED where UNKNOWN blocks specification).

The app is a **crew-facing portal for a manning agency (client code `SFAI`, "Southfield Agencies, INC")**. Reachable surface = 4 bottom tabs (Dashboard, Files, Announcement, Finance) + settings menu. Services (ASTRA, Call-It), Account and Tasks tabs exist in code but are **disabled/dead**.

## A. Authentication & account

| ID | Feature | Disposition | Status | Notes |
|---|---|---|---|---|
| AUTH-01 | Login (username + password) | KEEP/IMPROVE | SPECIFIED | `POST /login` → `userID`, `token`; then `GET /user/{userID}` for profile. Both required. |
| AUTH-02 | Session restore at launch | IMPROVE | SPECIFIED | Flutter: "profile exists in prefs" = logged in; token lost on restart. RN: persist token in secure storage, validate. |
| AUTH-03 | Registration | KEEP/IMPROVE | SPECIFIED | 11 fields, client-side captcha (cosmetic), account needs admin activation. Middle name mandatory (UX defect). |
| AUTH-04 | Forgot password | UNKNOWN | ANALYZED | Screen + API exist but **no entry point** (link commented out). Backend emails a new password. Decide: ship or drop. |
| AUTH-05 | Change password | KEEP | SPECIFIED | Old/new/confirm; ≥5 chars; success → forced logout. Only call that sends a Bearer token. |
| AUTH-06 | Logout | KEEP/IMPROVE | SPECIFIED | Must clear **all** in-memory + persisted user data (Flutter leaks previous user's lists). |
| AUTH-07 | Delete account | UNKNOWN | ANALYZED | Flutter is **fake** (no API call, no logout, says "request received"). App Store requires real deletion path. |
| AUTH-08 | Privacy policy link | KEEP | SPECIFIED | Opens `https://www.btsolve.com/privacy/data-privacy-sailix.html` externally. |

## B. Home / Dashboard

| ID | Feature | Disposition | Status | Notes |
|---|---|---|---|---|
| DASH-01 | Welcome header (first name) | KEEP | SPECIFIED | |
| DASH-02 | Shortcuts: Upload Documents, View Finances, To-do List, Documents | KEEP/IMPROVE | SPECIFIED | "Upload Documents" should open the upload form (Flutter only switches tab). |
| DASH-03 | "Request Appointment" shortcut | UNKNOWN | ANALYZED | No-op stub in Flutter. |
| DASH-04 | Latest announcements card (unread dot, relative age) | KEEP | SPECIFIED | Source: `GET /user/dashboard/combined/{userId}`. |
| DASH-05 | Expired-document count | UNKNOWN | ANALYZED | Parsed (`crewDocCountResult.expired`) but never displayed. |
| DASH-06 | iOS App Tracking Transparency prompt | REMOVE (proposed) | ANALYZED | No ad/analytics SDK exists; prompt is misleading and a review risk. Confirm. |
| DASH-07 | Onboarding coach marks | UNKNOWN | ANALYZED | Implemented but disabled (call commented out). |

## C. Announcements

| ID | Feature | Disposition | Status | Notes |
|---|---|---|---|---|
| ANN-01 | Announcement list (unread/read styling, pull-to-refresh) | KEEP/IMPROVE | SPECIFIED | `GET /announcement/user/{userId}` |
| ANN-02 | Announcement details with PDF or image (`jpg`/`png`) attachment | KEEP/IMPROVE | SPECIFIED | Support `jpeg`; handle unknown types. |
| ANN-03 | Mark as read on open | KEEP/IMPROVE | SPECIFIED | `PUT /user/{userId}/notification/{notificationID}` `{isViewed:"Y"}`; roll back on failure; share cache between Dashboard and list. |

## D. Files (crew documents)

| ID | Feature | Disposition | Status | Notes |
|---|---|---|---|---|
| DOC-01 | Documents list with server-computed expiry remarks (Expired/Expiring/None) | KEEP/IMPROVE | SPECIFIED | `GET /listCrewDocument/{crewId}` |
| DOC-02 | View document PDF | KEEP | SPECIFIED | One shared PDF viewer (Flutter has 3 copies). |
| DOC-03 | Pending (awaiting agency approval) list with status colouring | KEEP | SPECIFIED | `GET /user/{crewId}/documents/pending` |
| DOC-04 | Pending details (+ rejection reason, attachment) | KEEP | SPECIFIED | |
| DOC-05 | Upload new document (type picker, 6 text/date fields, PDF from device **or** scan) | KEEP/IMPROVE | SPECIFIED | Multipart POST; needs real success/failure handling and list refresh. |
| DOC-06 | Update / resubmit a pending document | KEEP/IMPROVE | SPECIFIED | Multipart POST with `_method=PUT`. Gate on status (Flutter allows edit even when Approved) — confirm rule. |
| DOC-07 | Document scanner (≤5 pages, gallery import, PDF output) | KEEP | SPECIFIED | Native capability; spike required (see 09). |
| DOC-08 | Document-type master list | KEEP | SPECIFIED | `GET /pldocument`; map by id, not by name index. |

## E. To-do

| ID | Feature | Disposition | Status | Notes |
|---|---|---|---|---|
| TODO-01 | To-do list (assigned by agency) with days-left | KEEP/IMPROVE | SPECIFIED | `GET /user/todolist/{userId}`; add overdue styling, "Today" handling. |
| TODO-02 | Toggle done | KEEP/IMPROVE | SPECIFIED | `PATCH /user/{userId}/todolist/{todoID}` with `X-*` headers; roll back on failure. |

No create/edit/delete exists in the app.

## F. Finance

| ID | Feature | Disposition | Status | Notes |
|---|---|---|---|---|
| FIN-01 | Birthdate privacy gate (yyyymmdd) before Allotment / Final Pay | UNKNOWN | ANALYZED | Client-side only, every time, no lockout. Preserve intent; replace mechanism (see 13). |
| FIN-02 | Allotment list (combined regular + special) with badge, sort toggle | KEEP/IMPROVE | SPECIFIED | `GET /user/{crewId}/payslip` |
| FIN-03 | Allotment / payslip detail (regular, special) | KEEP/IMPROVE | SPECIFIED | One shared implementation parameterised by kind. |
| FIN-04 | Final Pay list + detail | KEEP/IMPROVE | SPECIFIED | |
| FIN-05 | Cash Advance (loan deductions) list with PHP/USD totals and paid-% colouring | KEEP/IMPROVE | SPECIFIED | `GET /user/{crewId}/deductions`. Not gated. |
| FIN-06 | Standalone Special list / `/payslip` grid / old finance grid | REMOVE | ANALYZED | Unreachable dead code. Special slips remain reachable from FIN-02. |
| FIN-07 | "Other Services — coming soon" card | REMOVE (proposed) | ANALYZED | Placeholder. |
| FIN-08 | Payslip PDF export/share | UNKNOWN | ANALYZED | Does not exist in Flutter; `has_redownload` hints at a server concept. |

## G. Services (currently unreachable)

| ID | Feature | Disposition | Status | Notes |
|---|---|---|---|---|
| SVC-00 | Services tab / landing grid | UNKNOWN | ANALYZED | Nav item commented out in Flutter. **Product decision: ship, hide behind flag, or drop.** |
| SVC-01 | ASTRA: Pomodoro (25/5/15, 4 cycles) | UNKNOWN→KEEP if SVC-00 ships | SPECIFIED | Timestamp-based timer, keep-awake. |
| SVC-02 | ASTRA: Focus/Rest background noise (Brown / Rain / Water / Insects, 30–240 min) | same | SPECIFIED | 4 bundled ~4.8 MB mp3 clips. |
| SVC-03 | ASTRA: Risk Management 2×2 matrix | same | SPECIFIED | |
| SVC-04 | ASTRA: RCA (5 Whys, P.M.E.P.E + PDF) | same | SPECIFIED | Static content. |
| SVC-05 | ASTRA: SCARIL (+ PDF) | same | SPECIFIED | Static content. |
| SVC-06 | ASTRA: Military Style Emails guide (To/CC, RAID, BLUF, Next steps) | same | SPECIFIED | Static guide, **not** a generator. |
| SVC-07 | Call-It incident report | UNKNOWN | ANALYZED | UI mock; hard-coded data; nothing submits; no backend. |
| SVC-08 | "Sparks" and "Tala LMS" tiles | UNKNOWN | ANALYZED | No handler in Flutter. |

## H. Dead / excluded

Tasks module (hard-coded user id, `/crewfacingapi`), scanner demo pages, `dashboard/backup.dart`, `registration_screen2.dart`, Account tab, `pomodoro_timer_service.dart`, `reportsbu.dart`, social-login assets. **REMOVE** — do not port.
