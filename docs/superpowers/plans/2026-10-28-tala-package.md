# Tala as a Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tala becomes a self-contained package (`packages/tala`) mounted by a standalone Tala app (`apps/tala`) and, behind a flag, by Sailix Services, without deleting any existing Sailix Tala code.

**Architecture:** `packages/tala` exports `talaModule = { code, title, logo, Root }`; `Root` takes a `host` (`scope`, `theme`, `config`, `onExit`) and owns its navigation, sign-in, direct-to-Tala data source and offline store. Sailix mounts `Root` behind `TALA_PACKAGE`; `apps/tala` is a thin Expo shell around it plus an `extraTabs` slot.

**Tech Stack:** Expo SDK 57, React Native 0.86, React Navigation 7 (native-stack, bottom-tabs), TanStack Query 5, zustand, axios, zod, Jest (`jest-expo`), `expo-secure-store`, `expo-video`, `expo-file-system` (peer deps).

**Spec:** `docs/superpowers/specs/2026-10-27-standalone-tala-app-design.md`

## Global Constraints

- Nothing in `mobile/src/features/modules/tala`, `mobile/src/features/modules/ModuleScreen.tsx` behaviour with the flag off, the `AppStack` Tala routes, or `backend/app/Modules/Tala` is deleted or changed in behaviour.
- `packages/*` imports nothing from `mobile/` or any Sailix path (lint-enforced, Task 3).
- Tala address (`TALA_API_BASE_URL`) is HTTPS only; plain HTTP is refused by the package.
- `TALA_PROGRESS_WRITES` defaults to off; progress writes are never retried.
- A 401 **or** a 500 on an authenticated Tala call: one token refresh, then a "sign in again" signal.
- The quiz answer key is held in memory during an attempt and never persisted.
- Native modules (`expo-secure-store`, `expo-video`, `expo-file-system`) are peer dependencies of the package.
- Web and backend are not touched. Sailix's existing mobile suite (444 tests) must stay green after every task.
- Commit per task with a `docs/PROJECT-STATUS.md` row and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; do not push.

## Review Focus

- Tala returns an empty courses list or a team with no courses: screens show the empty state, not a crash.
- Token refresh fails or the network drops mid-request: user is returned to sign-in with offline data intact, no loop of refreshes.
- Account in several teams, one team, or none: picker, skip, or a clear "no team" message.
- Sign-out in the middle of a quiz attempt: answer key and tokens are wiped, no stale scoring state survives.
- Two scopes on one device (Sailix organization A vs B, or Sailix vs standalone): caches and offline files never cross.

---

## File Structure

```
package.json                              root workspaces: mobile, packages/*, apps/*   (created, Task 0)
packages/tala/package.json                name @sailix/tala, peerDependencies
packages/tala/src/index.ts                exports talaModule, TalaHost, TalaRoot
packages/tala/src/host.ts                 TalaHost type + HostProvider/useHost
packages/tala/src/direct/{client,auth,mapping,quiz,deck,progress}.ts
packages/tala/src/direct/__tests__/*.test.ts
packages/tala/src/data/source.ts          TalaDataSource interface + createDirectSource(host)
packages/tala/src/data/hooks.ts           TanStack Query hooks (replaces mobile .../tala/api.ts for the package)
packages/tala/src/offline/                copy of mobile/.../tala/offline
packages/tala/src/ui/                     small copies of AppText, Button, Card, Screen, EmptyState, FormError, theme
packages/tala/src/screens/                copies of the Tala screens
packages/tala/src/TalaRoot.tsx            navigation + sign-in gate + team picker
apps/tala/                                Expo shell (app.config.ts, eas.json, index.ts, src/App.tsx, src/MoreTab slot)
mobile/metro.config.js                    only if the spike needs it (Task 0)
mobile/src/features/services/            Services mounts the package when TALA_PACKAGE=1 (Task 4)
```

### Task 0: Spike. A workspace package renders inside Sailix

**Files:**
- Create: `package.json` (root), `packages/tala/package.json`, `packages/tala/src/index.ts`, `packages/tala/src/host.ts`, `packages/tala/src/TalaRoot.tsx`
- Modify: `mobile/package.json` (dependency `@sailix/tala`), `mobile/jest.config.js`, `mobile/src/features/modules/ModuleScreen.tsx` (flagged mount only), `mobile/app.config.ts` (expose `TALA_PACKAGE` in `extra`)
- Create if needed: `mobile/metro.config.js`
- Test: `packages/tala/src/__tests__/spike.test.tsx`

**Interfaces:**
- Produces: `type TalaHost = { scope: string; theme: TalaTheme; config: { talaBaseUrl: string; progressWrites: boolean; teamId?: number }; onExit: () => void }`; `talaModule: { code: 'tala'; title: string; Root: (p: { host: TalaHost; extraTabs?: ExtraTab[] }) => JSX.Element }`.

- [ ] **Step 1: Write the failing test.** `spike.test.tsx` renders `<talaModule.Root host={fakeHost} />` and asserts the text "Tala package" is shown and that pressing "Back" calls `fakeHost.onExit` once.
- [ ] **Step 2: Run** `cd mobile && npx jest packages/tala` from the root config; expect FAIL (module not found).
- [ ] **Step 3: Create the workspaces and the stub `TalaRoot`** (a Screen with the text and a Back button). Try root npm workspaces first (`mobile`, `packages/*`, `apps/*`); Expo SDK 57 auto-detects workspace roots for Metro. If Metro or Jest cannot resolve `@sailix/tala`, fall back to `"@sailix/tala": "file:../packages/tala"` plus `mobile/metro.config.js` with `watchFolders` and `resolver.nodeModulesPaths`. Record which one worked in the commit message.
- [ ] **Step 4: Run the test; expect PASS.** Then run `cd mobile && npm run validate`; expect green (444 tests).
- [ ] **Step 5: Run in the Android dev client** (`API_BASE_URL=http://localhost:8002`, flag `TALA_PACKAGE=1`): from Services, tapping Tala shows "Tala package" and Back returns. This is the spike's answer; if it cannot be made to work, stop and report to the owner.
- [ ] **Step 6: Commit** (`Spike: Tala package renders inside Sailix`).

### Task 1: Direct client and session (`client.ts`, `auth.ts`)

**Files:**
- Create: `packages/tala/src/direct/client.ts`, `packages/tala/src/direct/auth.ts`
- Test: `packages/tala/src/direct/__tests__/client.test.ts`, `auth.test.ts`

**Interfaces:**
- Produces: `createTalaClient(cfg: { baseUrl: string }, getToken: () => Promise<string|null>): TalaClient` with methods `login(email, password)`, `teams(userId)`, `courses(userId, teamId)`, `courseSync(userId, teamId, courseId, assignId)`, `card(teamId, id)`, `quiz(teamId, id)`, `material(kind: 'videos'|'pdf', teamId, id)`, `syncCourses(body)`, `applyCourses(body)`; every call returns parsed JSON or throws `TalaError { kind: 'unauthorized' | 'unavailable' | 'invalid' }`.
- Produces: `createTalaSession(storage, client): { signIn, signOut, current(), refresh(), onSignInAgain(cb) }`.
- Port source: `backend/app/Modules/Tala/TalaClient.php`, and its tests `TalaGatewayTest.php`, `CheckTalaEndpointTest.php`.

- [ ] **Step 1: Write failing tests** (mocked axios): `refuses a non-HTTPS base url` (throws at construction), `maps 401 and 500 to unauthorized`, `retries a GET once after refresh then signs in again`, `never retries a POST`, `signOut wipes stored tokens`, `uses the PHP client's timeouts` (copy values from `TalaClient.php`).
- [ ] **Step 2: Run** `npx jest packages/tala/src/direct`; expect FAIL.
- [ ] **Step 3: Implement** `client.ts` and `auth.ts`; tokens via `expo-secure-store` behind a tiny `Storage` interface so tests inject a fake.
- [ ] **Step 4: Run; expect PASS.**
- [ ] **Step 5: Commit.**

### Task 2: Mapping, quiz, deck and progress, ported from PHP

**Files:**
- Create: `packages/tala/src/direct/{mapping,quiz,deck,progress}.ts`
- Test: matching `__tests__/*.test.ts`, with fixtures under `packages/tala/src/direct/__tests__/fixtures/` copied from the PHP tests' raw Tala payloads

**Interfaces:**
- Consumes: `TalaClient` (Task 1).
- Produces: `course(raw)`, `materials(raw)`, `parseProgress(raw)`, `progressById(raw)`, `materialStats(raw)`; `parseQuiz(raw)`, `scoreQuiz(quiz, answers): { score; passed; ... }`; `parseDeck(raw)`, `applyRatings(deck, ratings)`; `writeSnapshot(client, cfg, ...)`, `syncItem(...)` (no-op returning `{written:false}` when `cfg.progressWrites` is false).
- Port sources: `TalaGateway.php`, `TalaQuiz.php`, `TalaDeck.php`, tests `TalaGatewayTest`, `TalaProgressTest`, `TalaQuizGatewayTest`, `TalaFlashcardGatewayTest`, `TalaStatsTest`, `TalaJoinCourseTest`.

- [ ] **Step 1: For each PHP test file, write the Jest equivalent** with the same raw fixture and expected output (one `it` per PHP test method, same name). Add: `scoreQuiz does not retain the answer key after scoring`, `writeSnapshot makes no request when progressWrites is off`, `assertMaterial rejects a material from another course`.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement the modules** as direct ports; same validation and error cases as PHP (`assertMaterial`, `assertQuiz`).
- [ ] **Step 4: Run; expect PASS.** If any PHP behaviour cannot be matched, record it in the spec's "Differences" list rather than silently diverging.
- [ ] **Step 5: Commit.**

### Task 3: Data source, offline store, UI copies and screens in the package

**Files:**
- Create: `packages/tala/src/data/{source,hooks}.ts`, `packages/tala/src/offline/*`, `packages/tala/src/ui/*`, `packages/tala/src/screens/*`, `packages/tala/src/host.ts` (provider)
- Modify: `mobile/eslint.config.js` (rule: files under `packages/` may not import `@/`, `mobile/`, or relative paths leaving `packages/`)
- Test: `packages/tala/src/screens/__tests__/*.test.tsx` (copies of `mobile/src/features/modules/__tests__/{courselist,flashcards,join,layout,offline,quiz,stats}.test.tsx`, retargeted at the package)

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: `interface TalaDataSource { courses(); course(assignId); material(assignId, materialId); quiz(assignId, quizId); submitQuiz(...); flashcards(...); submitRatings(...); submitProgress(...); joinCourse(code); stats() }` and `createDirectSource(host: TalaHost, session): TalaDataSource`; `useHost(): TalaHost`; hooks named as in `mobile/src/features/modules/tala/api.ts` so screen copies change only their imports.
- Scope: the offline store keys everything by `host.scope` plus `talaUserId:teamId`; `scopedKey(host, key)` replaces Sailix's `scopedKey`/`currentScope()`.

- [ ] **Step 1: Write failing tests**: copy the seven Sailix test files into the package and point them at package paths; add `offline files of two scopes never mix` and `signing out wipes offline data of that user`.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Copy** the Tala screens, viewers, offline store and the needed UI pieces (`AppText`, `Button`, `Card`, `Screen`, `EmptyState`, `FormError`, theme tokens read from `host.theme`) into the package; swap the data layer for `data/hooks.ts`; `TalaLinkForm` becomes the package's sign-in form. Leave the Sailix originals untouched.
- [ ] **Step 4: Implement `TalaRoot`**: sign-in gate, team picker (filtered to `host.config.teamId` when set; one team skips; none shows "No team"), tab navigator (My Courses, Stats, Join a course, then `extraTabs`), stack for course/flashcards/quiz/PDF/video, header avatar sheet with Switch team and Sign out; `onSignInAgain` returns to sign-in.
- [ ] **Step 5: Run** the package tests and `cd mobile && npm run validate`; expect PASS and 444 green.
- [ ] **Step 6: Commit.**

### Task 4: Sailix mounts the package behind `TALA_PACKAGE`

**Files:**
- Modify: `mobile/app.config.ts`, `mobile/src/features/modules/ModuleScreen.tsx` (flag on: render `<talaModule.Root host={...} />` for code `tala`; flag off: unchanged), `mobile/src/app/navigation/RootNavigator.tsx` only if the package needs the full screen height
- Test: `mobile/src/features/modules/__tests__/talaPackage.test.tsx`

**Interfaces:**
- Consumes: `talaModule`, `TalaHost` (Task 0).
- Produces: `buildTalaHost(me, navigation): TalaHost` in `mobile/src/features/modules/talaHost.ts` mapping scope = `org:{tenantId}:member:{membershipId}`, theme from `@/constants/theme`, config from `Constants.expoConfig.extra` (`TALA_API_BASE_URL`, `TALA_PROGRESS_WRITES`) plus the organization's `external_team_id` when `/me.modules` exposes it, `onExit = navigation.goBack`.

- [ ] **Step 1: Write failing tests**: `flag off renders the existing Tala module screen`, `flag on renders the package root`, `onExit goes back`, `scope differs per organization`.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement** the flag read and `buildTalaHost`.
- [ ] **Step 4: Run** `npm run validate`; expect green.
- [ ] **Step 5: Manual check** on Android, flag on and off, with a real Tala account; record results in the PROJECT-STATUS row.
- [ ] **Step 6: Commit.**

### Task 5: Standalone app shell (`apps/tala`)

**Files:**
- Create: `apps/tala/package.json`, `apps/tala/app.config.ts` (name "Tala", slug `tala`, scheme `tala`, bundle `com.btsolve.tala`), `apps/tala/eas.json` (profiles `development`, `staging`, `production`), `apps/tala/index.ts`, `apps/tala/src/App.tsx`
- Test: `apps/tala/src/__tests__/app.test.tsx`

**Interfaces:**
- Consumes: `talaModule.Root`, `TalaHost`.
- Produces: `App` building `host = { scope: '', theme, config from env, onExit: noop }` and passing `extraTabs=[]` (the new tab is added when the owner decides what it shows).

- [ ] **Step 1: Write failing tests**: `shows sign-in when there is no session`, `shows the course list after sign-in`, `sign out wipes tokens and offline data`, `config refuses a non-HTTPS address`.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement** the shell (query client, safe area provider, error boundary, `<talaModule.Root>`); reuse the Tala logo from `mobile/assets/brand` by copying it into `apps/tala/assets`.
- [ ] **Step 4: Run** the tests and `npx expo prebuild --no-install` dry check for the shell; expect PASS.
- [ ] **Step 5: Manual check** on the Android emulator against the real Tala server, progress writes off.
- [ ] **Step 6: Commit.**

## Out of this plan (gated)

- **The new tab** (spec step 5): needs the owner's decision on what it shows; it will be added through `extraTabs`.
- **Comparing and removing Sailix's Tala code** (spec step 6) and **release assets** (step 7): separate plans, after the owner has seen the package work.

## Self-review

- Spec coverage: sections 2 (package, host, workspace, UI copies, peers) -> Tasks 0, 3; 3 (direct source, port, differences, T0 facts) -> Tasks 1, 2; 4 (shell) -> Task 5; 5 (Sailix flag, nothing deleted, lint rule) -> Tasks 3, 4; 6 and 9 gated; 7 order matches.
- Names are consistent across tasks: `TalaHost`, `talaModule`, `TalaDataSource`, `createDirectSource`, `extraTabs`, `buildTalaHost`.
- Known gap by design: whether `/me.modules` exposes the organization's Tala team id is checked in Task 4; if not, the team filter is skipped and the owner is told.
