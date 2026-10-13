# 13 — Security Requirements

Data classes handled: **seafarer PII** (name, DOB, phone, email, address), **financial** (payslips, bank account, loans), **identity/certification documents**, credentials.

## Requirements (SR-nn; testable)

| ID | Requirement |
|---|---|
| SR-01 | No secrets, keys, hosts-with-credentials, signing files or `.env` in the repo; `.env*` git-ignored; `.env.example` has placeholders only. App config has **no** production credentials (a mobile app cannot hold secrets — assume everything shipped is public). |
| SR-02 | Access token stored only in Keychain/Keystore (`expo-secure-store`). Never in AsyncStorage, logs, URLs or crash reports. |
| SR-03 | Every API request carries `Authorization: Bearer <token>`; any 401 clears the session and routes to Login. (Backend enforcement is Q-1 / P0 — **until confirmed, the data endpoints must be treated as exposed and the finding escalated**.) |
| SR-04 | HTTPS only; no cleartext traffic (`usesCleartextTraffic=false`, ATS default). Certificate pinning: optional, decide with backend owner (Q-31). |
| SR-05 | Client never supplies identity the server should derive (`crewID`/`uploaded_by` in upload). Keep sending for compatibility, but request server-side derivation. |
| SR-06 | Logout/401 wipes: secure store, query cache, Zustand stores, payslip unlock state, cached upload files. Verified by test. |
| SR-07 | Payslip access control (FIN-01): the birthdate gate is **not** security (client-side, guessable, DOB stored locally). Requirement: replace/augment with device authentication (`expo-local-authentication` biometric/passcode) and **session re-lock** on background >N s. Final mechanism: Q-10. If product insists on the birthdate gate, add attempt limiting (e.g. 5 tries → 30 s lockout) and do not display the expected format as a hint beyond what exists today. |
| SR-08 | Sensitive screens (payslip detail, loans, documents) excluded from app-switcher snapshots (iOS blur overlay on background; Android `FLAG_SECURE` via `expo-screen-capture` `preventScreenCaptureAsync`) — confirm with product (Q-32). |
| SR-09 | Mask bank account numbers (last 4) by default; address shown as returned. |
| SR-10 | Never log: passwords, tokens, request/response bodies of auth, payslip or document endpoints, DOB. Logger redacts by key. Debug logging disabled in release. |
| SR-11 | Input validation client-side (zod) for UX **and** treat server as the authority; encode path params (`datePro`). |
| SR-12 | Uploaded/picked files: only `application/pdf`; copy to app cache; delete after upload or cancel; honour server size limit (Q-16). |
| SR-13 | Registration: no cosmetic captcha pretending to be security; rely on server-side admin activation/rate limiting. Password policy per backend (Q-5); no plaintext password emailing is a backend concern to flag (forgot-password). |
| SR-14 | Account deletion path must exist and be reachable in-app (App Store 5.1.1(v) / Play policy) — Q-3. |
| SR-15 | Android: `allowBackup=false` (or exclude secure-store); no broad storage permissions; release signed with a real release key via EAS credentials (not debug). |
| SR-16 | Dependencies: `npm audit`/Dependabot in CI; lockfile committed; no unmaintained native modules without sign-off. |
| SR-17 | Privacy: remove ATT prompt unless tracking exists; privacy policy link reachable from Settings; store privacy "data safety" forms reflect actual collection (name, email, phone, DOB, financial info, documents). |

## Threat notes
- **IDOR** (highest): knowing a `crewID`/`userID` may expose another person's payslips/loans/documents or allow uploads in their name. Mobile hardening cannot fix this; it needs a backend change. Reported as finding S1 / Q-1.
- Lost/stolen unlocked phone: mitigated by SR-07/08.
- MITM on public Wi-Fi: SR-04.
- Reverse-engineering: nothing sensitive shipped (SR-01).
