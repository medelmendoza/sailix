# 05 — Business Rules

Rules are phrased as the **required behaviour of the rebuild**. `[F]` = observed in Flutter; `[N]` = new/improved rule; `[?]` = needs confirmation (see OPEN-QUESTIONS).

## Identity & access
- BR-01 [F] Identity keys: `userID` (usr…) for dashboard/announcements/to-do/notifications/profile; `crewID` for documents, pending, payslips, loans. Both come from login + `GET /user/{id}`.
- BR-02 [F] New accounts are not usable until an admin activates them.
- BR-03 [F] Password ≥ 5 characters on register/change; confirmation must match. [N] Raise minimum only if backend agrees (Q-5).
- BR-04 [F] After a successful password change the user is logged out.
- BR-05 [N] Any 401 ends the session and returns to Login. [?] Backend must actually issue 401s (Q-1).
- BR-06 [N] Logout removes every trace of the previous user (tokens, profile, query cache, unlock state).
- BR-07 [F] Registration always sends `userType=ROLE_USER`, `client_code=SFAI`. [?] Multi-tenant later? (Q-20)

## Announcements
- BR-10 [F] Unread ⇔ `isViewed == 'N'`. Opening an unread item marks it read (server + local).
- BR-11 [F] Attachment `fileType` `pdf` → PDF viewer; `jpg`/`png` → inline image; `location` is the file URL. [N] also `jpeg`; unknown type → hide.
- BR-12 [F] Age label: whole days since `created_at` (`yyyy-MM-dd HH:mm:ss`) → `Nd ago`. [N] 0 days → "Today" (Flutter says "Yesterday").
- BR-13 [?] Server filters `is_inactive` / `date_expired` (Q-9). Until confirmed, client hides `is_inactive == 'Y'`.

## Documents
- BR-20 [F] Document card colour: remarks `Expired` → red; contains `Expiring` → orange; otherwise green. Badge (uppercase remarks) shown unless `None`. Remarks are **server-computed**.
- BR-21 [F] Pending card colour: `approval_status == 'Rejected'` → red; contains `Pending` → orange; anything else → green (approved). [?] full enum (Q-12).
- BR-22 [F] Rejection reason shown only when Rejected; uses `remarks`.
- BR-23 [F] Crew can only view/submit/resubmit; approval is agency-side.
- BR-24 [F] Upload requires: document type, number, grade, location, school, issue date, expiry date, file. Issue date ≤ today (picker 1950→today); expiry picker up to year 3000. [N] expiry ≥ issue; [?] grade/school required for all types? (Q-15).
- BR-25 [F] File must be PDF; scanner max 5 pages, PDF output. [N] enforce max size once server limit known (Q-16).
- BR-26 [F] Dates are sent as `yyyy-MM-dd`.
- BR-27 [N] Success is reported only on a 2xx; lists refresh after.

## To-do
- BR-30 [F] Done ⇔ `is_done == 'Y'`; toggling sends `Y`/`N`.
- BR-31 [F] "Days left" = calendar-day difference between today and `todo_due_date`. [N] negative → "Overdue by N days" styling; 0 → "Due today".
- BR-32 [F] Users cannot create/edit/delete to-dos.

## Finance
- BR-40 [F] Payslip and loan screens use `crewID`. Payslip types: **Regular** (monthly allotment with adjustments, SSS/PhilHealth/Pag-IBIG, itemised deductions), **Special** (one-off; no deductions), **Final** (end of contract; deductions; period line literally "Final Pay").
- BR-41 [F] Allotment list combines regular and special; `Remarks` (capital R) discriminates (contains "regular" → regular).
- BR-42 [F] A list item is identified to the detail endpoint by `date_pro` only. One `date_pro` may return several records → one card each. [?] vessel collisions (Q-8).
- BR-43 [F] Currency: `is_dollar == 'Y'` → `$` for net amount, total deductions and loan amounts; else `₱`. Allotment USD and PHP lines always shown. Number format `#,##0.00`.
- BR-44 [F] Deductions block visible when `employee_sss != ''` OR deductions list non-empty. SSS row displays `sss_total`. [N] Parse numerics defensively (empty → hidden row, never crash). [?] employee_sss vs sss_total semantics (Q-7).
- BR-45 [F] Loan health: paid/loan <50% red, <80% orange, else green. [N] loan_amount 0 → neutral.
- BR-46 [F] Allotment and Final Pay require the privacy gate each time; Cash Advance does not. Gate value = `dateof_birth` without hyphens. [?] replacement (Q-10).
- BR-47 [F] Default sort = server order (assumed newest first); toggle reverses. [N] sort explicitly by `date_pro` desc by default.
- BR-48 [F] Net amount, totals and conversions are **server values**; the client never recomputes money. [N] keep it that way.
- BR-49 [N] Mask bank account number except last 4 digits unless Q-6 says otherwise.

## Services (if shipped)
- BR-50 Pomodoro: 25 min work, 5 min short break, 15 min long break, 4 work sessions; break tips by completed session (1 walk/breathe, 2 rest eyes, 3 stretch, 4 long-break relax); long break end → stop + reset. [N] fix help text (says 25-min rest).
- BR-51 Sounds: Focus = Brown Noise; Rest = Rain, Water, Insects; clip is 5 min; selectable total 30–240 min in 30-min steps (default 5 = one play); screen stays awake; leaving stops audio. [N] duration measured by wall clock.
- BR-52 Risk: High prob/Low impact → Reduce; High/High → Avoid; Low/Low → Accept; Low prob/High impact → Transfer.
- BR-53 Email framework: To = action owners; CC = FYI; subject = RAID tag(s) + subject + vessel; body opens with BLUF (3–5 sentences: who/what/when/where/why/how); afterwards consider RCA (5 Whys/PMEPE) or SCARIL.
- BR-54 PMEPE = People, Materials, Equipment, Process & Policies, Environment. SCARIL = Situation, Complication, Analysis, Recommendation, Impact, Learnings.
- BR-55 Call-It: classifications Unsafe Acts/Conditions/Behaviour; sub-classes People/Materials/Processes/Equipment/Environment; locations Accommodation, Main Deck, Poop Deck, Cargo Space, Ballast Space, Hold Space, Machinery Space, Others. **No submit semantics exist** (Q-21).
