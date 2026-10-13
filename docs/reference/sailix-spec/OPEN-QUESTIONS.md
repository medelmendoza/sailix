# Open Questions

Priority: **P0** blocks the design or is a security/store-compliance risk · **P1** needed before the affected module is built · **P2** can default and revisit.
"Default" = what the rebuild will assume if unanswered.

| ID | Pri | Question | Why it matters | Default |
|---|---|---|---|---|
| Q-1 | **P0** | Does the backend enforce authentication on data endpoints (payslips, loans, documents, uploads)? Flutter sends no token; identity is only `crewID`/`userID` in the path. | Possible IDOR exposing seafarer financial/PII data | Send Bearer everywhere; escalate to backend owner as a security finding |
| Q-2 | **P0** | Which backend path is production: `/sfai-sailix-api-dev/...` (used by most calls on the "live" host) or `/sfai-sailix-api/...` (used by upload/update)? Are there staging/prod hosts? | Env configuration, upload correctness | Configurable prefixes; dev=current dev path |
| Q-3 | **P0** | Account deletion: endpoint, or web form/mailto? Flutter's is fake. | App Store/Play compliance | Block release until answered |
| Q-10 | **P0** | Payslip privacy gate: keep birthdate (yyyymmdd) prompt, replace with biometric/passcode, or both? Re-lock policy? | Product + security | Biometric/passcode with birthdate fallback; re-lock on background >60 s |
| Q-22 | **P0** | Replace the existing store listings (`com.btsolve.sailix2`, v1.0.30) or ship new? Are release keys available (Flutter release uses debug key)? | Bundle ids, versioning, signing | Keep ids; version >1.0.30+30 |
| Q-25 | **P0/P1** | Ship Services (ASTRA, Call-It)? Currently hidden in Flutter. If yes: tab, dashboard entry, or flag? | Scope (SVC-01..08), audio/PDF assets (~19 MB audio) | Build behind `SERVICES_ENABLED=false`, last milestone |
| Q-5 | P1 | Password policy (min 5 today), middle name mandatory?, is the captcha required by backend?, duplicate username/email messages? | Registration | Keep min 5; middle name optional; drop captcha |
| Q-4 | P1 | Keep iOS ATT prompt? No ad/analytics SDK exists. | Review risk | Remove |
| Q-7 | P1 | Payslip field semantics: `employee_sss` vs `sss_total`, `mpfee`, `adjustment`, `signon_adjustment`, `union_dues`, `withholding_tax`, `is_hold`, `is_officer`, `has_redownload`, `allotment_type`, `bank_code` vs `bankCode`. Which must display? | Financial correctness | Display exactly what Flutter displays |
| Q-8 | P1 | Does `date_pro` uniquely identify a payslip? (Detail call omits `vesID`.) Why can one `date_pro` return several records? | Wrong/duplicate slips | Render all returned records |
| Q-11 | P1 | Exact `Remarks` values on `/payslip` (regular vs special); does the list include finals? | Routing | case-insensitive contains "regular" else special |
| Q-12 | P1 | Full `approval_status` and document `remarks` enums | Colours/badges | As BR-20/21 |
| Q-13 | P1 | May crew edit a document that is Approved? (Flutter allows) | Update flow | Allow only Rejected/Pending |
| Q-14 | P1 | Does update require a new file? | Update flow | File optional (omit part) |
| Q-17 | P1 | Date formats of `crewDocumentIssue/Expiration`, `date_depart`, `payrolldate`, `date_pro` | Formatting | Parse leniently, fall back to raw |
| Q-6 | P2 | Mask bank account numbers? | Privacy | Mask |
| Q-9 | P2 | Does the server filter inactive/expired announcements? | List correctness | Hide `is_inactive=='Y'` |
| Q-15 | P2 | Are grade/school required for every document type? | Form rules | Required (as Flutter) |
| Q-16 | P2 | Server file size/type limits | Upload | PDF only; client limit TBD |
| Q-17b | P2 | Should ASTRA audio keep playing in background/locked? | Audio mode | No (as Flutter) |
| Q-18 | P2 | Any offline requirement? Flutter has none. | Architecture | None; in-memory cache only |
| Q-19 | P2 | Push notifications or deep links planned? | Platform | Out of scope |
| Q-20 | P2 | Multi-tenant (`client_code`)? | Registration | Fixed `SFAI` |
| Q-21 | P2 | Call-It backend, draft/saved reports, vessel list, user stats, "official reporting" meaning | SVC-07 | Not built; stub repository |
| Q-23 | P2 | Localization? | i18n | English only |
| Q-24 | P2 | Analytics / crash reporting allowed? | Observability, privacy forms | None |
| Q-26 | P2 | "Request Appointment" and Tasks module: planned features? | Scope | Excluded |
| Q-27 | P2 | Show expired-document count on Dashboard (data exists, unused)? | Dashboard | Show badge if present |
| Q-28 | P2 | Revive standalone Special allotment entry? | Finance | No (reachable via combined list) |
| Q-29 | P2 | Payslip PDF export/share wanted? | Finance | No |
| Q-30 | P2 | Show loan date / stopped / inactive on Cash Advance? | Finance | No |
| Q-31 | P2 | Certificate pinning? | Security | No |
| Q-32 | P2 | Block screenshots / hide in app switcher on financial screens? | Security | Hide in app switcher only |
| Q-33 | P2 | Use EAS Update (OTA)? | Release process | No at launch |
| Q-7b | P2 | Revive onboarding coach marks (disabled in Flutter)? | Onboarding | No |
| Q-34 | P1 | Forgot password (AUTH-04): expose it? Backend emails a plaintext new password. | Security/UX | Expose only if backend owner confirms flow |
| Q-35 | P2 | Branding: confirm name "Sailix" (legacy constant says "Tala 3.0") and legacy privacy URL | Copy | "Sailix"; current privacy URL |
