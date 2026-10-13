# 12 — UX Improvements

Business behaviour is preserved; presentation and robustness improve. The Flutter UI is **not** reproduced pixel-for-pixel.

## Keep (brand continuity)
- Palette: primary navy `#002352`, accent `#2364AA`; ASTRA dark scheme (`#192D3B` bars, `#1F232F` background, orange/blue accents); light theme only (dark mode: out of scope unless requested).
- Poppins as the app font. Logo `sailix_main_icon.png` in the header; login navy backdrop with white card.
- Information hierarchy: 4 tabs; Dashboard shortcuts; status colour semantics (red = expired/rejected, orange = expiring/pending, green = ok).

## Improve
1. **Every list/detail gets 4 states:** skeleton (L), friendly empty (E, distinct from error), error with **Retry** (Er), content. Pull-to-refresh works even when empty (scrollable container).
2. **Real feedback:** success/failure toasts and inline form errors; no "Success" on failure; disabled submit while in flight (no double-submit).
3. **Forms:** correct keyboard types (email, numeric/phone with `+`), `autoCapitalize=none`/`autoCorrect=false` on username, next/done focus chain, field-level errors under fields, password show/hide with accessible labels, date pickers with min/max, expiry ≥ issue.
4. **Registration:** middle name optional (pending Q-5), real birthday validation, drop cosmetic captcha unless backend requires (Q-5).
5. **Dashboard:** "Upload Documents" opens the upload form; show expired-document count badge if Q-27 confirms the data; "Request Appointment" hidden until defined.
6. **Announcements:** correct age labels ("Today"), unread state consistent across Dashboard and list, `jpeg` support, tap-to-zoom images.
7. **Documents:** search + filter chips (All / Expiring / Expired) and sort by expiry — new, low-risk because remarks are server-provided; formatted dates; hide Edit when status disallows (Q-13).
8. **Payslips:** year filter and sort defaulting to newest first (explicit sort by `date_pro`); formatted dates; masked account number; Share/Download as PDF only if Q-29 approves; "Total Deduction" label styled consistently across kinds; replace ASCII "NET AMOUNT ---->>>>" with a prominent net-pay row; remove duplicate Home button; keep company header/footer text.
9. **Cash Advance:** neutral colour when loan amount is 0; show loan date and stopped/inactive badges if Q-30 agrees.
10. **To-do:** overdue/today styling, sort by due date, rollback toast on failure.
11. **Session:** friendly "Session expired" notice; biometric/PIN unlock option instead of birthdate (Q-10).
12. **Settings menu:** dedicated Settings/Account screen (Profile, Change Password, Privacy Policy, Delete Account, Version, Log out) instead of a popup — the dead Flutter Account tab shows this was intended.
13. **Pomodoro:** wall-clock accuracy, haptic/notification at phase end (if approved), consistent help text, safe area padding instead of fixed 150px.
14. **Sounds:** default selection pre-set, duration picker never throws, play state survives rotation; optional volume.
15. **Call-It / inert buttons:** render non-interactive labels as text, not buttons.
16. **Copy:** fix typos; replace "An error occured" with plain messages; centralise strings.

## Responsive & accessibility (acceptance criteria)
- Layouts use flex/`useWindowDimensions`, no fixed 150/300/320px blocks; verified on 320dp-wide and large phones, portrait (landscape verified or locked), iOS + Android, font scale up to 200% without clipped text.
- Touch targets ≥ 44pt/48dp; contrast ≥ WCAG AA (fix Call-It `teal[100]`-on-white); `accessibilityLabel/Role/State` on icon buttons, checkboxes, status badges (do not convey state by colour alone — badge text already present); screen-reader order and focus management for dialogs; error text announced; `KeyboardAvoidingView` on forms.
