# Tala LMS (tala3 Flutter) - Identity and Session Analysis

Source: working tree of `/Users/btsolve/development/claude/tala3` (uncommitted changes present; HEAD differs). All paths below are relative to `tala3/lib/`. Read-only analysis. App title "Tala 3.0" (constants/app_constants.dart:7); the Version dialog says "Lodestar LMS v1.0.22" (tabs/settings/settings_item.dart:38).

## 1. Hosts / environments

| Name | Value | Where |
|---|---|---|
| liveUrl / finalUrl | `tala-v3-server.btsolve.com` | constants/api_url.dart:2-3 |
| devUrl | `tala-v3-admin-dev.ap-southeast-1.elasticbeanstalk.com` (declared, never used) | constants/api_url.dart:4-5 |
| localUrl | `192.168.3.76:5000` (declared, never used) | constants/api_url.dart:6 |

- Environment is NOT selectable: no flavor, build-time define or runtime switch. `grep` shows `devUrl`, `localUrl`, `finalUrl` are referenced nowhere outside api_url.dart. Every request uses `ApiUrl.liveUrl` (e.g. providers/auth.dart:117,149). Switching requires editing the constant.
- Transport is plain HTTP, not HTTPS: every call is `Uri.http(ApiUrl.liveUrl, ...)` (providers/auth.dart:117,149,180,205,232,262,315,346,422; also providers/course/courses.dart:50,78; stats.dart:60,497,860; epub/pdf/quizzes/flashcards/richmedia). The `Uri.https` versions are commented out directly above each (e.g. auth.dart:116,148). INFERRED: the live server may redirect HTTP to HTTPS, but a client following a redirect on POST would typically drop the body; unverified.
- Android: manifest declares only INTERNET (android/app/src/main/AndroidManifest.xml:2), no `usesCleartextTraffic` attribute found by grep. iOS Info.plist has no `NSAppTransportSecurity`/`NSAllows*` key (grep empty). INFERRED: with targetSdk >= 28 and default iOS ATS, plain-HTTP calls would be blocked unless server/platform config differs; so the working app implies either the build config permits cleartext elsewhere (not found) or the HTTP call is redirected. UNKNOWN - ask backend owner what scheme/port the live server accepts.
- Path strings: `ApiUrl.forgot` is `'api/v1/auth/users/forgot-password'` (no leading slash, constants/api_url.dart:9) but is unused; the real code builds the path from `getUser` (auth.dart:205). `register`, `login` constants are used (auth.dart:117,149). `getTeams2`, `applyCourse`, `getTeams` partly used (see section 3).

## 2. Auth mechanism (verified from code)

### Login request
- `POST http://tala-v3-server.btsolve.com/api/v1/login` (providers/auth.dart:149; path constants/api_url.dart:8).
- Headers: `Content-Type: application/json` only (auth.dart:152). No Authorization header on login. (Note: `AppConstants.base64Encode(user, pass)` exists at constants/app_constants.dart:16-23 for Basic auth but is NOT called anywhere in files reviewed; INFERRED legacy.)
- Body: `{"username": <string>, "password": <string>}` (auth.dart:153-156). The UI field is labelled "Username / Email / Contact no" (login/login_screen.dart:268) and sent as `username`; so the server apparently resolves username, email or phone (INFERRED from label only).
- Response on 200 consumed: `accessToken`, `refreshToken`, `userId` (auth.dart:159-162). `accessToken` is parked in `_tempAccessToken`, not yet the active token. Non-200 (401/400/other): throws `HttpException(responseData['message'])` (auth.dart:165-171). Error text containing the substring "activate" triggers a "Resend code" dialog (login_screen.dart:220-221).
- No expiry field is read (no `expiresIn`, no JWT decode).

### Post-login sequence (login_screen.dart:182-233)
1. `login()` -> temp token + userId.
2. `getUser()` -> `GET /api/v1/auth/users/{userId}` with `Authorization: Bearer <tempAccessToken>` (auth.dart:315-318); fills profile fields.
3. `getTeams()` -> `GET /api/v1/auth/users/{userId}/teams` with Bearer temp token (auth.dart:346-349); response is a JSON array of `{teamId, teamName}` (auth.dart:354-359).
   - If it returns 200 (even an empty list) -> "Select Team" dialog (login_screen.dart:204, 419-452). An empty list yields an empty dropdown (no apply dialog) - defect candidate.
   - If it throws `HttpException` (only thrown for status 400, auth.dart:381-383) -> "Join team" dialog asking for a team code (login_screen.dart:205-206, 454-481). Other statuses (401, 403, 404, 500) fall through silently as 200-equivalent only if body parses as a list; a non-list body throws a TypeError -> generic error dialog.
4. Selecting a team calls `savePrefs(teamId, teamName)` (auth.dart:392-417): sets `_accessToken = _tempAccessToken` (this is the moment the user is "authenticated"; `isAuth` is `accessToken != null`, auth.dart:28-31), writes SharedPreferences, `notifyListeners()`. main.dart's `Consumer<Auth>` then swaps `home` to `TabScreen` (main.dart:224-225).
- Consequence: a logged-in session cannot exist without a team selection; team is mandatory in the session.

### Storage
- `SharedPreferences` key `userData`, a single JSON string (auth.dart:396-415). Contents: accessToken, refreshToken, userId, lastName, firstName, middleName, fullName, userName, email, contactNo, birthDate, teamId, teamName, tags. Plaintext (no flutter_secure_storage/Keychain use in the reviewed files). On Android, SharedPreferences is an unencrypted XML file in app-private storage; on iOS, NSUserDefaults plist.
- The password is never stored. Token expiry is not stored.
- `attAsked` boolean pref (iOS tracking prompt) also in SharedPreferences (tabs/home/home_screen.dart:31,63).

### How later requests are authenticated
- Header `Authorization: Bearer <accessToken>` on all data calls (e.g. providers/course/courses.dart:56,83; providers/mystats/stats.dart:64,503,869; epub.dart:37,101; pdf.dart:37,106; quizzes.dart:55,173,303; flashcards.dart:43,156; richmedia.dart:40,116). No other custom headers (no API key, no team header). Team scope is carried in the URL path (`.../teams/{teamId}/...`), e.g. courses.dart:78-79; `ApiUrl.getTeams` + `{teamId}/epubs/{id}` (epub.dart:98).
- Providers are rebuilt with the token/userId/teamId from `Auth` via `ChangeNotifierProxyProvider` (main.dart:71-162). `refreshToken` is passed to Courses/RichMedia/FlashCards/Quizzes/QuizSectionData/Epub/Pdf and stored in a field but never used (grep: `_refreshToken` appears only in declarations/constructors and commented prints).
- Note: `changePassword` and `deleteUser` use `_accessToken`; `getUser/getTeams/applyTeam` use `_tempAccessToken` (auth.dart:237, 267, 318, 349, 425). After auto-login both are set to the same value (auth.dart:295-296).

### Refresh / expiry / 401
- No token refresh is implemented anywhere. No timer, no interceptor, no refresh endpoint call. The commented-out Firebase `_autoLogout` code (auth.dart:456-519) is dead.
- 401 handling: per-call only. Auth calls throw `HttpException(message)`. Data providers check `statusCode == 401` in few places (courses.dart:64 for applyCourse; stats.dart:520, 887) and merely throw with the server message; none logs the user out or retries. So an expired access token produces error screens ("Could not load your stats", home_screen.dart:106-109) until the user manually logs out. UNKNOWN: access token lifetime and whether the refresh token is usable via some endpoint.
- Auto-login (`tryAutoLogin`, auth.dart:288-312): if `userData` key exists, restores all fields including token and returns true; it does NOT validate the token with the server and does not re-fetch profile/teams. main.dart:224-233: if `auth.isAuth` -> TabScreen; else `FutureBuilder(tryAutoLogin())` showing `SplashScreen` ("Loading..." text only, splash/splash_screen.dart:6-10) while waiting, then `LoginScreen` (main.dart:232). Note `tryAutoLogin` calls `notifyListeners()` which flips isAuth and rebuilds home to TabScreen. Anti-pattern: `tryAutoLogin()` invoked inside `build` and re-run on each rebuild.

### Logout
- `Auth.logout()` (auth.dart:435-454): nulls all in-memory fields, `notifyListeners()`, then `prefs.clear()` (wipes ALL SharedPreferences, including `attAsked`). No server call (no token revocation). Local SQLite data is NOT cleared on logout (only on delete account; settings_item.dart:517, helpers/db_helpers.dart:1094-1102). Triggered from Settings "Log out" confirm (settings_item.dart:530-558), after change-password success (changepassword_screen.dart:125), and after delete account (settings_item.dart:395).

## 3. User model, teams and roles

### Fields parsed from `GET /api/v1/auth/users/{userId}` (auth.dart:320-333)
`lastName`, `firstName`, `middleName`, `userName`, `email`, `contactNo`, `birthDate`, `tags`. `fullName` is client-synthesised as `"<lastName>, <firstName> <middleName>"` (auth.dart:324-328) - throws if any is null (string + null) -> generic error dialog at login. Non-200 -> `HttpException(message)` (auth.dart:334-336; this error handling is new in working tree vs HEAD). `userId` comes from login response (auth.dart:162), not from this response. `suffix` is sent on registration but not read back.
- `tags` (String, may be null): stored on Auth (auth.dart:24,333) and passed to `Stats` (main.dart:159). Courses and PDFs also have a `tags` field (courses.dart:129,168; pdf.dart:73; course.dart:25). Semantics are not defined client-side (INFERRED: free-text/comma tags for content targeting; git log "added tags in user, course and materials", commit a5f16df). UNKNOWN.
- Profile screen shows only fullName, userName, birthDate, contactNo (tabs/settings/profile/profile_screen.dart:25,33,54-57,78-81); a button there shows "Coming soon!" (profile_screen.dart:99-105: edit not implemented).

### Teams
- A "team" is the tenant/organisation container. All course/material endpoints are scoped `.../users/{userId}/teams/{teamId}/...` (courses.dart:78-79) or `/api/v1/auth/users/teams/{teamId}/...` (epub.dart:98, `ApiUrl.getTeams`). `teamName` is shown as the AppBar title on every tab (tabs/tab_screen.dart:18-20).
- A user CAN belong to several teams: `getTeams()` returns an array; the user picks one at login (login_screen.dart:419-452) and can change it later via Settings > Teams > "Change Team" (settings_item.dart:28,110-111,159-212), which calls `getTeams()` again then `savePrefs(teamId, teamName)`. Changing team does not re-fetch the access token; the token is the same, only the URL scope changes. No server-side "current team" is set. After `savePrefs`, `notifyListeners` rebuilds providers with new teamId (main.dart:71-81).
- Joining a team: `POST /api/v1/auth/users/{userId}/teams/apply` body `{"teamCode": <string>}` with Bearer temp token (auth.dart:261-271). Success message: "Application is successful! Please contact admin for faster approval." (login_screen.dart:489-490; settings_item.dart:250-253). So a join creates a PENDING application that an admin approves (INFERRED from message). Teams the user is not yet approved in are presumably absent from `getTeams()` (INFERRED); a user with no approved teams hits status 400 -> "Join team" dialog (client assumes this; unverified).
- `ApiUrl.getTeams2 = /api/v1/auth/admin/teams/` is declared (api_url.dart:12) but never referenced in tala3/lib: there is NO admin path in the app. `getTeams` = `/api/v1/auth/users/teams/` (api_url.dart:11) is used as a prefix for materials (epub/pdf/quizzes/richmedia). `ApiUrl.applyCourse` is unused (courses.dart builds its own URL).
- Join course: `POST /api/v1/auth/users/{userId}/teams/{teamId}/courses/apply` body `{"courseCode": ...}` Bearer (courses.dart:50-60). Same "contact admin for faster approval" message (settings_item.dart:301-304). Promo code is stubbed ("Coming soon!", settings_item.dart:147; `_showPromoCodeDialog` commented body, 313-341).

### Roles / permissions
- No role, permission, `userType`, admin/trainer/learner concept exists in the client. The only user types that appear: the registration body carries `regType: 'mobile'` (auth.dart:114,132; registration_screen.dart:269) - a registration channel marker, not a role. The "admin" path constant (`getTeams2`) is unused. Every user of the app is a learner (INFERRED). Roles probably exist server-side (admin API at `/api/v1/auth/admin/...`) - UNKNOWN.

## 4. Registration

- Screen route `/registration` (registration/registration_screen.dart:11), opened from login ("SIGNUP INSTEAD" button, login_screen.dart:373-386).
- Endpoint: `POST http://tala-v3-server.btsolve.com/api/v1/auth/users/register` (auth.dart:117; api_url.dart:7). No Authorization header. Headers `Content-Type: application/json`.
- Body (auth.dart:121-133): `email, userName, password, lastName, firstName, middleName, suffix, contactNo (trimmed), birthDate, regType ("mobile")`. `gender` is commented out. Note birthDate is sent as `DateFormat.yMd()` locale string (e.g. `10/13/2026`, registration_screen.dart:208), not ISO; while profile/other code uses `yyyy-MM-dd` for dates elsewhere (app_constants.dart:52) - format inconsistency; birthday field has validator? (lines 523-528 not shown in grep; field is optional/readonly via date picker - INFERRED optional).
- Client validation: userName required (315-319); email must contain `@` (341-342); password length >= 5 (374-375); confirm must equal password (405-409); lastName, firstName, middleName, contactNo required (427-431, 449-453, 471-475, 506-510); suffix, birthday optional; captcha must equal local text (548-552). Bug: confirm-password field's `onSaved` overwrites `_authData['password']` with the confirm value (registration_screen.dart:411-413) - harmless only because they are equal.
- Captcha is purely client side: a random 6-char A-Z0-9 string generated on device and displayed on the same screen (registration_screen.dart:168-175,563-570); compared locally; never sent to the server (`_authData['captcha']` saved at 556 but not included in the request). Provides no bot protection. A separate demo `Captcha` route `/captcha` is registered in main.dart:259 (captcha.dart), not linked from the UI reviewed (also nests a second MaterialApp, captcha.dart:9).
- Response handling: 200 -> `notifyListeners`; 400 -> `HttpException(message)`; other statuses (e.g. 409, 500) are silently treated as success because no else branch (auth.dart:136-140) -> defect: UI shows "account successfully created" for any non-400 status. Success dialog: "Please check your email address to activate your account." (registration_screen.dart:271-272). So: email activation flow with activation code; resend via `POST /api/v1/auth/users/resend-activation-code` body `{email}` (auth.dart:180-186, offered when login error text contains "activate").
- Team/organisation is NOT chosen at sign-up. Team is joined after first login by team code (section 3). Approval: account activation by email, then team application needing admin approval (INFERRED from messages).

## 5. Forgot / change password

- Forgot: `POST /api/v1/auth/users/forgot-password` body `{"email": <value>}` (auth.dart:205-211). Note the UI field is "Username / Email / Contact no" (forgot_screen.dart:174-175) but the value is sent as `email`, so whether the server accepts username/phone is UNKNOWN. 200 -> dialog "Your new password has been sent to your email address." (forgot_screen.dart:141-142). This wording implies the server GENERATES a new password and emails it (likely plaintext) - INFERRED from client message only; confirm with backend owner. 401 mapped to "User not found!" (auth.dart:216-217), which is a user-enumeration signal. No authentication needed.
- Change password: `PUT /api/v1/auth/users/{userId}/change-password`, headers `Authorization: Bearer <accessToken>`, body `{"password": <old>, "newPassword": <new>}` (auth.dart:231-242). UI: Old Password, New Password (min 5 chars, changepassword_screen.dart:241-243), Confirm. Errors surface `message`. On success the app shows "Your password has been changed. You will be logged out." and calls `logout()` (changepassword_screen.dart:151-152, 123-125). The server does not seem to invalidate existing tokens (no evidence either way).

## 6. Delete account

Exists. Settings > "Delete Account" -> confirm dialog (settings_item.dart:475-509) -> `Auth.deleteUser()` -> `DELETE /api/v1/auth/users/{userId}` with `Authorization: Bearer <accessToken>`, no body (auth.dart:422-426). Only a 200 status is handled; any other status is silently ignored (no throw, no else; auth.dart:427-429) and the app still wipes local SQLite via `DBHelper.deleteAllData()` (settings_item.dart:517; db_helpers.dart:1094-1102), shows "Your account has been successfully deleted." and logs out (settings_item.dart:518-521,395). Defect: a failed server delete still reports success. UNKNOWN: whether the server hard-deletes or soft-deletes and what happens to team memberships/progress data.

## 7. Screens, navigation, settings, myforms, home

### Navigation structure
- Root `MaterialApp` with `home` conditional (main.dart:224-233) plus named routes (main.dart:234-260): `/registration`, `/forgot-password`, MyCourses detail online/offline, rich media/flashcard/quiz/new-quiz screens (courses and stats variants), MyStatsDetail, `/change-password`, Profile (route name via `ProfileScreen.routeName`), `/captcha`. Login route `/auth` is defined (login_screen.dart:16) but commented out of routes. No `onGenerateRoute`. `CustomRoute` (helpers/custom_route.dart:3-27) is a fade page route (unused by named routes; `CustomPageTransitionBuilder` is set in the theme, main.dart:213-218).
- `TabScreen` (tabs/tab_screen.dart): 4 bottom tabs (Home, Courses, Stats, Settings) managed by GetX `NavigationController` (tab_screen.dart:13,47-55); AppBar title = current `teamName` (tab_screen.dart:18-20; `as String` cast crashes if null). Uses `get` package for tab state and `provider` for everything else.
- State management: `provider` (`Auth` + proxy providers for Courses, RichMedia, FlashCards, Quizzes, QuizSectionData, Epub, Pdf, Stats) (main.dart:63-166).

### Home tab (tabs/home/home_screen.dart)
Two cards: "My Stats" (per-course progress bar = `totalMaterialSynced/totalMaterial`, lines 66-157; data from `Stats.fetchAndSetCourse()`, line 67) and "Due Dates" (per course `dateTo` formatted and days remaining, lines 175-214). On iOS requests App Tracking Transparency once (lines 22-64, pref `attAsked`). Stats provider endpoint belongs to another analysis area (stats.dart:60).

### Settings tab (tabs/settings/settings_screen.dart:5-16, settings_item.dart)
Items: Profile (route), Teams (Change Team / Apply Team), Course (Join Course / Promo Code[coming soon]), Change Password, Send Feedback ("Coming soon!"), Privacy Policy (opens external URL `https://www.btsolve.com/privacy/data-privacy-tala-3.html`, settings_item.dart:23-25,404-411), Version, Delete Account, Log out.

### "Forms" / myforms
- `providers/form/form.dart` defines a data model `Form` (formId, formName, formDescription, noItems, arraySection) -> `Section` (id, sectionTitle, description, pictureUploaded, recordingUploaded, sectionIndex, questions) -> `Question` (questionType, numQuestion, questionIndex, offeredQuestion, pictureUploaded, recordingUploaded, comment/picture/video checkboxes, mandatory, uploadPictureRequired, uploadRecordingRequired, commentRequired, tag, offeredAnswers) -> `OfferedAnswer` (i, offeredAnswer, answer) (form.dart:3-85). It is a survey/quiz-like structure with media/comment capture. It is imported only by `tabs/mycourses/detail/quiz/new_quiz_section_item.dart:4` (quiz area, covered by another analysis); no provider fetches `Form`s and no endpoint is attached.
- `tabs/myforms/myforms_screen.dart` and `myforms_item.dart` are a COPY of the My Courses list: they call `Courses.getMyCourses()` and render `Course` cards that open `MyCoursesDetailScreenOnline` (myforms_screen.dart:15-17,41; myforms_item.dart:15-18). It is NOT wired into `TabScreen` (tab_screen.dart has no MyForms reference; grep confirms no other usage). Dead/unfinished feature; there is no forms endpoint in the app. "Forms" as a user-facing feature does not exist in the shipped navigation.

## 8. HTTP endpoints touched in my files

Base `http://tala-v3-server.btsolve.com` (HTTP). All JSON. "Bearer" = `Authorization: Bearer <token>`.

| Method | Path | Auth header | Request | Response fields used | file:line |
|---|---|---|---|---|---|
| POST | /api/v1/login | none | `{username, password}` | `accessToken, refreshToken, userId`; error `message` | providers/auth.dart:149-171 |
| POST | /api/v1/auth/users/register | none | `{email, userName, password, lastName, firstName, middleName, suffix, contactNo, birthDate, regType}` | error `message` (400 only) | auth.dart:117-140 |
| POST | /api/v1/auth/users/resend-activation-code | none | `{email}` | `message` on error | auth.dart:179-200 |
| POST | /api/v1/auth/users/forgot-password | none | `{email}` | `message` on error | auth.dart:205-225 |
| PUT | /api/v1/auth/users/{userId}/change-password | Bearer access | `{password, newPassword}` | `message` on error | auth.dart:231-255 |
| GET | /api/v1/auth/users/{userId} | Bearer temp | none | `lastName, firstName, middleName, userName, email, contactNo, birthDate, tags`; `message` on error | auth.dart:315-337 |
| GET | /api/v1/auth/users/{userId}/teams | Bearer temp | none | array of `{teamId, teamName}`; 400 -> `message` | auth.dart:346-383 |
| POST | /api/v1/auth/users/{userId}/teams/apply | Bearer temp | `{teamCode}` | `message` on error | auth.dart:261-285 |
| DELETE | /api/v1/auth/users/{userId} | Bearer access | none | status 200 only | auth.dart:422-429 |
| POST | /api/v1/auth/users/{userId}/teams/{teamId}/courses/apply | Bearer access | `{courseCode}` | `message` on error | providers/course/courses.dart:50-68 |
| GET | /api/v1/auth/users/{userId}/teams/{teamId}/courses | Bearer access | none | list; consumed by MyForms too (other area) | courses.dart:78-83; tabs/myforms/myforms_screen.dart:16 |

Declared but unused: `/api/v1/auth/admin/teams/` (api_url.dart:12), `ApiUrl.applyCourse` (api_url.dart:13), `ApiUrl.forgot` (api_url.dart:9). Home stats endpoint is in providers/mystats/stats.dart:60-64 (`GET /api/v1/auth/users/{userId}/teams/{teamId}/courses`, same path pattern as courses.dart:78 INFERRED from the same constants).

## 9. Security observations

- Plain HTTP for all traffic including passwords, bearer tokens and refresh tokens (auth.dart:117,149; HTTPS variants commented out).
- Tokens (access and refresh) and PII (name, email, phone, birthdate) stored in plaintext SharedPreferences (auth.dart:396-415); no secure storage; no encryption.
- No token expiry handling, no refresh, no server-side logout/revocation; refresh token stored but unused.
- Registration captcha is client-generated and checked locally; offers no protection against automated sign-up (registration_screen.dart:168-175,548-552). Server must rate-limit.
- Forgot-password flow emails a "new password" (per UI text) - potential plaintext password delivery and account-takeover/DoS (anyone can trigger a password reset for an email); `401 -> "User not found!"` enables user enumeration (auth.dart:216-217, 191-192).
- IDOR surface: `userId` is in the URL path for profile, change-password, delete (auth.dart:232,315,422) and `teamId`/`userId` in all data URLs (courses.dart:78). The client trusts the server to verify the token's subject equals `{userId}` and membership in `{teamId}`. Also the client picks `teamId` locally from its own prefs; a tampered value would reach other teams' paths. Needs server-side verification (UNKNOWN whether done).
- Delete-account and change-password operate by userId path with Bearer; no re-authentication step for delete (confirm dialog only).
- Hard-coded values: server hostnames and a private LAN IP (`192.168.3.76:5000`) in api_url.dart:3-6; a Firebase Web API key string appears inside commented-out code at auth.dart:459 (existence and location only; value not reproduced; it is dead code but is in the repo and git history). No other credentials/keys found in the lib files I read (grep for BEGIN/apiKey/secret found none beyond this). Sample email in commented code (`// initialValue:` comments) at settings_item.dart:221,269,320,434 (personal-looking address; not reproduced).
- Local SQLite is not cleared on logout (only on account deletion) -> a second user on the same device may see prior user's offline content (settings_item.dart:530-558 vs 517) (INFERRED, depends on DB queries being user-scoped).
- `prefs.clear()` on logout wipes all prefs including `attAsked`.
- Global error handlers swallow exceptions into debugPrint (main.dart:45-55).

## 10. Defects, odd behaviours, UNKNOWNS

Defects/oddities
1. Registration treats every non-400 status as success (auth.dart:136-140); forgot/resend similar for non-handled codes are thrown but delete ignores failures (auth.dart:427-429).
2. `getTeams` only throws for 400; other statuses silently leave empty lists, and an empty-but-200 response shows an empty Select Team dropdown (login_screen.dart:203-204; auth.dart:381-383).
3. `getUser` crashes on null name parts when synthesising `fullName` (auth.dart:324-328); `TabScreen`/`ProfileScreen` cast nullable getters with `as String` (tab_screen.dart:20; profile_screen.dart:25,33) and would crash if null.
4. `tryAutoLogin()` is called inside `build()` repeatedly (main.dart:227) and never validates the token; the stored token may be stale.
5. Login screen contains dead signup mode (`AuthMode.signup`); "SIGNUP INSTEAD" actually navigates to the registration route (login_screen.dart:373-386).
6. `fullName` stored in prefs but only after `getUser`; team selection required before session exists, so abandoning the team dialog leaves the user at the login screen with a valid server session but no local session.
7. Forgot screen accepts username/email/phone but always sends key `email` (auth.dart:209-211).
8. Change team and apply team do not refresh teams on the server; `applyTeam` uses `_tempAccessToken`, which can be null after `logout`.
9. Dates: registration sends locale `yMd` birthdate (registration_screen.dart:208) but other code uses `yyyy-MM-dd` (app_constants.dart:52).
10. "Forms"/MyForms and promo code/feedback are unfinished stubs.
11. `devUrl`, `localUrl`, `getTeams2`, `applyCourse`, `forgot` constants unused (api_url.dart).

UNKNOWNS / questions for the backend owner
- Is the live API served over HTTPS (and does HTTP redirect)? Which scheme/port is canonical?
- Access token lifetime, refresh token endpoint and rotation policy; is the access token a JWT and what claims (sub, teamId, roles)?
- Does the server verify `{userId}` in paths against the token subject and `{teamId}` against membership?
- What does `/api/v1/login` accept in `username` (username, email, phone)? Response shape on error codes (400/401/403 for unactivated accounts)?
- What are `tags`, what `regType` values exist (mobile, web, admin?), and are there roles (admin/trainer/learner/`userType`) returned in the user object?
- Admin paths (`/api/v1/auth/admin/teams/`): what is their purpose and is the same login used for admins?
- Does forgot-password email a plaintext password? Does it accept username/phone?
- Team apply/approval workflow: who approves, status values, what `getTeams` returns for pending/rejected teams, and whether team codes are unique per team and guessable.
- Does delete-user soft/hard delete, and does it cascade to progress records and team membership?
- What happens to tokens after change-password/delete (revocation)?
- Is there any SSO/OIDC support or an account-linking field on the user record (e.g. external subject id)?

## Linking a Tala account to an external identity provider - what would be needed
Tala has only first-party username/password -> bearer token, no OIDC/SAML/SSO and no external-id field visible client-side. To link an external IdP (INFERRED requirements):
1. Backend: an endpoint to link/exchange an external identity (e.g. `POST /api/v1/login/sso` accepting an IdP id/ID token and returning the same `{accessToken, refreshToken, userId}`) or an admin/service endpoint to create/link Tala users by external subject id; a stored mapping external-sub -> Tala userId.
2. Client in the host app: after SSO, the host must still obtain a Tala bearer token and `userId`, then call `GET /users/{userId}/teams` and choose/auto-select a `teamId`, since every data call is scoped by userId+teamId in the path.
3. Team handling: either map the IdP tenant/organisation to a Tala `teamId` (auto-join without a team code/admin approval needs a backend change) or keep the code-based apply + approval flow.
4. Interim option without backend changes: store the user's Tala username/password (securely, e.g. Keychain/Keystore) in the host app and call `/api/v1/login`; weaker, and needs HTTPS confirmed first.
5. Require HTTPS and secure token storage in the RN rebuild; implement 401 -> refresh/re-login handling that the Flutter app lacks.
