# 09 — Native Capabilities

Library names are **candidates**; each must be verified for maintenance status, New-Architecture support and compatibility with the chosen Expo SDK at install time (see REACT-NATIVE-PLATFORM-DECISION.md). "Spike" = a time-boxed prototype is required before committing.

| Capability | Flutter today | Why needed | RN candidate | Expo-supported? | Native module / dev build? | iOS vs Android |
|---|---|---|---|---|---|---|
| **Document scanning → PDF** | `google_mlkit_document_scanner` (FULL, ≤5 pages, gallery import, PDF output); `flutter_doc_scanner`+`pdf` only in dead demo | DOC-07 upload from scan | `react-native-document-scanner-plugin` (ML Kit on Android, VisionKit on iOS) — **returns images**; PDF assembly via `expo-print` (HTML with embedded images) or a PDF lib | Not in Expo Go; works via config plugin / prebuild | **Yes (dev build)** | iOS VisionKit vs Android ML Kit UI differ; page-limit & gallery import behave differently. **Spike S1** |
| Pick PDF | `file_picker` (pdf only) | DOC-05/06 | `expo-document-picker` (`application/pdf`) | Yes | No | Android copies to cache; iOS security-scoped URL (copy with `copyToCacheDirectory`) |
| **View remote PDF** | `easy_pdf_viewer` (no cache) | Documents, announcements, pending | `react-native-pdf` (+ `react-native-blob-util`) | No (dev build) | **Yes** | Alternative: iOS QuickLook / Android intent via sharing. **Spike S2** (auth headers for URL, memory on large PDFs) |
| View bundled PDF (3 ASTRA PDFs) | `flutter_pdfview` | SVC-04/05/06 | `react-native-pdf` with asset copied to cache via `expo-asset` + `expo-file-system` | partly | with above | horizontal paging |
| Open file in external app | `open_filex` | preview scan | `expo-sharing` / `expo-intent-launcher` / `Linking` | Yes | No | Android needs FileProvider (handled by expo-sharing) |
| Image display/caching | `cached_network_image` | announcement images | `expo-image` | Yes | No | — |
| Audio playback (4 mp3, play/pause/stop/seek, loop) | `audioplayers` | SVC-02 | `expo-audio` (verify vs deprecated `expo-av`) | Yes | No | Background audio **not** required (Flutter has none); decide Q-17b |
| Keep screen awake | `wakelock_plus` | Pomodoro, Sounds | `expo-keep-awake` | Yes | No | — |
| Open URL (privacy policy) | `url_launcher` | AUTH-08 | `expo-linking` / `expo-web-browser` | Yes | No | Handle failure with message |
| Secure storage | none (SharedPreferences) | token/profile | `expo-secure-store` | Yes | No | Keychain / Keystore |
| Network status | none | offline banner | `@react-native-community/netinfo` | Yes | No | — |
| Biometrics | none | optional replacement for payslip gate (FIN-01, Q-10) | `expo-local-authentication` | Yes | No | Face ID needs `NSFaceIDUsageDescription` |
| Date picker | Flutter `showDatePicker` | DOC forms, registration | `@react-native-community/datetimepicker` | Yes | No | native pickers differ |
| SVG (risk arrows) | `CustomPainter` | SVC-03 | `react-native-svg` | Yes | No | — |
| App Tracking Transparency | `app_tracking_transparency` | none (no ad SDK) | `expo-tracking-transparency` **only if** Q-4 says keep | Yes | No | **Proposed removal** |
| Local notifications | none | optional Pomodoro phase-end alert | `expo-notifications` | Yes | No | Out of scope unless approved |
| Push notifications / deep links / background tasks / camera (direct) / location / Bluetooth / contacts / biometrics today | **none** | — | not needed | — | — | — |

## Permissions to declare
- **iOS:** `NSCameraUsageDescription` ("scan documents"), `NSPhotoLibraryUsageDescription` (gallery import), `NSPhotoLibraryAddUsageDescription` only if saving; `NSFaceIDUsageDescription` if biometrics adopted; drop `NSUserTrackingUsageDescription` if ATT removed. Keep `LSSupportsOpeningDocumentsInPlace` only if needed.
- **Android:** `INTERNET`, `CAMERA` (scanner). Avoid `READ_EXTERNAL_STORAGE`/`READ_MEDIA_IMAGES` — use the system picker/photo picker (no permission). `WAKE_LOCK` comes from expo-keep-awake.
- Identifiers to preserve if replacing the store listings: bundle/app id `com.btsolve.sailix2`, display name "Sailix". **Q-22: new listing or update the existing one?** (If updating, RN version must exceed 1.0.30+30 and signing must use the existing keys — Flutter release builds are signed with the **debug** key per `build.gradle`, so Play App Signing status must be checked.)

## Spikes required before M3
- **S1 Scanner:** produce a ≤5-page PDF on a real iPhone and Android; verify gallery import, page limit, cancel, output size.
- **S2 PDF viewer:** open an authenticated/unauthenticated remote PDF; check memory, no-cache refetch, failure states.
- **S3 Audio loop:** gapless repeat of the 5-min mp3 for 240 min with screen awake; behaviour on interruption (calls).
