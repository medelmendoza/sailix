# 03 - Finance (Loans / Cash Advance + Payslips) - Flutter analysis

Source root: `lib/` of /Users/btsolve/development/claude/sailix. Paths below are relative to `lib/`. "UNKNOWN" = not determinable from this code.

## 0. Overview & navigation

- Finance tab = `tabs/finance/finance_screen2.dart` (`FinanceScreen2`, registered in `tabs/tab_screen.dart:317`). The older grid `finance_screen.dart` (`FinanceScreen`, "Loan Deductions"/"Crew Payslip" tiles -> `/loans`, `/payslip`) is NOT referenced anywhere; `/payslip` (`PayslipScreen`, a 3-tile grid Regular/Special/Final) is therefore reachable only from dead code. Rebuild can drop both.
- Routes (registered `main.dart:330-337`, plain named routes with string arg): `/loans`, `/payslip`, `/regular`, `/regular-details`, `/special`, `/special-details`, `/final`, `/final-details`. Detail routes take `date_pro` (String) as the only argument.

## 1. Screens

### 1.1 FinanceScreen2 (finance tab) - finance_screen2.dart
- Scrollable column of 3 cards:
  1. "Crew Payslip" card (divider green): two circular blue icon buttons: "Allotment" (currency_exchange) and "Final Pay" (price_check). Special button is commented out (l.45-48) but dead code paths for 'Special' remain (l.130).
  2. "Cash Advance" ListTile card ("See Cash Advance Deductions") -> pushNamed `/loans` (l.65-66). (The Loan feature is labelled "Cash Advance" in UI, "Loan Deductions" in old grid.)
  3. "Other Services" card with a network image (hard-coded Google Drive URL, l.192; placeholder asset `course-placeholder.png`) and text "Coming soon! This portion is non-functional at this moment." (l.211-216).
- **Privacy gate (client-side only)**: tapping Allotment/Final Pay opens a dialog "Input Password" (l.224-311): obscured text field, label "Password", helper "Your birthdate (yyyymmdd)", eye toggle, Cancel/Submit. Submit compares `Auth.birthDate.replaceAll('-','') == input` (l.281-284). On match: pop dialog then pushNamed `/regular` (Allotment) or `/final` (Final Pay) (l.286-292). On mismatch: AlertDialog "An error occured" / "Incorrect password." / "Okay" (l.313-328); the password dialog stays open underneath. No attempt limit, no lockout, no per-session memory (prompts every time). `Auth.birthDate` comes from `dateof_birth` of the get-user API (`providers/auth.dart:206`), persisted in prefs (`auth.dart:287`). Date format expected `yyyy-MM-dd` (hyphens stripped). Loans screen has NO gate.

### 1.2 LoansScreen `/loans` - tabs/finance/loans/loans_screen.dart (+ loans_item.dart)
- AppBar "Cash Advance". FutureBuilder calls `Loans.getLoansAll()` on every build (l.43; note: FutureBuilder future recreated each rebuild -> refetch risk). Loading: shimmer, 5 cards height 120 (l.10-29). Pull-to-refresh via RefreshIndicator (l.48). Empty: centered "No data found..." (l.50). Error: NOT handled (snapshot.hasError ignored; exception -> falls through to Consumer, shows empty/previous list).
- List: item 0 = "Total Deductions" card (red[50]) with two lines `PHP : ₱ <n>` and `DOLLAR : $ <n>` using `NumberFormat("#,##0.00")` (l.65-67, from `total_deduction_php/dollar` of API, parsed with `double.parse`). Then one `LoansItem` per loan.
- LoansItem (loans_item.dart): Card, background color by "percentage" = `balance... ` see bug below: `getPercentage(loan_amount, paid_amount)` (l.18-24) is computed as `double.parse(second arg)/double.parse(first arg)*100` = paid/loan*100 (the helper's param is misleadingly named `balance`, l.97-100). `<50` -> red[50]; `<80` -> orange[50]; else green[50]. (loan_amount 0 -> NaN/Infinity -> falls to green; not guarded.) Content: bold `code`, bold `descr`, then 4 lines: "Loan Amount : ", "Deduction Amount : ", "Paid Amount : ", "Balance : " each prefixed `$ ` if `is_dollar=='Y'` else `₱ ` and formatted `#,##0.00`. Dates (loan_date, start_ofDeduction), remarks and flags (is_stopped_pay, is_scholar, is_cadet, is_inactive) are fetched but NOT displayed. Not tappable; no filter/sort.

### 1.3 Allotment list `/regular` - payslip/regular/regular_screen.dart (+ regular_item.dart)
- AppBar "Allotment", actions: sort toggle (icon arrow_downward/upward, tooltip "Sort Earliest to Latest"/"Sort Latest to Earliest"; state `_isLatestFirst` default true; "toggle" just reverses the list returned by API - server order assumed latest-first, l.86-90) and Home button (pushNamedAndRemoveUntil '/' ).
- Calls `Regulars.getRegularsSpecialsAll()` (combined endpoint `/payslip`, so both regular and special items appear here). Shimmer 6x80, pull-to-refresh, "No data found..." empty, no error UI.
- Item (regular_item.dart): Card with pill badge = `Remarks.toUpperCase()` (green if `Remarks.contains('regular')`, else orange), title `DateFormat("MMMM, yyyy").format(DateTime.parse(date_pro))`, subtitle `vessel_name`. Tap: if Remarks contains 'regular' -> `/regular-details` else `/special-details`, arg = `date_pro` (l.27-37). So Remarks (lowercase case-sensitive 'regular') is the discriminator; anything else (e.g. 'special') -> special. Case-sensitivity: `'Regular'` would route to special (bug risk). Remarks exact values UNKNOWN.
- Year/period filters: NONE anywhere; only sort direction.

### 1.4 Special list `/special` - special_screen.dart/special_item.dart
- Identical to 1.3 except AppBar "Special Allotment", provider `Specials.getSpecialsAll()` (`/payslip/special`), no badge, tap -> `/special-details`. UNREACHABLE from the current UI (button commented out) - only via the dead `/payslip` grid. Combined list in 1.3 already links to special details.

### 1.5 Final list `/final` - final_screen.dart/final_item.dart
- Identical structure; AppBar "Final Pay"; `Finals.getFinalsAll()` (`/payslip/final`); item title month-year, subtitle vessel; tap -> `/final-details` with `date_pro`.

### 1.6 Detail screens (`/regular-details`, `/special-details`, `/final-details`)
Common: AppBar title ("Regular Allotment"/"Special Allotment"/"Final Pay") + Home button; arg `date_pro` read via `ModalRoute...arguments as String`; FutureBuilder -> shimmer (2 cards height 700) -> RefreshIndicator -> list of payslip cards (API returns a LIST; each element rendered as its own card) / "No data found...". No error UI. Final and special screens diff from regular only in names/titles (verified by diff).

Payslip card layout (all three; items in `*_details_item.dart`):
1. Header: asset `assets/images/sfai_logo.png` 50x50 + "Southfield Agencies, INC" (hard-coded) + subtitle "PAYROLL SLIP REGULAR ALLOTMENT" / "PAYROLL SLIP SPECIAL ALLOTMENT" / "PAYROLL SLIP FINAL PAY".
2. Period line: `dateProName` (server-provided string) for regular and special; final shows hard-coded "Final Pay" (final_details_item.dart:53-60; `dateProName` not fetched for final).
3. Centered block: `crewName` (bold), `vessel_name`, `long_posname`, "Date of Embarkation :  {date_depart}" (raw string, no formatting), blank, `name` (payee/allottee name), `address`, "Date Remitted: {payrolldate} Bank: {bank_code} Account #: {account_number}" (raw strings; account number shown in full, NOT masked).
4. Divider; rows: "Ex Rate" = `exchange_rate` raw; "Allotment USD" = fmt(`*_Pay_USD`); divider; "Allotment ₱" = fmt(`*_Pay_PESO`). fmt = `NumberFormat("#,##0.00")` of `double.parse`.
5. (Regular & Final only) Deductions block, visible if `employee_sss != ''` OR deductions list non-empty: red bold "Less: (Deduction)". If `employee_sss != ''`: rows "SSS Premium" = fmt(`sss_total`) (NOT employee_sss), "Phil-health" = fmt(`employee_phealth`), "Pagibig Premium" = fmt(`employee_pagibig`) (these 2 would throw FormatException if empty string while employee_sss non-empty). Then each `deductions[]` row: descr (flexible) + fmt(deducted_amount). Then divider, "Total Deduction" (red label, bold) = `{$|₱} fmt(deductions_total)` ($ if `is_dollar=='Y'`), divider. (`deductions_total` empty -> double.parse throws.) Special slips have no deductions section.
6. "NET AMOUNT -------->>>>" bold = `{$|₱} fmt(Net_Amount)` ($ when `is_dollar=='Y'`).
7. Italic footer: "In case of any discrepancy or concern, kindly contact your payroll in charge.\nSystem generated, signature is not required."
- Fields fetched but NOT displayed: group_name, full_vessel_name, adjustment, adjustment_detail, signon_adjustment, union_dues, bank_charges, withholding_tax, is_hold, mpfee, date_pro, pad_date_pro, allotment_type, bankCode, is_officer, has_redownload (special/final). No PDF generation/viewing/download/share/print anywhere in this area (commented-out signature block "Prepared/Checked/Noted by" and "CA Onboard -200.00" are dead). `has_redownload` suggests a server-side redownload concept - UNKNOWN meaning.
- Computations client-side: only number formatting, percent paid on loans, sort reversal. Net amount, totals etc. are server-provided.

## 2. Providers (all `ChangeNotifierProxyProvider<Auth, X>` in main.dart:149-250; rebuilt whenever Auth notifies, previous list carried over)

Common to ALL: base host `ApiUrl.liveUrl = 'sailix.btsolve.com'`, https via `Uri.https(host, path)` (constants/api_url.dart:2). Path prefix `sfai-sailix-api-$env/public/api/user/` where `env='dev'` const (hard-coded 'dev' even for "live" host, l.6; `localUrl` 192.168.3.76:5000 unused here). `ApiUrl.getLoans` and `getPaySlips` both = that prefix (l.27-28). `_crewId` comes from `Auth.crewId` (login->getUser `crewID`, auth.dart:194). **No Authorization header, no token sent** (`_accessToken/_refreshToken` stored but unused); no 401 handling, no token refresh, no HTTP status check (`response.statusCode` never inspected; body is JSON-decoded blindly). Errors: any exception (network, JSON, null-cast) is `rethrow`n; UI ignores them. No caching beyond in-memory list; fetch on every screen build and pull-to-refresh. If body decodes to a Map (error object) where a List expected -> TypeError thrown (`as List<dynamic>?`). No client-side loading flags other than FutureBuilder. Provider state is not cleared on logout/user change other than being rebuilt with prior list (data from previous user may linger until refetch - UNKNOWN whether Auth logout resets; providers keep `previous*.list`).

| Provider.method | HTTP | Path (after host) | Response parsed |
|---|---|---|---|
| Loans.getLoansAll (loans.dart:43) | GET | `/sfai-sailix-api-dev/public/api/user/{crewId}/deductions` | Map: `deductions` (list, if null -> silently return), `total_deduction_php`, `total_deduction_dollar` (.toString()) |
| Regulars.getRegularsSpecialsAll (regulars.dart:30) | GET | `.../user/{crewId}/payslip` | List of {vesID, vessel_name, date_pro, Remarks} (used by Allotment screen; mixed regular+special) |
| Regulars.getRegularsAll (regulars.dart:58) | GET | `.../user/{crewId}/payslip/regular` | List {vesID, vessel_name, date_pro}; Remarks set to '' (UNUSED by any screen) |
| RegularDetails.getRegularDetailsAll(datePro) | GET | `.../user/{crewId}/payslip/regular/datepro/{datePro}` | List of regular detail objects (see 3.3) |
| Specials.getSpecialsAll | GET | `.../user/{crewId}/payslip/special` | List {vesID, vessel_name, date_pro} |
| SpecialDetails.getSpecialDetailsAll(datePro) | GET | `.../user/{crewId}/payslip/special/datepro/{datePro}` | List of special details |
| Finals.getFinalsAll | GET | `.../user/{crewId}/payslip/final` | List {vesID, vessel_name, date_pro} |
| FinalDetails.getFinalDetailsAll(datePro) | GET | `.../user/{crewId}/payslip/final/datepro/{datePro}` | List of final details |

Notes: `datePro` is the raw `date_pro` string from the list (format UNKNOWN, parsed by `DateTime.parse` so ISO-like `yyyy-MM-dd[...]`); interpolated into the path unencoded. Regular/Final detail parsers `continue` (skip the whole record) if `deductions` is null - payslips without a `deductions` key vanish (Regular/Final only). Special parser does not touch deductions.

Default state: `_loans/_regulars/...` = [] (main.dart create). Loans totals reset to '' on every Auth update (main.dart:159-160), so Consumer may hit `double.parse('')` if list non-empty from previous but totals empty after rebuild -> FormatException (potential crash).

## 3. Data models (all fields stored as `String`; every model `extends ChangeNotifier` needlessly)

Parsing convention in providers: numeric -> `.toString()` (accepts number or string); strings assigned directly (non-nullable `String`, so a JSON null throws a type error) except where `?.toString() ?? ''` or `?? ''` noted. For RN: model as nullable and normalize.

### 3.1 Loan (providers/loans/loan.dart) JSON keys identical to field names
crewID, crew_no, code, descr, loan_date (string), start_ofDeduction (`?? ''`), loan_amount, deduct_amount, balance, paid_amount (numeric->string), is_stopped_pay, is_dollar, is_scholar, is_cadet, is_inactive (strings, presumably 'Y'/'N'; only is_dollar=='Y' checked), remarks (string, non-null assumed).
Response wrapper: `{ deductions: Loan[], total_deduction_php, total_deduction_dollar }`.

### 3.2 Payslip list item
- Regular (regular.dart): vesID, vessel_name, date_pro, Remarks (capital R in JSON; from `/payslip` only).
- Special / Final: vesID, vessel_name, date_pro.

### 3.3 RegularDetail (regular_detail.dart; parser regular_details.dart:59-99)
Strings required non-null: crewName, group_name, vessel_name, long_posname, address, dateProName, date_depart, full_vessel_name, name, adjustment_detail, account_number, bank_code, is_dollar, is_hold, date_pro, payrolldate, pad_date_pro, allotment_type, bankCode, is_officer. Numeric->string: adjustment, signon_adjustment, Regular_Pay_PESO, Regular_Pay_USD, union_dues, bank_charges, Net_Amount, withholding_tax, exchange_rate. Optional (`?.toString() ?? ''`): mpfee, employee_sss, employee_phealth, employee_pagibig, sss_total, deductions_total. `deductions`: `[{descr: string, deducted_amount: number->string}]`.

### 3.4 SpecialDetail (special_detail.dart; parser special_details.dart:48-71)
crewName, group_name, vessel_name, long_posname, address, dateProName, date_depart, full_vessel_name, name, account_number, bank_code, Special_Pay_PESO, Special_Pay_USD, bank_charges, Net_Amount, exchange_rate, is_dollar, date_pro, payrolldate, allotment_type, bankCode, has_redownload. (No deductions/adjustment/SSS fields.)

### 3.5 FinalDetail (final_detail.dart; parser final_details.dart:60-90)
Same as special but pay fields `Final_Pay_PESO/USD`, no `dateProName`, plus adjustment, mpfee, employee_sss, employee_phealth, employee_pagibig, sss_total, deductions_total (optional ones `?? ''`), deductions[].

### 3.6 Deductions: `{descr, deducted_amount}` (class in regular/deductions.dart, shared by final).

## 4. Business rules (plain language)
- Crew member (identified by `crewID` from profile) can see: cash-advance/loan deductions with PHP and USD totals; payslips (called "Allotment"/"Payroll slip") per vessel and processing period (`date_pro`, shown month+year).
- Payslip types: **Regular** allotment (monthly; has adjustments, SSS/PhilHealth/Pag-IBIG government premiums and itemized deductions, union dues, bank charges, withholding tax, mpfee in model); **Special** allotment (one-off; only USD/PHP pay + net); **Final** pay (end-of-contract; like regular incl. deductions but no period name, title "Final Pay"). Combined list `/payslip` mixes regular+special distinguished by `Remarks` containing "regular".
- Currency: `is_dollar=='Y'` => amounts of net/total deduction/loans shown with `$`, else `₱`. Allotment lines always show both USD ("Allotment USD") and PHP ("Allotment ₱") amounts with `Ex Rate`. Format `#,##0.00` (en locale default of intl, no locale passed). Exchange rate shown raw (no formatting).
- Loan health coloring: paid/loan <50% red, 50-<80% orange, >=80% green. Loan statuses (stopped, inactive, scholar, cadet) not surfaced.
- Payslips access requires re-entering birthdate (yyyymmdd) every time (privacy gate, client-side only); Cash Advance is ungated. No masking of account numbers.
- Multiple records may be returned for one `date_pro` (list rendered as multiple cards) - e.g., multiple allotments/vessels in same period; UNKNOWN exact cause.

## 5. Bugs, duplication, security, hard-codes, UX

Duplication (for shared RN implementation):
- Three list screens, three list items, three list providers: identical except title, endpoint suffix (`regular|special|final`) and (regular only) `Remarks` badge/routing. One `PayslipListScreen(type)` + one `usePayslips(type)`.
- Three detail screens identical except title/route/provider; three detail items with same header/payee block/FX rows/net/footer. Differences: (a) subtitle "PAYROLL SLIP REGULAR ALLOTMENT"/"SPECIAL ALLOTMENT"/"FINAL PAY"; (b) period line = `dateProName` (regular, special) vs literal "Final Pay"; (c) pay field names `Regular_Pay_*`/`Special_Pay_*`/`Final_Pay_*`; (d) deductions section present on regular & final, absent on special; (e) special/final carry `has_redownload`, regular carries the extra fields (is_hold, is_officer, adjustment_detail, signon_adjustment, union_dues, withholding_tax, pad_date_pro). (f) `buildRow` in regular colors label red when label=='Total Deduction'; special/final do not (final's Total Deduction label is therefore NOT red - inconsistency). Single normalized `Payslip` type with `kind` and `pay_peso/pay_usd` resolved from `${Kind}_Pay_PESO` fits.
- `finance_screen.dart`/`payslip_screen.dart` MenuGridItem duplicated; `Regulars.getRegularsAll` unused; dead `Specials` route reachable only through dead grid.

Bugs:
1. `getPercentage(loanAmount, balance)` is called with (loan_amount, paid_amount) and divides second/first - works as paid%, but the parameter name lies; division by zero unguarded. (loans_item.dart:18-24, 97-100)
2. "SSS Premium" row shows `sss_total`, while visibility check uses `employee_sss` (regular_details_item.dart:119-127, final same) - `employee_sss` value itself is never shown; semantics UNKNOWN.
3. `double.parse('')` crashes when optional fields default to '' while the section is visible (employee_phealth/pagibig empty; deductions_total empty with non-empty deductions). Also `Total Deduction` when `employee_sss==''` but deductions non-empty uses `deductions_total` - fine only if server supplies it.
4. Regular/Final detail parser skips records whose `deductions` is null (continue) - silent data loss. Shared `loadedDeductions` list reset pattern is fine but fragile.
5. Loans provider totals reset to '' on each Auth update and compared with non-empty list -> `double.parse('')` possible (loans_screen.dart:66-67).
6. FutureBuilder `future: _loansAll(context)` created inside build -> refetches on every rebuild (e.g., after `notifyListeners`, which triggers Consumer only, but parent rebuild/route return rebuilds); all list/detail screens share this pattern.
7. Error states not rendered: failed fetch -> shimmer disappears, shows stale list or "No data found..." with no error message. `AppConstants.errorMessage` exists but not used here.
8. Month-year display uses `DateTime.parse(date_pro)` -> throws on non-ISO string; date_depart/payrolldate shown raw (format UNKNOWN).
9. Remarks routing is case-sensitive substring `'regular'`.
10. Sort toggle merely reverses; assumes server order newest first (UNKNOWN); icon semantic is inverted/confusing (arrow_downward when latest-first).
11. Wrong-password dialog: after error the password dialog remains and no visual reset; `_showErrorDialog` shows on top of the input dialog.
12. Placeholder typo: "An error occured".
13. `print(url)` debug prints (regulars.dart:33, final_details.dart:94 prints list).

Security:
- All finance endpoints are unauthenticated from client's perspective: GET with only the crewId in the path (no bearer token, no header) - anyone knowing a crewID could potentially read payslips/loans (IDOR) unless the server restricts by network/other means. Rebuild should send the token and handle 401/refresh (UNKNOWN whether server supports it; `login` returns `token`).
- Payslip "password" gate is purely client-side and the secret (birthdate) is stored in plain SharedPreferences (auth.dart:287) and is guessable; weak. Consider biometric/PIN, lockout.
- Full bank account number and address displayed unmasked.
- Birthdate used as password hint exposes the format to shoulder-surfers (helper text).

Hard-coded: host `sailix.btsolve.com`; env 'dev' in path; company name "Southfield Agencies, INC", logo asset, footer text; currency symbols `$`/`₱`; Google Drive promo image URL; titles "Allotment", "Cash Advance"; birthdate password rule.

UX: no year/period filter; no search; no PDF export/share/print; no pagination (whole history loaded); detail screens have no back-of-list context (period shown only via dateProName); duplicate Home button on every screen; "NET AMOUNT -------->>>>" ASCII styling; Special allotment entry removed from the finance tab but still shown in the combined Allotment list (badge orange).

## 6. UNKNOWNs / open questions
- Server auth requirements for these endpoints (token header? Auth.accessToken exists); 401/refresh behavior - none implemented client-side.
- Exact values/casing of `Remarks` (assumed contains "regular" vs something like "special"); whether `/payslip` combined list includes finals.
- Formats of `date_pro`, `payrolldate`, `date_depart`, `exchange_rate`; whether `date_pro` uniquely identifies a payslip (list items for same month with different vessels would collide on the datepro detail endpoint; `vesID` is not sent with the detail call).
- Meaning of `employee_sss` vs `sss_total`, `mpfee`, `adjustment`/`signon_adjustment`/`adjustment_detail`, `is_hold`, `is_officer`, `has_redownload`, `allotment_type`, `bank_code` vs `bankCode`, `crew_no`, `is_scholar/is_cadet/is_stopped_pay/is_inactive` semantics (probably Y/N flags).
- Whether loans from other statuses (inactive/stopped) are returned and how they should be styled.
- Whether `Auth.birthDate` can be null (gate then never matches because `null != text`).
- Whether provider state should be wiped on logout (Flutter keeps previous lists).
- Whether the unused Special tab/`/payslip` grid should be revived in the rebuild.
