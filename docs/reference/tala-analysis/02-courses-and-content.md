# Tala LMS (tala3) - Courses and Learning Content

Analysis of the Flutter app at `/Users/btsolve/development/claude/tala3` (WORKING TREE is the reference; HEAD `315ced9` differs). Read-only. All paths below are relative to `tala3/lib/` unless prefixed. "INFERRED" = not stated in code, deduced. No secret values are reproduced.

---

## 1. Feature inventory

| Feature | Screen / widget | Navigation | Source |
|---|---|---|---|
| My Courses list (online) | `MyCoursesScreen` -> `MyCoursesItemOnline` -> `CourseCard` (thumbnail, title overlay, creator, days left) | Tab in `tab_screen.dart`; card tap `pushNamed('/mycourses-detail-online', MyCoursesArguments(course))` | tabs/mycourses/mycourses_screen.dart:88-116; online/mycourses_item_online.dart:15-24; helpers/course_card.dart:4-90 |
| My Courses list (offline) | `MyCoursesScreen.offlineCourse` -> `MyCoursesItemOffline` | card tap `pushNamed('/mycourses-detail-offline')` | mycourses_screen.dart:118-148; offline/mycourses_item_offline.dart:15-22 |
| Online vs offline switch | Decided in `MyCoursesScreen.build` by connectivity | `connection ? onlineCourse : offlineCourse` | mycourses_screen.dart:70-86 |
| Course detail (online) | `MyCoursesDetailScreenOnline`: hero image, name, creator, days left, description, materials list | route `/mycourses-detail-online` (`routeName`), registered in main.dart:240 | online/mycourses_detail_screen_online.dart:10,60-145 |
| Course detail (offline) | `MyCoursesDetailScreenOffline`: same layout; materials loaded from SQLite via `fetchMaterials` | route `/mycourses-detail-offline` | offline/mycourses_detail_screen_offline.dart:10,121-149 |
| Apply / enroll in course by code | "Join Course" dialog in Settings tab (menu "Join Course" / "Promo Code"). "Promo Code" actually opens a feedback dialog (`_showFeedbackDialog`) and a dead `_showPromoCodeDialog` exists | Settings -> `_showJoinCoursePromoDialog` -> `_showJoinCourseDialog` -> `joinCourse` -> `Courses.applyCourse(courseCode)` | tabs/settings/settings_item.dart:29,126-150,264-310,313-340 |
| Material row (online) | `MyCoursesDetailItemOnline`: thumbnail, name, `Type`, `Status`, download or delete icon. Tap opens the material only if already downloaded, else snackbar "Please download material." | per type, see below | online/mycourses_detail_item_online.dart:58-318,1081-1088 |
| Material row (offline) | `MyCoursesDetailItemOffline`: no download/delete controls | per type | offline/mycourses_detail_item_offline.dart:38-217 |
| Video / rich media | `RichMediaScreen` (chewie + video_player, local file), feedback dialog (rating + comment) | `/mycourses-detail-richmedia` | detail/richmedia/richmedia_screen.dart:10-276 |
| PDF | `PDFScreen` (flutter_pdfview `PDFView`, local file, swipe horizontal) defined inside the item file (duplicated in online and offline item files) | `Navigator.push(MaterialPageRoute)` | online/mycourses_detail_item_online.dart:242-250,1091-1172; offline/mycourses_detail_item_offline.dart:169-177,249-330 |
| EPUB | **No viewer exists in the working tree.** Tap only flips the DB status to COMPLETED (`updateEpub`). Viewer code (`epub_view`, `vocsy_epub_viewer`) was commented out in HEAD and the two screen files are now deleted (staged `D`) and packages removed from pubspec | n/a | online/mycourses_detail_item_online.dart:190-215; offline/mycourses_detail_item_offline.dart:124-143; pubspec diff (git diff HEAD pubspec.yaml); HEAD epub_screen.dart/epub_screen2.dart (all commented) |
| Flashcards (type `CARD` and `UP_CARD`) | `FlashCardScreen`: question card -> ANSWER button -> EASY/MEDIUM/HARD self-rating | `/mycourses-detail-flashcard` | detail/flashcard/flashcard_screen.dart:11-649 |
| Quiz, legacy (type `QUIZ`, online only) | `QuizScreen`: one question at a time, single-choice, result summary + "Retake Quiz" | `/mycourses-detail-quiz` | detail/quiz/quiz_screen.dart:7-386; routed online/mycourses_detail_item_online.dart:158-173 |
| Quiz, new (type `UP_QUIZ`) | `NewQuizScreen` -> `NewQuizSectionItem` (per section, media header) -> `NewQuizQuestionItem` (multipleChoice / checkbox / text; media image/video/audio); Submit with confirm; back-guard with "answers will reset" | `/mycourses-detail-newquiz` | detail/quiz/new_quiz_screen.dart; new_quiz_section_item.dart; new_quiz_question_item.dart; routed online item :174-189 |
| Offline quiz routing | BOTH `QUIZ` and `UP_QUIZ` open `NewQuizScreen` (legacy `QuizScreen` is never used offline) | | offline/mycourses_detail_item_offline.dart:102-123 |
| Download / delete for offline | Confirm dialogs, progress dialog (`LinearProgressIndicator` + %), success/error dialogs | per material, online rows only | online item :322-595 (actions), :599-642 (download dialog), :690-724 (progress), :791-832 (delete dialog) |
| Empty / error / loading helpers | `EmptyStateView`, `ErrorRetryView`, `ShimmerList` (new, untracked files) | used in `MyCoursesScreen` | helpers/empty_state_view.dart:3-39; error_retry_view.dart:3-42; shimmer_list.dart:4-35; mycourses_screen.dart:92-113 |
| Other material types | None found. Server `materialType` values handled: `VIDEO`, `CARD`, `UP_CARD`, `QUIZ`, `UP_QUIZ`, `EPUB`, `PDF` (others silently ignored on tap). Forms exist elsewhere (`tabs/myforms`, `formDetails` tables) and are outside this analysis | | online item :59-64,69-257; db_helpers.dart:1078-1092 |

Routes registered in `main.dart:234-259`. Providers wired as `ChangeNotifierProxyProvider<Auth, X>` (token/userId/teamId injected) at main.dart:63-160.

Online detail uses `Course.materials` returned by the server list (not DB); offline detail rebuilds the list from five SQLite tables and relabels types (`UP_CARD`->`CARD`, `UP_QUIZ`->`QUIZ`) (providers/course/courses.dart:177-253).

---

## 2. HTTP endpoints

Transport: `package:http` for all JSON calls; `package:dio` ONLY for binary downloads (`Dio().download`). Base host: `ApiUrl.liveUrl = finalUrl = 'tala-v3-server.btsolve.com'` (constants/api_url.dart:2-3; dev/local hosts at :4-6 unused here). **Every call uses `Uri.http(...)` (plain HTTP, no scheme choice, no port)**; the `Uri.https` variants are commented out beside each call (e.g. courses.dart:48-51). Path prefixes: `getUser='/api/v1/auth/users/'`, `getTeams='/api/v1/auth/users/teams/'` (api_url.dart:10-11). `getTeams2='/api/v1/auth/admin/teams/'` and `applyCourse` constant are not used by the files in scope.

Auth for all JSON calls: `Authorization: Bearer <accessToken>`; POSTs add `Content-Type: application/json`. `refreshToken` is injected into every provider but never used (no 401 refresh). No other headers.

| # | Method | Full path (query) | Auth headers | Request body | Response fields consumed | file:line |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/v1/auth/users/{userId}/teams/{teamId}/courses` (no query) | Bearer | none | JSON array of assigns: `assignId,userId,teamId,dateFrom,dateTo,dateAssigned,assignedBy,courseId,updatedAt`; `course.{courseCode,courseName,courseDescription,courseThumbnailUrl,courseCreator,totalMaterial,sequential,instructor,tags,updatedAt,materialDetails[]}`; each material `{materialId,materialName,materialDescription,materialType,materialThumbnailUrl,materialUrl}`. Status code is never checked | providers/course/courses.dart:78-133 |
| 2 | POST | `/api/v1/auth/users/{userId}/teams/{teamId}/courses/apply` | Bearer + JSON | `{"courseCode": "<code>"}` | on 200 nothing read; on non-200 `message` -> `HttpException` | courses.dart:47-72 |
| 3 | GET | `/api/v1/auth/users/{userId}/teams/{teamId}/courses/{courseId}/sync/{assignId}/data` | Bearer | none | `materials.{videos,cards,quizzes,epubs,pdfs}[]` (previous progress/state, see section 3). Called first for every download; falls back to the per-material endpoints below when materials/array/item missing or `<fileUrl|thumbnailUrl> == null` or status != 200 | video: providers/richmedia/richmedia.dart:36-101; pdf: pdf/pdf.dart:33-92; epub: epub/epub.dart:33-88; card: flashcard/flashcards.dart:39-136; quiz: quiz/quizzes.dart:50-158 |
| 4 | GET | `/api/v1/auth/users/teams/{teamId}/videos/{videoId}` | Bearer | none | `videoId,videoName,videoDescription,videoThumbnailUrl,videoFileUrl,videoFileName,tags` | richmedia.dart:112-149 |
| 5 | GET | `/api/v1/auth/users/teams/{teamId}/pdf/{pdfId}` | Bearer | none | `pdfId,pdfName,pdfDescription,pdfThumbnailUrl,pdfFileUrl,pdfFileName,tags` | pdf.dart:102-136 |
| 6 | GET | `/api/v1/auth/users/teams/{teamId}/epubs/{epubId}` | Bearer | none | `epubId,epubName,epubDescription,epubThumbnailUrl,epubFileUrl,epubFileName,tags` | epub.dart:97-131 |
| 7 | GET | `/api/v1/auth/users/teams/{teamId}/upgraded_cards/{cardId}` | Bearer | none | `cardId,cardName,cardDescription,cardThumbnailUrl,tags,data[]{tags,question,answer,questionMediaType,questionMediaUploaded,answerMediaType,answerMediaUploaded}` | flashcards.dart:152-227 |
| 8 | GET | `/api/v1/auth/users/teams/{teamId}/up_quizzes/{quizId}` | Bearer | none | `quizId,quizName,quizDescription,quizThumbnailUrl,quizPercentage,tags,arraySection[]{sectionId,sectionTitle,sectionDescription,sectionMediaType,sectionMedia,pagePerSection,data[]{questionType,numQuestion,question,answer,choices,mediaType,mediaUploaded,required,tags}}` | quizzes.dart:164-293 |
| 9 | GET | `/api/v1/auth/users/teams/{teamId}/quizzes/{quizId}` (legacy quiz) | Bearer | none | `quizId,quizName,quizDescription,quizThumbnailUrl,quizPercentage,data[]{question,answer,choices,tags}` | quizzes.dart:295-384 |
| 10 | POST | `/api/v1/auth/users/{userId}/teams/{teamId}/courses/sync` (progress/score push; lives in the Stats provider, triggered from the My Stats screen sync button) | Bearer + JSON | `{"courseList":[CourseList...]}` (full shape in section 2.1) | on 200 nothing read except to update local `totalMaterialSynced`; else `message` | providers/mystats/stats.dart:497-505 (single course), :860-868 (all courses); trigger tabs/mystats/mystats_screen.dart:68-107 |
| 11 | GET | same as #1, a second copy in `Stats.getMyCourses` | Bearer | none | same | providers/mystats/stats.dart:57-65 |
| 12 | GET (binary) | whatever absolute URL is in `videoFileUrl`, `pdfFileUrl`, `epubFileUrl` (server-provided, not constructed by the app; the commented example in the code shows a CloudFront host `d5azi3tbd80jy.cloudfront.net/dev/api/v1/teams/.../videos/<name>.mp4`) | **none** (Dio called with no headers) | none | bytes saved to file | richmedia.dart:186-196; pdf.dart:169-179; epub.dart:164-174; sample URL online item :619-620 (comment) |
| 13 | GET (images) | `courseThumbnailUrl`, `materialThumbnailUrl`, `sectionMedia`, question `mediaUploaded` | none (`CachedNetworkImage` default) | | | helpers/course_card.dart:41-54; online item :266-279; quiz/new_quiz_section_item.dart:77-121; new_quiz_question_item.dart:91-104; flashcard_screen.dart:447-461 |
| 14 | GET (stream) | question/answer `mediaUploaded` for video (`VideoPlayerController.networkUrl`) and audio (`AudioPlayer.play(UrlSource)`) | none | | | flashcard_screen.dart:119-120,342-376,635; new_quiz_question_item.dart:51-52,342 |

Notes:
- Video file is NOT streamed from the server; it is always downloaded then played from disk (`VideoPlayerController.file`, richmedia_screen.dart:31-34). Only quiz/flashcard question media (video/audio) is streamed over the network.
- "Progress reporting back to the server": there is NO per-event reporting. Progress, completion, feedback (rating/comment), flashcard ratings, quiz answers and scores are accumulated in SQLite and pushed in one batch via #10 (only entries whose status is `COMPLETED` are sent: db `*ForMaterialsCompleted` queries, stats.dart:242,~290,~330,~430,~440). Download progress is only a local UI callback (`onReceiveProgress`, richmedia.dart:190-195).
- Download-progress UI: video/PDF/EPUB use `downloadProgress` ValueNotifier on the provider; flashcard/quiz use a throwaway notifier stuck at 0% (online item :374-398,420-443,485-509).

### 2.1 Sync push payload (POST #10), built client-side
`StatsSync{courseList}` -> `CourseList` keys (stats_sync.dart:62-81): `assignId,courseId,courseName,courseDescription,userId,teamId,lastName,firstName,middleName,dateFrom,dateTo,dateAssigned,assignedBy,email,status,progress,syncDate(always ''),courseTags,userTags,materials{videos,cards,quizzes,epubs,pdfs}`.
- `Videos`: `videoId,videoName,videoDescription,videoFileUrl,videoFileName,videoThumbnailUrl,status,feedback,comment,progress,tags` (stats_sync.dart:143-153).
- `Cards`: `cardId,cardName,cardDescription,cardThumbnailUrl,status,notseen,easy,medium,hard,progress,tags,data[]{tags,question,answer,questionMediaType,questionMediaUploaded,answerMediaType,answerMediaUploaded,result}` (:191-237; `result` is `NOT SEEN|EASY|MEDIUM|HARD`, stats.dart ~600).
- `Quizzes`: `quizId,quizName,quizDescription,quizThumbnailUrl,status,quizPercentage,correct,wrong,average,remarks(PASSED|FAILED),progress,tags,sections[]{sectionId,sectionTitle,sectionDescription,sectionMediaType,sectionMedia,pagePerSection,data[]{tags,numQuestion,questionType,question,answer,choices,mediaType,mediaUploaded,required,userAnswer,result}}` (:277-289,315-321,355-365).
- `EPubs`: `epubId,epubName,epubDescription,epubFileUrl,epubFileName,epubThumbnailUrl,status,progress,tags` (:397-405). `Pdfs`: analogous (:437-445).
- Course `status` = `NOT YET COMPLETED` if (count of completed materials) < `totalMaterial` else `COMPLETED`; `progress` = `"<done>/<totalMaterial>"` (stats.dart:466-480, :820-835). So the server receives the SCORE and per-question answers computed by the client; the server never scores.

---

## 3. Data models

All fields are Dart `String` (even numeric ones); SQLite columns are all `TEXT`. No `fromJson`; parsing is inline map access, so a JSON number where a String is assigned would throw a cast error (INFERRED: server returns strings).

**Course** (providers/course/course.dart:4-52): `assignUpdatedAt`(assign.updatedAt), `courseUpdatedAt`(course.updatedAt), `assignId,userId,teamId,dateFrom,dateTo,dateAssigned,assignedBy,courseId,courseCode,courseName,courseDescription,courseThumbnailUrl,courseCreator,totalMaterial,sequential,totalMaterialAnswered,totalMaterialSynced,instructor(default ''),tags, List<MaterialItem> materials`. Online parse: courses.dart:108-131 (`totalMaterialAnswered`/`totalMaterialSynced` hard-coded `'0'`). A course whose `course.materialDetails` is null is skipped entirely (courses.dart:94-96 returns inside forEach).

**MaterialItem** (providers/materials.dart:3-21): `materialId,materialName,materialDescription,materialType,materialStatus,materialThumbnailUrl,materialUrl`. Online `materialStatus` is hard-coded `'NOT STARTED'` (courses.dart:103); real status is read from SQLite per row (online item :834-989).

**Material type strings**: `VIDEO, CARD, UP_CARD, QUIZ, UP_QUIZ, EPUB, PDF` (compare online item :59-64; case-insensitive via `toUpperCase`). `UP_*` = "upgraded" cards/sections-based quiz. Display label maps `UP_CARD`->`CARD`, `UP_QUIZ`->`QUIZ` (:59-64).

**Status strings (local)**: `NOT STARTED`, `NOT YET COMPLETED` (video only, set on open), `COMPLETED`. Stored per material table.

**Video** (`richmediaDetails`, db_helpers.dart:205): `assignId,userId,teamId,courseId,videoId,videoName,videoDescription,videoThumbnailUrl,videoFileUrl,videoFileName(spaces stripped, UPPERCASE),videoStatus,totalMaterialAnswered('false'),feedback(rating string, default '0.0'),comment(default 'N/A'),tags`. From sync/data it also takes `status`, `feedback`, `comment` (richmedia.dart:67-85). Dart wrapper `RichMediaDetails` (richmedia.dart:240-272) is unused (INFERRED, no references in scope).
**PDF** (`pdfDetails`): `...,pdfId,pdfName,pdfDescription,pdfThumbnailUrl,pdfFileUrl,pdfFileName,pdfStatus,totalMaterialAnswered,tags` (pdf.dart:60-76).
**EPUB** (`epubDetails`): `...,epubId,epubName,epubDescription,epubThumbnailUrl,epubFileUrl,epubFileName,epubStatus,totalMaterialAnswered,tags` (epub.dart:60-76).
**Flashcard deck** (`flashcardDetails`, db_helpers.dart:578): `assignId,userId,teamId,courseId,cardId,cardName,cardDescription,cardThumbnailUrl,cardStatus,totalMaterialAnswered,tags`. **Card** (`flashcardData`, :583; model `FlashCardItem` flashcard.dart:15-48): `id`(client counter "1..N"),`assignId,userId,teamId,courseId,cardId,name(''),question,answer,questionMediaType,questionMediaUploaded,answerMediaType,answerMediaUploaded,tags,flaggedItem`. `flaggedItem` is `DEFAULT` (unseen) | `EASY` | `MEDIUM` | `HARD`; from sync/data it is taken from `card['result']` (flashcards.dart:99,116 - which means the server's `result` must use the same vocabulary, INFERRED; the push maps `DEFAULT`->`NOT SEEN`, so a restore of `NOT SEEN` would be treated as non-DEFAULT, see defects). Media types: `image|video|audio|''`.
**Quiz** (`quizDetails`, :791): `assignId,userId,teamId,courseId,quizId,quizName,quizDescription,quizThumbnailUrl,quizStatus,quizAverage(unused for display),quizPercentage(passing %),totalMaterialAnswered,tags`.
**QuizSection** (`quizSection`, :796; model quiz_section.dart:3-19): `id(client counter),assignId,userId,teamId,courseId,quizId,sectionId,sectionTitle,sectionDescription,sectionMediaType,sectionMedia,pagePerSection`.
**Quiz question** (`quizData`, :801; model `QuizItem` providers/quiz/quiz.dart:19-61): `id(client counter across all sections of a quiz),assignId,userId,teamId,courseId,quizId,sectionId,questionType,numQuestion,question,answer,choices,tags,mediaType,mediaUploaded,required,flaggedItem(DEFAULT|CORRECT|WRONG),userAnswer`. Question types seen in UI: `multipleChoice`, `checkbox`, anything else -> free text (new_quiz_question_item.dart:151,169,204). `choices` is a single string joined by `:`; `answer` format: single answer = option index as string (INFERRED from comparing index to `answer`, new_quiz_question_item.dart:159,245-258; legacy quiz_screen.dart:269); checkbox answer = `:`-joined indices (checkbox compares `checkedIndex.join(':')`, :271-279).
Unused duplicate models: `providers/quiz/newquiz.dart` (a second `Quiz`/`QuizItem` pair, with `tag`), `quiz_section_data.dart` imports unused packages (`http`, `quiz_section`).
`Materials` provider holds a static empty list `mat` and is never filled (materials.dart:23-33).
**Local SQLite**: `tala3.db`, version 3, no primary keys/unique indexes (db_helpers.dart:25-63,89,205,346,462,578,583,791,796,801).

---

## 4. Business rules

### 4.1 Who scores
The CLIENT scores everything. Each answer is compared locally and stored as `flaggedItem` CORRECT/WRONG; totals, percentage, and PASSED/FAILED are computed on the device and sent in the sync push (#10). Nothing is ever sent to the server at answer time. Server only supplies `answer` strings (so correct answers are shipped to the device in plain text via endpoints #3/#8/#9).

### 4.2 New quiz (`UP_QUIZ`) rules
- Layout: all sections and all questions on one scrolling page (`pagePerSection` stored but ignored) (new_quiz_screen.dart:98-158; no reference to `pagePerSection` in tabs).
- Each interaction scores immediately and writes to SQLite: radio (`userAnswer = index`, compare `trim+remove-all-whitespace+UPPERCASE` of index vs `answer`; new_quiz_question_item.dart:245-269); checkbox (indices joined `:`, compare via `areEquivalent`, which sorts characters of both strings; :271-319); text (case/whitespace-insensitive equality with `answer`; :227-243). Stored `userAnswer` is the option text (radio), `[a, b]` list-string (checkbox), or typed text.
- True/false and identification are not special types; INFERRED: true/false arrives as `multipleChoice`, identification as the text fallback.
- Submit: enabled always; re-reads DB and requires `correct+wrong == total` else snackbar "Please complete your answer." (new_quiz_screen.dart:164-203); confirm dialog; on Yes sets `quizStatus='COMPLETED'` and shows the result (:326-359,426-435). `required` flag is parsed and stored but never enforced.
- Result screen: `YOU GOT : xx.xx %`, `CORRECT`, `WRONG`, `TOTAL SCORE x/y` (:224-280). No pass/fail shown in-app and no passing mark enforced; `quizPercentage` is used only at sync to derive `remarks` (stats.dart:~392-401: `average >= int.parse(quizPercentage) ? PASSED : FAILED`).
- Retake: unlimited, local only, confirm dialog; resets every question to `DEFAULT/DEFAULT` and quiz status to `NOT STARTED` (quizzes.dart:462-476; new_quiz_screen.dart:308-324,361-391). Back during an unfinished quiz also resets answers after confirm (:393-424).
- Re-entry: if all questions already answered the result screen is shown immediately (:58-61).
- No timer anywhere (no `Timer`/countdown found in tabs/mycourses or providers/quiz). No question/choice randomisation (order = DB row order).
- Attempts counter: none. History: only the latest attempt is kept.

### 4.3 Legacy quiz (`QUIZ`, online only)
- One question per screen, single-choice list; `Next` requires a selection (quiz_screen.dart:281-296). Score per question vs `answer` (index string) with same whitespace/case normalisation (:144-166). After the last question sets status `COMPLETED` (:211-220), refetches and shows summary; resumes at position `correct+wrong` (:46-60). `Retake Quiz` immediately resets with no confirm (:364-380).

### 4.4 Flashcards
- Self-assessed: ANSWER reveals answer; then EASY/MEDIUM/HARD saves `flaggedItem` for that card and loads the next card (flashcard_screen.dart:339-342,516-621).
- Spaced-like selection: first serve all `DEFAULT` cards in random order (`getData`, :82-148). When none remain: card status set `COMPLETED` (:137, `updateFlashCardStatus` :390-399) and a bucket is chosen at random with `rand(0..9)`: HARD 60% (<=5), MEDIUM 30% (6-8), EASY 10% (9) (:69-80); empty bucket falls through HARD->MEDIUM->EASY->DEFAULT (:216-218,274-276,332-334). So cards are never "finished"; session loops forever. Zero-card deck would recurse infinitely (INFERRED, `getData`<->`getEasy`).
- Card media: `image` (CachedNetworkImage), `video` (Chewie, networkUrl, no autoplay), `audio` (play/pause icon via audioplayers) (:447-482).

### 4.5 Video and feedback (rating)
- Opening a not-completed video sets status `NOT YET COMPLETED` (online item :96,1032-1060; offline :65,219-228).
- A video becomes `COMPLETED` only when feedback is submitted (`updateRichMedia` sets `videoStatus='COMPLETED'`, `feedback`, `comment`; db_helpers.dart:268-291; screen submit richmedia_screen.dart:201-211).
- Back-navigation is blocked (`PopScope canPop:false`) until completed; if not completed a dialog "Feedback is required in order to complete this video" offers Cancel / Maybe Later (exit without completing) / Yes (open feedback) (richmedia_screen.dart:69-98,234-268). `Maybe Later` leaves the video incomplete.
- `flutter_rating_bar` is used ONLY here: `RatingBar.builder`, 5 stars, `allowHalfRating: true`, `minRating: 1`, `initialRating: 0` (richmedia_screen.dart:159-172). Rating stored as string e.g. `"3.5"`; Submit only acts if the comment field was edited (`comment != null`), so rating can remain `0.0` (:185-193). Feedback = rating + free-text comment; both sent in sync as `feedback`,`comment`.
- There is no playback-progress tracking, resume position or "watched %" requirement; completion is purely the feedback submission.

### 4.6 PDF / EPUB
Status set to `COMPLETED` the moment the item is opened (PDF before navigation, online item :241, offline :168; EPUB no viewer, :209/:140). No page tracking.

### 4.7 Course-level rules
- Course completion is computed ONLY at sync time from completed material counts vs `totalMaterial` (stats.dart:466-480). `totalMaterialAnswered`/`totalMaterialSynced` are local counters; `updateCourseSynced` stores number of completed items after a successful sync (db_helpers.dart:142-160; stats.dart:511-521).
- `sequential` (ordered progression) is parsed and stored but never enforced (only courses.dart:125,164,273,289-302 and online item :1021).
- `dateFrom` is displayed nowhere; `dateTo` is shown as "N Days" / "Days Left" using `AppConstants.daysBetween` (constants/app_constants.dart:45-48); negative values are shown as-is; there is no lock after expiry and no filtering of expired courses (INFERRED: server decides which assigns to list).
- Enrolment: `applyCourse` posts a course code; success text is "Application is successful! Please contact admin for faster approval." (settings_item.dart:303-306) -> server-side approval/assignment flow (INFERRED). No pending-state list, no refresh of the course list afterwards. Errors surface `message` from the response (courses.dart:64-68).
- `instructor`, `tags`, `courseCode` fetched but unused in the screens in scope (tags only pass through to sync).

---

## 5. Offline behaviour

- **Online/offline decision**: `connectivity_plus` `checkConnectivity()` + `onConnectivityChanged`; the app is "online" only if the result is exactly `wifi` or `mobile` (string comparison of `ConnectivityResult.toString()`); ethernet/vpn/other = offline; no reachability probe (mycourses_screen.dart:50-81). Offline mode renders from SQLite and never calls the network.
- **Material access model**: Even when online, a material can only be opened after the user downloads it (tap => snackbar "Please download material." if not in SQLite) (online item :121-123 etc.). The "online" list is simply the server catalogue; the DB is the only content source for playback.
- **What a download stores**
  - Video/PDF/EPUB: file via Dio into `getExternalStorageDirectory()` on Android, `getApplicationDocumentsDirectory()` on iOS (`!` null-forced), path `<dir>/<userId><materialId><FILENAME>` where FILENAME = server `*FileName` with whitespace removed and UPPERCASED; existing file deleted first (richmedia.dart:163-205; pdf.dart:150-188; epub.dart:145-183). Plus one row in `richmediaDetails`/`pdfDetails`/`epubDetails`.
  - Flashcards: rows only (`flashcardDetails` + `flashcardData`), NO media files are cached; question/answer images/audio/video remain network URLs, so flashcards with media do not work fully offline (flashcards.dart:66-117; flashcard_screen.dart:119,342).
  - Quizzes: rows only (`quizDetails`, `quizSection`, `quizData`); media remote (quizzes.dart:77-139). Thumbnails cached by `cached_network_image` disk cache.
  - Course: a `courseDetails` row inserted on first material download (`_insertCourse`), updated only when `courseUpdatedAt` changed (online item :991-1030). A course appears in the offline list only if at least one material was downloaded (`fetchAndSetCourse` reads `courseDetails`, courses.dart:142-175). Offline course rows carry `materials: []`; the offline detail screen calls `fetchMaterials` which queries the five tables for the course (courses.dart:177-253).
- **Local state**: statuses, flashcard ratings, quiz answers, feedback live only in SQLite until the user syncs from My Stats (POST #10).
- **Seeding progress from server**: each download first GETs `/sync/{assignId}/data` so previously synced progress is restored into the new rows (endpoints #3).
- **Delete**: trash icon -> confirm -> deletes DB rows only. Video/PDF/EPUB delete calls `DBHelper.delete*Details` and DOES NOT delete the downloaded file (richmedia.dart:231-237; pdf.dart:206-212; epub.dart:201-207; the only `File.delete()` calls are the pre-download cleanup). Flashcard delete removes both tables; legacy quiz delete (`deleteQuiz`) leaves `quizSection` rows, new quiz delete (`deleteQuizEnhanced`) removes all three (quizzes.dart:486-505). Account delete clears all tables (settings_item.dart:517; db_helpers.dart:1094-1102). Logout does not clear the DB (INFERRED: `deleteAllData` referenced only in settings_item.dart:490(comment),517). Data is keyed by `userId`+`teamId`, so multi-user on one device is partially isolated.
- **Offline screens**: course list (pull-to-refresh re-reads DB), course detail with read-only material rows (type + status), tap opens content (offline item :38-182). No download/delete controls offline. Legacy `QUIZ` downloaded via endpoint #9 has `sectionId=''` and no `quizSection` rows, so offline (which always opens `NewQuizScreen`) would show an empty quiz (INFERRED from quizzes.dart:356-375 and offline item :102-112).
- **DB mechanics**: `DBHelper.database()` reopens `tala3.db` on every call (db_helpers.dart:25-63); `insert` calls `db.insert` without `await` (db_helpers.dart:66-73), so the `await DBHelper.insert(...)` added in the working tree does not actually wait for commit. `conflictAlgorithm.replace` is ineffective because there are no PKs/unique keys, so repeated downloads without delete create duplicate rows (reads use the LAST row for detail screens: online item :92-94).

---

## 6. Media / native needs

| Need | Package (pubspec.yaml) | Use |
|---|---|---|
| Video playback (local file) | `video_player ^2.7.0` + `chewie ^1.7.0` | `VideoPlayerController.file`, autoplay, aspect ratio from video size (richmedia_screen.dart:31-48) |
| Video (remote, quiz/flashcard) | same | `VideoPlayerController.networkUrl`, `autoPlay:false`, 16:9, 350px box (new_quiz_question_item.dart:49-58; flashcard_screen.dart:117-126) |
| Audio (remote) | `audioplayers ^6.5.0` | play/pause toggle only, `UrlSource` (flashcard_screen.dart:628-640; new_quiz_question_item.dart:335-347) |
| PDF | `flutter_pdfview ^1.3.4` | native `PDFView` of a local path: horizontal swipe, pageFling/pageSnap, fitPolicy BOTH, error + loading overlay (online item :1117-1169). No bookmarks/zoom UI/page indicator/progress |
| EPUB | **none** (no `epub_view`/`vocsy_epub_viewer` in pubspec; code commented out in HEAD) | Files are downloaded but cannot be rendered in the current build. Earlier experiments: `epub_view` (pure-Dart renderer with TOC drawer) and `vocsy_epub_viewer` (native Folio/Readium-style, TTS, night mode) from deleted epub_screen.dart / epub_screen2.dart |
| File download | `dio ^5.4.1` | `Dio().download(url, path, deleteOnError:true, onReceiveProgress)` |
| JSON HTTP | `http ^1.2.0` | all other calls |
| Local DB | `sqflite ^2.2.2`, `path_provider ^2.0.15` | see section 5 |
| Connectivity | `connectivity_plus ^5.0.2` | online/offline switch |
| Images | `cached_network_image ^3.2.3` | thumbnails + question media; local `assets/images/course-placeholder.png`, `flashcard-question-answer.png` |
| Rating | `flutter_rating_bar ^4.0.1` | video feedback |
| Loading skeleton | `shimmer ^3.0.0` | course list |
| Permissions | `permission_handler ^11.3.0` present but the storage permission code is deleted (HEAD had commented `Permission.storage` check, git diff richmedia.dart) | Android manifest declares only `INTERNET` (android/app/src/main/AndroidManifest.xml:2). App-specific external dir needs no permission. |

File storage paths: Android `getExternalStorageDirectory()` (Android/data/<pkg>/files, removed on uninstall); iOS `Documents` (backed up by iCloud by default, INFERRED). Files are in the directory root, no subfolders.
React Native equivalents (suggested): react-native-video / expo-av, react-native-fs or expo-file-system (downloadAsync with progress callback), react-native-pdf, an EPUB reader (epubjs inside WebView or react-native-readium) if EPUB must really work, expo-sqlite / op-sqlite, @react-native-community/netinfo, react-native-ratings.

---

## 7. Security observations

(No secret values reproduced.)
1. **All API traffic is cleartext HTTP**: `Uri.http(host, path)` everywhere, the `Uri.https` lines are commented (courses.dart:48-51,76-79; richmedia.dart:112; all providers). Bearer tokens, course codes and quiz answers cross the network unencrypted. No Android `usesCleartextTraffic` or iOS ATS exception was found in the manifests (grep of android/ and ios/ for cleartext/ATS keys returned nothing), so on modern OS versions plain HTTP would normally be blocked: see UNKNOWNS (the live build presumably relies on something not visible, or a redirect).
2. **Media URLs are unauthenticated**: `videoFileUrl`/`pdfFileUrl`/`epubFileUrl` and question media URLs are fetched with no Authorization header (richmedia.dart:186-196, flashcard_screen.dart:119, new_quiz_question_item.dart:51), i.e. they are public/pre-signed URLs (the sample in a comment is a CloudFront host path including the team id and file name, online item :619-620). Anyone who has a URL can download the content. No signed-URL expiry handling.
3. **Correct answers are delivered to the client** in `answer`, and the client computes the score and pushes the result; a modified client can submit any score/PASSED status. Scores are not verified by the server (INFERRED: nothing in the client suggests re-validation).
4. **Plain-text local storage**: all downloaded content, quiz answers (`userAnswer`), correct answers, feedback and statuses in unencrypted SQLite `tala3.db`; media files in app dir (Android external-app dir is readable by users via USB). Auth tokens persisted in `SharedPreferences` JSON (providers/auth.dart:289-295,396-415, other analyst's area).
5. **Tokens in memory only in URLs**: tokens are in headers, not URLs (good). User/team ids are in URL paths (expected).
6. File names derived from server data are written into app dir without sanitising path separators (`<userId><id><FILENAME>`, richmedia.dart:173): a malicious `videoFileName` containing `../` could escape the folder (INFERRED risk; Dart `File` would honour it).
7. Unauthorised-state handling: no 401 handling in `getMyCourses` (no status check, `json.decode` cast to List); refresh token unused.
8. Debug aids: `printWrapped` of full sync JSON (includes names/email) in `getAllCourseforSync` (stats.dart:~850 and helper at the end of the file) - logs PII in debug builds.

---

## 8. Defects, dead code, UX issues, working-tree changes

### 8.1 Dead / backup / unused
- `tabs/mycourses/detail/quiz/new_quiz_backup.dart` (310 lines): unreferenced backup of `NewQuizQuestionItem` (older constructor `(course, materialId, sectionId)`), duplicate class name with `new_quiz_question_item.dart`; no imports anywhere (grep). Safe to ignore.
- `providers/quiz/newquiz.dart` (unused second `Quiz`/`QuizItem`), `providers/materials.dart` `Materials` provider (static empty list, never populated), `RichMediaDetails`/`PdfDetails`/`EpubDetails` wrapper classes, `FlashCard`/`Quiz` ChangeNotifier models (`quiz.dart:3-17`), unused `_refreshToken` everywhere, `QuizItem.get data => null` (quiz.dart:60), `Courses._dbMaterials`.
- Dead dialog `_showPromoCodeDialog` (settings_item.dart:313-340; "Promo Code" menu opens the feedback dialog instead, :146-149).
- EPUB: deleted screens (see 1), commented viewer code in online/offline item files.
- Large commented-out blocks throughout; 40+ commented `print`s; duplicated `PDFScreen` in two files.

### 8.2 Functional defects
1. EPUB cannot be read at all in the current tree; tapping an EPUB just marks it COMPLETED (online item :190-215), so users get completion credit for downloading. HEAD had no viewer either.
2. `DBHelper.insert` does not await the sqflite insert (db_helpers.dart:66-73); the working-tree `await DBHelper.insert(...)` additions are ineffective, so "download success" can be reported before rows exist. Legacy quiz download (`getMyCoursesQuiz`, quizzes.dart:316,356) and `getMyCoursesUpdatedQuiz` (:188,213,230) still call insert without `await` at the call site.
3. No PK/unique constraints: re-download (including via the error-dialog path that sets `_result = true`, online item :770-789) duplicates rows; flashcards would show duplicate cards.
4. Delete removes DB rows but leaves the media file on disk (storage leak, no way to reclaim).
5. `_showDownloadDialogError` sets `_result = true` (shows the item as downloaded after a failure), and every success/error helper calls `Navigator.pop()` blindly (online item :694,727,749,771).
6. Download progress for flashcards/quizzes is a never-updated 0% (throwaway `ValueNotifier`, online item :376,422,487); video/PDF/EPUB share one notifier per provider.
7. `richmedia_screen.dart:271-275`: `dispose` force-unwraps `_chewieController!` and `late _videoPlayerController` (crash if init failed or args null).
8. `new_quiz_question_item.dart:349-355` and `flashcard_screen.dart:642-648`: `dispose` calls `late` `_videoPlayerController`, `_chewieController` and `_audioPlayer` that are initialised only for matching media types -> `LateInitializationError` on dispose for any question without video/audio (INFERRED crash, appears on screen exit). In `flashcard_screen` video/audio controllers are re-created per card/answer without disposing the previous ones (leak).
9. Quiz answer race: `updateQuizItem` is not awaited before `nextQuestion` (quiz_screen.dart:284-286), and in new quiz the Submit re-reads DB right after async updates; last answer may be missed (score off by one). `quiz_screen.dart:116-117` marks COMPLETED before the last answer is stored.
10. Checkbox scoring uses character-sorted equality of `answer` vs `join(':')` (new_quiz_question_item.dart:278,313-319): false positives are possible (e.g. "1:10" vs "11:0"), and the `defaultAnswer` is only filled after a first interaction. Radio uses `selectedRadio[0]` and `selectedRadio`/`selectedCheckbox` sized by character count of the `choices` string, not option count (:43-48).
11. Text question: one TextField per `:`-segment of `choices` (itemCount = `choices.split(':').length`, :149); empty text still counts as answered once typed then cleared (flag WRONG); case/whitespace-insensitive matching only; no multiple acceptable answers.
12. Flashcard restore mismatch: push maps `DEFAULT` to `NOT SEEN` (stats.dart ~600); restore reads `result` into `flaggedItem` (flashcards.dart:99). A restored `NOT SEEN` would not equal `DEFAULT`, so those cards are skipped from the unseen pass (INFERRED, depends on server echo).
13. Legacy quiz offline: always opens the section-based `NewQuizScreen` (offline item :102-112) though legacy data has no sections.
14. `Stats.getAllCourseforSync` uses `forEach(async)` for flashcards (stats.dart:~588): JSON may be encoded before cards are loaded (race); EPUB sync entries use `pdf[...]` variables (`status: pdf['pdfStatus']`, `tags: pdf['tags']`, stats.dart:440-442, :795-797) so EPUB status/tags are wrong or null-crash.
15. `MyCoursesScreen` passes a new `FutureBuilder.future` created in `build` (mycourses_screen.dart:88-92,118-121): every rebuild/connectivity event re-fetches (network call per rebuild).
16. `getMyCourses` never checks the status code and ignores a non-array body (courses.dart:82-87); `course['course']['materialDetails']==null` silently drops the course (courses.dart:94-96).
17. EPUB from sync/data lacks the null-guard on `materials` that other types have (epub.dart:44 vs pdf.dart:44) -> NPE if `materials` is null (caught and rethrown as generic error).
18. Course `updateCourse` filters only `courseId` (db_helpers.dart:162-190) so it updates other users'/assigns' rows with the same course.
19. DB upgrade only adds `tags`/`instructor`/`status` columns (v3, db_helpers.dart:38-60) and references `richMediaDetails` casing (works, SQLite is case-insensitive).
20. Hard-coded Android `getExternalStorageDirectory()!` can be null on some devices (crash).

### 8.3 UX issues
Approvals/pending courses invisible after Apply; no course list refresh post-apply; days-left shown negative for expired courses; video exit requires feedback (can be bypassed via "Maybe Later" yet stays incomplete); no resume position for video/PDF; progress dialog uses fixed copy "Downloading" and 0% for cards/quizzes; hero image fixed 250px; title overlay uses fixed 300px width and 26px font (course_card.dart:57-77); flashcard has no "back to deck / stats" or completion state; quiz has no navigation between sections or unanswered indicator; offline detail shows no hint that cards/quiz media need network.

### 8.4 Uncommitted working tree vs HEAD (`git status`, `git diff HEAD --stat`)
Overall: 37 files changed, +1217/-1646. In my area the work is a UX/robustness refresh, not new features:
- **Download progress**: new `downloadProgress` `ValueNotifier` on RichMedia/Pdf/Epub and a progress dialog with `LinearProgressIndicator`+% replacing the spinner; Dio download now `deleteOnError`, resets progress, recreates file, rethrows with log (providers/{richmedia,pdf,epub}/*.dart, online item).
- **Awaiting inserts / fallbacks**: `await` added to all `DBHelper.insert` and fallback calls (`getMyCourses*`) so download completion actually follows persistence (flashcards/quizzes/pdf/epub/richmedia providers). Plus new guard `data != null && <thumbnail/file>Url != null` so a sync/data stub entry without payload falls back to the per-material endpoint.
- **EPUB removal**: `epub_screen.dart`, `epub_screen2.dart` deleted (staged), `epub_view`/`vocsy_epub_viewer` leftovers and EPUB-open code removed from the online item; pubspec comment cleanup.
- **New UI helpers** (untracked): `CourseCard`, `EmptyStateView`, `ErrorRetryView`, `ShimmerList` replace duplicated course card code in online/offline items (-172 lines each) and inline shimmer; `MyCoursesScreen` gains error+retry/empty states.
- **Tooltips** for download/delete and audio buttons; typo fix "answers will reset"; removal of debug prints and `printWrapped`.
- Outside scope but in same diff: app label renamed "Tala LMS" -> "Lodestar LMS" (AndroidManifest/Info.plist), version 1.0.18+18 -> 1.0.22+22, iOS scene-delegate manifest, new `assets/images/tala_main_icon2.png`, many screens/settings/auth/stats files (login, registration, forgot, home, mystats, myforms, settings) - rebranding/UX pass.
Untracked/unstaged: `lib/helpers/{course_card,empty_state_view,error_retry_view,shimmer_list}.dart`, `assets/images/tala_main_icon2.png`.

---

## 9. UNKNOWNS and questions for the backend owner

1. Why is cleartext HTTP used for production host `tala-v3-server.btsolve.com` with no Android/iOS cleartext exemption in the manifests? Is there a redirect/TLS terminator, and should the RN app use HTTPS?
2. Exact response schemas: are `totalMaterial`, `sequential`, `quizPercentage`, `numQuestion`, `required`, `pagePerSection` strings or numbers? What do `sequential` and `required` mean and should the client enforce them?
3. Enumerations: full set of `materialType`, `questionType` (is true/false its own type? identification? "essay"?), `mediaType`, `status`, and `result` values; and the exact `answer` encoding for each question type (index vs text; checkbox separator and order).
4. Does `/sync/{assignId}/data` return `status`, `average`/`result` values with the vocabulary the client expects (`DEFAULT`/`NOT SEEN`)? Is the `<field> != null` heuristic (thumbnailUrl) the intended "has progress" marker?
5. What server rules apply to the POST `/courses/sync`: is the quiz score/PASS recalculated server-side, are retakes/overwrites allowed, is partial sync idempotent, and what happens to materials not COMPLETED?
6. Enrolment: what does `courses/apply` do (immediate assign vs pending approval), what are the error messages/codes, and how is expiry (`dateFrom`/`dateTo`) and "sequential" enforced server-side? What is the Promo Code feature (the menu entry opens feedback)?
7. Media delivery: are `*FileUrl` and `mediaUploaded` URLs public or time-limited signed? Are range requests supported (for streaming in RN)? Max file sizes? Could EPUB be rendered server-side?
8. Should EPUB be supported in the rebuild (no working viewer exists, completion is awarded on open)? Preferred reader and completion criterion?
9. Token lifecycle: is there a refresh-token endpoint (client stores a refresh token but never uses it)?
10. Required offline guarantees: should flashcard/quiz media be downloaded for offline use (currently remote-only)? Should logout wipe local content? What should happen to the `totalMaterialAnswered`/`totalMaterialSynced` fields?
11. Legacy quiz (`QUIZ`) vs `UP_QUIZ`: is the legacy type still produced by the server, and can legacy data be migrated? Is `quizAverage` supposed to be shown?
12. Is a passing mark (`quizPercentage`) meant to gate course completion or just be reported? Is a quiz timer, attempt limit, or randomisation planned (none exist today)?
