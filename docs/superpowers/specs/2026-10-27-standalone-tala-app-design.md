# Standalone Tala app from the Sailix mobile code: design

Status: design for review (2026-10-27). No code has been written for it.

## 1. What this is for

Sailix is the host app: sign-in, organizations, roles and modules. Tala (a learning service) is one module in it, reached through
the Sailix backend's gateway (`backend/app/Modules/Tala`) to the existing Tala server. The mobile app already holds the Tala
screens (courses, flashcards, quizzes, PDF and video viewers, stats, offline store).

The goal is a **separate Tala app**, published on its own, that reuses the Sailix mobile code and differs by having **one more
tab**. Sailix keeps working exactly as it does now.

### Decisions already made (with the owner)

| Question | Decision |
|---|---|
| Who signs in, and against what | The standalone app has its own accounts and talks **directly to the Tala server**. The Sailix backend, organizations and Sailix accounts are not involved. |
| Its tab bar | **Only Tala**: its own tabs (My Courses, Stats, Join a course) plus the new tab. No Sailix sections. |
| The new tab | A new screen built from **data the Tala server already has**. What it shows is not decided yet (section 9). |
| Shape of the reuse | **One codebase, two builds** (a build variant) with a swappable Tala data source. Not a monorepo of packages, not a copy. |

### Not in scope for the first version

Register, forgot password and delete account for Tala users (they depend on what Tala's API offers); Sailix features of any kind
in the standalone app; push notifications; a server of our own.

## 2. Architecture

### 2.1 One build switch

`APP_VARIANT` is `sailix` (the default) or `tala`. `app.config.ts` reads it to set the app name, slug, scheme, icon and bundle ids
(for example `com.btsolve.tala`), and passes the variant and the Tala settings to the app through `expo-constants`. At start-up one
small root component chooses `SailixApp` (today's root) or `TalaApp`. Everything below the root is shared code. The standalone
app's own screens (tab bar, sign-in, team picker, the new tab) live in `mobile/src/variants/tala/`.

### 2.2 The seam: `TalaDataSource`

Today the Tala screens call the Sailix gateway through `mobile/src/features/modules/tala/api.ts` (`/modules/tala/*`). That file
becomes the only place that talks to a data source, through an interface:

```
TalaDataSource: courses, course(assignId), material(assignId, materialId), quiz + submitQuiz, flashcards + submitRatings,
                submitProgress, joinCourse(code), stats, plus the session calls (sign in, sign out, relink signal)
```

- `GatewayTalaSource`: today's code moved without any change in behaviour (Sailix registers this one).
- `DirectTalaSource`: new, talks to the Tala server itself (the standalone app registers this one).

### 2.3 Cutting the coupling to Sailix

The Tala code reads three things from Sailix that the standalone app does not have:

1. **Scope**: caches and offline files are keyed by organization + membership (`scopedKey`, `currentScope()`). This becomes a neutral
   scope: Sailix gives organization + member, the standalone app gives Tala user + team.
2. **Link form**: in Sailix "link your Tala account" attaches an account to a member. In the standalone app the same form
   (`TalaLinkForm`) is the sign-in itself.
3. **Relink prompt**: the "your link expired" handling calls Sailix's `/me` refresh (`useSessionStore().refreshMe`). It becomes a
   generic "sign in again" signal that each variant answers.

The Tala routes (course, quiz, flashcards, PDF, video, stats, join) are pulled out of Sailix's `AppStackParamList` into a small
`TalaRoutes` type that both navigators extend, and registered through one shared list of screens, so both apps get the same
screens with the same route names.

## 3. The direct-to-Tala data source

`DirectTalaSource` does in TypeScript the five jobs the PHP gateway does today, under
`mobile/src/features/modules/tala/direct/`:

1. **`client.ts`**: the calls to the Tala server, with the same endpoints, timeouts and no-retry rule for writes as
   `app/Modules/Tala/TalaClient.php`: `POST /api/v1/login`, `GET /api/v1/auth/users/{user}/teams`,
   `.../teams/{team}/courses`, `.../courses/{course}/sync/{assign}/data`, `.../teams/{team}/upgraded_cards/{id}`,
   `.../up_quizzes/{id}`, `.../videos|pdf/{id}`, `POST .../courses/sync`, `POST .../courses/apply`.
2. **`mapping.ts`**: Tala's raw data into the shapes the screens already use (port of the gateway's `course`, `materials`,
   `parseProgress`, `progressById`, `materialStats`).
3. **`quiz.ts`, `deck.ts`**: parsing and scoring (port of `TalaQuiz` and `TalaDeck`). In Sailix the server scores. In the
   standalone app the device scores from the quiz document Tala sends, which includes the answer key. The key is held in memory
   during an attempt and never saved.
4. **`progress.ts`**: progress written back as Tala's snapshot sync (port of `writeSnapshot` and `syncItem`). The build setting
   `TALA_PROGRESS_WRITES` plays the role of the backend's `SAILIX_TALA_PROGRESS_WRITES`. Writes are never retried.
5. **`auth.ts`**: the Tala session. Access and refresh tokens are kept in the phone's secure storage. A 401 triggers one refresh,
   then a "sign in again" signal. The signed-in user, their teams and the chosen team are remembered. The Tala address
   (`TALA_API_BASE_URL`) is fixed at build time and must be HTTPS; the user never types it.

### How the port is checked

The eight PHP test files (`TalaGatewayTest`, `TalaProgressTest`, `TalaQuizGatewayTest`, `TalaFlashcardGatewayTest`,
`TalaJoinCourseTest`, `TalaStatsTest`, `CheckTalaEndpointTest`, `PlatformTalaSettingTest`) are the executable specification. The
relevant ones are ported to Jest with the same raw Tala fixtures and the same expected outputs. The TypeScript must give identical
results.

### Differences from the gateway, accepted

- No per-member server checks, no Sailix rate limits and no address guard (the app calls one fixed HTTPS address). The app relies
  on the Tala server's own limits.
- The quiz answer key reaches the device. This is how Tala itself delivers it: the T0 verification (`docs/reference/tala-analysis/04-t0-verification-results.md`, item 10) found the `answer` field in the quiz payload sent to any client.
- The material-belongs-to-course checks (`assertMaterial`, `assertQuiz`) are kept.

### Facts about the Tala server that shape this (from the T0 verification)

- Tala **stores progress exactly as the client sends it** and does not recompute scores or statuses (W3). A client-computed score is therefore accepted as sent: the app is the only party holding the score logic.
- Tokens are long-lived and look non-revocable; a garbage bearer token answers HTTP 500; plain HTTP is accepted without redirect. The app therefore enforces HTTPS itself, and treats a 401 **or** a 500 on an authenticated call as "sign in again" after one refresh attempt.

## 4. The standalone app shell (`mobile/src/variants/tala/`)

- **Start-up**: `TalaApp` sets up what Sailix's root sets up (query cache, safe areas, toasts, error boundary).
- **Gate**: no Tala session means the sign-in screen (`TalaLinkForm` reused, copy adjusted). After sign-in, an account in more than
  one team sees a team picker; with one team it skips on. The choice is remembered.
- **Tabs**: My Courses (course list, the home tab), Stats, Join a course, and the new tab. No Account tab: an avatar button in the
  header opens a small sheet with Switch team and Sign out. Sign-out wipes the stored tokens and the offline data.
- **Stack screens**: the shared Tala screens (section 2.3).
- **Look**: the Sailix theme and components to begin with (they are already organization-themeable); a variant can set its own brand
  colours later. The Tala logo is already in `assets/brand`. A proper app icon and splash are design assets still to be supplied.
- **The new tab**: a screen plus one new `TalaDataSource` method reading Tala's existing API. Adding it touches nothing else.

## 5. Build, release and boundaries

- **Config**: `TALA_API_BASE_URL` (HTTPS) and `TALA_PROGRESS_WRITES` for the Tala build; it does not need Sailix's `API_BASE_URL`.
- **EAS**: new profiles `tala-development`, `tala-staging`, `tala-production` in `eas.json`, setting `APP_VARIANT=tala`, pointing at
  their own EAS project, so the Tala app is a separate store record.
- **Running**: `APP_VARIANT=tala npx expo start`. Without the variant you get Sailix as today.
- **Boundaries**: an ESLint `no-restricted-imports` rule stops the Tala code importing Sailix-only features (files, finance,
  announcements, to-dos, organizations, auth) and stops Sailix code importing `variants/tala`.
- **Bundle**: both variants' code is in each bundle at first. If it matters later, Metro can replace the other variant's folder with
  an empty module.

## 6. Testing

- Sailix's existing mobile tests (444) are the safety net for the seam and decoupling steps.
- New: the ported gateway tests (section 3), the variant config, the standalone navigation (sign-in gate, team picker, tabs,
  sign-out wipe), and the new tab.
- `npm test` covers both; a `test:tala` script runs only the standalone tests. CI also builds and type-checks the Tala variant.
- A run on the Android emulator against the real Tala server, with progress writes off until their behaviour is confirmed.

## 7. Order of work

Each step leaves Sailix working and tested.

0. **The seam**: `TalaDataSource`, the neutral scope, the `TalaRoutes` type, the relink signal; Sailix's behaviour unchanged.
1. **The direct source**: `DirectTalaSource` and its ported tests.
2. **The standalone shell**: variant config, sign-in, team picker, tabs, header sheet, sign-out wipe.
3. **The new tab.**
4. **Release**: Tala icon and splash, EAS profiles, store listing.

## 8. Risks

| Risk | Handling |
|---|---|
| Tala's sync semantics are unverified (`docs/13` section 20): a snapshot write could overwrite progress | Progress writes are off by default (`TALA_PROGRESS_WRITES`), never retried, enabled only after a check against the real server |
| No gateway protections (rate limits, address guard, hidden answer key) | One fixed HTTPS address; tokens in secure storage; the answer key only in memory; accepted by the owner |
| A change to a shared Tala screen now affects two apps | Both test sets run in CI; lint boundaries keep the shared code clean |
| An account in several Tala teams | A team picker and a header switcher (section 4) |
| A second app in the stores | Own bundle id and EAS project; store review is a separate task |

## 9. Still to decide (does not block steps 0 to 2)

- What the new tab shows and which existing Tala API call feeds it (needed before step 3).
- The app's name, icon, splash and bundle id (needed before step 4).
- Whether register, forgot password or delete account is needed in the first release.
