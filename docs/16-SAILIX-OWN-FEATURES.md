# Sailix's own features (the crew portal modules)

On 2026-10-13 the product owner said "go with Sailix functionality, leave Tala for now". That lifts the deferral in Q-S1: the crew-portal modules (docs/12 D2–D7) are back in scope, one at a time, each stopped for review. Tala work is paused.

## Status

| Module | State |
|---|---|
| D2 Announcements | **Built** (this document) |
| To-dos (D4) | **Built** (below). Written but NOT yet run through the checks |
| Documents / Files (D3) | **Built on mock data** (below). Real file storage is still a decision |
| Finance (D5) | **Built on mock data** (below). Real data now comes in through the admin **Payroll import** (CSV, below); a direct feed from a payroll system is still open (G-02) |
| Dashboard | **Built**: the four old shortcuts (Upload a document, Finance, To-do list, My documents), a "Documents need attention" card (expired and expiring-soon documents, which the old app counted but never showed), the to-do card, the latest announcements and the Tala learning summary |
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
- **Scanner:** built later, see "Document scanner" below.
- **Not built:** automatic expiry reminders, per-type required documents, an admin "add a document on a member's behalf".

### Finance (Finance tab)

- **Tables:** `payslips` (regular / special / final; period label, vessel, position, bank, ENCRYPTED account number, exchange rate, pay in USD and PESO, adjustment, union dues, bank charges, withholding tax, management fee, SSS / PhilHealth / Pag-IBIG, deductions total, net amount, hold flag), `payslip_deductions`, `loans` (code, description, dates, loan / deduct / paid / balance amounts, dollar flag, stopped, scholar, cadet, inactive, remarks). Money is stored and returned as the server's own decimal strings; the apps only group digits for reading and never recompute (spec BR-48).
- **Member:** Finance tab = Allotment (regular and special together) and Final pay, each behind a password step-up, plus Cash advance (totals per currency, each loan with a coloured progress bar: under 50 percent red, under 80 percent orange, else green). Payslip detail hides empty figures, shows deductions, masks the bank account to the last four digits (`••••5678`) and never shows a held payslip.
- **Step-up (Q-10) now enforced by the SERVER:** the old app compared a typed birthdate on the phone, so the server never saw it. Now `POST /finance/unlock` re-checks the account password; payslip endpoints answer `403 step_up_required` until then. The unlock belongs to ONE sign-in (its token or session) for 5 minutes (`SAILIX_FINANCE_UNLOCK_TTL`), another device starts locked, wrong passwords are rate limited (5 a minute) and audited without the password. An organization can switch it off with its existing setting `payslip_step_up = none`. Cash advance is not gated (as in the old app).
- **Assumptions to confirm (change if wrong):** the step-up uses the sign-in password, not the birthdate; "total deduction" on Cash advance = what is still being deducted each period (running, not stopped, balance above zero), per currency; held payslips are hidden from members; payslips are never cached on the device.
- **Not built:** any way for an administrator to ENTER or IMPORT payslips and loans (G-02: payroll system, CSV or manual entry is still undecided), PDF export of a payslip, notifications when a new payslip arrives.

### State

Checks were run afterwards (see the PROJECT-STATUS row): backend 465, web 110, mobile 345 tests, Pint, PHPStan, OpenAPI lint, ESLint, audit gate, expo-doctor 21/21, Playwright 26, a native iOS build with the new picker module, and demo-build screenshots of Files, Finance, Allotment, payslip, cash advance. NOT verified: the document picker and the multipart upload on a device, the PDF/image viewer with a real downloaded file, Android.

## Services: Astra and Call-it (built), SRT (not)

- **Astra is a built-in service**, switched on per organization by the BTSolve platform admin (platform portal, organization > Modules > Astra; no team ID, nothing to link). It joins the module registry (`Module::Astra`, `requiresEndpoint() = false`): a member sees it in Services as **Available** when the organization has it on, and as "Coming soon" when it does not. The platform provisioning call takes no `external_team_id` for it (and refuses one), and many organizations can have it at once.
- **Tools** (all client-side, no backend, no data stored): **Pomodoro** (25 min work / 5 min break, four rounds, 15 min long break, then it stops and resets; counts WALL-CLOCK time so a locked phone does not drift; screen stays awake while it runs; break tips), **Focus and Rest sounds** (Brown noise; Rain, Water, Insects; each 5-minute clip repeats until the chosen 5, 30...240 minutes is up, measured on the clock; the screen stays awake; audio stops when you leave the screen, no background audio is declared), **Risk management** (the 2x2 chart: reduce / avoid / accept / transfer), **Root cause analysis** (5 Whys, P.M.E.P.E with its guide PDF), **SCARIL** (with its guide PDF), **Military style emails** (To and CC, R.A.I.D and subject, B.L.U.F with its example PDF, next steps).
- **Taken from the old app:** the texts (typos corrected; the Pomodoro help now says 15 minutes, as the timer does), the four sounds, six pictures and three PDFs (copied from the old project's `assets`, 23 MB added to the app).
- **New dependencies:** `expo-audio`, `expo-keep-awake` (native; a rebuild is needed) and `expo-asset`.
- **Not built:** **SRT** (no spec at all).
- **State:** checks run (see PROJECT-STATUS). Not verified: sound playback and the screen-awake behaviour on a device (the simulator build and screenshots were checked, the audio itself was not heard), Android. The module data now carries `built_in` so the web pages hide the team field for built-in services.

### Call-it (incident / safety reports), built from the old app's mock screen

The old Call-it was a mock: hard-coded name ("Jaycob"), "88 reports", a hard-coded vessel, and the Send button never sent anything (both dialog buttons did the same, "Others" showed no text field, the 1 MB limit was not enforced). It is now a real feature with a backend. **The behaviour below is my design from that mock, not from a spec: please confirm it.**

- **Built-in module** like Astra (`Module::CallIt`, `callit`), switched on per organization by the platform admin; an organization without it sees "Coming soon". The endpoints sit behind `module:callit`.
- **Member (mobile):** Call-it dashboard (welcome with the real name, reports made, medals), Create a new report, My reports. A report has classification (unsafe acts / conditions / behaviour), sub-classification (people, materials, processes, equipment, environment), location (accommodation, main deck, poop deck, cargo, ballast, hold, machinery space, others, and "others" now asks WHERE), vessel (free text; there is no vessel list), details, "did you intervene" (+ how), one optional photo or PDF, and "does this need official reporting". **Save as draft** keeps it private; **Send** checks it is complete, asks the official-reporting question, shows a summary, and sends it. A sent report can no longer change.
- **Admin (web "Call-it reports"):** the reports members SENT (never drafts), unreviewed first, open one, view its file, **Mark as reviewed**.
- **Medals:** 1, 10, 50 and 100 reports sent (counted per member). The old "#1 in Reports Made" ranking was NOT built: a league table of safety reports could discourage reporting; say if you want it.
- **Security:** the reporter, organization and status come from the session; drafts are private to the reporter (admins get `404`); another member's or organization's report is `404`; crew cannot read the admin list or review; files use the same private, content-checked storage as documents; audit records submitted / reviewed without the text; text is shown as text, never HTML.
- **Not built:** notifications to administrators when a report arrives (no email provider, no push), a vessel list, editing a report after it was sent, "official report" follow-up workflow, offline drafts (a draft needs a connection to save).
- **State:** checks run (see PROJECT-STATUS). Not verified: the file picker and upload on a device, Android.

## Dashboard (copied from the original Sailix dashboard)

The first version put Tala content on the Dashboard (a learning summary and a course list) and a stack of cards; the product owner asked for the original Sailix dashboard instead. Nothing from a service lives on the Dashboard now: Tala, Astra and Call-it are under Services.

- **Header:** a blue-to-teal gradient with rounded bottom corners (the logo's blue; the old one went blue to green, but white text must stay readable), "Welcome," and the member's first name large and bold, the organization name under it, and the Account button in the corner. The tab bar's own header is hidden for the Dashboard.
- **Shortcuts card:** three round blue buttons: **Upload documents** (opens the add-document form; the old app only switched tab), **View finances**, and **Services** (the old third button, "Request appointment", was a no-op with no spec, so it is replaced by a way into Services).
- **Two tiles:** **To-do list** and **Documents** (round icon and title, as in the old app). New: a live note under each, "3 open, 1 overdue" or "All done" on the to-do tile, and "1 expired, 2 expiring soon" on the Documents tile when something needs attention (the old app counted expired documents and never showed them).
- **Announcements card:** the title with a "new" count, a bell that opens the Announcements tab, a green rule, then the latest three announcements, or "No announcements yet." (the old "No data found...").
- **Removed from the Dashboard:** the Tala "My learning" card (progress and due dates) and the separate to-do list and document alert cards. Tala's progress and due dates are on its own My stats screen (Services > Tala > My stats).
- **Left out on purpose:** the iOS tracking prompt (the app has no ad or analytics SDK) and the disabled onboarding tips.
- **State:** checks run (see PROJECT-STATUS); the demo build was compared on the simulator and matches the old layout.

## Payroll import (how real payslips and cash advances get in)

The Finance screens read payslips and cash advances, but until now only the demo seeder could create them. Where the data really comes from (G-02) was never answered, so this is the smallest thing that works with ANY payroll system: an organization administrator uploads a CSV exported from it. **The CSV format is my design: please confirm it matches what your payroll system can export, or tell me the real format.**

- **Where:** web portal, **Payroll import** (ability `finance.manage`, administrators only). Two sections: **Payslips** and **Cash advances**, each with a template download.
- **How it works:** choose a CSV (at most 2000 rows and 2 MB), **Check the file** (nothing is written; it says how many rows are new or would be updated, or lists every problem with its line number), then **Load**. All or nothing: one wrong row means nothing is loaded. Re-loading the same file updates the same records: a payslip is its member, kind, pay date and period label; a loan is its member and loan code. For payslips, the file's deductions replace the stored ones.
- **Members** are named by `username` and must belong to the administrator's own organization (another organization's username is refused like an unknown one).
- **Payslip columns:** required `username, kind (regular|special|final), pay_date, period_label, vessel_name, net_amount`; optional `full_vessel_name, position, address, payee_name, bank_code, account_number, depart_date, payroll_date, is_dollar, exchange_rate, pay_usd, pay_peso, adjustment, adjustment_detail, signon_adjustment, union_dues, bank_charges, withholding_tax, mpfee, sss_total, employee_sss, employee_philhealth, employee_pagibig, deductions_total, deductions ("Description=amount|Description=amount"), is_hold, allotment_type`. **Loan columns:** required `username, code, description, loan_amount, paid_amount, balance`; optional `deduct_amount, loan_date, start_of_deduction, is_dollar, is_stopped, is_scholar, is_cadet, is_inactive, remarks`. Dates are `YYYY-MM-DD`, amounts have at most two decimals, yes/no columns accept yes/no/true/false/1/0. An unknown or missing column stops the file (so a typo never silently drops data).
- **Money is never worked out:** amounts are stored exactly as the file gives them (spec BR-48), including net amount, loan balance and paid amount, which must come from the payroll system. `is_hold` payslips are stored but stay hidden from the member.
- **Security:** administrators only; the bank account number is encrypted at rest and masked in every response; the audit trail records the kind and the row counts, never contents; limited to 30 uploads an hour; the template and upload are `nosniff`.
- **Not built:** a direct feed or API from a payroll system, scheduled imports, an import history screen, deleting payslips or loans through the portal, and an Excel (.xlsx) reader (export as CSV).
- **State:** written and typechecked only; tests exist for backend and web, none run (no checks until asked).

## Document scanner (DOC-07)

Scan a document into one PDF from the **Add a document** form (Files) and the **Call-it** report form: a **Scan with the camera** button next to the file picker.

- **How it works:** take up to **five** pictures with the camera, or pick them from the photo library (it only asks the library for as many as there is room for), put them in order (earlier / later / remove), then **Make a PDF**. The PDF (one picture per US-Letter page, shrunk to 1600 px wide and compressed, so it stays small enough to upload) goes back to the form as the chosen file; the page pictures are deleted, and the PDF is deleted from the cache once it has been sent. Cancel hands nothing over.
- **Camera permission:** asked when the scanner opens, with an explanation; refused for good shows "Open Settings"; and the scanner always works from the photo library, so a phone or a simulator without a camera is not stuck. The app declares only the camera (no microphone, no barcode reading) and the photo library picker.
- **Built with:** `expo-camera`, `expo-image-picker`, `expo-image-manipulator`, `expo-print` (all native: a rebuild is needed). The pictures are inlined into the PDF as base64 because the print engine cannot read local file addresses on iOS.
- **Not the same as the old scanner:** the old app used Google's ML Kit document scanner, which finds the page edges, straightens and cleans the picture automatically. This one does NOT: it keeps the picture as taken. Say if you want automatic edge detection and cropping (a bigger native dependency).
- **Privacy:** a scan is personal data. It stays on the phone until the PDF is sent, is never added to the offline store, and the temporary files are removed.
- **State:** written and typechecked only; tests exist (page model, PDF html, scanner screen flows), not run.
