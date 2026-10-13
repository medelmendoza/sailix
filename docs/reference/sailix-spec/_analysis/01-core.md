# 01 - Core analysis of Flutter app `sailix` (package `sailix2`, app name "Sailix", pubspec version 1.0.30+30)

Scope: main.dart, constants, helpers, models, providers/auth.dart, login/forgot/registration/splash, tab_screen, account, changepassword, platform config, pubspec, assets, tests. Line refs are to `/Users/btsolve/development/claude/sailix/...`.

## 1. Routes and navigation

Single `MaterialApp` (lib/main.dart:263), Material 3, no `onGenerateRoute`, no named-route guards. `GetX` is only used for tab index state (not for routing). `CustomRoute` (helpers/custom_route.dart) is unused; `CustomPageTransitionBuilder` is used via `pageTransitionsTheme` for Android+iOS: **FadeTransition for every route except name '/'** (home shows with no transition).

**Home / guard (main.dart:313-322):** `auth.isAuth` (== `_userId != null`) ? `TabScreen` : `FutureBuilder(auth.tryAutoLogin())` -> waiting: `SplashScreen` (plain Scaffold with centered text "Loading..."), done: `LoginScreen`. Guard is only the home switch; named routes are not protected. Logout sets userId null -> Consumer<Auth> rebuilds -> home becomes the FutureBuilder -> LoginScreen (prefs were cleared). Note: because home is rebuilt and tryAutoLogin runs again on every Auth rebuild while unauthenticated, calling `notifyListeners` in tryAutoLogin on success flips to TabScreen.

| Route name | Screen (file under lib/) | Notes |
|---|---|---|
| (home) | TabScreen / LoginScreen / SplashScreen | see above |
| `/auth` (LoginScreen.routeName) | LoginScreen | NOT in routes table; never pushed by name (only used as home) |
| `/registration` | RegistrationScreen (registration/registration_screen.dart) | pushed from Login "SIGNUP INSTEAD" |
| `/forgot-password` | ForgotScreen (forgot/forgot_screen.dart) | registered but **no UI entry point** (Forgot link commented out in login_screen.dart:267-279) |
| TodolistScreen.routeName | tabs/todolist | other agents' area |
| AnnouncementsDetailsScreen | tabs/announcements/details | |
| PendingDetailsScreen | tabs/documents/pending_details | |
| LoansScreen | tabs/finance/loans | |
| PayslipScreen, RegularScreen, RegularDetailsScreen, SpecialScreen, SpecialDetailsScreen, FinalScreen, FinalDetailsScreen | tabs/finance/payslip/... | |
| ChangePasswordScreen | tabs/changepassword | from settings menu |
| ASTRA: MenuScreen, Pomodoro, BackgroundNoise, Focuswn, Rest, Sounds, RiskManagement, Rca, Whys, PmepeMain, Pmepe, Scaril, MilitaryEmails, ToAndCc, NextSteps, Raid, Bluf | tabs/services/astra/... | |
| CallIt: CallItDashboardScreen, CallItReportsScreen | tabs/services/callit/... | |

Exact route-name strings for non-core screens are defined in each screen's `routeName` (UNKNOWN here; other agents' scope). Services tab (`ServicesScreen`) and Account tab (`AccountScreen`) and TasksScreen exist but are commented out of navigation.

**Tab structure (tab_screen.dart):** `DefaultTabController(length:4)` (unused controller) + Scaffold; body switched by GetX `NavigationController.selectedIndex` (Obx) among `[DashboardScreen, DocumentsScreen, AnnouncementsScreen, FinanceScreen2]` (lines 309-320); Material 3 `NavigationBar` height 60 with 4 destinations: Dashboard (Icons.dashboard), Files (folder), Announcement (announcement), Finance (monetization_on). Screens are held in a controller list => instances persist (state preserved across tab switches since the same widget instances; but not IndexedStack). `Get.put(NavigationController())` in build; controller is not deleted on logout so the selected tab index persists to the next login.
AppBar: title = logo image `sailix_main_icon.png` 100x100; actions = settings PopupMenuButton with 4 items:
1. Change Password -> push ChangePasswordScreen
2. Delete Account -> confirmation dialog (see 3.7)
3. Privacy Policy -> `launchUrl('https://www.btsolve.com/privacy/data-privacy-sailix.html', externalApplication)`; throws Exception if cannot launch (unhandled)
4. Log out -> confirm dialog ("Log out" / "Are you sure you want to log out?" / No, Yes) -> pop then `Auth.logout()`.
No drawer. No back-button interception.

## 2. Auth (lib/providers/auth.dart)

URL composition: `Uri.https(ApiUrl.liveUrl, path)`, host `sailix.btsolve.com`, always HTTPS, no port. `ApiUrl.env = 'dev'` is hard-wired, so paths are `/sfai-sailix-api-dev/public/api/...` against the "live" host. (`localUrl = 192.168.3.76:5000` defined, unused.) Let `P = /sfai-sailix-api-dev/public/api`.

| Action | Method + URL | Headers | Body | Response handling |
|---|---|---|---|---|
| Register (auth.dart:108) | POST `https://sailix.btsolve.com{P}/user/registration/app` | Content-Type: application/json | `{userType:"ROLE_USER", email_address, username, password, last_name, first_name, middle_name, suffix_name, mobile_number (trimmed), dateof_birth ("yyyy-MM-dd" or ""), client_code:"SFAI"}` (regType/gender commented out) | 200 -> ok; 400 -> HttpException(body.message). **Any other status (401/409/500) is silently treated as success** (UI then shows success dialog). |
| Login (:153) | POST `{P}/login` | Content-Type json | `{username, password}` | 200: `userID` -> `_tempUserId`, `token` -> `_accessToken` (memory only). 401 -> HttpException(body['error']); 400 and others -> HttpException(body['message']). Non-JSON body -> FormatException -> generic error message. |
| Get user (:185) | GET `{P}/user/{userID}` | **none (no Authorization)** | - | fields: `crewID`, `last_name`, `first_name`, `middle_name` (nullable), `username`, `email_address`, `mobile_number`, `dateof_birth`, `client_code`. Status code not checked. fullName = "Last, First Middle". Then `savePrefs()` (which sets `_userId = _tempUserId`, persists, notifies -> triggers navigation to TabScreen). |
| Forgot password (:216) | POST `{P}/user/forgot-password` (built from `ApiUrl.getUser + 'forgot-password'`; `ApiUrl.forgot` const is unused/legacy) | Content-Type json | `{username, email}` | 200 ok; 401 -> "User not found!"; 400/other -> body.message |
| Change password (:242) | PUT `{P}/user/{userId}/change/password` | Content-Type json, `Authorization: Bearer {_accessToken}` | `{old_password, new_password}` | 200 ok; 401/400/other -> body.message. This is the ONLY authenticated call in the core area. |
| Delete account (:317) | **No API call.** `deleteUser()` only calls notifyListeners. | | | UI nevertheless tells the user a deletion request was received (misleading; see section 9). |

Token handling:
- `_accessToken` (login `token`) held **in memory only**; never written to SharedPreferences. `_refreshToken` is declared and exposed but **never assigned anywhere**; there is **no refresh-token logic**. Login response has no refresh token in the code.
- After app restart `tryAutoLogin()` (:295) restores only profile data from prefs key `userData`; `accessToken` is null afterwards. Since all other API calls (as far as grep shows: no `Authorization` header anywhere except `Auth.change`) don't send tokens, data fetches work without a token; but `change password` after auto-login sends `Bearer null`, which will presumably fail (UNKNOWN server behavior).
- Auto-login = "userData exists in prefs" -> authenticated. No expiry check, no server validation, no token validation. Session never expires client-side; no 401 handling or global interceptor exists.
- `teamId` / `teamName` / `tags` getters exist but are never assigned (always null).
- How other providers receive tokens: `ChangeNotifierProxyProvider<Auth, X>` in main.dart (lines 79-260) recreates a new provider instance on every Auth notification, passing positional `(accessToken, refreshToken, userId, userName, crewId, teamId, ...)` plus the previous list of data (e.g. `previousX.items`) to preserve cached lists. Providers: Dashboards, Todolists, Documents, Pendings, Announcements, Loans, Regulars, RegularDetails, Specials, SpecialDetails, Finals, FinalDetails, Tasks. (Todolists/Tasks omit crewId.) Loans gets two extra '' args. Providers received tokens but, per grep of `Authorization|Bearer`, do not use them; they identify the user via `userId`/`crewId` in the URL path. => **Server APIs appear unauthenticated apart from path IDs** (IDOR risk; confirm with backend owner).
- Logout (:321): nulls profile vars (not `_accessToken`/`_tempUserId`), `notifyListeners()`, then `SharedPreferences.clear()` (wipes ALL keys including `attAsked`). No server call.
- Registration/login screens call `Provider.of<Auth>(listen:false)`.

## 3. Screens

### 3.1 Splash (splash/splash_screen.dart)
Plain `Scaffold`, centered `Text('Loading...')`. No logo. Shown only while `tryAutoLogin` future is pending. (Native launch screen: ios `LaunchScreen` storyboard; Android `LaunchTheme`.)

### 3.2 Login (login/login_screen.dart)
- Layout: full-screen navy gradient (both stops same color `0xFF002352`-derived), logo `assets/images/sailix_main_icon.png` (padding 16/94), then Card (rounded 10, elevation 8, width 75% of screen, height 320 fixed with scroll).
- Fields: **Username** (plain text, no autocapitalize config, no keyboardType) and **Password** (obscured, eye toggle). Validation: both required -> "Please fill out required fields." No trimming, no min length.
- Button: "LOGIN" (ElevatedButton, rounded 30); shows CircularProgressIndicator while loading. Below: TextButton "SIGNUP INSTEAD" -> pushNamed `/registration`. (AuthMode.signup, hidden Confirm Password and `_passwordController` are dead code; the animated confirm field is height 0.)
- NO "Forgot password" link (commented out), no social login (commented out, assets facebook.png/google2.png remain), no remember-me.
- Flow: `login()` then `getUser()`; success -> Auth notifies in savePrefs -> home switches to TabScreen (no explicit navigation). Errors: `HttpException` -> AlertDialog title "An error occured" (sic) with server message and "Okay"; any other exception -> `AppConstants.errorMessage` = "We're sorry, something went wrong on our end. Please contact our support team or update your app to continue using all features."
- Edge cases: login success but getUser failure -> error dialog but `_accessToken` set and `_userId` null so user stays on login. `getUser` network/parse failure is generic. setState after await without `mounted` check (crash risk if the widget is gone, e.g. after successful login the card is disposed and `setState(_isLoading=false)` runs on a disposed State -> Flutter error/warning).
- ATT: `requestTrackingAuthorization()` in login_screen.dart is dead code (calls commented out). Actual ATT prompt is in Dashboard (see section 7).

### 3.3 Registration (registration/registration_screen.dart)
Card width 85%, height 80% of screen, scrollable. Fields (label, required?, validation):
| Field | Required | Validation / msg |
|---|---|---|
| Username | * | non-empty -> "Please fill out required fields." (keyboard type email; no format rule) |
| Email | * | non-empty and contains '@' else "Invalid email!" |
| Password | * | length >= 5 else "Password is too short!" ; eye toggle |
| Confirm Password | * | equals password else "Passwords do not match!" ; eye toggle |
| Last Name | * | non-empty |
| First Name | * | non-empty |
| Middle Name | * (marked required, validated required) | non-empty (people without middle names blocked) |
| Suffix Name | optional | - |
| Contact no. | * | non-empty only; numeric keyboard; no length/format check |
| Birthday | not validated (optional, label has no asterisk) | tap opens date picker 1950-01-01..today, initial today, stored "yyyy-MM-dd"; field editable via controller but onTap picker |
| Captcha | * | client-side random 6-char [A-Z0-9] code displayed in a grey box; must equal typed value, exact (case-sensitive) else "Captcha do not match!". Generated once in initState; never refreshes. `_verifyCaptcha` snackbar function is unused. Purely cosmetic/no security. |
Gender dropdown helpers (['Male','Female']) exist but no gender field rendered. Submit "SIGN UP" -> `Auth.registration` (see 2). Success dialog "Success": "Congratulations, your account has been successfully created. Please contact admin to activate your account." -> Okay pops dialog AND the screen (back to login). Error: dialog "An error occured" with server message (400) or generic message. Buttons: "GO BACK".
`registration_screen2.dart`: unused 3-page wizard stub (RegistrationScreen2, routeName '/registration' duplicate); `_submit` only debugPrints. Ignore for rebuild (or treat as an abandoned redesign: pages "Personal Info", "Login Credentials", "Additional Info").
Server-side message on duplicate username/email: UNKNOWN (returned in `message` on 400).

### 3.4 Forgot password (forgot/forgot_screen.dart)
Card 85% width x 30% height. Fields: Username, Email (both required, only non-empty check; no email format check). "SUBMIT" -> `Auth.forgot`. Success dialog "Success": "Your new password has been sent to your email address." (Okay only closes dialog, stays on screen). Error: title "An error occured"; message from server; 401 -> "User not found!"; other exception -> "Could not authenticate you. Please try again later." "GO BACK" pops. Unreachable from UI currently. Backend sends a new password by email (design smell: plaintext password in email).

### 3.5 Change Password (tabs/changepassword/changepassword_screen.dart)
Card 85% x 40% height. Fields: Old Password (required), New Password (>=5 chars else "Password is too short!"), Confirm Password (must match). Each with eye toggle. Submit -> `Auth.change(old,new)`. Success dialog (non-dismissible) "Your password has been changed. You will be logged out." -> Okay pops dialog, pops screen, then `logout()`. Error: "An error occured" + server message, else generic `AppConstants.errorMessage`. New password may equal old (no check). "GO BACK" pops.

### 3.6 Account tab (tabs/account/*) - **dead code**
`AccountScreen` ListView of items [Profile, Change Password, Send Feedback, Privacy Policy, Version, Log out] with icons (person, password, feedback, lock_outline, info, logout). `AccountItem` handles only 'LOG OUT' (same logout confirm dialog); all other taps are empty. Privacy URL there is `http://tala-admin.btsolve.com/privacy.html` (legacy "Tala" app; unused). Not in navigation.

### 3.7 Delete Account (tab_screen.dart:155-246)
Confirm dialog "Delete account": "Deleting your account will delete your access and all your information on this app. Are you sure you want to proceed?" (No / Yes). Yes -> shows progress dialog "Deleting account / Please wait..." -> `Auth.deleteUser()` (no-op) -> after 2s Timer shows non-dismissible dialog "Success": "We've received your account deletion request and are currently processing it. In the meantime, you can continue to use your account as usual. We'll notify you once the deletion is complete." Okay -> pop. **No request is sent to any server; user is NOT logged out.** Dialog stack handling (`Navigator.pop` in helper functions) is fragile. Required for App Store (account deletion) -> rebuild needs a real endpoint or a mailto/web-form decision (UNKNOWN backend endpoint).

## 4. Constants

lib/constants/api_url.dart (host, env, API paths; paths are relative suffixes, some with leading slash, some without; `Uri.https` tolerates both):
| Const | Value |
|---|---|
| liveUrl | `sailix.btsolve.com` |
| localUrl | `192.168.3.76:5000` (unused; LAN dev IP) |
| env | `'dev'` (hard-coded; interpolated into every path as `sfai-sailix-api-$env`) |
| register | `/sfai-sailix-api-dev/public/api/user/registration/app` |
| login | `/sfai-sailix-api-dev/public/api/login` |
| forgot | `api/v1/auth/users/forgot-password` (unused legacy) |
| getUser | `/…/api/user/` |
| getToDoLists | `…/api/user/todolist/` |
| patchToDoLists | `…/api/user/` |
| getDocuments | `…/api/listCrewDocument/` |
| getPlDocuments | `/…/api/pldocument` |
| getPendings | `…/api/user/` |
| getDashboards | `…/api/user/dashboard/` |
| getAnnouncements | `…/api/announcement/user/` |
| updateAnnouncements | `…/api/user/` |
| getLoans, getPaySlips | `…/api/user/` |
Inconsistency: lib/providers/documents/documents.dart:104,146 hard-code `https://${ApiUrl.liveUrl}/sfai-sailix-api/public/api/...` (no `-dev` suffix) for document upload and pending-document calls, i.e. different backend instance than the rest. (Other agents should confirm.)
Other hard-coded URLs: privacy `https://www.btsolve.com/privacy/data-privacy-sailix.html` (tab_screen.dart:22); finance_screen2.dart:192 Google Drive download link (`drive.usercontent.google.com/download?id=...`); legacy `http://tala-admin.btsolve.com/privacy.html` (account_item.dart:19, dead).

lib/constants/app_constants.dart: appName `'Tala 3.0'` (legacy name; used as MaterialApp title, but native label is "Sailix"); `myCourses`, `myStats` (legacy, unused); `fillOutRequired` = "Please fill out required fields."; `errorMessage` (see 3.2); `colorPrimary` 0xFF002352; `colorAccent` 0xFF2364AA; helpers `base64Encode(user,pass)` (Basic-auth builder, unused), `createMaterialColor`, `daysBetween(from,to)`, `getFormatedDate('yyyy-MM-dd' -> 'MMMM dd, yyyy')` (throws on bad input), `kColorSchemeAstra` (seed 0xFF002352, onPrimaryContainer 0xFF192D3B, primaryContainer 0xFF1F232F).
**No secrets/tokens/passwords/API keys found** in constants, auth.dart, or platform files (no Firebase/Google-services keys either). Commented-out `initialValue` test credentials exist in login/forgot screens but contain only an email (`ggatdula@btsolve.com`, in login_screen.dart:229 comment) and 'test' / 'A1111111' placeholders - a minor PII/credential-hint leak in source. Release signing: android/app/build.gradle:37 uses `signingConfigs.debug` for release (no release keystore configured).

## 5. Models
There is **no models directory beyond `models/http_exception.dart`**: `HttpException(String message)` implements Exception, `toString()` returns message. All other data classes live in each provider file (other agents' area). In the core area the "model" is the Auth user state: userId (String), crewId, teamId (never set), teamName (never set), lastName, firstName, middleName, fullName, userName, email, contactNo, birthDate (string 'yyyy-MM-dd'), tags (never set), clientCode - all `String?`; accessToken, refreshToken (never set), tempUserId, tempAccessToken (unused).

## 6. Local storage (SharedPreferences, plaintext)
| Key | Type | Written | Read | Deleted | Sensitivity |
|---|---|---|---|---|---|
| `userData` | JSON string `{userId, crewId, lastName, firstName, middleName, fullName, userName, email, contactNo, birthDate, clientCode}` | `Auth.savePrefs` after successful login+getUser | `Auth.tryAutoLogin` at app start | `Auth.logout` via `prefs.clear()` | PII (name, email, phone, DOB). Unencrypted. No token inside. |
| `attAsked` | bool | dashboard.dart:76 after ATT prompt flow (iOS only) | dashboard.dart:45 | wiped by `prefs.clear()` on logout (so prompt shown again after next login) | low |
No secure storage package (flutter_secure_storage) used. Other files writing prefs: none beyond these (grep). Documents are saved to app documents/external dirs via path_provider (see other agents).

## 7. Native capabilities and dependencies

Android (AndroidManifest.xml): permissions INTERNET, CAMERA (document scanning), READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE (file/photo picking). applicationId `com.btsolve.sailix2`; label "Sailix"; icon `@mipmap/launcher_icon`; launchMode singleTop; no deep links/intent filters other than LAUNCHER; no cleartext flag; minSdk/targetSdk = Flutter defaults; `queries` for PROCESS_TEXT only (note: url_launcher https works without queries; no `<queries>` for VIEW intent needed for externalApplication launch, mostly fine). No WAKE_LOCK explicitly (wakelock_plus adds its own). No notification/push permission. No storage-manage permission.
iOS (Info.plist): bundle id `com.btsolve.sailix2`, deployment target 15.5/15.6, display name "Sailix". Keys: `NSUserTrackingUsageDescription` (ATT), `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription` ("scan documents"), `NSPhotoLibraryAddUsageDescription`, `LSSupportsOpeningDocumentsInPlace`=true, `CADisableMinimumFrameDurationOnPhone`=true. Orientations: iPhone portrait + both landscapes; iPad all four (no code locks orientation - UNKNOWN whether any screen forces it; grep did not look for SystemChrome in detail). No URL schemes, no associated domains, no background modes, no ATS exceptions. AppDelegate.swift is the stock Flutter template (no Firebase, no push, no custom native code). The ATT description text says "personalized ads" although no ad SDK exists in pubspec (App Store review risk / unnecessary prompt).
ATT flow (dashboard.dart:35-77, iOS only): on Dashboard init, if `attAsked` not set and status notDetermined -> explainer dialog "Help Us Improve" / "We'd like to show you relevant content and offers. To do this, we need permission to track your activity." (buttons "No, thanks" / "Continue" both just close) -> system ATT prompt -> set `attAsked=true`.

pubspec dependencies and actual use (grep of `package:` imports in lib):
| Package | Used in | Purpose |
|---|---|---|
| provider | main.dart + all screens | state mgmt (Auth + feature providers) |
| get | tab_screen.dart, dashboard.dart | only `Get.put`/`Obx` for tab index (and something in dashboard - other agent) |
| intl | many item/screens | date formatting (yyyy-MM-dd, MMMM dd, yyyy etc.) |
| http | auth + all providers, documents_screen | REST calls |
| dio | **nowhere** | unused |
| shared_preferences | auth, login, dashboard | session data + ATT flag |
| app_tracking_transparency | login (dead code), dashboard | iOS ATT prompt |
| shimmer | many list screens | loading skeletons |
| easy_pdf_viewer | announcements details, documents_item, pending_details | view PDFs from URL |
| flutter_pdfview | astra scaril/pmepe/bluf | view bundled asset PDFs |
| cached_network_image | announcements details, finance_screen2, pending_details | image caching |
| wakelock_plus | astra pomodoro, sounds | keep screen on during focus timers |
| audioplayers | astra sounds | background noise mp3 playback |
| file_picker | documents_screen, documents_item, pendings_item, callit reports | upload file selection |
| dropdown_search | documents_screen/_item, pendings_item | searchable dropdown (document type) |
| path | documents_screen, pendings_item | filename handling |
| path_provider | documents, pendings, astra pdfs, scanner, todolists | temp/documents directories |
| url_launcher | tab_screen.dart only | open privacy policy in external browser |
| tutorial_coach_mark | tab_screen (import), dashboard | onboarding tutorial overlay (call site commented out: `_showTutorial` postFrameCallback commented) -> effectively unused |
| google_mlkit_document_scanner | documents_screen, scanner2 | document scanning (camera) |
| flutter_doc_scanner | providers/scanner/scanner.dart | alternate scanner + `pdf` package to build PDFs |
| pdf | scanner.dart | build PDF from scanned images |
| open_filex | documents_screen, scanner, scanner2 | open saved file in external viewer |
| cupertino_icons | - | iOS icons (default) |
Dev: flutter_lints. Tests: `test/widget_test.dart` is the **default Flutter counter template test** that cannot pass (the app has no counter) - zero real tests.

## 8. Theme, assets, shared helpers

- Theme (main.dart:60-307): Material 3, `ColorScheme.fromSeed(seed rgb(0,35,82)=#002352)`; default font family **Poppins**; AppBar background = `onPrimaryContainer` (a dark derived tone), foreground = `primaryContainer`; Card color white; ElevatedButton background = `onPrimaryContainer`; FAB bg = `primary`, fg white, elevation 4; page transitions fade. Light theme only (no dark theme). Derived exact hex of fromSeed tonal values UNKNOWN (compute in RN via Material tonal palette or sample from running app). Brand: primary #002352, accent #2364AA. ASTRA module uses `kColorSchemeAstra` (onPrimaryContainer #192D3B, primaryContainer #1F232F).
- Auth-screen look: navy gradient background, white rounded card, pill-shaped (radius 30) ElevatedButtons, `TextButton` links in `colorScheme.primary`.
- Fonts bundled: Poppins (Regular 400/SemiBold 600/Bold 700) default; Montserrat (Regular/SemiBold/Bold .otf), Raleway (Regular/Bold/Black); `fontFamily: 'Montserrat'` used once elsewhere (grep). Raleway usage not found in lib (UNKNOWN/unused).
- Assets (assets/): images: sailix_main_icon.png (logo, used in login & appbar), sailix_icon.png, sailix_icon2.png (not in pubspec), tala_icon.png, astra_icon.png, srt_icon.png, callit_icon.png, sfai_logo.png, loan.png, payslip.png, govt.png, regular.png, special.png, final.png, course-placeholder.png, facebook.png, google2.png; images/astra/{insects,water,brown,rain}.jpg, monkey.png, whys.png; sounds/astra/{brown-noise,rain,water,insects}-5.mp3; pdfs/astra/{bluf,scaril,pmepe}.pdf; fonts listed above. Listed-in-pubspec vs files: sailix_icon*.png and tala/srt icons present but only some are declared.
- Shared helpers: `AppConstants` utilities, `HttpException`, `CustomPageTransitionBuilder`. Common UI patterns copy-pasted per screen: gradient-card shell, AlertDialog helpers `_showDialog(title,message)`, shimmer skeletons.

## 9. Bugs, security issues, hard-coded values, UX

Security
1. `ApiUrl.env='dev'` shipped to production host: app talks to `/sfai-sailix-api-dev/` on `sailix.btsolve.com`; no env switching mechanism (single const, `localUrl` unused). Documents upload uses non-`dev` path -> mixed backends.
2. **No bearer token sent on any data request** (only change-password). Access token is not persisted and refresh token never exists. APIs appear to authorize by path IDs (userId/crewId) -> IDOR / unauthenticated data access. Confirm and fix on RN side by using a token interceptor if backend supports it (UNKNOWN).
3. Session = presence of plaintext `userData` in SharedPreferences; no expiry, no server validation, no 401 handling; token lost on restart so change-password after cold start sends `Bearer null`.
4. PII stored unencrypted in SharedPreferences; RN rebuild should use Keychain/Keystore (react-native-keychain / expo-secure-store) for tokens and minimize PII.
5. Registration treats non-200/400 responses as success; captcha is client-side only (no bot protection); forgot-password emails a new plaintext password; weak password policy (>=5 chars).
6. Release build signed with debug key (android/app/build.gradle:37).
7. Test email and placeholder credentials left in comments (login_screen.dart:229, forgot_screen.dart:175).
8. `READ_EXTERNAL_STORAGE`/`READ_MEDIA_IMAGES` declared broadly; ATT usage text claims advertising though no ad SDK.
Bugs/UX
- Delete Account is fake (no API call, no logout) but tells the user a request was received.
- Forgot Password unreachable (link commented out); Login screen has dead signup-toggle code.
- `setState` after await without `mounted` in login (card disposed after successful login).
- `AppConstants.appName` 'Tala 3.0' mismatch with brand "Sailix"; legacy Tala artifacts (privacy URL, My Courses strings).
- Typo "An error occured". Middle name mandatory. Birthday optional but sends '' -> backend might reject (UNKNOWN). Contact no. only non-empty; numeric keyboard can't enter '+' country code.
- Login username field lacks `autocorrect:false`/no-capitalize; no keyboard "next/done" actions; no loading-guard against double submit besides button swap.
- Logout does not clear `NavigationController` tab index or provider in-memory data (providers get recreated with previous lists via proxy update => stale data from previous user may be shown to the next user until refetched: `previousX.list` is carried over even when `auth` changes user). Real data-leak risk between accounts.
- Auth state notifies on every change, which rebuilds ALL 13 proxy providers (new instance each time) - inefficient and discards in-flight state.
- Account tab and Services/Tasks tabs commented out (dead code); `backup.dart` in dashboard; `registration_screen2.dart`; `custom_route.dart: CustomRoute` unused.
- Deprecated APIs: `Color.red/green/blue/value` in createMaterialColor (Flutter 3.27+ deprecations), `TextButton` etc fine; widget test broken; `launchUrl` throws instead of showing message; `RegistrationCard` class name duplicated across files (copy/paste).
- Orientation: iPhone allows landscape while layouts use fixed heights/percent -> likely overflows (UNKNOWN visually).
- Date picker has no locale handling; dates all treated as 'yyyy-MM-dd' strings.

## 10. UNKNOWNs / open questions
- Real server contracts: full response schema of login (any `refreshToken`/expiry?), `GET /user/{id}` auth requirement, error shapes for 401/409/500, duplicate-username messages.
- Is the `-dev` path intentionally production? Why does documents.dart use no-env path? Which backend is canonical for the rebuild?
- Does the backend accept/require `Authorization` on all endpoints? Is there a refresh endpoint? Is there an account-deletion endpoint?
- Exact `routeName` strings of non-core screens (defined in each screen file; other agents).
- Is Raleway/Montserrat actually used anywhere besides one `fontFamily: 'Montserrat'`? Exact derived tonal colors from `fromSeed`.
- What `get` does in dashboard.dart beyond tab controller; whether ATT is really needed (no ads/analytics SDKs present).
- Whether orientation is locked anywhere (SystemChrome not examined in core files), and Android min/target SDK values (Flutter defaults, version-dependent).
- `userType: 'ROLE_USER'` and `client_code: 'SFAI'` hard-coded in registration: are other client codes planned (multi-tenant)?
- Is the Services (ASTRA/CallIt/Tala) tab intended to return (commented-out nav destination)?
