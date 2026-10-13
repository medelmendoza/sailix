# Tala3 (Flutter) - My Stats, local DB, sync, connectivity, platform inventory

Scope: read-only analysis of `/Users/btsolve/development/claude/tala3` WORKING TREE (HEAD differs). All paths below are relative to `tala3/` unless absolute. "L" = line. Items marked INFERRED are not directly stated in code.

IMPORTANT FINDING UP FRONT: `lib/providers/mystats/stats_sync.dart` contains ONLY payload model classes (DTOs with `toJson`). There is NO sync queue, scheduler, retry or background logic anywhere. "Sync" is a manual, user-triggered full-snapshot POST (section 3).

---

## 1. "My Stats" feature

### 1.1 Screens
| Screen | File | What it shows |
|---|---|---|
| Stats tab (list) | `lib/tabs/mystats/mystats_screen.dart` (tab wired at `lib/tabs/tab_screen.dart:7,36,53`) | One card per locally downloaded course (`MyStatsItem2`), pull-to-refresh, FAB "Sync" (L66-75) that syncs ALL courses. States: shimmer (L37-38), error+retry "Could not load your stats." (L39-45), empty "No data found..." (L50-53). |
| List item | `lib/tabs/mystats/mystats_item2.dart` | Course thumbnail+name (`CourseCard`), progress bar = `totalMaterialSynced / totalMaterial` and `%` text with 2 decimals (L38-41). Tap opens detail with `MyStatsArguments(course)` (L19-22). |
| Course stats detail | `lib/tabs/mystats/detail/mystats_detail_screen.dart` | Thumbnail (Hero), course name, "Creator", "Days Left" = `AppConstants.daysBetween(now, DateTime.parse(dateTo))` (L116-123), description, list of materials with type and status (L161-175). AppBar cloud-sync icon (L61-73) syncs ONLY this course. |
| Material row | `lib/tabs/mystats/detail/mystats_detail_item.dart` | Thumbnail, name, "Type", "Status" (L78-85). Tap routes: VIDEO -> RichMediaScreen (L27-37), CARD -> FlashCardScreen (L38-48), QUIZ -> QuizScreen (L49-59). EPUB: empty handler (L60). PDF: no handler. |
| Video stat | `lib/tabs/mystats/detail/richmedia/richmedia_screen.dart` | Shows only the saved `comment` text (L33-39, L87-93). |
| Flashcard stat | `lib/tabs/mystats/detail/flashcard/flashcard_screen.dart` | Counts of NOT SEEN / EASY / MEDIUM / HARD, computed on device from `flaggedItem` (L17-20, L37-46, labels L78-115). |
| Quiz stat | `lib/tabs/mystats/detail/quiz/quiz_screen.dart` | CORRECT / WRONG counts, `TOTAL SCORE correct/(correct+wrong)`, average `(correct/length)*100` (L36-45, L94-111). |
| Home dashboard | `lib/tabs/home/home_screen.dart` (L66-67, L100-150) | "My Stats" section re-uses `Stats.fetchAndSetCourse()`; same synced-progress % per course (L68-81); second list shows course name + `dateTo`. |

### 1.2 How values are computed (client vs server)
- All displayed stats are computed ON DEVICE from SQLite. The Stats tab never calls the server to read stats: `Stats.fetchAndSetCourse()` reads `courseDetails` filtered by `userId` and `teamId` (`lib/providers/mystats/stats.dart:119-149`, query `lib/helpers/db_helpers.dart:110-120`).
- `Stats.fetchMaterials` (stats.dart:151-227) builds the material list by reading 5 tables (richmediaDetails, flashcardDetails, quizDetails, epubDetails, pdfDetails) for one `assignId/userId/teamId/courseId`; type tags 'VIDEO','CARD','QUIZ','EPUB','PDF'.
- Progress bar numerator is `totalMaterialSynced` (count of COMPLETED materials as of the last successful sync upload, set at stats.dart:508-519 / 875-885 via `DBHelper.updateCourseSynced` db_helpers.dart:142-160); denominator is `totalMaterial` from the server course record. Therefore "progress" shown = last-synced progress, NOT live local progress. Column `totalMaterialAnswered` exists but `updateCourseAnswered` (db_helpers.dart:122-140) has no caller (grep) - dead.
- Quiz score and PASS/FAIL are computed client-side at sync time: `average = correct/(correct+wrong)*100`; `remarks = average >= int.parse(quizPercentage) ? 'PASSED':'FAILED'` (stats.dart:395-399, 736-740). Any quiz item whose `flaggedItem != 'CORRECT'` counts as wrong (stats.dart:349-353) including unanswered 'DEFAULT'.
- Course `status` and `progress` strings are computed client-side at sync: `status = completedCount < totalMaterial ? 'NOT YET COMPLETED' : 'COMPLETED'`; `progress = '<completed>/<total>'` (stats.dart:472-476, 828-832).
- Days left computed client-side.
- Server-side aggregation (admin dashboards etc.) is not visible in this app. UNKNOWN.

### 1.3 Endpoints
Base: `ApiUrl.liveUrl` = host string constant in `lib/constants/api_url.dart:2-3` (production host; `devUrl`/`localUrl` also defined L4-7). ALL calls use `Uri.http(...)` i.e. plain `http://` (cleartext); every `Uri.https` variant is commented out (e.g. stats.dart:58-61, 495-498, 858-861). `getUser = '/api/v1/auth/users/'` (api_url.dart:11).
Auth header on every call: `Authorization: Bearer <accessToken>` (accessToken from `Auth`, injected via ProxyProvider, `lib/main.dart:148-162`). POSTs add `Content-Type: application/json`. No refresh-token flow, no retry, no timeout is set on any `http` call (INFERRED from absence in stats.dart; `refreshToken` is held by Auth but not used here).

| Method | Path | Headers | Body | Response fields used | File:line |
|---|---|---|---|---|---|
| GET | `/api/v1/auth/users/{userId}/teams/{teamId}/courses` | Bearer | - | JSON array; per item: `updatedAt`, `assignId`, `userId`, `teamId`, `dateFrom`, `dateTo`, `courseId`, `course.{updatedAt, courseName, courseDescription, courseThumbnailUrl, courseCreator, totalMaterial, materialDetails[{materialId, materialName, materialDescription, materialType, materialThumbnailUrl, materialUrl}]}` | `Stats.getMyCourses` stats.dart:57-117. NO CALLER in Stats context (INFERRED dead code: only `Courses.getMyCourses` is invoked, `mycourses_screen.dart:26`, `myforms_screen.dart:16`; same endpoint in `providers/course/courses.dart:78-82`). |
| POST | `/api/v1/auth/users/{userId}/teams/{teamId}/courses/sync` | Bearer + JSON | See 3.4 (`{"courseList":[...]}`) | Success only if `statusCode == 200`; error body read as `responseData['message']` (stats.dart:506-524, 872-891) | `getCourseforSync` L231-530 (one course), `getAllCourseforSync` L534-898 (all) |
| GET | `/api/v1/auth/users/{userId}/teams/{teamId}/courses/{courseId}/sync/{assignId}/data` | Bearer | - | `materials.{videos[],cards[],quizzes[],epubs[],pdfs[]}` (same shape as the POST payload) - used to RESTORE previously synced results when a material is downloaded | richmedia.dart:36-100, flashcards.dart:39-125, quizzes.dart:50-150, pdf.dart:33, epub.dart:33-85 |

Download endpoints that populate the local DB (owned by other analysis areas but needed to understand stats): `/api/v1/auth/admin/teams/{teamId}/{videos|epubs|pdf|quizzes|up_quizzes|upgraded_cards}/{id}` (`ApiUrl.getTeams2`/`getTeams` constants api_url.dart:9-10; paths at richmedia.dart:113, epub.dart:98, pdf.dart:103, quizzes.dart:169,300, flashcards.dart:153). NOTE: code uses `ApiUrl.getTeams` (= `/api/v1/auth/users/teams/`) for those. Use auth 'Bearer'.

---

## 2. Local SQLite schema (exact)

DB file: `tala3.db` under `getDatabasesPath()` (db_helpers.dart:26-27). `DBHelper.database()` calls `openDatabase` on EVERY helper call (no cached handle; L25-64). **Version 3** (L63). No `PRIMARY KEY`, no `UNIQUE`, no `INDEX`, no foreign keys and no `NOT NULL` anywhere; every column is `TEXT`. `insert()` uses `ConflictAlgorithm.replace` (L66-73) but with no unique key it never replaces: re-inserting creates DUPLICATE rows. `insert` is not awaited internally (`db.insert` result dropped, L68) so callers that `await DBHelper.insert` return before the write completes.

onCreate (L28-40) runs, in order: createTableCourse, RichMedia, Epub, Pdf, FlashCardDetails, FlashCardData, QuizDetails, QuizSection, QuizData, FormDetails, FormSection, FormData. The `db.execute` calls inside `createTable*` are not awaited (fire-and-forget; `await` on a void function).

onUpgrade (L41-62), only `if (oldVersion < 3)`: `ALTER TABLE ... ADD COLUMN ... TEXT DEFAULT ""` for: courseDetails.instructor, courseDetails.tags, courseDetails.status, and `tags` on richMediaDetails, epubDetails, pdfDetails, flashCardDetails, quizDetails, formDetails. (SQLite table names are case-insensitive so `richMediaDetails`/`flashCardDetails` resolve.) There is NO migration adding `courseDetails.dateAssigned`, `assignedBy`, `sequential` that exist in the CREATE (L89) - devices upgraded from an old DB would lack them (INFERRED risk; the original v1 create at L82-85 comment lacks them). No onDowngrade. No `tables` for pending-sync queue.

Exact DDL:

```
courseDetails(assignUpdatedAt TEXT, courseUpdatedAt TEXT, assignId TEXT, userId TEXT, teamId TEXT, dateFrom TEXT, dateTo TEXT, dateAssigned TEXT, assignedBy TEXT, courseId TEXT, courseCode TEXT, courseName TEXT, courseDescription TEXT, courseThumbnailUrl TEXT, courseCreator TEXT, totalMaterial TEXT, sequential TEXT, totalMaterialAnswered TEXT, totalMaterialSynced TEXT, instructor TEXT, tags TEXT, status TEXT)        -- L89
richmediaDetails(assignId TEXT, userId TEXT, teamId TEXT, courseId TEXT, videoId TEXT, videoName TEXT, videoDescription TEXT, videoThumbnailUrl TEXT, videoFileUrl TEXT, videoFileName TEXT, videoStatus TEXT, totalMaterialAnswered TEXT, feedback TEXT, comment TEXT, tags TEXT)  -- L205
epubDetails(assignId TEXT, userId TEXT, teamId TEXT, courseId TEXT, epubId TEXT, epubName TEXT, epubDescription TEXT, epubThumbnailUrl TEXT, epubFileUrl TEXT, epubFileName TEXT, epubStatus TEXT, totalMaterialAnswered TEXT, tags TEXT)  -- L346
pdfDetails(assignId TEXT, userId TEXT, teamId TEXT, courseId TEXT, pdfId TEXT, pdfName TEXT, pdfDescription TEXT, pdfThumbnailUrl TEXT, pdfFileUrl TEXT, pdfFileName TEXT, pdfStatus TEXT, totalMaterialAnswered TEXT, tags TEXT)  -- L462
flashcardDetails(assignId TEXT, userId TEXT, teamId TEXT, courseId TEXT, cardId TEXT, cardName TEXT, cardDescription TEXT, cardThumbnailUrl TEXT, cardStatus TEXT, totalMaterialAnswered TEXT, tags TEXT)  -- L578
flashcardData(id TEXT, assignId TEXT, userId TEXT, teamId TEXT, courseId TEXT, cardId TEXT, name TEXT, question TEXT, answer TEXT, questionMediaType TEXT, questionMediaUploaded TEXT, answerMediaType TEXT, answerMediaUploaded TEXT, tags TEXT, flaggedItem TEXT)  -- L583 (no IF NOT EXISTS)
quizDetails(assignId TEXT, userId TEXT, teamId TEXT, courseId TEXT, quizId TEXT, quizName TEXT, quizDescription TEXT, quizThumbnailUrl TEXT, quizStatus TEXT, quizAverage TEXT, quizPercentage TEXT, totalMaterialAnswered TEXT, tags TEXT)  -- L791
quizSection(id TEXT, assignId TEXT, userId TEXT, teamId TEXT, courseId TEXT, quizId TEXT, sectionId TEXT, sectionTitle TEXT, sectionDescription TEXT, sectionMediaType TEXT, sectionMedia TEXT, pagePerSection TEXT)  -- L796
quizData(id TEXT, assignId TEXT, userId TEXT, teamId TEXT, courseId TEXT, quizId TEXT, sectionId TEXT, questionType TEXT, numQuestion TEXT, question TEXT, answer TEXT, choices TEXT, mediaType TEXT, mediaUploaded TEXT, required TEXT, tags TEXT, flaggedItem TEXT, userAnswer TEXT)  -- L801
formDetails(assignId TEXT, userId TEXT, teamId TEXT, courseId TEXT, formId TEXT, formName TEXT, formDescription TEXT, formThumbnailUrl TEXT, formStatus TEXT, totalMaterialAnswered TEXT, tags TEXT)  -- L1079
formSection(id TEXT, assignId TEXT, userId TEXT, teamId TEXT, courseId TEXT, formId TEXT, sectionId TEXT, sectionTitle TEXT, sectionDescription TEXT, sectionMediaType TEXT, sectionMedia TEXT, pagePerSection TEXT)  -- L1084
formData(id TEXT, assignId TEXT, userId TEXT, teamId TEXT, courseId TEXT, formId TEXT, sectionId TEXT, questionType TEXT, numQuestion TEXT, question TEXT, answer TEXT, choices TEXT, mediaType TEXT, mediaUploaded TEXT, required TEXT, tags TEXT, flaggedItem TEXT, userAnswer TEXT)  -- L1089
```
(Table names in code: stats.dart uses `'flashCardDetails'` and `'flashcardDetails'` interchangeably; SQLite case-insensitive. A second, commented-out older `database()` exists at L6-23; commented example tables L1119-1129 are dead.)

Identity key used by every query: composite `(assignId, userId, teamId, courseId[, materialId])`, never indexed (e.g. db_helpers.dart:100-107, 217-223). The `id` in quizSection/quizData/flashcardData is a per-material counter string (`ctr.toString()`, flashcards.dart:93,101; quizzes.dart:101,119) NOT unique across materials or courses; `updateQuizData`/`updateFcData` filter by `id` plus the composite key.

What each table stores / source of truth:
| Table | Content | Written by | Source of truth |
|---|---|---|---|
| courseDetails | Assigned-course metadata snapshot, `totalMaterial`, `totalMaterialSynced` | Inserted when a material is first downloaded (`Courses.insertDBCourse`, courses.dart:255-278, called from mycourses_detail_item_online.dart:1006-1007); metadata refreshed if `courseUpdatedAt` differs (L1012-1024, but `updateCourseDetails` db_helpers.dart:162-194 does not write `courseUpdatedAt`, so the check keeps firing); `totalMaterialSynced` set after successful sync | Metadata: server. `totalMaterialSynced`: device cache of last upload |
| richmediaDetails / epubDetails / pdfDetails | Downloaded file metadata (`*FileName` is whitespace-stripped upper-case, richmedia.dart:63-66), status, video `feedback`/`comment` | Download flow | Material content: server. Status/feedback/comment: DEVICE until synced |
| flashcardDetails/flashcardData | Cards + per-card self rating `flaggedItem` ('DEFAULT' initial, flashcards.dart:201,218; or server `result` on restore, flashcards.dart:111,129) | Download + study | Ratings and status: DEVICE until synced |
| quizDetails/quizSection/quizData | Quiz structure, answer key (`answer`), user answers (`userAnswer`), result `flaggedItem` ('DEFAULT'/'CORRECT'/'WRONG'), pass mark `quizPercentage` | Download + attempt | Answers/results: DEVICE until synced |
| form* | Created by onCreate but no writer found in stats scope (INFERRED unused; `DBHelper.insert('form...')` has no caller in grep) | - | - |

Status vocabulary: 'NOT STARTED', 'NOT YET COMPLETED', 'COMPLETED' (db_helpers.dart:281,303,419,535; quizzes.dart:472-473; stats.dart:83). Completed means server and device agree only after a successful sync POST.

`DBHelper.deleteAllData()` (L1094-1102) deletes all rows of ALL tables incl. `android_metadata`/`sqlite_master` listing; called ONLY on account deletion (`lib/tabs/settings/settings_item.dart:517`), NOT on logout (`Auth.logout` clears SharedPreferences only, auth.dart:435-453). Rows are scoped by userId+teamId in the list query so another user logging in on the same device does not see them in the list, but they persist on disk.

---

## 3. Sync algorithm

### 3.1 What is queued offline
Nothing is queued. There is no outbox/dirty flag. Local state is mutated in place by study actions (e.g., `updateRichMedia` sets `videoStatus='COMPLETED'` + feedback + comment, db_helpers.dart:268-291; `updateFcData`/`updateFcStatus` flashcards.dart:297-309; `updateQuiz`/`updateQuizStatus` quizzes.dart:452-483; epub/pdf set `*Status='COMPLETED'`, db_helpers.dart:419,535). At sync time the app re-derives the payload from the tables by selecting rows whose status is 'COMPLETED' (`getRichMediaForMaterialsCompleted`, `getFcForMaterialsCompleted`, `getQuizForMaterialsCompleted`, `getEpubForMaterialsCompleted`, `getPdfForMaterialsCompleted`; stats.dart:242-243, 269-270, 332-333, 412-413, 430-431).
Consequence: only COMPLETED materials are uploaded; partial progress (in-progress quiz answers, half-rated flashcards) is never sent.

### 3.2 Triggers
Manual only:
1. Stats tab FAB -> confirm dialog ("Are you sure you want to sync?") -> `getAllCourseforSync()` (mystats_screen.dart:66-75, 79-114). On success shows "Courses synced successfully." and reloads list from DB (L105-110).
2. Course detail AppBar icon -> confirm -> `getCourseforSync(assignId,userId,teamId,courseId)` (mystats_detail_screen.dart:61-73, 185-239).
No auto-sync on connectivity regain, app start, logout, completion of material, or background. No connectivity pre-check: offline press simply fails with an exception shown in a dialog (mystats_screen.dart:111-113; detail screen shows generic `AppConstants.errorMessage`, L235-237).

### 3.3 Ordering / algorithm
`getAllCourseforSync` (stats.dart:534-898):
1. Read all `courseDetails` rows for user+team (L543-544).
2. For each course sequentially: collect completed videos, cards, quizzes (+sections+questions), epubs, pdfs; compute totals; build one `CourseList` entry (L545-851); reset accumulators.
3. `jsonEncode(StatsSync(courseList))` (L853), `printWrapped` prints the whole JSON (including user answers, name, email) to the debug console (L854; this line is an UNCOMMITTED working-tree change, see 8).
4. If `courseList.isEmpty` -> throws `HttpException('No course to sync.')` (L863-864). Otherwise ONE `POST` for all courses (L866-871).
5. On HTTP 200: for every course set `totalMaterialSynced = totalSynced[i]` (L873-886); then `notifyListeners`. Index alignment of `totalSynced[ctrSynced]` with `courses` assumes every course produced exactly one `totalSynced` entry (true: added at L809 for each course).
6. Any other status: throw `HttpException(responseData['message'])` (L887-891). Network error or non-JSON body -> `json.decode` throws (L872) -> error dialog.
`getCourseforSync` (L231-530) is the same for one course, with a one-element `courseList`.

### 3.4 Payload format (`stats_sync.dart`)
`POST {"courseList":[CourseList...]}` (stats_sync.dart:8-12). Every value is a String except where noted.
- CourseList (L15-84): `assignId, courseId, courseName, courseDescription, userId, teamId, lastName, firstName, middleName, dateFrom, dateTo, dateAssigned, assignedBy, email, status, progress ("n/total"), syncDate (always '' - server must stamp), courseTags, userTags, materials`. lastName/firstName/middleName/email/tags come from Auth (`_lastName!` etc., stats.dart:464-466,471,479; force-unwrapped, throws if null).
- materials (L86-110): `{videos[], cards[], quizzes[], epubs[], pdfs[]}`.
- videos (L114-155): `videoId, videoName, videoDescription, videoFileUrl, videoFileName, videoThumbnailUrl, status, feedback, comment, progress(''), tags`.
- cards (L160-204): `cardId, cardName, cardDescription, cardThumbnailUrl, status, notseen(int), easy(int), medium(int), hard(int), progress(''), tags, data[]`; data item (L207-239): `tags, question, answer, questionMediaType, questionMediaUploaded, answerMediaType, answerMediaUploaded, result` where result = 'NOT SEEN' if DEFAULT else 'EASY'|'MEDIUM'|'HARD' (stats.dart:294).
- quizzes (L244-291): `quizId, quizName, quizDescription, quizThumbnailUrl, status, quizPercentage(pass mark, string), correct(int), wrong(int), average(double), remarks('PASSED'|'FAILED'), progress(''), tags, sections[]`; section (L294-323): `sectionId, sectionTitle, sectionDescription, sectionMediaType, sectionMedia, pagePerSection, data[]`; question (L326-367): `tags, numQuestion, questionType, question, answer, choices, mediaType, mediaUploaded, required, userAnswer, result`.
- epubs/pdfs (L372-447): `<x>Id, <x>Name, <x>Description, <x>FileUrl, <x>FileName, <x>ThumbnailUrl, status, progress(''), tags`.
Contents are a FULL denormalised snapshot (includes question text and correct answers), so each sync re-uploads everything completed, not a delta. Payload size is unbounded (no chunking).

### 3.5 Conflict handling / idempotency / retry
- Conflict handling: none client-side. The device snapshot overwrites; the server behaviour (replace vs merge) is UNKNOWN. The only reconciliation is the reverse path: when a material is downloaded, the app GETs `.../sync/{assignId}/data` and, if the server has that material's synced data, seeds the local row from it (status, flagged results), else falls back to the plain material download (richmedia.dart:83-100 pattern; flashcards.dart:119+; quizzes.dart:140+). There is no timestamp/version compare in either direction.
- Idempotency: the POST is a whole-state resend with stable ids, so repeats are naturally idempotent IF the server upserts by (userId, teamId, courseId, assignId). No client idempotency key. UNKNOWN server behaviour.
- Retry: none (no backoff, no queue, no timeout).
- Concurrency: no mutex; the user can start both per-course and all-course sync, or study while a sync runs. Data changed between snapshot and 200 response is marked "synced" by `totalMaterialSynced` count only (count of completed items at snapshot time, so the count stays correct to what was sent).
- Failure modes: HTTP non-200 -> message from body; 401 -> same as other errors (no token refresh, no forced logout; stats.dart:520-524); `json.decode` crash on HTML/empty error bodies (e.g. proxy 502); 200 with partial server failure undetectable.

### 3.6 Data-loss and correctness risks specific to sync
See section 8 (notably the un-awaited flashcard `forEach` and 'NOT SEEN' vs 'DEFAULT' mismatch).

---

## 4. Online/offline detection and mode differences

- Only `connectivity_plus ^5.0.2` (pubspec.yaml:53), used in ONE place: `lib/tabs/mycourses/mycourses_screen.dart`. `Connectivity().checkConnectivity()` at init (L50-68) plus `onConnectivityChanged` stream (L39-40), cancelled in dispose (L43-47).
- `online = (result is wifi) || (result is mobile)` compared via `toString()` (L70-81). Ethernet, VPN, bluetooth, other => treated as OFFLINE. No actual reachability/DNS/ping check; "wifi but no internet" counts as online. Initial value `connection=false` (L23) so first frame renders the offline branch until the async check finishes (L85); the offline branch triggers a DB read, then flips to online.
- `build` returns `onlineCourse` or `offlineCourse` (L85). Both use `FutureBuilder(future: <call in build>)` so every `setState` (e.g., each connectivity event) re-issues the fetch (L88-92, 118-122).
- Behaviour differences (My Courses tab):
  - ONLINE: `Courses.getMyCourses()` GET course list from server (courses.dart:76-82) -> `MyCoursesItemOnline` (can download/refresh materials, apply course code, download-for-offline icon mycourses_detail_item_online.dart:292-293, enqueue sync restore calls).
  - OFFLINE: `Courses.fetchAndSetCourse()` reads local `courseDetails` -> `MyCoursesItemOffline` / `MyCoursesDetailScreenOffline` / `MyCoursesDetailItemOffline` (main.dart:26,242-243; mycourses_item_offline.dart). Study uses local files in app documents (path_provider) and DB.
- My Stats tab has NO connectivity awareness: it always reads the local DB; the Sync buttons need network and fail with an error dialog when offline.
- Login/auth screens do not check connectivity (INFERRED from grep: no other references).
- Auth tokens are persisted (SharedPreferences `userData`, auth.dart:289-300, 396-420) so the app can auto-login offline (`tryAutoLogin`, auth.dart:287+). Token expiry offline is not checked here (timer code commented, auth.dart:518).

---

## 5. Dependency inventory (pubspec.yaml L31-59; versions are constraints as written, not asserted installed)

Candidate = suggested React Native/Expo equivalent; verify maintenance/compat at install (Expo SDK/RN New Architecture) before adopting.

| Package (constraint) | Purpose in app / where | RN/Expo candidate (verify maintenance/compat at install) |
|---|---|---|
| provider ^6.0.4 | State management; ChangeNotifier providers in main.dart:148+ | React Context + Zustand (or Redux Toolkit / TanStack Query for server cache) |
| intl ^0.19.0 | Date/format (registration_screen, app_constants) | Intl API / date-fns / dayjs |
| http ^1.2.0 | All REST calls | fetch / axios |
| shared_preferences ^2.0.15 | Persist session `userData` JSON, `attAsked` flag (auth.dart:289-420; home_screen.dart:31-62) | `expo-secure-store` (tokens) + `@react-native-async-storage/async-storage` (non-secret flags) |
| video_player ^2.7.0 + chewie ^1.7.0 | Video playback in course materials and card/quiz media | `expo-video` (or react-native-video) |
| audioplayers ^6.5.0 | Audio in flashcards/quiz | `expo-audio` (or expo-av, react-native-sound) |
| flutter_rating_bar ^4.0.1 | Video feedback rating (richmedia_screen) | `react-native-ratings` / simple custom component |
| cached_network_image ^3.2.3 | Image caching for thumbnails | `expo-image` (built-in caching) / react-native-fast-image |
| shimmer ^3.0.0 | Loading skeletons | `moti` skeleton / `react-native-skeleton-placeholder` |
| percent_indicator ^4.0.1 | Progress bars on stats/home | `react-native-progress` / `react-native-svg` custom |
| path ^1.8.3 | Path joins (DB path, files) | Expo FileSystem paths (`expo-file-system`) |
| path_provider ^2.0.15 | App documents dir for downloaded media | `expo-file-system` (documentDirectory) |
| sqflite ^2.2.2 | Local DB `tala3.db` | `expo-sqlite` (or WatermelonDB / op-sqlite) |
| dio ^5.4.1 | File downloads with progress (pdf.dart, epub.dart, flashcard_screen, quiz item) | `expo-file-system` `createDownloadResumable` / `react-native-blob-util` |
| permission_handler ^11.3.0 | No usage found in lib (grep empty; INFERRED unused) | Expo per-module permission APIs if ever needed |
| dropdown_button2 ^2.3.9 | No usage found in lib (INFERRED unused) | `react-native-dropdown-picker` / `@react-native-picker/picker` |
| url_launcher ^6.3.1 | Open privacy policy URL (settings_item.dart:24) | `expo-linking` / `expo-web-browser` / `Linking` |
| flutter_pdfview ^1.3.4 | Native PDF viewer (online/offline course item) | `react-native-pdf` (needs dev build) / `react-native-webview` |
| connectivity_plus ^5.0.2 | Online/offline switch in My Courses | `@react-native-community/netinfo` |
| app_tracking_transparency ^2.0.4 | iOS ATT prompt (home_screen.dart:28-62, login_screen.dart:558-567) | `expo-tracking-transparency` |
| get ^4.6.6 | Only `tab_screen.dart` import (INFERRED minor: snackbar/nav helper) | Not needed (React Navigation) |
| cupertino_icons ^1.0.2 | iOS icon font | `@expo/vector-icons` |
| flutter_lints (dev) | Lint | ESLint + TypeScript |
Assets: `pubspec.yaml:84-90` (facebook.png, google.png, flashcard-question-answer.png, course-placeholder.png, tala_main_icon.png, tala_main_icon2.png) and fonts Raleway (Regular/Bold 700/Black 900) and Montserrat (Regular 400/SemiBold 600/Bold 700) at L103-118. App version string `1.0.22+22` (L20). Dart SDK constraint `>=2.18.2 <3.0.0` (L23). Note: no `epub_view`/`vocsy_epub_viewer` remain (commented out in HEAD, removed in working tree; EPUB screens deleted in working tree, see 8) - EPUB is effectively not viewable in the working tree (mystats_detail_item.dart:60 empty handler).

---

## 6. Permissions and platform config (exact)

### Android
- `android/app/src/main/AndroidManifest.xml`: only `<uses-permission android:name="android.permission.INTERNET"/>` (L2). debug and profile manifests also only INTERNET (`android/app/src/debug/AndroidManifest.xml:6`, `profile/...:6`).
- No `READ/WRITE_EXTERNAL_STORAGE`, no `ACCESS_NETWORK_STATE` declared (connectivity_plus normally adds its own via manifest merge; INFERRED), no CAMERA/RECORD_AUDIO/notifications/foreground-service.
- No `android:usesCleartextTraffic`, no `networkSecurityConfig` (grep of `android/` empty; `res/xml` does not exist). On Android 9+ the default blocks cleartext HTTP, yet ALL API calls are `http://` (see 7) - UNKNOWN how this works in production (server-side redirect/HSTS cannot help a plain-http POST).
- Label `Lodestar LMS` (L5; WORKING TREE change from "Tala LMS"); activity `.MainActivity` exported, launchMode singleTop (L7-15); only MAIN/LAUNCHER intent-filter (L24-27); `queries` PROCESS_TEXT (L40-45). No deep links / App Links / custom schemes.
### iOS (`ios/Runner/Info.plist`)
- `CFBundleDisplayName`/`CFBundleName`: "Lodestar LMS" (L9-10, 17-18; working-tree rename from "Tala LMS").
- `NSUserTrackingUsageDescription` = "We use your device's advertising identifier to deliver personalized ads and track performance. This helps keep the app free and supports future improvements." (L29-30). ATT prompt is requested in code: home screen on iOS once (`attAsked` pref, home_screen.dart:28-62, after a custom explainer dialog whose both buttons just continue) and login screen (login_screen.dart:558-567). Note the explanation mentions advertising/ads but no ads SDK is in pubspec (INFERRED mismatch; App Store review risk).
- No `NSAppTransportSecurity` / `NSAllowsArbitraryLoads` / exception domains -> iOS ATS would block `http://` requests to a non-exempt host (same unexplained contradiction as Android).
- No `UIBackgroundModes`, no camera/microphone/photo/location/Bluetooth usage strings, no `CFBundleURLTypes`, no `LSApplicationQueriesSchemes`, no associated domains.
- Orientation: iPhone portrait only; iPad all four (L58-68). `UIApplicationSceneManifest` with `FlutterSceneDelegate` (L31-51; new in working tree), `CADisableMinimumFrameDurationOnPhone` true (L5-6).
- `AppDelegate.swift` (working tree): adopts `FlutterImplicitEngineDelegate`; plugin registration moved to `didInitializeImplicitFlutterEngine` (Flutter scene-lifecycle migration).

---

## 7. Security observations
- Cleartext transport: every API call, including login, registration, password change and the sync POST carrying student answers/PII, is built with `Uri.http` (auth.dart:117,149,205,232,...; stats.dart:60,497,860; `https` variants commented out). Bearer tokens and passwords therefore travel unencrypted unless the server/edge forces TLS in a way the client tolerates (UNKNOWN). Required fix in RN: https only.
- Tokens at rest: access token, refresh token and profile (name, email, contact number, birth date, tags, team) stored as one plaintext JSON string in SharedPreferences key `userData` (auth.dart:396-420). Not Keychain/Keystore.
- SQLite at rest: `tala3.db` is unencrypted and holds, per user: course metadata, quiz answer KEYS (`quizData.answer`) alongside user answers (`userAnswer`) and results, flashcard Q/A, video comments/feedback, file URLs (may be signed/CDN URLs). Contains no tokens or passwords. Sensitivity: moderate (assessment integrity; student performance data). Anyone with device/backup access can read it and could edit `*Status`/`flaggedItem` to forge completions that the next sync will upload (server does not appear to be given any proof; server-side verification UNKNOWN).
- Persistence after logout: `Auth.logout` wipes SharedPreferences (auth.dart:435-453) but NOT the SQLite DB or downloaded files; data remains (only account deletion calls `deleteAllData`, settings_item.dart:517). The same-user re-login restores it.
- Logging: working tree adds `printWrapped(jsonCourseList)` in `getAllCourseforSync` (stats.dart:854) that dumps the full sync payload (names, email, quiz answers) to the debug console in all build modes (`debugPrint` is throttled but not stripped in release logs on all platforms).
- `auth.dart` contains a commented-out block mentioning an API key (Firebase-style `identitytoolkit` call, around L520+). Not copied here; treat as a leaked secret if ever live and rotate/remove.
- PII in payload: first/middle/last name and email are sent in every course record (stats.dart:464-471), redundant with the Bearer identity (server should derive from token).
- Password confirmation, token refresh, certificate pinning: absent.
- ATT string/ads wording vs no ad SDK (section 6).

---

## 8. Defects and risks

### 8.1 Defects (file:line)
1. **Un-awaited async `forEach` loses/misattributes flashcard data** - `cardDetails.forEach((card) async {...})` at stats.dart:272-323 and 591-648. `forEach` does not await its async callbacks, so `loadedCards` is read (L449-453 / L804-808 `totalMaterial`, and `jsonEncode` L491/L853) possibly BEFORE cards are appended. In `getAllCourseforSync` accumulators are re-assigned per course (L846-850), so late callbacks append cards to the NEXT course's (or an orphaned) list; the status/count (`totalMaterial` = completed count, hence `COMPLETED` decision L472/L828, and `totalMaterialSynced`) can omit cards. Likely results: cards missing from payload or attributed to the wrong course; counts `notseen/easy/medium/hard` and `cData` shared mutable variables are also shared across overlapping callbacks (they reset at L315-319 while another callback may be mid-loop). Race outcome depends on DB timing (INFERRED; deterministic in no case).
2. **'NOT SEEN' vs 'DEFAULT'** - restored-from-server cards carry `flaggedItem = card['result']` which for unseen is 'NOT SEEN' (flashcards.dart:111,129; payload writes 'NOT SEEN' at stats.dart:294). The sync counter only treats 'DEFAULT' as not-seen; everything else falls to `else -> hard++` (stats.dart:277-285, 601-609), inflating `hard`. The stats screen treats any non-EASY/MEDIUM/HARD as not seen (flashcard_screen.dart:39-46) so UI and uploaded counts disagree.
3. **Quiz scoring edge cases** - division by zero (`correct/(correct+wrong)` with no questions -> NaN, then JSON-encodes NaN, which `jsonEncode` rejects with an exception for double.nan), `int.parse(quiz['quizPercentage'])` throws on null/decimal/empty (stats.dart:395-399). Unanswered 'DEFAULT' items counted wrong (L349-353). The `quizDetails.quizAverage` column is stored but sync recomputes.
4. **Progress UI crashes** - `double.parse(totalMaterial)` and percent division: `totalMaterial=='0'` -> NaN/Infinity; `LinearPercentIndicator` asserts percent in [0,1] (mystats_item2.dart:38-41; home_screen.dart:68-81). `DateTime.parse(dateTo)` throws on empty string (mystats_detail_screen.dart:120). `findById` uses `firstWhere` without `orElse` (stats.dart:52-55) -> StateError if list reloaded while detail open.
5. **Duplicate rows** - no keys/indexes and `ConflictAlgorithm.replace` is ineffective (db_helpers.dart:66-73). Re-downloading a material inserts duplicates in details/data tables; subsequent `update`s hit all duplicates, `query`s return duplicates, so sync payload can contain duplicate materials/questions and counts (`totalMaterial` completed count inflates).
6. **Fire-and-forget DB writes** - `DBHelper.insert` doesn't await `db.insert` (L68); `createTable*` don't await `execute`; `insertDBCourse` not awaited (courses.dart:256). A crash/kill right after a "completed" action may drop it; sync reading immediately after may miss it.
7. **New DB connection per call** - `database()` calls `openDatabase` every time (db_helpers.dart:25-64) (works because sqflite returns the shared handle for same path, but adds overhead and makes version-upgrade work happen on first call; INFERRED).
8. **Migration gap** - v3 upgrade omits `dateAssigned`, `assignedBy`, `sequential` columns of `courseDetails` that INSERT/SELECT now use (courses.dart:260-262,267; db_helpers.dart:89) -> insert fails on upgraded legacy installs (INFERRED; needs a v1/v2 device to confirm). `courseUpdatedAt` never updated (db_helpers.dart:162-194).
9. **No retry, queue, dedup or connectivity guard for sync**; "Success" dialog depends solely on HTTP 200. Per-course sync closes the confirm dialog via `Navigator.pop` inside `_showSyncDialogProgress` (mystats_detail_screen.dart:241-243); `_showDialog` pops once more (L263-264), a mismatch can pop the wrong route (UI defect). List screen refetches after sync with a new future (mystats_screen.dart:108-110).
10. **Single failed sync of all courses = nothing marked synced; one malformed course (e.g., null name `_lastName!`) aborts all** (all-or-nothing, stats.dart:863-891).
11. **Large payload risk** - all completed materials of all courses (incl. full quiz bodies with answer keys) in one request, no compression/chunk; mobile timeouts leave local state unmarked while server may have partially/fully applied.
12. **Data-loss window** - re-downloading/reset flows: `updateQuizItems` resets quiz status to 'NOT STARTED' (quizzes.dart:462-475) and delete* helpers (db_helpers.dart:315,431,547,738,760,1004,1026,1048) remove local rows; completed-but-unsynced work is destroyed with no warning. Likewise account deletion clears DB (settings_item.dart:517). There is no "unsynced changes" indicator (the bar shows last synced %, not pending).
13. **Unbounded growth** - nothing prunes DB or files; no cap on queue because there is no queue; DB rows accumulate per (user, team, assignment) forever (logout does not delete).
14. `Stats.getMyCourses` (stats.dart:57-117) is dead code and `Stats` ProxyProvider reconstructs the object on each Auth notification (main.dart:151-162), carrying only `courses` forward (not `_dbMaterials`), so materials list is dropped whenever Auth notifies (INFERRED).

### 8.2 Uncommitted working-tree changes vs HEAD in my files
Verified with `git diff --stat` / `git diff` (read-only):
- `lib/providers/mystats/stats.dart` (+4/-7): removes four commented `// printWrapped(qs)` debug lines; UNCOMMENTS `printWrapped(jsonCourseList)` in `getAllCourseforSync` (stats.dart:854), now actively logging the sync payload; changes `print` to `debugPrint` inside `printWrapped` (L908-911). No behavioural change to sync/DB logic. `stat.dart`, `stats_sync.dart`, `db_helpers.dart` are UNCHANGED vs HEAD.
- `lib/tabs/mystats/mystats_screen.dart` (212 lines changed): rewrite to use shared widgets `ShimmerList`, `ErrorRetryView`, `EmptyStateView` (new untracked `lib/helpers/{shimmer_list,error_retry_view,empty_state_view,course_card}.dart`), cached `_statsFuture` with retry, FAB "Sync" with progress/result dialogs (previously per-item layout and inline shimmer; HEAD behaviour not fully re-diffed beyond stat summary). `mystats_item.dart` is staged-deleted (`D`) and replaced by `mystats_item2.dart` (modified, uses `CourseCard`). `mystats_detail_screen.dart` +1 line.
- `lib/tabs/mycourses/mycourses_screen.dart`: replaces inline shimmer with `ShimmerList`; adds `snapshot.hasError` -> `ErrorRetryView` for both online and offline builders and `EmptyStateView`; connectivity logic UNCHANGED.
- `pubspec.yaml`: version `1.0.18+18` -> `1.0.22+22`; adds asset `tala_main_icon2.png`; removes commented-out deps only (no real dependency add/remove; `pubspec.lock` also modified, not inspected).
- `android/.../AndroidManifest.xml`: label "Tala LMS" -> "Lodestar LMS" only. `ios/Runner/Info.plist`: name -> "Lodestar LMS"; reordered ATT key (text unchanged); adds `UIApplicationSceneManifest`. `AppDelegate.swift`: implicit-engine plugin registration. Also modified/not in my scope: Podfile(.lock), project.pbxproj, AppFrameworkInfo.plist, providers (richmedia/epub/pdf/quizzes/flashcards/materials/auth), login/registration/forgot, deleted `epub_screen.dart`, `epub_screen2.dart` (EPUB viewer removed -> EPUB cannot be opened; stats detail already no-ops EPUB taps).

---

## 9. UNKNOWNS / questions for the backend owner
1. TLS: does `http://<host>` redirect to https and how do the clients tolerate it on iOS ATS / Android 9+? Is plain HTTP intended in production? (All endpoints; section 7.)
2. `POST .../courses/sync`: replace or merge semantics per (user, team, course, assignment)? Does the server dedupe materials by id? What does it return (only `message`)? Does it store `syncDate` (client sends '')? Is it idempotent on retries? Any payload size limit?
3. Does the server validate that submitted `status`/`correct`/`result`/`remarks`/`progress` are consistent with the stored course/quiz definition, or trust the client (answer keys are on device)? Does it recompute scores?
4. `GET .../courses/{courseId}/sync/{assignId}/data`: exact schema, behaviour when never synced (empty arrays vs null `materials`), and whether 'NOT SEEN' or 'DEFAULT' is the canonical unseen value for cards; canonical set of status strings ('NOT STARTED' vs 'NOT YET COMPLETED').
5. Token lifetime and refresh endpoint: what does 401 on sync mean for queued offline work? Is there a refresh-token API (the app stores `refreshToken` but never uses it)?
6. Are `quizPercentage` pass marks integers? Can `totalMaterial` be 0? Can `dateTo` be empty/null?
7. Are there server-side aggregate "My Stats" endpoints (analytics, per-material attempts, leaderboards) not used by this client? Multiple attempts/retakes: how should they be represented (client overwrites in place today)?
8. Do the forms tables (`formDetails/formSection/formData`) correspond to a server feature (`myforms_screen.dart` exists)? No sync path found in my scope.
9. Are video/epub/pdf file URLs signed and expiring? (They are stored and re-sent in the sync payload.)
10. What is the intended policy for the ATT/advertising wording given no ad SDK? (affects iOS plist for the RN app.)
11. Multi-device: if the same user syncs from two devices, is last-write-wins acceptable?
