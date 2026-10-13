# 11 — Known Issues & Improvement Recommendations (Flutter app)

These are **inputs to the rebuild**. Nothing is to be fixed in the Flutter repo. Severity: **H**/M/L. "RN:" = how the rebuild avoids it.

## Security (see also 13)
| # | Sev | Issue | RN |
|---|---|---|---|
| S1 | H | **No auth on any data call** except change-password; identity = IDs in URL path → potential IDOR over payslips, loans, documents, uploads (`api_url.dart`, providers; verified by grep: single `Authorization` at `auth.dart:252`) | Bearer on all calls; escalate Q-1 to backend |
| S2 | H | Token held in memory only, no refresh, auto-login = "profile exists"; change-password after cold start sends `Bearer null` | Secure token persistence; 401 handling |
| S3 | H | `env='dev'` hard-coded; production host serves `-dev` path; upload/update use non-dev path (two backends?) | Env config; Q-2 |
| S4 | M | PII (name, email, phone, DOB) in plaintext SharedPreferences; DOB is also the payslip password | Secure store; replace gate |
| S5 | M | Payslip gate is client-side, unlimited attempts, guessable | Q-10 |
| S6 | M | Release build signed with **debug** key (`android/app/build.gradle:37`) | Proper signing in EAS; check Play App Signing |
| S7 | M | Registration treats unknown status as success; captcha is cosmetic; forgot-password emails a plaintext password; min length 5 | Fix status handling; Q-5 |
| S8 | L | Test email and placeholder credentials in code comments; full bank account number displayed | Not ported; mask account |
| S9 | L | Broad Android storage permissions; ATT text claims advertising with no ad SDK | Photo picker; remove ATT |

## Correctness
| # | Sev | Issue | RN |
|---|---|---|---|
| B1 | H | Upload/update always show "Success", even on failure; lists don't refresh | Real result handling + query invalidation |
| B2 | H | Logout leaves previous user's lists in providers (proxy providers carry `previous*` lists) and tab index | Clear query cache + stores |
| B3 | H | **Delete Account is fake** (no API call, user stays logged in) | Q-3 |
| B4 | M | `FutureBuilder` fetching inside `build()` on all lists → refetch loops/flicker | TanStack Query |
| B5 | M | One null JSON field kills whole list (non-null casts everywhere) | zod lenient + per-record safeParse |
| B6 | M | `double.parse('')` crashes in payslip deductions / loan totals | defensive number parsing |
| B7 | M | Regular/final detail records with null `deductions` silently dropped | default `[]` |
| B8 | M | Announcement details from Dashboard can throw `StateError` (different provider list); read-state diverges between lists | shared cache by id |
| B9 | M | Update flow can submit a non-existent file path; force-unwrap crash (`PendingsItem.didChangeDependencies`) | optional file part |
| B10 | M | Optimistic UI (read, to-do) without rollback | rollback |
| B11 | L | "Yesterday" for same-day items; negative "Days Left"; no overdue styling | BR-12, BR-31 |
| B12 | L | SSS row shows `sss_total` while visibility uses `employee_sss` | Q-7 |
| B13 | L | Remarks routing is case-sensitive substring | case-insensitive; Q-11 |
| B14 | L | Loan %: divide-by-zero unguarded; helper param names misleading | guard |
| B15 | L | `setState` after await without `mounted` (login) | n/a in RN hooks; guard unmounted |
| B16 | L | Dropdown maps selection by name index (duplicate names → wrong id) | select by id |
| B17 | L | Error dialogs `Navigator.pop` unconditionally (can pop wrong route) | no imperative pop |
| B18 | L | Scanner image-only result ignored (no PDF built) | spike S1 |
| B19 | L | Typo "An error occured", "its the most optimal", "an communication framework", "you can to do" | fix copy |

## ASTRA / Call-It
| # | Sev | Issue |
|---|---|---|
| A1 | M | Services tab disabled; Sparks/Tala LMS tiles dead (Q-25) |
| A2 | M | Pomodoro tick-based (drifts/pauses in background), extra 1 s at 00:00, no phase alert, wakelock stays on after long break, help text says 25-min rest (code 15) |
| A3 | M | Sounds: Submit with no selection throws; loop is count-based (pause extends time), stale loop counter; wakelock on while paused; screen crashes without route args |
| A4 | M | Call-It is a mock: hard-coded "Jaycob", 88 reports, "M/V LA BAMBA"; Send/Save/Cancel no-ops; Yes/No dialog identical; "Others" has no text field; 1 MB limit unenforced |
| A5 | L | Many styled-but-inert buttons; routing by display-title strings; PDF asset copy race |

## Duplication / dead code
`PDFScreen` ×3, announcement item ×2, shimmer ×5, upload/update dialogs ~90% identical, `MenuItem/MenuGridItem` ×5, help sheet ×8, payslip list/detail ×3 (identical except endpoint/labels). Dead: Tasks module (hard-coded user id), scanner demos, `backup.dart`, `registration_screen2.dart`, Account tab, `pomodoro_timer_service.dart`, `reportsbu.dart`, social-login assets, unused `dio`.

## Maintainability / platform
Default counter widget test (cannot pass; zero real tests); app name constant still "Tala 3.0"; legacy privacy URL; deprecated `Color.red/green/blue/value`; `.cxx` build artifacts tracked in git; 66 uncommitted changes on `medel_dev_march2025`; fixed-height layouts likely overflow in landscape / large fonts; no a11y semantics.
