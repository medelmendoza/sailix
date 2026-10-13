# 07 — Data Models

All Flutter models store every field as `String` and cast JSON non-null (one null → whole list fails). RN models are TypeScript types **inferred from zod schemas** (`z.infer`), lenient on input and normalised on output. `YN = 'Y' | 'N'`. "num-str" = number or string in JSON; normalise to `string` for display fields and `number` where arithmetic is needed (only loan paid %).

## Session / User
```ts
type UserProfile = {
  userId: string; crewId: string; username: string;
  firstName: string; lastName: string; middleName?: string; fullName: string; // "Last, First Middle"
  email: string; mobile: string; birthDate: string /* yyyy-MM-dd */; clientCode: string;
};
type Session = { token: string; user: UserProfile };
```
`teamId`, `teamName`, `tags`, `refreshToken` exist in Flutter but are never populated — **not modelled**.

## Announcement
`announceID, notificationID, title, description, creatorID, filename('' if null), fileType('pdf'|'jpg'|'png'|''), location(URL|''), date_expired, is_inactive, created_at('yyyy-MM-dd HH:mm:ss'), updated_at, isViewed(YN?)` → map to `{id, notificationId, title, description, fileType, fileUrl?, isRead, createdAt: Date, inactive}`.

## CrewDocument
`crewID, crewDocumentID, crewDocumentTypeID, crewDocumentName, crewShortDocumentName, crewDocumentNo, document_typename, type, crewDocumentIssue, crewDocumentExpiration, grade, location, school, remarks('Expired'|'Expiring …'|'None'|other), url`. Dates displayed raw in Flutter; format UNKNOWN (Q-17) — parse defensively, show formatted when parseable else raw.

## DocumentType
`{docID, document_name}` (select by `docID`).

## PendingDocument
`crewdocID, crewID, docID, doc_number, grade, location, school, date_issued, date_expired, file_type, app_file_name, approved_by, approval_status, rejection_reason, remarks, is_checking, is_rejected, is_inactive, last_name, first_name, document_name, document_shortname, file_url`. UI uses only `approval_status`, `remarks`, `file_url`, names/numbers/dates.

## Todo
`todoID, creatorID, userID, todo_description, todo_due_date('yyyy-MM-dd'), is_done(YN), isViewed, is_inactive, created_at, updated_at, status`.

## Loan
`crewID, crew_no, code, descr, loan_date, start_ofDeduction?, loan_amount, deduct_amount, balance, paid_amount (num-str), is_stopped_pay, is_dollar, is_scholar, is_cadet, is_inactive (YN), remarks`. Response: `{deductions: Loan[], total_deduction_php, total_deduction_dollar}`. Displayed: `code, descr, loan_amount, deduct_amount, paid_amount, balance, is_dollar`.

## Payslip (normalised across kinds)
```ts
type PayslipKind = 'regular' | 'special' | 'final';
type PayslipListItem = { vesId: string; vesselName: string; datePro: string; remarks?: string; kind: PayslipKind };
type PayslipDetail = {
  kind: PayslipKind; crewName; vesselName; longPosName; address; payPeriodLabel: string; // dateProName, or "Final Pay" for final
  dateDepart: string; payeeName: string; datePro: string; payrollDate: string;
  bankCode: string; accountNumber: string; exchangeRate: string;
  payUsd: string; payPeso: string;        // from {Regular|Special|Final}_Pay_{USD|PESO}
  netAmount: string; isDollar: boolean;
  sss?: {sssTotal; employeeSss; philhealth; pagibig}; deductions: {descr: string; amount: string}[]; deductionsTotal?: string;
};
```
Fields fetched but never displayed (not modelled unless Q-7 says otherwise): `group_name, full_vessel_name, adjustment, adjustment_detail, signon_adjustment, union_dues, bank_charges, withholding_tax, is_hold, mpfee, pad_date_pro, allotment_type, is_officer, has_redownload`.

Raw field names per kind are in `_analysis/03-finance.md` §3.3–3.5; the schema layer maps them.

## Services content models (static)
`PomodoroPhase = 'work'|'short'|'long'`; `Sound {id, category:'focus'|'rest', title, icon, image, audio}`; `RiskQuadrant {id, title, text}`; guide pages as typed content objects. Call-It `Report` draft type only if SVC-07 ships (fields in `_analysis/04-services.md` §4.2).

## Rules
No `any`. API schemas live in `src/schemas/`; screens only see normalised domain types from `src/models/`.
