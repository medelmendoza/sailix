# 02 — Screen Inventory

Legend: **L** loading, **E** empty, **Er** error, **S** success. "Flutter gap" = behaviour missing in Flutter that the rebuild must add (all lists in Flutter lack Er states and refetch inside `build()`).

## Authentication

| Screen | Purpose | Fields / controls | Validation | States & notes |
|---|---|---|---|---|
| Splash | Session restore | Logo (Flutter: plain "Loading…") | — | Shown while restoring session. |
| Login | Sign in | Username, Password (eye toggle), LOGIN, "SIGNUP INSTEAD" | Both required | Navy `#002352` background, white card. Errors: server message in dialog; generic fallback. L: button spinner. Flutter gap: `mounted` crash after success; no autocorrect off. Forgot link: UNKNOWN (AUTH-04). |
| Registration | Create account | Username*, Email*, Password*, Confirm*, Last*, First*, Middle*(→ make optional, confirm), Suffix, Contact*, Birthday (date, 1950→today), captcha* | Email contains `@`; password ≥5; match; captcha equals shown code | Success dialog: "contact admin to activate". 400 → server message. Flutter gap: any non-200/400 treated as success — must be an error. |
| Forgot Password (UNKNOWN) | Request new password | Username*, Email* | non-empty | Success: "new password sent to your email". |
| Change Password | Change | Old*, New* (≥5), Confirm* | match | Success dialog (non-dismissible) → logout. |

## Main (tabs: Dashboard · Files · Announcement · Finance) + settings menu (Change Password, Delete Account, Privacy Policy, Log out)

| Screen | Purpose | Contents | States / notes |
|---|---|---|---|
| Dashboard | Landing | Gradient header "Welcome, {firstName}"; 3 circular shortcuts; To-do + Documents tiles; Announcements card (≤300px list, bell → Announcements tab) | L shimmer; E "No data found…"; Er (gap). Pull-to-refresh. |
| Announcements list | All announcements | Cards: title (bold + dot if unread), description, age (`Nd ago`/`Today`) | L shimmer×6; E; Er; pull-to-refresh. |
| Announcement details | Read one | Title, description, PDF link **or** inline image (250px, radius 15) | Image placeholder/error. |
| PDF viewer (shared) | View PDF from URL or bundled asset | Title bar; vertical scroll (remote) / horizontal paging (ASTRA assets) | L spinner; Er "Failed to load PDF"; **no cache** for remote. |
| Files | Two tabs: Documents · Pending; FAB "Add" | Document card colour by remarks (Expired red / Expiring orange / else green) + uppercase badge unless `None`; Pending card by status (Rejected red / contains "Pending" orange / else green) + edit icon | L/E/Er per tab; pull-to-refresh; list refresh after upload/update (gap). |
| Upload Document (dialog/sheet) | Submit new document | Document type (searchable), Document No, Grade, Location, School, Date Issued (≤today), Date Expiry (≤year 3000), Attach (pick PDF / scan) | All required. Submit spinner; **real** S/Er. |
| Update Document | Resubmit pending | Same, prefilled; new file optional | Gap: Flutter can submit a non-existent path. |
| Pending details | Inspect | Status in title; name, number, issued, expiry; if Rejected: "Reason/s for rejection" (`remarks`); "View attachment" | Hide link when no `file_url`. |
| To-do list | Assigned tasks | Header row; items: checkbox, description, due date, "N Days Left" | Overdue style (gap); optimistic toggle w/ rollback. |
| Finance | Entry | "Crew Payslip" card: Allotment, Final Pay (both gated); "Cash Advance" card | — |
| Privacy gate dialog | Unlock payslips | Password field, helper "Your birthdate (yyyymmdd)", Cancel/Submit | Wrong → "Incorrect password." UNKNOWN replacement — see 13. |
| Allotment list | Regular+special periods | Title `MMMM, yyyy`, subtitle vessel, badge from `Remarks`; sort toggle; Home | L ×6 (80px); E; Er. |
| Final Pay list | Final slips | Same, no badge | |
| Payslip detail ×3 (regular/special/final) | Slip | Header (logo, "Southfield Agencies, INC", "PAYROLL SLIP …"); period; crew/vessel/position/embarkation; payee, address, remitted/bank/account; Ex Rate, USD, PHP; **Less (Deduction)** block (regular & final); NET AMOUNT; footer disclaimer | Multiple records per `date_pro` → multiple cards. Mask account number (improvement). |
| Cash Advance | Loans | "Total Deductions" card (PHP, USD) + loan cards (code, descr, loan/deduction/paid/balance; colour by paid% <50 red, <80 orange, else green) | Guard divide-by-zero. |

## Services (UNKNOWN whether shipped — SVC-00)

| Screen | Contents |
|---|---|
| Services landing | 2-col tiles: Sparks (no-op), Tala LMS (no-op), Astra, Call-It |
| ASTRA menu | 6 tiles: Pomodoro, Focus/Rest, Risk Management, Root Cause Analysis, Scaril, Military Style Emails |
| Pomodoro | MM:SS, mode label, Start/Pause, Reset, 4 cycle dots, break tips, help sheet |
| Focus/Rest chooser → Focus (Brown Noise) / Rest (Rain, Water, Insects) → Sounds player | Hero image, play/pause/stop, seek slider, position/duration, duration dialog 30–240 min |
| Risk Management | 2×2 grid (Reduce, Avoid, Accept, Transfer), axis arrows, bottom sheet per cell |
| RCA → 5 Whys, P.M.E.P.E → P.M.E.P.E detail (+PDF) | Static |
| Scaril (+PDF) | Static label/descriptor list |
| Military Emails → To & CC, RAID, BLUF (+PDF example), Next steps | Static guide |
| Call-It dashboard / Create report / summary dialogs | Mock (SVC-07) |

Exact copy text for all ASTRA screens is captured in `_analysis/04-services.md` §3 and must be moved to a data file in `src/features/services/content/`.
