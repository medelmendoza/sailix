# 04 - Services (Astra, Call-It, landing) - Flutter analysis

Source root: `lib/tabs/services/` (paths below relative to it unless noted). Line refs are `file:line`.
Package name in imports: `sailix2`.

## 0. Headline findings

- **The Services tab is NOT reachable in the current app.** `lib/tabs/tab_screen.dart:315,318` has `// ServicesScreen()` commented out in `NavigationController.screens`, and the bottom-nav "Services" item is commented out (`tab_screen.dart:120,127`). Active tabs: Dashboard, Documents, Announcements, Finance. No other code references `ServicesScreen`. All routes ARE still registered in `lib/main.dart:339-359`. Decision needed: rebuild as hidden/feature-flagged or omit (UNKNOWN - ask product owner).
- **Nothing here talks to a backend.** No http, no auth dependency, no shared_preferences, no tutorial_coach_mark usage anywhere in `tabs/services/` (grep confirmed). Call-It is a UI mock with hard-coded data.
- **No url_launcher.** Tiles launch in-app named routes only. "Sparks" and "Tala LMS" tiles have no handler at all (no-op).
- **Astra "Military Style Emails" is static educational content, not an email generator.** No templates, inputs, validation, clipboard, or share.
- Only real logic: Pomodoro state machine, Sounds player (looping to a chosen duration), risk-quadrant bottom sheets, PDF viewing.

## 1. Navigation map / routes

Routes registered in `lib/main.dart:339-359` (plain `Navigator.pushNamed`, no args except Sounds).

| Route | Screen (file) | Reached from |
|---|---|---|
| (tab, disabled) | ServicesScreen `services_screen.dart` | commented out |
| `/astra-menu-screen` | MenuScreen `astra/menu_screen.dart:11` | Services tile "Astra" |
| `/pomodoro` | Pomodoro `astra/pomodoro/pomodoro.dart:7` | Astra menu |
| `/background-noise` | BackgroundNoise (Focus/Rest chooser) `focuswn/background_noise.dart:7` | Astra menu "Focus/Rest" |
| `/focus` | Focuswn `focuswn/focus.dart:7` | BackgroundNoise "Focus" |
| `/rest` | Rest `focuswn/rest.dart:7` | BackgroundNoise "Rest" |
| `/sounds` | Sounds player `focuswn/sounds/sounds.dart:10` | FocuswnItem tap, args `FocusArguments(url,title,asset)` |
| `/riskmngmt` | RiskManagement `riskmngmt/risk_management.dart:6` | Astra menu |
| `/rca` | Rca `rca/rca.dart:7` | Astra menu; NextSteps |
| `/whys` | Whys `rca/whys.dart:5` | Rca "5 Why's" |
| `/pmepe-main` | PmepeMain `rca/pmepe_main.dart:6` | Rca "P.M.E.P.E" |
| `/pmepe` | Pmepe `rca/pmepe.dart:11` | PmepeMain arrow |
| `/scaril` | Scaril `scaril/scaril.dart:12` | Astra menu; NextSteps |
| `/emails` | MilitaryEmails `militaryemails/military_emails.dart:9` | Astra menu |
| `/to-and-cc` | ToAndCc | Emails step 1 |
| `/raid` | Raid | Emails step 2 |
| `/bluf` | Bluf | Emails step 3 |
| `/next-steps` | NextSteps | Emails step 4 |
| `/callit-dashboard` | CallItDashboardScreen `callit/dashboard/dashboard_screen.dart:5` | Services tile "Call-It" |
| `/callit-reports` | CallItReportsScreen `callit/reports/reports_screen.dart:5` | Call-It dashboard button |

Unregistered/unused: `callit/reports/reportsbu.dart` (backup copy with its own `main()`; not in routes, see bugs), `pomodoro/pomodoro_timer_service.dart` (unused class), `focuswn_model.dart`, `focuswn_arguments.dart` (data classes used by focus/rest/sounds).

Common Astra chrome: dark theme. `AppConstants.kColorSchemeAstra` (`lib/constants/app_constants.dart:58`): seed `#002352`, onPrimaryContainer `#192D3B` (25,45,59) used as AppBar bg, primaryContainer `#1F232F` (31,35,47) used as scaffold bg. Accents: `Colors.orange[300]`, `Colors.blue[400]`, `Colors.blue[900]`, white text. Help `?` icon (orange) in several AppBars opens a modal bottom sheet (height 250, bg #192D3B, radius 17, title 20pt bold white, body white) - this is the only "tutorial" mechanism (no coach marks).

## 2. Services landing screen (`services_screen.dart`)

- 2-column GridView (spacing 10, padding 8) of Cards (elevation 4, radius 15), icon 60x60 asset + 18pt bold black title (:5-94).
- Tiles (:6-13): "Sparks" (`assets/images/srt_icon.png`), "Tala LMS" (`tala_icon.png`), "Astra" (`astra_icon.png`), "Call-It" (`callit_icon.png`). A commented-out "Schedule Appointment" tile exists.
- Tap logic (:49-55): title string match; `'Astra'` -> pushNamed `/astra-menu-screen`; `'Call-It'` -> `/callit-dashboard`; Sparks and Tala LMS do nothing. Matching by display title (fragile).
- No url_launcher, no external app deep links. (Note `AppConstants.appName = 'Tala 3.0'` - lib/constants/app_constants.dart:6, unrelated naming leftover.)

## 3. Astra

### 3.1 Astra menu (`astra/menu_screen.dart`)
AppBar "ASTRA". 2-col grid of 6 tiles (:12-19), Material icons + titles; routing by title string (:60-75):
Pomodoro (timer icon), Focus/Rest (music_note_rounded), Risk Management (priority_high_rounded), Root Cause Analysis (search), Scaril (settings), Military Style Emails (email). Tile color by position (:81-85): idx 0,1 orange[300]; idx 2,3 blue[400]; others blue[900]. Icons 50, white.

### 3.2 Pomodoro (`pomodoro/pomodoro.dart`) - the main state machine
Constants (:14-17): work 25*60 s, short break 5*60 s, long break 15*60 s, cycleCount 4. (Commented test values 5/5/10 s at :19-22.)

State: `_remainingTime` (init 1500), `_timer`, `_isRunning`, `_showResetButton` (false initially), `_currentMode` in {'Work','Short Break','Long Break'}, `_completedCycles` (0).

Behavior:
- **Start** (:31-51): cancels existing timer; `Timer.periodic(1s)`: if remaining>0 decrement, else `_switchMode()`. Sets running=true, showReset=true, `WakelockPlus.enable()`.
- **Pause** (:53-62): cancel timer, running=false, `WakelockPlus.disable()`. Remaining time retained; Start resumes.
- **Reset** (:64-77): cancel timer; remaining=work; mode='Work'; completedCycles=0; hide Reset; wakelock off.
- **_switchMode** (:79-106), invoked on the tick AFTER reaching 0 (so 00:00 is displayed for one extra second):
  - Work -> completedCycles++; if completedCycles < 4 -> Short Break (300 s) else Long Break (900 s).
  - Short Break -> Work (1500 s).
  - Long Break (finished) -> stop timer, remaining=1500, running=false, mode 'Work', completedCycles=0, hide Reset. (Auto-restart code is commented out.) **Wakelock is NOT disabled here** (bug; only disabled on pause/reset/dispose).
  - Sequence: W1 SB W2 SB W3 SB W4 LB -> stop. Timer auto-continues between W/SB without user action.
- Display (:164-248): padding-top 150; MM:SS (80pt bold white, zero-padded, :108-112); mode text 30pt; Start/Pause toggle (orange[300]) and Reset (blue[400], only after first start); 4 circle indicators 20px (orange when index < completedCycles, else grey).
- Break messages (:169-200) shown above the clock: SB with cycles==1 "Take a walk and breathe."; ==2 "Rest your eyes for a few minutes."; ==3 "Stretch and loosen up your body."; Long Break & cycles==4 "Relax and take a long break."
- Help sheet (:142-152): title "What is Pomodoro?" body "The Pomodoro Technique is a time management method in which you do focused work during 25-minute intervals — known as pomodoros — and take a five-minute break.\n\nThis goes for 4 intervals, where at the end, you will rest for 25 mins." (**text says 25 min rest but code uses 15 min long break**).
- dispose: cancel timer, wakelock disable (:276-283).
- No audio/vibration/notification on phase change. No background execution: timer is Dart `Timer`, counts ticks (drifts / pauses when app is backgrounded or OS suspends it); not wall-clock based. Not persisted; leaving screen discards state.
- `pomodoro_timer_service.dart`: UNUSED alt implementation (work 25 min, break 1 min, isWorking toggle, `late Timer` may throw if `stopTimer` called before start). Do not port.

### 3.3 Focus / Rest background noise

Chooser `focuswn/background_noise.dart`: AppBar "Focus/Rest"; help sheet title "Focus or Rest?" body "Background noise can be a powerful tool for improving focus and concentration while studying. This allows you to delve deeper into your work and achieve a state of flow.\n\nUse these background noises to either focus or rest." (:42-52). 2 tiles: Focus (lightbulb, orange[300]) -> `/focus`; Rest (airline_seat_recline_extra, blue[400]) -> `/rest` (:94-100; else-branch).

Catalog (model `FocuswmModel{icon,url(image),title,asset}`, `focuswn_model.dart`):

| Category | Title | Icon | Image | Audio asset (AssetSource, relative to assets/) |
|---|---|---|---|---|
| Focus (`focus.dart:9-15`, AppBar "Focus Noise") | Brown Noise | queue_music_rounded | assets/images/astra/brown.jpg | sounds/astra/brown-noise-5.mp3 |
| Rest (`rest.dart:9-25`, AppBar "Rest Noise") | Rain | cloudy_snowing | rain.jpg | sounds/astra/rain-5.mp3 |
| Rest | Water | water_drop_outlined | water.jpg | sounds/astra/water-5.mp3 |
| Rest | Insects | bug_report_rounded | insects.jpg | sounds/astra/insects-5.mp3 |

Tile (`focuswn_item.dart`): card color by title (:32-36): Rain/Brown Noise orange[300]; Water blue[400]; else blue[900]. Icon 50 + title; tap -> `/sounds` with `FocusArguments(url, title, asset)`. Tile shows icon, not the photo (photo card is commented out :66-135). Each mp3 is ~4.8 MB, i.e. a **5-minute loopable clip** (filename "-5").

Sounds player `focuswn/sounds/sounds.dart`:
- On first `didChangeDependencies` (:24-43): reads route args; creates `AudioPlayer`; `setReleaseMode(ReleaseMode.stop)` (NOT loop); post-frame `player.setSource(AssetSource(args.asset))` (does not auto-play; "resume" commented out); `WakelockPlus.enable()` for the whole screen lifetime (screen stays awake even while paused/stopped).
- dispose (:63-68): `player.dispose()`, wakelock disable. Audio therefore stops when leaving the screen. No background-audio config found: iOS `Info.plist` has no `UIBackgroundModes`/audio match (grep empty), Android manifest has no WAKE_LOCK/foreground-service matches. (wakelock_plus adds its own perms.)
- UI (:71-136): AppBar title=args.title with timer icon action -> duration dialog; 300 px hero image (`Hero tag 'sounds<title>'`, source args.url, cover); `PlayerWidget`; caption "This sound will play for $_loopTimes minutes. To modify duration, please set the timer by clicking the timer icon." (18pt bold white, centered).
- Duration dialog (:138-182): title "Select duration"; dropdown "Choose a duration" with options 30, 60, 90, 120, 150, 180, 210, 240 minutes; single "Submit" button sets `_loopTimes = _selectedValue!`. **Default `_loopTimes` = 5 (minutes)** (:21), `_selectedValue` starts null. Bug: Submit with nothing selected throws (null-bang :169). Dropdown is not pre-set to current value after first selection? It is (`value: _selectedValue`).
- PlayerWidget (:188-373) (copied from audioplayers example): Play / Pause / Stop icon buttons (48 px; play disabled while playing; pause enabled only when playing; stop enabled when playing or paused), seek Slider (value = position/duration, clamped 0..1; onChanged seeks immediately to value*duration), text "`H:MM:SS / H:MM:SS`" (Duration.toString minus fractional part). Subscribes to duration, position, complete, state streams.
- **Looping rule** (:331-346): on each track completion: state=stopped, position=0, `loops++`; if `loops <= loop/5` (integer loop minutes divided by 5, double division) -> `_play()` again; else `loops = 1` (reset). `loops` starts at 1. So total plays = loop/5: 5 min => 1 play; 30 => 6 plays; 240 => 48 plays. Rule: "repeat the 5-minute clip until the chosen duration elapses". Duration is track-count based, not wall-clock; pausing extends time. Pause/stop mid-way don't reset `loops` (stop mid-loop then play continues with stale counter). If duration changed during playback it takes effect via widget.loop at next completion.
- Gaps/audible seam between repeats may occur (re-resume of stopped source). No volume control (default), no mixing of sounds, no sleep timer UI beyond duration, no persistence of last choice.

### 3.4 Risk Management (`riskmngmt/risk_management.dart`)
Interactive 2x2 probability/impact matrix. AppBar "Risk Management"; help sheet "What is Risk Management?": "Risk management is the process of identifying, assessing and controlling threats to an organization's capital, earnings and operations.\n\nThis graph shows you what you need to do if the PROBABILITY or IMPACT of your risk is HIGH or LOW." (:42-52). Header "Click one of the quadrants to learn more." (:73).
- Layout (:83-183): dark panel; left a vertical label "Probability" (rotated -90deg, `Transform.rotate(-1.5708)`) above an upward arrow (CustomPainter 30x100, orange[300], stroke 2, `UpwardArrowPainter` :245); 2x2 non-scrolling GridView of bordered cells (blue[400] 2px border); bottom a right arrow (`RightArrowPainter` 100x50) + label "Impact".
- Cell order in grid (`_name`, :13): index 0 Reduce (top-left), 1 Avoid (top-right), 2 Accept (bottom-left), 3 Transfer (bottom-right). I.e. Y axis = probability (top high), X axis = impact (right high): Reduce = High prob/Low impact; Avoid = High/High; Accept = Low/Low; Transfer = Low prob/High impact. (axes have no tick labels "High/Low" beyond the arrows.)
- Tap (:190-207): sets `selectedIndex` (selected cell fills orange[300]; persists) and opens bottom sheet (same style as help):
  - Reduce: title "Reduce your risk!" / "When your risk is HIGH probability but LOW impact, you need to take action in order to minimize its impact."
  - Avoid: "Avoid your risk!" / "When your risk is HIGH probability with HIGH impact, it is better to avoid the risk entirely."
  - Accept: "Accept your risk!" / "When your risk is LOW probability with LOW impact, sometimes the best option is to accept it, especially if its the most optimal option." (typos: "its")
  - Transfer: "Transfer your risk!" / "When your risk is LOW probability but with HIGH impact, it is best to share the risk or transfer the risk entirely."
- `risk_management_item.dart`: trivial centered text widget (unused `provider` import, empty didChangeDependencies).

### 3.5 Root Cause Analysis (RCA)
- `rca/rca.dart`: AppBar "Root Cause Analysis"; help "What is Root Cause Analysis?" / "Root cause analysis (RCA) is the process of discovering the root causes of problems in order to identify appropriate solutions." 2 tiles: "5 Why's" (question_mark_rounded, orange[300]) -> `/whys`; "P.M.E.P.E" (search, blue[400]) -> `/pmepe-main` (:94-100).
- `rca/whys.dart`: static page. Title "Root Cause Analysis:\n5 Whys [Deep]" (28pt); blurb "5 Whys is the practice of asking why repeatedly whenever a problem is encountered in order to get beyond the obvious symptoms to discover the root cause." Then flow: button "Define the problem" (blue, inert) -> down arrow -> image `assets/images/astra/whys.png` (full width) -> arrow -> button "Broader or Deeper?" (orange, inert). Unused `_buildText` helper (:102-158, "WHY" -> answer row). No input fields; not interactive.
- `rca/pmepe_main.dart`: AppBar "Root Cause Analysis", help "What is P.M.E.P.E?": "“Purple Monkey Eating Pink Elephant” or P.M.E.P.E is a mnemonic used to easily remember the 5 main things we can look for a root cause of the problems in ships. Each category reminds you to consider if the problem is related to, for example, Equipment in the ship etc." Body: title "P.M.E.P.E", image `assets/images/astra/monkey.png`, bordered RichText "Purple Monkey Eating Pink Elephant" with initial letters bold orange[300] 24pt and rest white; orange circle-arrow icon + "Click to learn more." -> `/pmepe`.
- `rca/pmepe.dart`: same help sheet. Title "P.M.E.P.E". Rows (blue button left = category, orange right = mnemonic word, both inert) each followed by a bordered descriptor (:107-125):

| Category | Mnemonic | Descriptor |
|---|---|---|
| People | Purple | Related to People |
| Materials | Monkey | Supplies, Cargo and Inventory |
| Equipment | Eating | Machinery and Tools |
| Process and Policies | Pink | Lack of clarity and gaps |
| Environment | Elephant | Weather and Company culture |

  Then blue[900] button "Detailed View" -> PDF viewer (see 3.7) of `pmepe.pdf`, title 'PMEPE'.

### 3.6 SCARIL (`scaril/scaril.dart`)
AppBar "Scaril"; help "What is S.C.A.R.I.L?": "This serves as a framework for assessing problems and communicating it. Situation, Complication, Analysis, Recommendation, Impact and Learnings can help you easily put out fires by easily recognizing why that happened and what you can to do to prevent it." (:65-75; typo "you can to do"). Heading "S.C.A.R.I.L"; label-button + descriptor pairs (:97-128, buttons inert):

| Letter word | Descriptor |
|---|---|
| Situation | Background Summary |
| Complication | Incident / Problem |
| Analysis | Root Causes / Alternatives |
| Recommendation | Corrective actions / Solutions |
| Impact | How badly affected? |
| Learnings | Lessons learned / Improvement |

Then orange button "Detailed View" -> PDF `scaril.pdf`, title 'SCARIL'. Own copy of PDFScreen class (:~160-293).

### 3.7 Military Style Emails (static guide)
- `military_emails.dart`: AppBar "Military Style Emails"; help "What is a Military Style Email?": "It is an communication framework in order for one to be more concise and effective in their emailing. Apart from that, it also includes steps towards problem recognition and actions for prevention." (typo "an communication"). Heading "How to write an effective email" (28pt). Four full-width blue[400] buttons joined by disabled down-arrow buttons, routed by exact label (:95-103): "STEP 1 : To and CC" -> `/to-and-cc`; "STEP 2 : R.A.I.D and Subject" -> `/raid`; "STEP 3 : B.L.U.F and Body" -> `/bluf`; "STEP 4 : Next steps" -> `/next-steps` (else-branch).
- **To and CC** (`toandcc.dart`): heading "To and CC:", sub "Know who you are sending your email to." Button "To" (blue) + text "It is intended for the main recipients of your email. These are the recipients used in the salutation at the beginning of your email message and those from whom you expect a direct reply or action."; Button "CC" (orange) + "CC in an email stands for carbon copy. Carbon copy refers to the practice of sending a copy to one or more recipients to keep them in the loop. "
- **RAID** (`raid.dart`): heading "RAID!", sub "Set the right expectations for your email's subject". Tag/descriptor pairs: [Request] "Approvals, Signatures, Documents"; [Action] "Action needs to be done"; [Info] "Updates and announcements"; [Decision] "Choose from options and/or recommendation"; [Urgent] "Added when request needs an immediate response"; [Example] (orange) with two boxes: "Before:\nSubject: Documents for Crew Change" and "After:\nSubject: [Urgent Request]\nDocuments for Crew Change - MV - Vessel A". Subject convention thus: `[<Tag(s)> ] <Subject text> - <vessel>`; multiple tags may be combined ("[Urgent Request]"). All buttons inert.
- **BLUF** (`bluf.dart`): heading "BLUF", sub "Bottom Line Up Front:\nFrontload all the important details in 3 to 5 sentences". Buttons/descriptors: Who "Who is involved?"; What "What happened?\nWhat needs to be done?"; When "When did it happen?\nHow long will it take?"; Where "Where did it happen?\nWhere to go/accomplish?"; Why "Why did it happen?"; How "How did it happen?". Orange "Example" -> PDFScreen('BLUF') of `bluf.pdf` (:100,128-153). Buttons inert.
- **Next steps** (`nextsteps.dart`): heading "Next Steps:", text "After sending the email, you might want to consider RCA or SCARIL." 2 tiles: "Root Cause Analysis" (search, orange) -> `/rca`; "Scaril" (settings, blue[400]) -> `/scaril`.

### 3.8 PDF viewing (3 PDFs)
Identical pattern in `bluf.dart`, `pmepe.dart`, `scaril.dart` (copy-pasted `PDFScreen` x3):
- `initState` copies the asset (`rootBundle.load('assets/pdfs/astra/<name>.pdf')`) into `getTemporaryDirectory()/<name>.pdf` (flush) and stores the path; button navigates with that path (`Navigator.push MaterialPageRoute`, not named route). If tapped before the copy finishes, path is "" (race).
- `flutter_pdfview` `PDFView`: enableSwipe, swipeHorizontal=true, autoSpacing=false, pageFling, pageSnap, fitPolicy BOTH, preventLinkNavigation=false, spinner until onRender, error text on onError/onPageError. No page indicator, zoom/search/share. AppBar title = 'BLUF' / 'PMEPE' / 'SCARIL'. Pmepe's PDFScreen uses default light AppBar (no Astra colors) - inconsistency (:246-249).
- RN equivalent: bundled PDFs (react-native-pdf or WebView/QuickLook) with horizontal paging.

### 3.9 Asset inventory
- `assets/sounds/astra/`: brown-noise-5.mp3 (4,805,694 B), insects-5.mp3 (4,808,620), rain-5.mp3 (4,802,351), water-5.mp3 (4,802,769). (`assets/sounds/` contains only `astra/`.)
- `assets/pdfs/astra/`: bluf.pdf (1,236,287 B), pmepe.pdf (466,168), scaril.pdf (1,258,272).
- `assets/images/astra/`: brown.jpg, insects.jpg, rain.jpg, water.jpg (hero images in Sounds screen), monkey.png (PMEPE), whys.png (5 Whys diagram). (`brown/insects/rain/water` all declared in pubspec :102-111; PDFs :112-114.) Related top-level service icons: `assets/images/astra_icon.png`, `callit_icon.png`, `srt_icon.png`, `tala_icon.png`.

## 4. Call-It (`callit/`)

Entirely mock UI; **no API calls, no persistence, no auth use.** Teal theme (`Colors.teal`, grey[200] bg).

### 4.1 Dashboard (`dashboard/dashboard_screen.dart`)
AppBar "Call-It" (bold) + settings icon (no-op :13). Header band teal: "Welcome," + **hard-coded name "Jaycob"** (:54). Card: bar-chart icon, "Reports Made:" **hard-coded "88"** (:93); "Medals & Achievements" with two hard-coded badges: trophy "#1 in Reports Made", star "100 Reports Made" (:115-125); button "See Saved Reports" (eye icon, no-op onPressed :133; styled teal[100] with white text = low contrast). Button "Create New Report" (teal, add icon) -> `/callit-reports` (:154).

### 4.2 Create Report (`reports/reports_screen.dart`) - "Create New Report" (teal AppBar)
Fields (all in-memory state; nothing validated or sent):

| Field | Control | Values / default |
|---|---|---|
| Classification | Dropdown | 'Unsafe Acts' (default), 'Unsafe Conditions', 'Unsafe Behaviour' (:146) |
| Sub - Classification | Dropdown | 'People' (default), 'Materials', 'Processes', 'Equipment', 'Environment' (:162-168) |
| Location | Dropdown | 'Accommodation' (default), 'Main Deck', 'Poop Deck', 'Cargo Space', 'Ballast Space', 'Hold Space', 'Machinery Space', 'Others (Free text)' (:184-192) - choosing Others shows NO free-text field |
| Vessel | read-only text, hard-coded 'M/V LA BAMBA' (:226); dropdown for vessels is commented out (Vessel A/B/C) |
| Details of Incident | multiline (4) text, hint "Give a brief description of the incident...(e.g saw the master on deck with his shoe laces undone)" |
| Did you intervene? | two mutually exclusive checkboxes Yes / No (can both be unchecked) |
| Intervention Details | multiline (4), hint "Give a brief description how you intervened if applicable..." |
| Upload Files | cloud_upload icon -> `file_picker` (types jpg/png/pdf, `withData: true`); label "(Limit to 1 mb)" - limit NOT enforced; only file NAME is kept and shown as blue underlined text |

Buttons (:302-330): Cancel (red, no-op), Save as Draft (blue, no-op), Send (green) -> `_showOfficialReportDialog`.
- Official Report dialog (:104-127): title "Official Report", "Does this incident require official reporting?" with "No, not needed" and "Yes" - **both do exactly the same thing** (close, open Report Summary).
- Report Summary dialog (:36-102): read-only fields: Classification, Sub-Classification, Location, Vessel, Details of Incident, "Did you intervene?" (Yes/No - shows "No" when neither checked), Intervention Details, Uploaded File (if any). Buttons Cancel and Send both just close the dialog (**nothing is submitted**). Summary fields use `initialValue` (fine since dialog is built fresh).
- No validation of any field (empty details allowed).
- `reportsbu.dart`: stale earlier draft with its own `main()`/`SPOTitApp` (title "SPOTit"), `CreateReportScreen`; `_pickFile` empty. Dead code. Name hint: product earlier called "SPOTit".

## 5. API calls / auth dependencies
None in this area (no http/dio, no Provider/Auth reads, no tokens). Related global config only: `lib/constants/api_url.dart` (`liveUrl 'sailix.btsolve.com'`, `env 'dev'`, no Call-It/Astra endpoints). A real Call-It backend (report submit, saved reports, stats, vessel list, user name) is UNKNOWN / not designed. For RN: model Call-It as a stubbed feature with a repository interface; defer endpoint design to product.

## 6. Business rules (plain language)
1. Pomodoro: 25 min work, 5 min short break, up to 4 work sessions; after the 4th work session take a 15 min long break and then the timer stops and resets. Phase changes are automatic; user can pause/resume/reset. Screen stays awake while the timer runs.
2. Break tips per completed session: 1 walk/breathe; 2 rest eyes; 3 stretch; 4 long-break relax.
3. Noise categories: Focus = Brown Noise; Rest = Rain, Water, Insects. Each clip is 5 min and repeats until total (default 5, selectable 30-240 min in 30 min steps) minutes reached (repeats = duration/5). Screen stays awake while on the player screen. Leaving the screen stops audio.
4. Risk matrix: High prob/Low impact => Reduce; High/High => Avoid; Low/Low => Accept; Low prob/High impact => Transfer.
5. Email framework: To = action owners (addressed in salutation), CC = FYI; Subject = RAID tag(s) + descriptive subject + vessel; Body opens with BLUF in 3-5 sentences (Who/What/When/Where/Why/How); afterwards consider RCA (5 Whys / PMEPE) or SCARIL.
6. PMEPE: People, Materials, Equipment, Process and Policies, Environment (mnemonic Purple Monkey Eating Pink Elephant).
7. SCARIL: Situation, Complication, Analysis, Recommendation, Impact, Learnings.
8. Call-It report classifications and location lists as in 4.2 (single-vessel, hard-coded).

## 7. Native capabilities needed (RN mapping)
| Capability | Flutter pkg | Usage | RN suggestion |
|---|---|---|---|
| Audio playback of bundled mp3 | audioplayers ^6.5.0 | play/pause/stop/seek/position/duration, completion callback | expo-av / react-native-track-player / react-native-sound; bundle 4 x ~4.8 MB mp3 |
| Keep screen awake | wakelock_plus ^1.2.8 | Pomodoro (running), Sounds (whole screen) | expo-keep-awake / react-native-keep-awake |
| PDF viewer | flutter_pdfview ^1.3.3 (+path_provider temp copy) | 3 bundled PDFs, horizontal swipe, snap | react-native-pdf (copy asset to cache) |
| File picker | file_picker | Call-It attachments jpg/png/pdf | react-native-document-picker / expo-document-picker |
| Timers | dart Timer | 1 s tick | prefer timestamp-based end time to avoid drift |
| Custom painting | CustomPaint | risk arrows | react-native-svg |
| url_launcher / clipboard / share / coach marks | url_launcher is in pubspec; tutorial_coach_mark in pubspec | NOT used in this area | not needed here |
No background audio mode, no notifications, no haptics.

## 8. Bugs / duplication / hard-codes / UX issues
1. Services tab disabled (see section 0); Sparks and Tala LMS tiles dead.
2. Pomodoro: wakelock stays on after long break completes; extra 1 s at 00:00; tick-based (drift/pauses in background); no alert at phase end; help text says 25 min rest vs. 15 min actual; unused `PomodoroTimerService` with inconsistent values (1 min break).
3. Sounds: Submit with no selection -> null-check exception (`sounds.dart:169`); default caption says "5 minutes" though minimum selectable is 30 (user cannot select 5 again after changing); loop counter stale after stop; loop based on count not time; `late AudioPlayer player = AudioPlayer()` initialized twice; `args` is `late` and build crashes if route has no args (:75); no autoplay; wakelock on while paused; no error handling for asset load.
4. Duplicated code: `MenuItem`/`MenuGridItem` defined 5 times (services_screen, menu_screen, background_noise, nextsteps, rca); `_buildButton/_buildText` copied in each email/RCA page; `PDFScreen` copied 3 times (Pmepe's differs in theme); help bottom-sheet duplicated ~8 times. Rebuild with shared `InfoPage`, `Tile`, `HelpSheet`, `PdfViewer` components, and a data-driven content file.
5. Many buttons are inert styled buttons (Who/What/..., [Request]..., PMEPE labels, "Define the problem", "See Saved Reports", settings, Cancel, Save as Draft) - non-interactive affordances (consider rendering as non-pressable labels).
6. Navigation by display-title string matching (fragile).
7. Content typos: "It is an communication framework", "what you can to do", "its the most optimal option", "Poop Deck" (legit nautical term) etc.
8. Call-It: all hard-coded (name "Jaycob", 88 reports, vessel M/V LA BAMBA); Send/Save/Cancel do nothing; "No, not needed" and "Yes" identical; "Others (Free text)" has no text field; 1 MB limit not enforced; Yes/No checkbox pair instead of radio, can be neither; teal[100] button with white text low contrast; `reportsbu.dart` dead file with a second `main()`.
9. PDF race: asset copy is async; button can pass empty path if tapped quickly.
10. Risk matrix: axis end labels (High/Low) absent; meaning only in sheet text; `selectedIndex` highlight persists after dismiss. Risk item widget imports unused provider.
11. Accessibility: color-only states; no semantics; fixed 250 px sheet height may clip longer text on small devices/large fonts; Pomodoro top padding fixed 150.

## 9. UNKNOWNs / open questions
- Is the Services tab intended to ship (currently commented out)? Entry point for RN (tab vs. dashboard link) UNKNOWN.
- Intended behavior of "Sparks" and "Tala LMS" tiles (external apps via url_launcher? deep links?) UNKNOWN - no code.
- Call-It backend: endpoints, auth, vessel list (per-user?), user name/stats source, draft/saved-reports behavior, 1 MB attachment upload, "official reporting" semantics (what Yes vs No changes) - all UNKNOWN.
- Whether audio should continue in background / when screen locks (not configured today; wakelock forces screen on instead).
- Whether Pomodoro should survive app backgrounding or notify at transitions.
- Contents of bluf.pdf / pmepe.pdf / scaril.pdf (binary; not analyzed) and meaning of images whys.png/monkey.png.
- Whether the 5-minute clips are seamlessly loopable.
- Source of truth for text content (copy lives in code; any localization needs?) UNKNOWN.
