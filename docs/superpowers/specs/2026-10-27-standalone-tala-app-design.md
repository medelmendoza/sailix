# Tala as a package: standalone app and Sailix service

Status: design for review (revised 2026-10-28 for "option C"). No code has been written for it. It replaces the earlier
"one codebase, two builds" design.

## 1. What this is for

Sailix is the host app: sign-in, organizations, roles and modules. Tala (a learning service) is one module, reached through the
Sailix backend's gateway (`backend/app/Modules/Tala`) to the existing Tala server. The mobile app holds the Tala screens
(courses, flashcards, quizzes, PDF and video viewers, stats, offline store) in `mobile/src/features/modules/tala/`.

Goals:

1. A **separate Tala app**, published on its own, that has **one more tab** than Sailix's Tala.
2. **Tala written once**, as a package. The standalone app wraps it. Sailix mounts the same package when the user taps Tala in
   Services, so in the end Sailix has no Tala source of its own.
3. The same pattern for **Astra and Call-it**, which will be built the same way.

Sailix's current Tala code and the backend gateway **are not deleted** in this work. The owner wants to see the package working
first (section 6).

### Decisions already made (with the owner)

| Question | Decision |
|---|---|
| Who signs in, and against what | The standalone app has its own accounts and talks **directly to the Tala server**. The Sailix backend and Sailix accounts are not involved. |
| Its tab bar | **Only Tala**: My Courses, Stats, Join a course, plus the new tab. No Sailix sections. |
| The new tab | A new screen built from **data the Tala server already has**. What it shows is not decided (section 9). |
| Shape of the reuse | **Tala as a package** that both apps mount (option C). Sailix keeps its own Tala code for now. |
| Other services | Astra and Call-it follow the same package pattern later. |

### Not in scope

Register, forgot password and delete account for Tala users; Sailix features in the standalone app; push notifications; a
server of our own; a shared `@sailix/ui` package (extracted when the second service arrives); Astra and Call-it themselves.

## 2. The service package

Every service is a package with one standard shape:

```
serviceModule = { code, title, logo, Root }     // Root is <TalaRoot host={host} />
```

- **`Root`** is a self-contained mini app: its own navigation (tabs and stacks), its own sign-in, its own offline storage. It
  imports nothing from Sailix.
- **`host`** is a small object the mounting app passes in:

| Field | Meaning |
|---|---|
| `scope` | A string that namespaces the package's caches and offline files (Sailix: organization + member; standalone: empty, the package scopes by Tala user + team itself). |
| `theme` | Colours and fonts (the app's theme tokens). |
| `config` | Build settings: Tala address (`TALA_API_BASE_URL`, HTTPS only), `TALA_PROGRESS_WRITES`. |
| `onExit()` | Return to the host (Sailix: go back to Services; standalone: unused). |

- **Sailix** lists service descriptors in Services. Tapping Tala mounts `<TalaRoot>` as a screen; `onExit` goes back.
- **Standalone app** is a thin shell: it mounts `<TalaRoot>` and adds the new tab through a slot the root exposes
  (`extraTabs`). Astra and Call-it repeat this recipe.

### 2.1 Where the code lives

In this repo, as workspaces, so it can move to its own repository later without edits:

```
packages/tala/     the package (screens, direct data source, offline store, tests)
apps/tala/         the standalone shell (Expo app: app.config, sign-in gate wrapper, new tab)
mobile/            Sailix, unchanged apart from the flag in section 5
```

A root workspace config lists `mobile`, `packages/*` and `apps/*`. Web and backend are not touched. Whether Metro resolves a
workspace package and its native peers cleanly in this repo is **unverified**; the spike (section 7, step 0) proves it first.

### 2.2 The package's own pieces

The Tala screens use Sailix UI pieces (text, cards, buttons, theme). A package cannot import from Sailix, so `packages/tala`
carries its **own small copy of only the pieces it uses**, themed from `host.theme`. When Astra or Call-it needs the same, the
copies are extracted into one shared UI package. Until then, two copies of small components are accepted.

Native modules (secure storage, video, file system) are **peer dependencies**, installed once by the host app, so the package
never ships a second copy of a native module.

## 3. The direct-to-Tala data source

Inside the package, a `DirectTalaSource` does in TypeScript the jobs the PHP gateway does today, under
`packages/tala/src/direct/`:

1. **`client.ts`**: the calls to the Tala server, with the same endpoints, timeouts and no-retry rule for writes as
   `app/Modules/Tala/TalaClient.php`: `POST /api/v1/login`, `GET /api/v1/auth/users/{user}/teams`,
   `.../teams/{team}/courses`, `.../courses/{course}/sync/{assign}/data`, `.../teams/{team}/upgraded_cards/{id}`,
   `.../up_quizzes/{id}`, `.../videos|pdf/{id}`, `POST .../courses/sync`, `POST .../courses/apply`.
2. **`mapping.ts`**: Tala's raw data into the shapes the screens use (port of the gateway's `course`, `materials`,
   `parseProgress`, `progressById`, `materialStats`).
3. **`quiz.ts`, `deck.ts`**: parsing and scoring (port of `TalaQuiz`, `TalaDeck`). The device scores from the quiz document
   Tala sends, which includes the answer key; the key lives in memory during an attempt and is never saved.
4. **`progress.ts`**: progress written back as Tala's snapshot sync (port of `writeSnapshot`, `syncItem`), controlled by
   `config.TALA_PROGRESS_WRITES`. Writes are never retried.
5. **`auth.ts`**: the Tala session. Tokens in secure storage; a 401 triggers one refresh, then a "sign in again" signal. The
   signed-in user, their teams and the chosen team are remembered. The address is fixed at build time and must be HTTPS.

**Sailix uses this same direct source when it mounts the package**: a learner signs in to Tala inside Sailix with their own Tala
account. The Sailix gateway is not used by the package (it keeps serving today's Tala screens).

### How the port is checked

The eight PHP test files (`TalaGatewayTest`, `TalaProgressTest`, `TalaQuizGatewayTest`, `TalaFlashcardGatewayTest`,
`TalaJoinCourseTest`, `TalaStatsTest`, `CheckTalaEndpointTest`, `PlatformTalaSettingTest`) are the executable specification. The
relevant ones are ported to Jest with the same raw Tala fixtures and expected outputs.

### Differences from the gateway, accepted

- No per-member server checks, Sailix rate limits or address guard (one fixed HTTPS address); Tala's own limits apply.
- The quiz answer key reaches the device. This is how Tala itself delivers it (T0 verification,
  `docs/reference/tala-analysis/04-t0-verification-results.md`, item 10).
- The material-belongs-to-course checks (`assertMaterial`, `assertQuiz`) are kept.
- **Organization team check is lost in Sailix.** Today the gateway requires the Tala team to match the organization's
  `external_team_id` (`team_not_in_organization`). A package signing in directly cannot enforce that server-side. In the trial the
  package filters teams to the organization's team id passed in `host.config`; this is a client-side convenience, not a guarantee.
  The owner is told this before Sailix's own Tala is ever removed.

### Facts about the Tala server that shape this (T0 verification)

- Tala stores progress exactly as the client sends it and does not recompute (W3), so a client-computed score is accepted as sent.
- Tokens are long-lived and look non-revocable; a garbage bearer token answers HTTP 500; plain HTTP is accepted. The package
  enforces HTTPS and treats a 401 **or** a 500 on an authenticated call as "sign in again" after one refresh attempt.

## 4. The standalone app shell (`apps/tala/`)

- **Start-up**: sets up what Sailix's root sets up (query cache, safe areas, toasts, error boundary), then mounts `<TalaRoot>`.
- **Gate**: no Tala session means the package's sign-in screen. An account in more than one team gets a team picker; the choice
  is remembered.
- **Tabs**: My Courses (home), Stats, Join a course, and the new tab through `extraTabs`. No Account tab: a header avatar opens a
  small sheet with Switch team and Sign out. Sign-out wipes tokens and offline data.
- **Look**: the same theme tokens; the Tala logo from `assets/brand`. App icon and splash are design assets still to be supplied.
- **Build**: its own `app.config.ts` (name, slug, scheme, bundle id such as `com.btsolve.tala`) and `eas.json` profiles
  (`development`, `staging`, `production`) with its own EAS project, so it is a separate store record.

## 5. Sailix during the trial

- A build flag `TALA_PACKAGE=1` makes the Services screen mount `<TalaRoot>` from the package. With the flag off, Services opens
  today's Tala exactly as now. Both can be tried on the same device.
- **Nothing is deleted**: `mobile/src/features/modules/tala`, the `AppStack` Tala routes, the backend `app/Modules/Tala` gateway,
  `ModuleLink` and the link form all stay.
- Sailix passes `scope`, `theme`, `config` (including the organization's team id) and `onExit` into the package.
- A lint rule stops `packages/*` importing from `mobile/` or any Sailix path.

## 6. Proving it before removal

Sailix's own Tala code is removed only when **all** hold, and the owner says yes:

1. The package's ported Jest tests pass.
2. A manual run on the Android emulator and on iOS against the real Tala server, with progress writes off until their behaviour
   is confirmed.
3. The flag-on path in Sailix covers everything the flag-off path does (courses, flashcards, quizzes, PDF, video, stats, join,
   offline).
4. The owner accepts the lost server-side team check (section 3).

Removal is a separate piece of work with its own plan.

## 7. Order of work

Each step leaves Sailix working.

0. **Spike**: a package under `packages/` renders inside Sailix's Metro with the theme and `onExit` working; the root workspace
   config is in place. Throwaway if it fails; the answer decides how the rest is done.
1. **Package skeleton and `DirectTalaSource`** with its ported tests.
2. **Tala's screens into the package**: a copy, with Sailix's originals untouched.
3. **Sailix mounts the package** behind `TALA_PACKAGE`.
4. **Standalone shell** (`apps/tala`): sign-in gate, team picker, tabs, header sheet, sign-out wipe.
5. **The new tab** (needs the open decision below).
6. **Compare and decide** about removing Sailix's Tala code and the gateway (section 6).
7. **Release**: icon, splash, EAS profiles, store listing.

## 8. Risks

| Risk | Handling |
|---|---|
| A workspace package may not resolve in Metro, or duplicate native modules | Spike first (step 0); native modules are peer dependencies |
| Tala's sync semantics are unverified (`docs/13` section 20): a snapshot write could overwrite progress | Progress writes off by default, never retried, enabled only after a check against the real server |
| No gateway protections (rate limits, address guard, hidden answer key, organization team check) | One fixed HTTPS address; tokens in secure storage; key only in memory; team filter is client-side; owner informed (sections 3 and 6) |
| Two copies of small UI components (package and Sailix) | Accepted until the second service; then one shared UI package |
| Tala code exists twice in Sailix during the trial | Intentional and temporary; removal is gated (section 6) |
| An account in several Tala teams | Team picker and header switcher |
| A second app in the stores | Own bundle id and EAS project; store review is a separate task |

## 9. Still to decide (does not block steps 0 to 4)

- What the new tab shows and which existing Tala API call feeds it (needed before step 5).
- The app's name, icon, splash and bundle id (needed before step 7).
- Whether register, forgot password or delete account is needed in the first release.
- Whether the package will later live in its own repository (the workspace layout allows either).
