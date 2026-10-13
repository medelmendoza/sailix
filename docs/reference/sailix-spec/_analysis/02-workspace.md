# 02 - Workspace tabs analysis (Dashboard, Files/Documents, Announcements, To-do, Tasks, Scanner)

Source (read-only): /Users/btsolve/development/claude/sailix/lib. Paths below are relative to `lib/`. App id `sailix2`. Navigation container = `tabs/tab_screen.dart` (owned by another area), 4 bottom tabs: Dashboard(0), Files(1)=DocumentsScreen, Announcement(2)=AnnouncementsScreen, Finance(3). Tab switching via GetX `NavigationController.changeTab(i)` (tab_screen.dart:309-325). All providers are `ChangeNotifierProxyProvider<Auth, X>` rebuilt on Auth change, carrying previous list (main.dart:79-260).

## 0. Global API facts (apply to every provider here)
- Host: `ApiUrl.liveUrl = 'sailix.btsolve.com'` (constants/api_url.dart:2), always HTTPS via `Uri.https(host, path)`. `localUrl 192.168.3.76:5000` unused. `env = 'dev'` is baked into paths: `/sfai-sailix-api-dev/public/api/...`.
- **NO Authorization header, NO bearer token on any call in this area.** `_accessToken/_refreshToken` are held but never used. Identity is in the URL path (`userId`, `crewId`). No 401 handling, no token refresh, no timeouts, no retry. (Security issue, see section 7.)
- Only the todo PATCH sends custom headers: `X-User-ID`, `X-User-Name`, `X-User-Type: USER`, `X-Client-Code: SFAI`, `Content-Type: application/json` (todolists.dart:71-78).
- Error handling pattern: `try { ... } catch (e) { rethrow; }`; UI swallows or shows generic `AppConstants.errorMessage` ("We're sorry, something went wrong on our end. Please contact our support team or update your app to continue using all features.", app_constants.dart:11). `HttpException(responseData['message'])` thrown only for non-200 on PUT/PATCH.
- Response status is never checked on GETs (except getPlDocuments); a non-JSON/error body causes a JSON decode/type exception -> generic error/empty.
- Auth values used: `userId` (e.g. `usr...`), `crewId`, `userName`, `teamId`, `firstName` (providers/auth.dart:14-73,194-196). Persisted by Auth (SharedPreferences key set at auth.dart:274-305, outside my area).

### API path constants (constants/api_url.dart)
| Const | Value (after host) | Used by |
|---|---|---|
| getDashboards | `sfai-sailix-api-dev/public/api/user/dashboard/` | Dashboards.getDashboards (+`combined/{userId}`) |
| getAnnouncements | `sfai-sailix-api-dev/public/api/announcement/user/` | Announcements.getAnnouncementsAll (+`{userId}`) |
| updateAnnouncements | `sfai-sailix-api-dev/public/api/user/` | PUT `{userId}/notification/{notificationId}` |
| getToDoLists | `sfai-sailix-api-dev/public/api/user/todolist/` | GET + `{userId}` |
| patchToDoLists | `sfai-sailix-api-dev/public/api/user/` | PATCH `{userId}/todolist/{todoId}` |
| getDocuments | `sfai-sailix-api-dev/public/api/listCrewDocument/` | GET + `{crewId}` |
| getPlDocuments | `/sfai-sailix-api-dev/public/api/pldocument` | GET document-type master list |
| getPendings | `sfai-sailix-api-dev/public/api/user/` | GET `{crewId}/documents/pending` |
| (hard-coded, NOT using env) | `/sfai-sailix-api/public/api/user/document/upload` | POST upload |
| (hard-coded) | `/sfai-sailix-api/public/api/user/{crewId}/documents/pending/{crewdocID}` | POST + `_method=PUT` update |
| (hard-coded, tasks) | `/crewfacingapi/public/api/task/usr83f7583766e9a7bfa` | GET tasks (dead feature) |

Note: upload/update use `/sfai-sailix-api/` (no `-dev`) while everything else uses `-dev` -> environment inconsistency (documents.dart:103-104,146).

---
## 1. Screens

### 1.1 Dashboard (tabs/dashboard/dashboard.dart) - tab index 0
- Route: no named route; is `NavigationController.screens[0]`.
- Layout (SingleChildScrollView, column): 
  1. Gradient header (blue->green, rounded bottom 20) "Welcome," + `Auth.firstName` bold 28 white (dashboard.dart:150-185). `firstName as String` will crash if null.
  2. "First card": 3 circular icon buttons in a row (:202-242, :330-358): "Upload\nDocuments" (upload_file_rounded), "Request\nAppointment" (calendar_today), "View\nFinances" (monetization_on). onTap logic checks `label.contains('Documents')` -> `changeTab(1)`; `contains('Finances')` -> `changeTab(3)`; **"Request Appointment" does nothing** (stub). "Upload Documents" only navigates to Files tab (doesn't open upload dialog).
  3. Second card row (:244-302): "To-do List" (checklist_rounded) -> `Navigator.pushNamed('/todolist')`; "Documents" (folder_copy_rounded) -> `changeTab(1)`.
  4. Announcements card (:304-327): title "Announcements" + bell icon (tap -> `changeTab(2)`), green divider, list.
- Announcements widget: `FutureBuilder` calling `Dashboards.getDashboards()` **inside build()** (re-fires on every rebuild) (:382-416). Waiting -> shimmer (grey/white, items = existing announcements count or 6, each 80px card; box height min(n*100,300)). Loaded -> `RefreshIndicator` (pull-to-refresh calls getDashboards) wrapping `Consumer<Dashboards>`; empty -> centered "No data found..."; else fixed-height (<=300px) scrollable list of `DashboardAnnouncementsItem`. Error: FutureBuilder error is ignored -> shows the (empty) "No data found...". Note the RefreshIndicator wraps an empty `Center` (not scrollable), so pull-to-refresh won't work when empty.
- Dashboard announcement item (dashboard_announcements_item.dart): Card; unread (`isViewed=='N'`) = bold title + small dark dot trailing; read = normal title. Subtitle: description (1-line ellipsis? no maxLines set, just ellipsis) + relative age: `calculateDaysLapsed(created_at)` (parse `yyyy-MM-dd HH:mm:ss`, `now.difference.inDays`); `>0` -> "`{n}d ago`", else **"Yesterday"** (bug: 0 days shows "Yesterday"; should be "Today"). Tap: push `/announcements-details` with `AnnouncementsArguments(announcement)`; then if `isViewed=='N'` calls `Announcements.updateAnnouncements(notificationID)` (errors swallowed) and sets local `isViewed='Y'` regardless of success.
- iOS App Tracking Transparency (:35-77): on iOS initState `_checkATT()`: SharedPreferences bool `attAsked`; if not asked and status notDetermined -> dialog "Help Us Improve" ("We'd like to show you relevant content and offers. To do this, we need permission to track your activity.") buttons "No, thanks"/"Continue" (both just close), then calls `requestTrackingAuthorization()` regardless; sets `attAsked=true`. (Both buttons lead to the system prompt - misleading.)
- Tutorial coach marks (`tutorial_coach_mark`): `_showTutorial` defined (:79-114) with 5 targets (name: "This is your name."; first card: "These are the primary functions of the app."; to-do: "Find the task list given to you by your agency here"; documents: "You can find your documents/certificates through this button."; announcements card: "Get notified on the latest announcements from your manning agency."), SKIP text, shadow black 0.8 -- but the call is **commented out** (:38) => tutorial never shows. Targets list also accumulates duplicates if invoked twice.
- `MenuItem`, `MenuGridItem` classes (:462-513) are dead code (hard-coded '9 Expired' subtitle). `dashboard/backup.dart` is a dead duplicate `DashboardScreen` with static counts "New Tasks 2 / Expired Documents 3 / Expiring Documents 5" (do not port).
- Provider fields `expiredCount` is parsed but **never displayed** in the live dashboard.

### 1.2 Announcements list (tabs/announcements/announcements_screen.dart) - tab index 2
- Same FutureBuilder-in-build pattern calling `Announcements.getAnnouncementsAll()`. Shimmer: 6 cards of 120px. Loaded: RefreshIndicator + Consumer; empty "No data found..."; else ListView of `AnnouncementsItem`.
- `AnnouncementsItem` (announcements_item.dart) is an exact duplicate of the dashboard item (elevation 4 vs none); same unread/read logic, same tap behavior, same `calculateDaysLapsed`.
- No search/filter/sort/pagination (server order preserved).

### 1.3 Announcement details (tabs/announcements/details/announcements_details_screen.dart)
- Route `/announcements-details`, arg `AnnouncementsArguments{announcement}`. AppBar "Announcements". Looks up the announcement by `announceID` in the **`Announcements` provider** via `findById` (firstWhere w/o orElse -> throws StateError if opened from Dashboard before the Announcements provider has loaded; dashboard uses a separate `Dashboards` list. Real bug.)
- Content card: title (normal weight), description, then:
  - if `fileType == 'pdf'`: blue underlined "View attachment" -> pushes `PDFScreen(url: location, pdfName: title)`. (Tap handler is on the GestureDetector outside Visibility; invisible when not pdf.)
  - if `fileType == 'jpg' || 'png'`: `CachedNetworkImage(location)` 250px high, full width, cover, radius 15, placeholder asset `assets/images/course-placeholder.png`, error icon. (jpeg/gif etc. not handled.)
- PDFScreen (:128-186): `easy_pdf_viewer` `PDFDocument.fromURL(url, cacheManager: CacheManager(Config('customCacheKey', stalePeriod: 0 days)))` -> spinner while loading; success `PDFViewer(lazyLoad:false, zoomSteps:1, vertical)`; failure "Failed to load PDF". AppBar title = pdf name. **Identical `PDFScreen` is copy-pasted 3 times** (announcements details, documents_item.dart:140-199, pending_details.dart:111-181). RN: one shared PDF viewer, with cache disabled (always refetch).

### 1.4 Files tab - Documents screen (tabs/documents/documents_screen.dart) - tab index 1
- Stateful, TabController(2): top TabBar "Documents" | "Pending" (black selected, grey unselected, blue indicator). FAB extended "Add" (upload_file_rounded, blue) -> upload flow.
- Data: initState `_loadData()` sequentially loads `getDocumentsAll()` then `getPendingsAll()` (not parallel). Separate `_isLoadingDocs`/`_isLoadingPendings` flags; errors silently set loading=false (no error UI, empty state shown). Local copies `_documents/_pendings` snapshot provider lists (so are stale until refresh; they are NOT refreshed after upload/update succeed - **after "Document added successfully" the list does not refresh** until pull-to-refresh).
- Each tab: shimmer (6x120px) while loading; RefreshIndicator -> reload; empty -> "No data found..."; else ListView.
- Documents list item `DocumentsItem` (documents_item.dart): Card colored by `remarks`: `=='Expired'` red[50]; `contains('Expiring')` orange[50]; else green[50]. If `remarks != 'None'`: pill badge with `remarks.toUpperCase()` white bold on red/orange/green. Shows `document_typename` (bold), then "Name: {crewDocumentName}" (bold), "Doc. Number : {crewDocumentNo}", "Date Issued : {crewDocumentIssue}", "Expiration : {crewDocumentExpiration}" (raw API strings, no formatting). Tap -> PDFScreen(url, crewDocumentName). Edit trailing button commented out. Remark values seen: 'Expired', 'Expiring ...' (e.g. "Expiring in 3 months" per comment), 'None' (server-computed; client doesn't compute).
- Pending list item `PendingsItem` (pendings_item.dart): Card color by `approval_status`: `=='Rejected'` red[50]; `contains('Pending')` orange[50]; else green[50] (i.e. approved). Badge with status uppercase. "Name : {document_name}", doc number, issued, expiration. Trailing edit_document icon -> Update dialog. Card tap -> `/pending-details` with `PendingsArguments(pending)`. **Edit icon is available for every status including Approved** (no gating on status).
- **Upload Document flow** (FAB "Add"): 
  1. `_showDocumentsLoading`: shows non-dismissible-by-code progress AlertDialog ("Documents" / "Please wait..." spinner; barrier dismissible by default) then `Documents.getPlDocuments()` (GET `/sfai-sailix-api-dev/public/api/pldocument`, parses list of `{docID, document_name}`) then `_showUploadDocument()` pops the progress dialog and opens form dialog. On error: `_showDialog` pops the current dialog then shows "An error occured" with generic message + "Okay" (typo "occured").
  2. AlertDialog "Upload Document" with Form fields (all required, validator message `AppConstants.fillOutRequired` = "Please fill out required fields."):
     | Field | Widget | Notes |
     |---|---|---|
     | Documents | DropdownSearch<String> with search box, label "Documents", rounded 20 | items = document_name list; on change maps index -> docID/documentName |
     | Document Number | text | required |
     | Grade | text | required (even for docs without grade) |
     | Location | text | required |
     | School | text | required |
     | Date Issued | readonly, date picker (1950..today), format `yyyy-MM-dd` | required |
     | Date Expiry | readonly, date picker (1950..year 3000), `yyyy-MM-dd` | required (no expiry <-> none; no check expiry > issued) |
     | Attach Document | readonly text showing filename; suffix icons: folder-upload (file picker, **PDF only**) and document_scanner (ML Kit scan) | required; tapping the field when a scanned PDF exists opens it via OpenFilex |
  3. Buttons Cancel / Submit (Submit shows a CircularProgressIndicator while `_isSubmitting`). On valid: save -> `_uploadFile` -> `Documents.uploadDocument` -> then **always** clears controllers and shows "Success"/"Document added successfully." dialog even when upload failed (the provider only `print`s on non-200 and never throws; `_uploadFile` try/catch can't see failure). Also note `_showDialog` pops the context first (closing the form dialog). `_selectedItem` and `_documentsData` aren't reset between uses (stale docId possible); text fields have no controllers so reopened form is empty but `_documentsData` retains prior values.
  4. Scan flow (`_scanDocument`, :470-508): `google_mlkit_document_scanner` `DocumentScannerOptions(mode: ScannerMode.full, pageLimit: 5, isGalleryImport: true, documentFormat: DocumentFormat.pdf)`; `scanner.scanDocument()`; if `result.pdf != null` -> `_selectedFile = File(pdf.uri)`, text = basename; else if images returned -> stores `_imagePaths` and clears the field (no PDF built - images path is a dead end); `scanner.close()`. Errors -> SnackBar "Scan failed: $e" (shown behind dialog). `_viewPdf` -> `OpenFilex.open(path)` (external viewer).
  5. File picker flow (`_uploadDocument`, :565-595): `FilePicker.pickFiles(type: custom, allowedExtensions:['pdf'])`; copies picked file into app dir (`getExternalStorageDirectory()` on Android, `getApplicationDocumentsDirectory()` on iOS) under original basename (collision overwrites; no size limit check); sets `_selectedFile` and field text to picked name. 
- Update (edit) pending flow (`PendingsItem._showUploadDocument`): same progress-> dialog pattern titled "Update Document"; fields prefilled from the Pending (docID/name preselected, doc number, grade, location, school, dates, file name). Differences: date fields and file field have **no validators** (file optional visually, but `_selectedFile` is pre-seeded as `File(appDir/app_file_name)` - a path that likely doesn't exist locally -> `MultipartFile.fromPath` throws if the user doesn't pick a new file -> caught by generic handler -> error dialog, but then "Success" dialog also shows). Upload field is picker-only (no scan). Same always-success dialog bug. `didChangeDependencies` is `async` and force-unwraps `selectedDocId!/selectedDocName!` (crash if docID/name empty) (:61-82).
- Provider `Pendings` list isn't refreshed after update.

### 1.5 Pending details (tabs/documents/pending_details/pending_details.dart)
- Route `/pending-details`, arg `PendingsArguments{pending}`; looks up `Pendings.findById(crewdocID)`. AppBar title = `approval_status`. Card: "Name: {document_name}", doc number, issued, expiration; if `approval_status == 'Rejected'` shows "Reason/s for rejection :" + italic `remarks` (note: uses `remarks`, not `rejection_reason`; both parsed). Blue underlined "View attachment" -> PDFScreen(file_url, document_name) (always visible, even when file_url empty/null -> crash on `file_url` null, see model). No approve/sign/reject actions exist in the crew app: **pending items are crew-submitted documents awaiting agency approval; crew can only view/re-submit.**

### 1.6 To-do List (tabs/todolist/todolist_screen.dart + todolist_item.dart)
- Route `/todolist` (pushed from Dashboard). AppBar "To-do List". FutureBuilder-in-build -> `Todolists.getToDoListsAll()`. Shimmer 6x120. RefreshIndicator. Empty "No data found...". Else ListView with a header row (index 0, red[50] card: "Task Name" ... "Due Date", fake blank leading icon) followed by items.
- Item: Card with leading Checkbox (`is_done == 'Y'`), title `todo_description`, trailing column: raw `todo_due_date` (bold) and "`{n} Days Left`" where n = `daysBetween(today, DateTime.parse(due))` (rounded hours/24 on date-only values; negative when overdue -> shows e.g. "-3 Days Left"; `DateTime.parse` throws on null/invalid -> red error widget).
- Toggle: on change -> PATCH `is_done` 'Y'/'N' (errors swallowed) -> **local state updated regardless of success** (optimistic w/o rollback). Not time-stamped; no done-date. Item `isViewed` field present but never updated. No add/delete/edit from the app (tasks are assigned by agency; creatorID != userID).
- No sorting, no filter of `is_inactive`.

### 1.7 Tasks (tabs/tasks/tasks_screen.dart, tasks_item.dart, providers/tasks) - **UNUSED / DEAD**
- `TasksScreen` is not registered in routes nor in tabs (grep: only self-references). Provider `Tasks` is registered in main.dart:249 but never consumed. Hard-coded user id `usr83f7583766e9a7bfa` in the URL (tasks.dart:31-32) and an unrelated API root `/crewfacingapi/`. `getTasksAll` doesn't call notifyListeners. A commented-out UI shows segmented filters On-Going{New Assignment, For Approval, On-Going} / Closed{Completed, Rejected} with fake data (`_data` map) -> hints at intended task statuses, but UNKNOWN whether backend supports it. Item renders priority (red label), type, Creator, due date; onTap no-op. Recommendation: do not port in v1 (or stub behind a flag).

### 1.8 Scanner demo pages (providers/scanner/scanner.dart, scanner2.dart) - **UNUSED**
- `DocumentScannerPage` (flutter_doc_scanner `getScanDocuments(page:5)`; result List<String> images -> shows list; "Save & View PDF" builds PDF using `pdf` package `pw.Document`, one `pw.Page` per image centered, saves `scanned_{epoch}.pdf` in app documents dir, SnackBar "PDF saved at: ...", `OpenFilex.open`) and `DocumentScannerPage2` (ML Kit as in upload flow, shows path). Only an `import` of scanner.dart in main.dart:19; neither is routed. The actually used scanner = ML Kit inside DocumentsScreen. Useful reference for the "images -> PDF" fallback logic (RN: ML Kit on Android/VisionKit on iOS gives PDF directly; fallback build PDF from images).

---
## 2. Providers - API detail

### 2.1 Dashboards (providers/dashboard/dashboards.dart)
State: `_expiredCount: String?`, `_announcementResult: List<Announcement>`; getters `expiredCount` (force-unwrap), `announcements` (copy), `findById`.
| Method | Request | Response parsed | Notifies |
|---|---|---|---|
| getDashboards | GET `https://sailix.btsolve.com/sfai-sailix-api-dev/public/api/user/dashboard/combined/{userId}` no headers | JSON object: `announcementResult[]` (Announcement model below) and `crewDocCountResult.expired` (-> string via toString). Also commented references: `crewDocCountResult.{expired,expiring,normal}`, `notificationResult.countNotification` (models `DashboardDocs{expired,expiring,normal}`, `DashboardNotifs{userID,countNotification}` exist but unused). | yes after success; null body returns early |
| updateAnnouncements(notificationId) | PUT `.../api/user/{userId}/notification/{notificationId}` headers `Content-Type: application/json`, body `{"isViewed":"Y"}` | body must be JSON with `message` on error; status 200 required else `HttpException(message)` | yes (200) |
Note: dashboard item calls the **Announcements** provider's identical update, not Dashboards' one, so the Dashboards list isn't updated (only the in-memory object's isViewed mutated; shared object instance? No - separately parsed lists -> the Announcements tab list will still show "unread" until refetch... Actually mutation happens on the object tapped; each tab has its own objects).

### 2.2 Announcements (providers/announcements/announcements.dart)
- `getAnnouncementsAll`: GET `.../api/announcement/user/{userId}` -> JSON array. Each: `announceID, notificationID, title, description, creatorID, filename(?? ''), fileType(?? ''), location(?? ''), date_expired(?? ''), is_inactive, created_at, updated_at, isViewed`. Null array returns silently. Non-nullable `String` casts for title/description/creatorID/is_inactive/created_at/updated_at/isViewed (isViewed nullable in model) -> a null in JSON throws a type error -> whole load fails.
- `updateAnnouncements`: same as above. `findById` unguarded firstWhere.
- No filtering by `is_inactive` or `date_expired` client-side (UNKNOWN if the server filters).

### 2.3 Documents (providers/documents/documents.dart)
State: `_documents`, `_docIds`, `_docNames` (parallel lists for dropdown).
- `getPlDocuments`: GET `/sfai-sailix-api-dev/public/api/pldocument` -> array of `{docID, document_name}`; fills parallel lists only if 200; **does NOT call notifyListeners**; resets lists first. No auth.
- `getDocumentsAll`: GET `.../api/listCrewDocument/{crewId}` -> array. Fields below in Document model; required casts without null-safety for `crewDocumentName, crewShortDocumentName, crewDocumentNo, crewDocumentIssue, crewDocumentExpiration, grade, location, school, remarks, url` (any null crashes the whole list). `crewDocumentTypeID/document_typename/type` default ''.
- `uploadDocument(File, Map)`: multipart POST `https://sailix.btsolve.com/sfai-sailix-api/public/api/user/document/upload` (no -dev). Parts: file field `file` (path), fields: `crewID`=crewId, `docID`, `doc_number`, `grade`, `location`, `school`, `date_issued` (yyyy-MM-dd), `date_expired` (yyyy-MM-dd), `app_file_name` (display filename), `uploaded_by`=crewId. Status 200 => prints success; else prints failure; **no exception, no notify, no response body parsing**.
- `updateDocument(File, Map)`: multipart POST (Laravel method spoofing `_method=PUT`) to `https://sailix.btsolve.com/sfai-sailix-api/public/api/user/{crewId}/documents/pending/{crewdocID}`. Fields: `_method=PUT`, `docID`, `doc_number`, `grade`, `location`, `school`, `date_issued`, `date_expired`, `app_file_name`; `file` part. 200 -> notifyListeners; else silent.
- Uploaded doc naming: client sends original filename as `app_file_name`; server stores file and returns `file_url`/`url`.

### 2.4 Pendings (providers/pendings/pendings.dart)
- `getPendingsAll`: GET `.../api/user/{crewId}/documents/pending` -> JSON object with `data[]` (null `data` returns silently). Item fields in Pending model. Casting: required non-null for crewdocID, crewID, docID, doc_number, location, school, date_issued, date_expired, approval_status, is_checking, is_rejected, last_name, first_name, document_name, document_shortname, file_url; defaults '' for grade, file_type, app_file_name, approved_by, rejection_reason, remarks, is_inactive. notifyListeners on success. `findById(crewdocID)` unguarded.
- No approve/sign/reject API anywhere (crew-side read + resubmit only). Flags `is_checking`, `is_rejected`, `is_inactive`, `approved_by` parsed but unused in UI; UI keys only on `approval_status` string.

### 2.5 Todolists (providers/todolist/todolists.dart)
- `getToDoListsAll`: GET `.../api/user/todolist/{userId}` -> object `{data:[...]}`; fields in Todolist model; all non-null casts (`status` too).
- `updateToDoLists(todoId, isDone)`: PATCH `.../api/user/{userId}/todolist/{todoId}` with headers listed in section 0, body `{"is_done":"Y"|"N"}`; 200 -> notify; else `HttpException(message)`.

### 2.6 Tasks (providers/tasks/tasks.dart) - dead; GET `/crewfacingapi/public/api/task/usr83f7583766e9a7bfa` -> array of Task (fields below). No notify.

---
## 3. Document handling summary (RN implementation guidance)
| Capability | Flutter lib | Where | RN equivalent suggestion |
|---|---|---|---|
| PDF viewing from URL | easy_pdf_viewer (`PDFDocument.fromURL`, cache stale 0d) | all 3 PDFScreens | react-native-pdf (or WebView/Quick Look); always refetch; loading/failed states |
| Image attachment view | cached_network_image | announcement details | FastImage / expo-image |
| Pick PDF | file_picker 9 (pdf only) | documents_screen, pendings_item | react-native-document-picker / expo-document-picker, type application/pdf |
| Scan to PDF | google_mlkit_document_scanner 0.4 (FULL mode, 5 pages, gallery import, PDF output) | documents_screen (live); flutter_doc_scanner & pdf pkg only in unused demo | react-native-document-scanner-plugin or ML Kit/VisionKit native module; output PDF; max 5 pages |
| Open external | open_filex | preview of scanned PDF | react-native-file-viewer / Linking / share sheet |
| PDF generation | `pdf` (pw.Document) | unused demo only | only if scanner returns images (react-native-pdf-lib / expo-print) |
| Local copy | path_provider | copy picked file to app dir | RNFS / expo-file-system (copy into document dir) |
| Download | none (no download-to-device feature) | | |
| Permissions | Android manifest: INTERNET, CAMERA, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE; iOS NSCameraUsageDescription (Info.plist:33) + ATT | | add equivalents; no explicit runtime permission code in app (scanner handles camera) |

Pending workflow (business): Crew uploads document (+PDF) -> server creates a *pending* record (`approval_status` e.g. "Pending ..."), agency staff checks (`is_checking`) and approves (-> appears in Documents list with remarks) or rejects (`is_rejected`, `approval_status=='Rejected'`, `remarks`/`rejection_reason` explains). Crew can edit/resubmit via PUT on `/documents/pending/{crewdocID}`. Exact status enum UNKNOWN beyond 'Rejected' and strings containing 'Pending'; anything else is treated as Approved (green).

---
## 4. Business rules (plain language)
- Document card colour/badge: remarks 'Expired' = red; remarks containing 'Expiring' = orange; anything else (non-'None') = green; remarks 'None' = no badge, green card. Remarks computed by server.
- Pending card colour: 'Rejected' red; status containing 'Pending' orange; otherwise green.
- Rejection reason shown only when status == 'Rejected' (uses `remarks`).
- Announcement unread = `isViewed == 'N'`; opening marks as 'Y' (server + local). Attachment kinds: fileType 'pdf' -> viewer; 'jpg'/'png' -> inline image. `location` = file URL.
- To-do done = `is_done == 'Y'`; toggling sends 'Y'/'N'. Days left = calendar-day difference.
- Date issued cannot be in the future; expiry up to year 3000; format sent `yyyy-MM-dd`.
- Upload requires: all fields + file; max 5 scanned pages; PDF only.
- No role/team/crew conditional UI in this area, except IDs: `crewId` used for documents/pendings, `userId` for dashboard/announcements/todos, `teamId` passed but unused. Announcement targeting is server-side per user.

## 5. Data models (JSON key = field name unless noted)
**Announcement** (announcements/announcement.dart): announceID:string, notificationID:string, title:string, description:string, creatorID:string, filename:string('' if null), fileType:string('' if null; 'pdf'|'jpg'|'png'), location:string('' if null; URL), date_expired:string('' if null), is_inactive:string, created_at:string `yyyy-MM-dd HH:mm:ss`, updated_at:string, isViewed:string?('Y'|'N', mutable).
**Document** (documents/document.dart): crewID, crewDocumentID, crewDocumentTypeID('' if null), crewDocumentName, crewShortDocumentName, crewDocumentNo, document_typename('' if null), type('' if null), crewDocumentIssue, crewDocumentExpiration (strings; date format UNKNOWN, displayed raw), grade, location, school, remarks ('Expired' | 'Expiring ...' | 'None' | other), url (PDF URL) - all strings, non-null cast.
**PlDocument (document type master)**: docID:string, document_name:string.
**Pending** (pendings/pending.dart): crewdocID, crewID, docID, doc_number, grade(''), location, school, date_issued, date_expired, file_type(''), app_file_name(''), approved_by(''), approval_status, rejection_reason(''), remarks(''), is_checking, is_rejected, is_inactive(''), last_name, first_name, document_name, document_shortname, file_url. All strings.
**Todolist**: todoID, creatorID, userID, todo_description, todo_due_date (`yyyy-MM-dd`, parsed with DateTime.parse), is_done:string?('Y'|'N'), isViewed, is_inactive, created_at, updated_at, status - strings.
**Task** (dead): taskID, taskCreatorId, Creator, taskType, taskStatus, taskPriority, taskCreateDate, taskDueDate, taskInstruction, taskAssignedToId, AssignedTo, isViewed, created_at, updated_at.
**Dashboard combined response**: `{announcementResult: Announcement[], crewDocCountResult:{expired,expiring?,normal?}, notificationResult?:{userID,countNotification}}` (last two only referenced in comments).
All models extend ChangeNotifier needlessly. Booleans are encoded as 'Y'/'N' strings.

## 6. Local storage & native capabilities
- SharedPreferences: `attAsked` (bool) in Dashboard (iOS ATT). Auth keeps session data elsewhere.
- Files: copies of picked PDFs saved to app external dir (Android) / documents dir (iOS) permanently (never deleted -> storage leak). Scanner outputs in cache/app dir.
- No offline cache of lists (in-memory provider state only; previous list preserved across Auth rebuild). PDF cache disabled (stale 0 days).
- Native: camera/document scanner (ML Kit), file picker, external file opener, iOS ATT prompt, image network cache.
- Lists in memory; no pagination anywhere (entire list fetched).

## 7. Bugs, security issues, UX problems, hard-codes
Security
1. No auth header/token on any API call; user/crew identity only in URL (IDOR risk: anyone can query `/user/dashboard/combined/{userId}`, `/documents/pending`, upload for any crewID). RN rebuild must send Bearer token and verify with backend team (UNKNOWN whether backend enforces anything).
2. Upload sends `crewID`/`uploaded_by` from client.
3. Hard-coded production host and `env='dev'` path baked into constants; upload endpoints use a different (non-dev) path -> likely broken on dev/prod mismatch. Hard-coded test user id in tasks.
4. File opened/stored unencrypted in app directory; PDFs of identity/seafarer documents; Android requests broad READ_EXTERNAL_STORAGE.
Bugs
5. FutureBuilder with fetch in `build()` -> repeated network calls on every rebuild (Dashboards, Announcements, Todolists, Tasks) and flicker; notifyListeners inside triggers rebuild loops.
6. Upload/update always show "Success" even on failure; provider swallows non-200 (prints only). No list refresh after success.
7. Update flow can send a non-existent file path if user doesn't pick a new file; force-unwraps in PendingsItem.didChangeDependencies.
8. Announcement details lookup from Dashboard may throw StateError (different provider list). isViewed updates diverge between Dashboard and Announcements lists.
9. "Yesterday" label for same-day items. To-do shows negative "Days Left" when overdue; no overdue styling.
10. Optimistic UI updates (announcement read, todo checkbox) with no rollback on failure.
11. Dashboard "Request Appointment" no-op; "Upload Documents" shortcut doesn't open upload; ATT dialog wording/both buttons identical.
12. Scanned images-only result path ignored (no PDF generated); SnackBar behind dialog.
13. `getPlDocuments` doesn't notify; dropdown mapping by index of name (duplicate document names would map to wrong id).
14. Error dialogs pop the navigator unconditionally (`Navigator.pop` in `_showDialog`) - can pop the wrong route.
15. Nullable JSON fields cast as non-null -> single bad record kills the list.
16. Typos: "An error occured".
Duplication
- `PDFScreen` x3, announcement item x2 (+`calculateDaysLapsed` x2), shimmer builder x5, upload/update dialog forms ~90% identical (documents_screen vs pendings_item), `_showDialog/_showDialogProgress/_showErrorDialog` x2, scanner demos x2, dead `backup.dart`, dead tasks module. Unused fields `_accessToken/_refreshToken/_userName/_teamId` in most providers; `AppConstants.appName = 'Tala 3.0'` (template residue).
UX
- No search/sort/filter on Documents, Announcements, To-dos. No error state/retry UI (silent empty). No empty-state distinction between error and no data. Pull-to-refresh broken on empty lists (non-scrollable child). Dates shown raw and unformatted (ISO).

## 8. UNKNOWNs / open questions
- Backend auth requirements (are endpoints really open? tokens/401 behavior?) and correct env paths (`-dev` vs none) for upload/update.
- Exact `approval_status` values (only 'Rejected' and 'Pending*' known), `remarks` values on documents beyond 'Expired'/'Expiring…'/'None', meaning of `is_checking`, `is_rejected`, `approved_by`, `file_type`, `type`, `grade`.
- Date format of `crewDocumentIssue/Expiration`, `date_issued/expired` from server (assumed `yyyy-MM-dd`, since the edit form pre-fills them into the picker field).
- Whether `crewDocCountResult.expiring/normal` and `notificationResult` still exist and whether the dashboard should show counts (UI currently doesn't).
- Whether the Tasks API/screen is a planned feature (`/crewfacingapi`) - not reachable in current app.
- Response bodies of upload/update (id? file_url?), file size limits, allowed MIME types server-side, whether update requires a new file.
- Whether announcements are server-filtered by `is_inactive`/`date_expired`.
- Whether to-do items should be sortable/overdue-highlighted; `status` field meaning in todo.
- Whether "Request Appointment" feature is planned.
- Tutorial coach marks intended to run on first launch (disabled) - decide whether to implement.
