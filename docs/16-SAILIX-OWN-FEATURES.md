# Sailix's own features (the crew portal modules)

On 2026-10-13 the product owner said "go with Sailix functionality, leave Tala for now". That lifts the deferral in Q-S1: the crew-portal modules (docs/12 D2–D7) are back in scope, one at a time, each stopped for review. Tala work is paused.

## Status

| Module | State |
|---|---|
| D2 Announcements | **Built** (this document) |
| To-dos (D4) | **Built** (below). Written but NOT yet run through the checks |
| Documents / Files (D3) | **Built on mock data** (below). Real file storage is still a decision |
| Finance (D5) | **Built on mock data** (below). Where real payslip/loan data comes from (G-02) is still open: nothing in the product can enter it yet |
| Dashboard | Partly: shows the latest announcements and the Tala learning summary |
| Tabs: Dashboard, Files, Announcements, Finance, Services | **In place** (docs/07 §7.6). Services lists Tala and shows SRT, Call-it, Astra as coming soon |

## D2 Announcements

- **Who writes:** an organization's administrators, in the web portal (Announcements). **Who reads:** every active member of that organization, in the mobile app (Announcements tab with an unread badge, a Home card with the latest three, and a detail screen).
- **Fields:** title (150), message (5000, plain text), switched on/off, optional "show until" date. No attachments yet.
- **Read state** is per member: opening an unread announcement marks it read (idempotent). The unread count covers everything, not just the loaded page.
- **Hidden from members:** switched-off and expired announcements (and, to the API, they are `404`, the same as another organization's id). Administrators still see them in the portal.
- **Security:** the organization and author always come from the session, never the request body; one organization can never read, mark or change another's (tested); crew cannot manage (only `announcements.manage`, held by `tenant_admin`; crew abilities are unchanged); malformed ids are `404`; the audit trail records created/updated/deleted without the text; announcements are shown as text, never HTML (tested in both web and mobile).
- **API:** `GET /announcements`, `GET /announcements/{id}`, `PUT /announcements/{id}/read`; admin `GET|POST /tenant/announcements`, `PATCH|DELETE /tenant/announcements/{id}` (contracts/openapi.yaml).

### Defaults I chose (change if you disagree)

- **G-03 audience:** everyone in the organization (no targeting by vessel or selected crew). Per-recipient targeting can be added without changing the read table.
- **Attachments:** not built. They need a file-storage decision (S3-compatible vs local disk, size limits, virus scanning, expiring URLs). The spec's PDF/image attachments (ANN-02) wait for that.
- **Delete** removes the announcement and its read records; "switch off" hides it and keeps them.
- **No push notification or email** when an announcement is published (push is out of the MVP; email provider D-11 is unresolved).
- **Offline:** announcements need a connection (no saved copy yet).

### Not checked

- The mobile screens on a real device or Android; the web page in a browser (only tests and simulator screenshots of the demo build); no Playwright end-to-end test was added for announcements.

## D4 To-dos

- **Who assigns:** an organization's administrators, in the web portal (To-dos): one task for one or many members at once (a task is created per member). **Who sees it:** only the assigned member, in the mobile app: a To-do card on the Dashboard (the next open tasks, tick them there) and a To-do list screen (To do / Done, overdue count, load more). Crew can only tick or untick their own task; the text and date are the administrator's.
- **Fields:** description (500, plain text), optional due date (a calendar day, shown in the phone's time zone: "Overdue by N days", "Due today", "Due tomorrow", "N days left"), done / done-at. A finished task is never overdue.
- **Security:** the assignee must be an ACTIVE member of the administrator's own organization or nothing is created (`422 invalid_assignee`); organization, author and done state are never taken from the body; a member ticking someone else's task, or another organization's, gets `404`; crew cannot manage (`todos.manage` is admin-only, crew abilities unchanged); malformed ids are `404`; the audit trail records created/updated/deleted and a count, never the text; text is shown as text, never HTML.
- **API:** member `GET /todos` (with `open_count`, `overdue_count`), `PATCH /todos/{id}` `{is_done}`; admin `GET|POST /tenant/todos`, `PATCH|DELETE /tenant/todos/{id}`.
- **Defaults chosen:** the spec has no create/edit in the old app (agency-side only), so the portal is new; no "viewed" flag; the assignee cannot be changed after creation (delete and re-assign); no reminders or push; no offline queue (ticking needs a connection; a failed tick is put back on screen).
- **State:** written and typechecked-by-edit only. Per the owner's instruction (no checks until asked), the test suites, lint, builds and screenshots were NOT run for this module. Backend tests, web tests and mobile tests for it exist and will run when you ask for the checks. The local database was migrated.

## D3 Documents (Files) and D5 Finance, built from the old app's API and models

The old Sailix backend cannot be run, so these were rebuilt as a NEW backend from the old app's API calls and Dart models (docs/reference/sailix-spec/06, 07; `sailix/lib/providers/*`), with invented demo data (`database/seeders/CrewPortalDemoSeeder.php`, local/testing only; every name, number and amount is made up). The old key `crewID` became the membership.

### Documents (Files tab, web "Documents" and "Document types")

- **Tables:** `document_types` (per organization), `crew_documents` (owner membership, type, number, grade, place of issue, school, issued/expires dates, status pending|approved|rejected, rejection reason, reviewer, and the stored file's disk/path/name/mime/size). The old "pending" list and "approved" list are one table with a status.
- **Member:** Files tab = Documents (approved, with Expired / Expiring soon / Valid computed ON THE SERVER; expiring = within 90 days) and Pending (waiting or sent back, with the reason), a warning banner with counts, a detail screen, a viewer, and Add / Fix-and-send-again (type picker, number, grade, place, school, dates as `YYYY-MM-DD`, file picker for PDF/JPEG/PNG). An APPROVED document cannot be edited by the member (the old app allowed it, which made approval meaningless).
- **Admin (web):** Documents (review queue: view file, approve, send back with a reason) and Document types (add / rename / switch off / delete when unused).
- **Files:** stored on a PRIVATE disk (`SAILIX_DOCUMENTS_DISK`, default local) under a random name; the type is judged by content (PDF/JPEG/PNG only), size limited by the organization's `upload_max_mb`; every read goes through an ownership-checked endpoint (own document, or admin of the same organization) with `nosniff`, no caching and a locked-down CSP. The mobile viewer downloads with the bearer token into a temporary cache file and deletes it on leaving: documents are never kept on the device.
- **Security:** owner, organization, status and review fields never come from the request; another member's or organization's document is `404`; crew cannot review or manage types; audit records submitted / resubmitted / approved / rejected without numbers or reasons.
- **Not built:** the camera document SCANNER (native, needs a real-device test; the picker takes a PDF or an existing photo), automatic expiry reminders, per-type required documents, an admin "add a document on a member's behalf".

### Finance (Finance tab)

- **Tables:** `payslips` (regular / special / final; period label, vessel, position, bank, ENCRYPTED account number, exchange rate, pay in USD and PESO, adjustment, union dues, bank charges, withholding tax, management fee, SSS / PhilHealth / Pag-IBIG, deductions total, net amount, hold flag), `payslip_deductions`, `loans` (code, description, dates, loan / deduct / paid / balance amounts, dollar flag, stopped, scholar, cadet, inactive, remarks). Money is stored and returned as the server's own decimal strings; the apps only group digits for reading and never recompute (spec BR-48).
- **Member:** Finance tab = Allotment (regular and special together) and Final pay, each behind a password step-up, plus Cash advance (totals per currency, each loan with a coloured progress bar: under 50 percent red, under 80 percent orange, else green). Payslip detail hides empty figures, shows deductions, masks the bank account to the last four digits (`••••5678`) and never shows a held payslip.
- **Step-up (Q-10) now enforced by the SERVER:** the old app compared a typed birthdate on the phone, so the server never saw it. Now `POST /finance/unlock` re-checks the account password; payslip endpoints answer `403 step_up_required` until then. The unlock belongs to ONE sign-in (its token or session) for 5 minutes (`SAILIX_FINANCE_UNLOCK_TTL`), another device starts locked, wrong passwords are rate limited (5 a minute) and audited without the password. An organization can switch it off with its existing setting `payslip_step_up = none`. Cash advance is not gated (as in the old app).
- **Assumptions to confirm (change if wrong):** the step-up uses the sign-in password, not the birthdate; "total deduction" on Cash advance = what is still being deducted each period (running, not stopped, balance above zero), per currency; held payslips are hidden from members; payslips are never cached on the device.
- **Not built:** any way for an administrator to ENTER or IMPORT payslips and loans (G-02: payroll system, CSV or manual entry is still undecided), PDF export of a payslip, notifications when a new payslip arrives.

### State

Checks were run afterwards (see the PROJECT-STATUS row): backend 465, web 110, mobile 345 tests, Pint, PHPStan, OpenAPI lint, ESLint, audit gate, expo-doctor 21/21, Playwright 26, a native iOS build with the new picker module, and demo-build screenshots of Files, Finance, Allotment, payslip, cash advance. NOT verified: the document picker and the multipart upload on a device, the PDF/image viewer with a real downloaded file, Android.
