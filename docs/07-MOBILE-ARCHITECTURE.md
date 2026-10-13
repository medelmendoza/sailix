# 07 — Mobile Architecture (React Native + TypeScript)

Status: PROPOSED. Functional reference = existing spec (`claude/sailix-rn/docs`, features AUTH/DASH/ANN/DOC/TODO/FIN/SVC). This document records only what **changes or is added** by the multi-tenant backend; it does not repeat the 14 spec docs.

## 1. Platform decision: Expo (development builds + prebuild/CNG + EAS) — re-confirmed
The needed natives (scanner, PDF viewer, picker, secure store, optional audio/keep-awake/biometrics) were analysed in `REACT-NATIVE-PLATFORM-DECISION.md` and `09-NATIVE-CAPABILITIES.md`; nothing requires bare RN. Not Expo Go. Existing M0 uses Expo SDK 57 / RN 0.86 / React Navigation 7 / TanStack Query / Zustand / Axios / zod (read from its `package.json`; **library maintenance/compatibility to be re-verified at install**, as the spec requires). Exit criteria remain: spike failures S1/S2 → local native module via prebuild before leaving Expo. ADR-0007.

| Native capability | Candidate | iOS | Android | Expo | Status |
|---|---|---|---|---|---|
| Scan → PDF | `react-native-document-scanner-plugin` + `expo-print`/PDF lib | VisionKit | ML Kit | dev build/config plugin | **Spike S1 open** |
| PDF view | `react-native-pdf` + `react-native-blob-util` | yes | yes | dev build | **Spike S2 open** (signed/expiring URLs now the norm) |
| Pick PDF | `expo-document-picker` | yes | yes | yes | – |
| Secure storage | `expo-secure-store` | Keychain | Keystore | yes | in M0 |
| Biometrics | `expo-local-authentication` | Face/Touch ID | BiometricPrompt | yes | optional (Q-10) |
| Audio/keep-awake (Services) | `expo-audio`, `expo-keep-awake` | yes | yes | yes | flag, **Spike S3** |
Licensing and maintenance status of each library are to be checked and recorded at the time of installation (not asserted here from memory).

## 2. Tenant context on mobile (new)

| Question | Design |
|---|---|
| How does a user identify their organization? | Default: username is globally unique (D-4) → no org entry needed. If D-4 = per-agency usernames: login screen has an "Agency code" field (remembered, non-secret). Registration always requires the agency code. |
| Selection before or after authentication? | **After credential check.** One active membership → auto. Several → server returns `{requires_tenant_selection, ticket, memberships[]}`; user selects; app posts ticket + membership id; server issues token bound to that membership. |
| How is membership verified? | Server only: token row carries `membership_id`; each request middleware re-checks membership + tenant status. Client headers are hints at most. |
| Tenant switching | Not offered in v1 UI (crew belong to one agency). API supports it: `POST /auth/token/switch` → new bound token; old token revoked. |
| Where is context kept? | Token + `{tenantId, membershipId, tenantName}` in `expo-secure-store` (single atomic write). Nothing tenant-related in AsyncStorage. |
| Preventing stale-tenant requests | Axios request interceptor reads the **current session object** at send time (no captured closures); `sessionStore.switch()` first aborts in-flight requests (`AbortController`), clears Query cache, then installs the new token. Query keys are `[tenantId, membershipId, …]` so a late response for the old tenant can never populate the new cache. |
| Local cache isolation | In-memory TanStack Query only (no persisted server data, per spec). Logout, 401, 403 `tenant_suspended`, or switch → `queryClient.clear()`, reset Zustand stores (incl. payslip step-up state), delete cached upload/scan files, clear secure store. Verified by tests (SR-06). |

## 3. Changes to the existing mobile spec
- API client targets `/api/v1`; identity not in paths; `crewId/userId` removed from services (use `/me`). Lenient zod parsing retained for resilience, but contract types come from OpenAPI.
- Payslips by `id`; PDFs/images fetched via authorized endpoints or short-lived signed URLs (viewer handles expiry → refetch).
- Payslip gate: server step-up (`403 step_up_required` → app shows password prompt → `POST /auth/step-up`); biometric convenience optional.
- Error handling: map problem+json `code`s (`tenant_suspended`, `account_suspended`, `step_up_required`, `validation`, `throttled`) to UI states; `401` → session clear.
- Delete account: calls deletion-request endpoint (Q-3).
- **Superseded (M1):** Services (ASTRA/Call-It) are deferred; the mobile shell shows the modules returned by `/me.modules[]` (Tala only in the MVP). The `services_enabled` setting no longer exists.
- Seed decision D-10: copy `sailix-rn` M0 into `sailix_v2/mobile` (original left untouched), then re-run its gates.

## 4. Needs & behaviours carried unchanged
Navigation tree (spec 03), 4-state screens, accessibility criteria (spec 12), offline: none beyond NetInfo banner (Q-18), notifications: none (Q-19), permissions list (spec 09), store identity (Q-22).

## 5. Tests (see 10)
Unit (mappers, money/date), component (forms, gate), navigation (auth swap), auth/session store (tenant switch, 401 wipe), API error mapping with MSW, secure-storage mocks, tenant-context tests (stale response discarded, cache cleared), device-only checks (scanner, PDF, audio) recorded manually per release.
