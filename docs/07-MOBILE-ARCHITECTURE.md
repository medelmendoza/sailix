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

## 6. M5 implementation notes (2026-10-13)
- Session states: `bootstrapping | authenticated | unauthenticated | unreachable`. A network failure at start-up keeps the stored credential and shows a retry screen; only a 401 wipes it.
- Token refresh when fewer than 7 days remain (single in-flight); late `/me` responses are ignored; 401 on an authenticated session signs out with a notice.
- All query keys go through `scopedKey()` → `[tenantId, membershipId, ...]`; sign-out cancels and clears the query cache.
- Tests mock at the Axios adapter (`mockApi`): an unmocked call fails the test, so nothing can reach a network.
- Module screen shows availability only until the M3 gateway exists (`MODULE_CONTENT_AVAILABLE`).
- Not run on a native build/simulator yet; see docs/13 §14.

## 7. Visual design (2026-10-13)
**Reference:** the product owner chose https://uupm.cc/demo/mental-health. I read its real computed styles in a browser (not just its text): a calm **soft-UI / neumorphic** language — one soft grey-blue surface (`#F0F4F8`), raised and pressed-in shapes made of a light and a dark shadow, 24 px cards and 16 px controls, a dusty-blue primary (`#7C9EB2` → `#8FAFC4`) with lavender, mint and peach accents, Quicksand headings and Nunito body text.
**What was applied** (all tokens in `src/constants/theme.ts`; components restyled once, so every screen follows): raised cards, a gradient primary button and a raised secondary button that sink when pressed, inset (pressed-in) text fields with a visible outline, an inset progress track with a gradient fill, soft tinted notices, calm headers (surface colour, no divider, Quicksand titles, chevron-only back button), a raised tab bar with drawn icons, the Sailix badge on sign-in, Quicksand/Nunito replacing Poppins.
**Deliberate deviations from the reference (accessibility):** the reference's colours fail WCAG AA (white on its `#7C9EB2` button is 2.8:1; its muted text is 3.6:1). Same hues, darkened: primary `#3E6F8A`, muted text `#556579`, status text colours re-tuned, and an outline (`#74879D`, ≥3:1) on inputs and option rows because soft shadows alone do not identify a control. Lavender/mint/peach stay decorative fills. **A test (`src/constants/__tests__/theme.test.ts`) enforces ≥4.5:1 for every text/background pair and ≥3:1 for control outlines**, so the palette cannot drift. Emoji tab icons were tried and dropped (they rendered as missing-glyph boxes in the simulator runtime); the two icons are drawn from plain shapes. Headline gradient text from the reference is not used (React Native cannot gradient text without a native module).
**Technique:** React Native 0.86 `boxShadow` (multiple layers, `inset`) and `experimental_backgroundImage` (gradients): no new native dependency. Android renders both on recent versions; **Android and older iOS were not checked**.
**Demo mode (build-time, never in production):** `DEMO_MODE=1` builds the app signed in with invented sample data (no network, no storage) and a scripted tour through Home, My Stats, a course, a quiz, flashcards and Account every 7 seconds — used to review the design on real screens without touching them, and useful for stakeholder demos. `parseEnv` forces it off for `appEnv: production` (tested).
**Not done:** the web administration portal still has its own Tailwind look (not restyled); dark mode; larger-text (Dynamic Type) review; a design pass on the registration/forgot-password screens beyond the shared components; screenshots of the Android build.


### 7.1 Tala screen layout (copied from the original Tala app)

Only the *placement* is copied; colours, type and shadows stay the Sailix soft-UI tokens (§7).

- **Course list**: one card per course. A large course picture with the title over it, then a footer row with the creator and the time left, then the progress bar and "N of M items completed".
- **Course detail**: hero picture; info card (name, "Creator", "Due", progress); Description card; Materials card. Each material row has a thumbnail (or a type icon), the name, "Type : …" and "Status : …" lines, and a trailing download / remove icon for video and PDF. Tapping a row opens the video, PDF, quiz or flashcards.
- A missing or failed picture shows a soft placeholder (first letter), never a broken image. The gateway returns `creator` (string or null).

### 7.2 "Harbor" redesign (replaces the soft-UI look in §7; the screen layout in §7.1 is unchanged)

Warm sand ground, white cards lifted by a soft shadow and a hairline, deep-teal brand (`#0A5C6E`), navy ink, coral/seafoam as decoration only. Same token names, so every screen picked it up; text/background pairs (including on the sand ground) are contrast-tested in `theme.test.ts`. Not done: web admin portal, dark mode, Dynamic Type.

### 7.3 Send feedback

Account > Send feedback posts `{category, message}` to `POST /me/feedback`. The server stamps the organization and member from the session (never the body), limits to 10 a day, and administrators read it at `GET /tenant/feedback` (API only; no web screen yet). It is NOT sent to Tala.

### 7.4 Flashcard study screen (copied from the Tala app, plus a flip)

One large card shows the Question. A big round ANSWER button turns the card over to the Answer side; then three round buttons, Easy (green), Medium (amber), Hard (red), rate the card and turn it back to the next question. Study order and recording are unchanged (unrated cards first in random order, then hard/medium/easy practice; the complete set is sent once every card is rated). The flip is a 480 ms rotation using `Animated` on the native driver; with "reduce motion" on it changes side without turning. Only the side facing the learner is exposed to screen readers. Demo builds accept a `preview: 'answer'` route param so screenshots can show the answer side (ignored otherwise).

Not verified: the motion itself on a device (screenshots show the two resting sides only, and touch input does not work on the simulator here).
