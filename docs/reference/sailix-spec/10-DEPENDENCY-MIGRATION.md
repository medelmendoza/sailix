# 10 — Dependency Migration Matrix

Selection is by **actual requirement**, not by name similarity. "Used?" is from a grep of `package:` imports in `lib/`.

| Flutter package | Used? / actual purpose | Required? | React Native solution | Notes |
|---|---|---|---|---|
| `provider` | state mgmt + proxy providers (rebuilt on every Auth change; leak data across users) | Yes (concept) | TanStack Query (server state) + small Zustand store (session, UI) | Query cache cleared on logout |
| `get` | only tab-index controller | No | React Navigation tab state | |
| `http` | all REST calls | Yes | Axios | interceptors for auth/401/timeouts |
| `dio` | **unused** | No | — | |
| `intl` | date/number formatting (`MMMM, yyyy`, `#,##0.00`) | Yes | `Intl.NumberFormat`/`date-fns` (+ `en-PH`/`en-US` locale explicit) | Hermes Intl support — verify |
| `shared_preferences` | profile JSON + ATT flag | Yes | `expo-secure-store` (secrets/PII) + AsyncStorage (UI prefs) | see 08 |
| `app_tracking_transparency` | ATT prompt, no SDK needs it | **No (proposed)** | none (or `expo-tracking-transparency` if Q-4) | |
| `shimmer` | loading skeletons | Yes (UX) | own `Skeleton` component (Reanimated) | |
| `easy_pdf_viewer` | remote PDF | Yes | `react-native-pdf` | spike S2 |
| `flutter_pdfview` | bundled PDFs | Yes if SVC | `react-native-pdf` | |
| `cached_network_image` | announcement/finance images | Yes | `expo-image` | |
| `wakelock_plus` | keep awake | Yes if SVC | `expo-keep-awake` | |
| `audioplayers` | ASTRA sounds | Yes if SVC | `expo-audio` | spike S3 |
| `file_picker` | PDF pick; Call-It attachment | Yes | `expo-document-picker` | |
| `dropdown_search` | searchable document-type select | Yes | custom searchable picker (modal + FlatList) | |
| `path`, `path_provider` | file names/dirs | Yes | `expo-file-system` | |
| `url_launcher` | privacy link only | Yes | `expo-web-browser`/`Linking` | |
| `tutorial_coach_mark` | call site commented out | **No** (Q-7b) | — (or `react-native-copilot` if revived) | |
| `google_mlkit_document_scanner` | scan to PDF | Yes | `react-native-document-scanner-plugin` + PDF assembly | spike S1 |
| `flutter_doc_scanner`, `pdf` | only dead demo | No | — (`expo-print` if images→PDF needed) | |
| `open_filex` | open scanned file | Yes | `expo-sharing` | |
| `cupertino_icons` | default | No | `@expo/vector-icons` | |
| `flutter_lints` | lint | — | ESLint + typescript-eslint + Prettier | |
| *(fonts)* Poppins (default), Montserrat, Raleway | Poppins used globally; Montserrat once; Raleway not found | Poppins yes | `expo-font` / `@expo-google-fonts/poppins` | Raleway/Montserrat dropped unless found |

## New dependencies (each with a reason)

| Library | Reason |
|---|---|
| `expo`, `expo-router` **or** `@react-navigation/*` | Platform + navigation (ADR in 14) |
| `@tanstack/react-query` | Server cache, retry, refetch, invalidate-after-mutation (fixes Flutter's refetch-in-build and stale lists) |
| `zustand` | Tiny stores: session, payslip unlock, UI |
| `axios` | Interceptors, timeouts, multipart |
| `zod` | Runtime validation of lenient backend JSON |
| `react-hook-form` + `@hookform/resolvers` | Forms with zod (upload/registration/password) |
| `react-native-svg`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-screens` | Navigation/animation prerequisites, risk matrix |
| `expo-*` modules listed in 09 | Native capabilities |
| Dev: `typescript` (strict), `eslint`, `prettier`, `jest-expo`, `@testing-library/react-native`, `msw` | Quality gates & tests |

Explicitly **not** added: Redux, styled-components/NativeWind (use `StyleSheet` + theme tokens), i18n library (single language in Flutter; Q-23), analytics/crash SDK (none today; Q-24).
