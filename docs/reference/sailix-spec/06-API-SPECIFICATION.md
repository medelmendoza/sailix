# 06 — API Specification (as observed in Flutter)

**Host:** `https://sailix.btsolve.com` (single host; `localUrl 192.168.3.76:5000` unused).
**Prefix `P`:** `/sfai-sailix-api-dev/public/api` — Flutter hard-codes `env='dev'`, so the "live" host is serving the **dev** path. Upload/update use `/sfai-sailix-api/public/api` (no `-dev`). **Which is production is UNKNOWN (Q-2).** The RN app must take host + prefix from environment config, never constants.

**Cross-cutting observations (verified in source):**
- The **only** call that sends `Authorization: Bearer` is change-password (`auth.dart:252`). All other calls are unauthenticated and carry identity only in the URL (`userID`/`crewID`). **Q-1 (P0): does the backend enforce auth?** The RN client will send `Authorization: Bearer <token>` on every request (harmless if ignored) and handle 401.
- No status-code checks on GETs, no timeouts, no retries, no refresh endpoint (login returns only `token`).
- JSON booleans are `'Y'`/`'N'` strings; numeric fields arrive as number **or** string.
- No endpoint below was invented; response shapes come from provider parsing code. Anything beyond that is UNKNOWN — REQUIRES CONFIRMATION.

## Authentication & user

| Op | Method + path | Headers | Body | Response |
|---|---|---|---|---|
| Login | `POST P/login` | JSON | `{username, password}` | 200 `{userID, token}`; 401 `{error}`; 400 `{message}` |
| Get user | `GET P/user/{userID}` | none today | — | `{crewID, last_name, first_name, middle_name?, username, email_address, mobile_number, dateof_birth(yyyy-MM-dd), client_code}` |
| Register | `POST P/user/registration/app` | JSON | `{userType:"ROLE_USER", email_address, username, password, last_name, first_name, middle_name, suffix_name, mobile_number, dateof_birth("yyyy-MM-dd" or ""), client_code:"SFAI"}` | 200 ok; 400 `{message}`; others UNKNOWN |
| Forgot password | `POST P/user/forgot-password` | JSON | `{username, email}` | 200 ok; 401 → "User not found"; 400 `{message}` |
| Change password | `PUT P/user/{userId}/change/password` | JSON + `Bearer` | `{old_password, new_password}` | 200 ok; 400/401 `{message}` |
| Delete account | **UNKNOWN — REQUIRES CONFIRMATION** (none in Flutter) | | | |
| Refresh token | **UNKNOWN — none exists** | | | |

## Dashboard / announcements

| Op | Method + path | Notes |
|---|---|---|
| Dashboard combined | `GET P/user/dashboard/combined/{userId}` | `{announcementResult: Announcement[], crewDocCountResult:{expired,expiring?,normal?}, notificationResult?:{userID,countNotification}}` |
| Announcements | `GET P/announcement/user/{userId}` | `Announcement[]` |
| Mark read | `PUT P/user/{userId}/notification/{notificationID}` | JSON `{isViewed:"Y"}`; 200 required else `{message}` |

## Documents

| Op | Method + path | Notes |
|---|---|---|
| Document types | `GET P/pldocument` | `[{docID, document_name}]` |
| Documents | `GET P/listCrewDocument/{crewId}` | `CrewDocument[]` |
| Pending | `GET P/user/{crewId}/documents/pending` | `{data: Pending[]}` |
| Upload | `POST /sfai-sailix-api/public/api/user/document/upload` (**no -dev**) | multipart: `file`, `crewID`, `docID`, `doc_number`, `grade`, `location`, `school`, `date_issued`, `date_expired`, `app_file_name`, `uploaded_by`(=crewId). 200 = success; response body unused |
| Update pending | `POST /sfai-sailix-api/public/api/user/{crewId}/documents/pending/{crewdocID}` (**no -dev**) | multipart: `_method=PUT`, `docID`, `doc_number`, `grade`, `location`, `school`, `date_issued`, `date_expired`, `app_file_name`, `file` |

Security note: client sends `crewID`/`uploaded_by` itself — server should derive them from the token (Q-1).

## To-do

| Op | Method + path | Notes |
|---|---|---|
| List | `GET P/user/todolist/{userId}` | `{data: Todo[]}` |
| Toggle | `PATCH P/user/{userId}/todolist/{todoID}` | headers `X-User-ID`, `X-User-Name`, `X-User-Type: USER`, `X-Client-Code: SFAI`, JSON; body `{is_done:"Y"|"N"}`; 200 else `{message}` |

## Finance (all `GET`, base `P/user/{crewId}`)

| Op | Path | Response |
|---|---|---|
| Loans | `/deductions` | `{deductions: Loan[], total_deduction_php, total_deduction_dollar}` |
| Combined list | `/payslip` | `[{vesID, vessel_name, date_pro, Remarks}]` |
| Regular list (unused) | `/payslip/regular` | `[{vesID, vessel_name, date_pro}]` |
| Special list (dead UI) | `/payslip/special` | same |
| Final list | `/payslip/final` | same |
| Regular detail | `/payslip/regular/datepro/{datePro}` | `RegularDetail[]` |
| Special detail | `/payslip/special/datepro/{datePro}` | `SpecialDetail[]` |
| Final detail | `/payslip/final/datepro/{datePro}` | `FinalDetail[]` |

`datePro` is interpolated raw — RN must `encodeURIComponent`. Flutter silently drops regular/final detail records whose `deductions` is null — RN must not (treat as `[]`).

## Excluded / dead endpoints
`GET /crewfacingapi/public/api/task/usr83f7583766e9a7bfa` (Tasks; hard-coded user) — **not ported**. `ApiUrl.forgot` (`api/v1/auth/users/forgot-password`) — legacy, unused.

## Services
No API calls. Call-It has none (Q-21).

## Client contract for the RN API layer
- One Axios instance; `baseURL` from config; timeout 15 s; request interceptor adds Bearer; response interceptor: 401 → session expiry event; normalises errors to `ApiError{status, message, kind: 'network'|'http'|'parse'}`.
- Every response passes through a **zod schema** with nullable/lenient fields (`.nullish()`, `z.coerce.string()` for number-or-string) and per-record `safeParse` so one bad record doesn't kill a list.
- Never log request bodies for `/login`, `/change/password`, `/registration/app`.
