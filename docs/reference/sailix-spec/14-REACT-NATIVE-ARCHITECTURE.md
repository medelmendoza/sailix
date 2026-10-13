# 14 — React Native Architecture

## Stack (each with a reason; see 10)
Expo (dev builds) · React Native + TypeScript (`strict`, `noUncheckedIndexedAccess`) · **React Navigation** (typed stacks/tabs; chosen over expo-router for explicit auth-gate switching and testability — ADR-1, revisit if the team prefers file routing) · **TanStack Query** (server state) · **Zustand** (session + payslip unlock + UI) · **Axios** · **zod** · react-hook-form · ESLint (`@typescript-eslint`, `react-native`, `react-hooks`, `import`) · Prettier · Jest (`jest-expo`) + React Native Testing Library + MSW.

## Layering
```text
Screen (UI) → feature hooks (useX query/mutation) → service (typed API fn) → api client (Axios) → backend
                         ↑ zod schema parse + mapper → domain model (src/models)
```
Rules: screens never call Axios; services never import React; mappers are pure and unit-tested; no `any` (justified `// eslint-disable` with reason only).

## Structure
```text
src/
├── app/
│   ├── navigation/          RootNavigator, AuthStack, AppStack, MainTabs, types.ts
│   ├── providers/           QueryProvider, ThemeProvider, SessionBootstrap
│   └── config/              env.ts (reads expo-constants extra), flags.ts (servicesEnabled…)
├── components/              Button, TextField, Card, Badge, Skeleton, EmptyState, ErrorState,
│                            PdfViewer, SearchablePicker, ConfirmDialog, Screen, FormError
├── features/
│   ├── auth/                screens, hooks, service, schemas, session store
│   ├── dashboard/  announcements/  documents/ (list, pending, upload, scanner)  todo/
│   ├── finance/             loans/, payslips/ (one list + one detail, parameterised by kind), privacyGate/
│   ├── settings/
│   └── services/            (flag) astra/ (pomodoro, sounds, risk, rca, scaril, emails, content/), callit/
├── services/
│   ├── api/                 client.ts, errors.ts, interceptors.ts
│   └── storage/             secureStore.ts, prefs.ts
├── hooks/  store/  models/  schemas/  utils/ (money, dates, parsing)  constants/ (theme tokens)  types/
└── assets/                  fonts, images, sounds (flagged), pdfs
```

## Key design decisions
1. **Session:** `sessionStore` (Zustand) bootstraps from SecureStore; `RootNavigator` renders AuthStack/AppStack from `session`. `logout()` = single function clearing storage, `queryClient.clear()`, stores. 401 interceptor calls it.
2. **API/env:** `env.ts` provides `API_BASE_URL` and `API_PREFIX` (+ `UPLOAD_PREFIX` while the two-backend question Q-2 is open) from `app.config.ts` `extra`, set per EAS profile. No URL literals elsewhere.
3. **Query keys** scoped by `userId`/`crewId`; mutations invalidate affected keys (documents + pending after upload/update; notifications/dashboard after mark-read, with optimistic update + rollback).
4. **Payslips:** one `PayslipListScreen({kind})`, one `PayslipDetailScreen({kind, datePro})`, one `PayslipCard`; per-kind differences expressed as a config object (`titleLabel`, `periodLabel`, `payFields`, `hasDeductions`). Money formatting in `utils/money.ts` (pure, tested); never recompute server totals.
5. **Privacy gate:** `usePayslipGate()` exposes `ensureUnlocked()` → resolves after the chosen mechanism (Q-10); state in memory.
6. **Uploads:** `useUploadDocument` builds `FormData` (React Native file object `{uri,name,type}`), maps non-2xx → `ApiError`, deletes cached file in `finally`.
7. **PDF:** `<PdfViewer source={{url}|{asset}} />` single component; remote = no cache; asset = copied to cache once.
8. **Services (flagged):** content in typed data modules; `usePomodoro` is a pure state machine over a wall-clock `endsAt` (unit-testable with fake timers); `useLoopingSound` wraps expo-audio with deadline-based stop.
9. **Theming:** tokens in `constants/theme.ts` (colors, spacing, typography — Poppins); light only.
10. **Errors:** `ApiError` kinds → `ErrorState` messages; error boundary at root; no stack traces to users.
11. **Logging:** `utils/logger.ts` with redaction; no-op in release except errors to crash reporter if Q-24 approves one.
12. **Config:** `.env.example` documents `EXPO_PUBLIC_*`/EAS vars: `API_BASE_URL`, `API_PREFIX`, `UPLOAD_PREFIX`, `APP_ENV`, `PRIVACY_URL`, `SERVICES_ENABLED`.

## Testing strategy
- **Unit:** mappers/schemas (fixtures from real-shaped JSON incl. nulls, num-vs-string), money/date utils, loan %, age label, pomodoro machine, remarks→colour, payslip kind config, session store.
- **Component:** Login, Registration, ChangePassword, UploadDocument form, PrivacyGate, Todo toggle (rollback), list screens' 4 states.
- **Integration (MSW):** Login→Dashboard→Announcement→mark read; Upload (success + failure); Finance gate→list→detail; 401 → Login; logout clears cache.
- **Manual matrix:** iOS sim + device, Android emu + device; scanner, PDF, audio only verifiable on devices.
- **Gates in CI:** `tsc --noEmit`, `eslint --max-warnings=0`, `jest --coverage`, `expo-doctor`, `expo prebuild --no-install` smoke.

## Milestones
M0 foundation (project, tooling, theme, api client, error/logging) → M1 auth + session + navigation shell → M2 announcements + dashboard + to-do → M3 documents (list/pending/PDF) then upload + scanner (after S1/S2) → M4 finance (loans, payslips + gate) → M5 settings/account/delete → M6 services (if SVC-00 approved) → M7 hardening (a11y, responsive, security review, store builds).
