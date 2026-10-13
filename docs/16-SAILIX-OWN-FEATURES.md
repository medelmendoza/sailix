# Sailix's own features (the crew portal modules)

On 2026-10-13 the product owner said "go with Sailix functionality, leave Tala for now". That lifts the deferral in Q-S1: the crew-portal modules (docs/12 D2–D7) are back in scope, one at a time, each stopped for review. Tala work is paused.

## Status

| Module | State |
|---|---|
| D2 Announcements | **Built** (this document) |
| To-dos (D4) | **Built** (below). Written but NOT yet run through the checks |
| Documents (types, upload, review, expiry) | Not started. Needs a file-storage decision and Q-13/14/16 |
| Finance (payslips, loans) | Not started. Needs G-02 (where the money data comes from) and Q-10 (step-up) |
| Dashboard | Partly: shows the latest announcements and the Tala learning summary |
| Tabs: Dashboard, Files, Announcements, Finance, Services | **In place** (docs/07 §7.6). Files and Finance are "Coming soon" placeholders; Services lists Tala and shows SRT, Call-it, Astra as coming soon |

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
