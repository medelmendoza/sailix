# 04 — User Flows

Notation: ✔ normal · ALT alternative · ✖ failure. Gaps in Flutter are marked **(gap)** — the rebuild must handle them.

## F1 Login
✔ Launch → restore session (secure storage) → valid → MainTabs.
✔ No session → Login → submit → `POST /login` → `GET /user/{userID}` → store token + profile → MainTabs.
✖ 401 → show `error` from body. 400/other → `message`. Non-JSON/network → generic message. Login OK but profile fetch fails → show error, discard token **(gap: Flutter keeps token)**.
✖ Session expired (401 on any call) → clear session → Login with notice. **(gap: Flutter has no expiry handling.)**
App restart: session restored without re-login; profile cached.

## F2 Registration
Form → client validation → `POST /user/registration/app` (`userType:"ROLE_USER"`, `client_code:"SFAI"`) → 200 → success dialog "contact admin to activate" → back to Login.
✖ 400 → server message (duplicates: exact message UNKNOWN). **Any non-200 must be an error (gap).**

## F3 Change password
Form → `PUT /user/{userId}/change/password` with Bearer → success (non-dismissible) → logout. ✖ 400/401 → message.

## F4 Announcements
Dashboard/List → tap → Details (data from shared cache by id; fetch if absent **(gap: Flutter StateError)**) → if unread: `PUT …/notification/{id}` `{isViewed:"Y"}`, update both caches, rollback on failure → attachment: pdf → PdfViewer; jpg/jpeg/png → inline image.

## F5 Upload document
Files/Dashboard → Add → load `/pldocument` (L) → form → pick PDF (document picker, `application/pdf`) **or** scan (≤5 pages) → Submit → multipart `POST /user/document/upload` → **S only on 2xx** → invalidate documents + pending queries → close, toast. ✖ non-2xx/network → inline error, keep form data.
ALT: cancel; scan cancelled; picker cancelled.

## F6 Update pending document
Pending card edit → form prefilled → optionally replace file (if none chosen, **omit the file part** and confirm server accepts; Q-14) → `POST …/documents/pending/{crewdocID}` with `_method=PUT` → same success/failure rules as F5. Status gating: Q-13.

## F7 View documents / pending
Documents tab → tap card → PdfViewer(url). Pending tab → tap → PendingDetails → "View attachment". Pull-to-refresh on both.

## F8 To-do toggle
Tap checkbox → optimistic update → `PATCH` → ✖ rollback + toast.

## F9 Payslips (Allotment / Final Pay)
Finance → tap Allotment/Final Pay → privacy gate → ✔ unlock → list (`/payslip` or `/payslip/final`) → tap period → detail(s) `GET …/payslip/{kind}/datepro/{datePro}` → render one card per returned record.
✖ Wrong password → "Incorrect password."; stay on dialog, clear field. ✖ list/detail fetch error → error state with Retry **(gap)**.

## F10 Cash Advance
Finance → Cash Advance (no gate) → `GET /user/{crewId}/deductions` → totals + loan cards.

## F11 Logout
Settings → Log out → confirm → clear secure storage, TanStack Query cache, in-memory stores, unlock state, selected tab → Login. **(gap: Flutter leaves lists and tab index.)**

## F12 Delete account — UNKNOWN (Q-3)
Flutter: confirm → fake progress → fake success; user stays logged in. Rebuild: depends on backend endpoint or web-form decision.

## F13 Services (if shipped)
Pomodoro: Start → W(25) → SB(5) → W → SB → W → SB → W → LB(15) → stop+reset. Pause retains remaining; Reset returns to W, 0 cycles. Screen kept awake while running.
Focus/Rest: choose sound → player → (optional) pick duration 30–240 min → Play; repeat clip until duration elapsed; leaving screen stops audio.
Risk matrix: tap cell → sheet with advice. Emails: Step1→2→3→4 guide, BLUF "Example" opens PDF.

## Offline / network behaviour
Flutter: none (no caching, no error UI, no timeouts). Rebuild baseline: request timeout (15 s default), single retry for idempotent GETs, `NetInfo`-aware banner "No connection", stale-while-revalidate for lists (in-memory cache only; **no offline persistence of financial data**). Offline persistence of any list is **not** required unless Q-18 says otherwise.
