# 03 — Navigation Specification

## Flutter structure (reference)

- Home is a guard: `isAuth ? TabScreen : (autoLogin → Splash → Login)`. Named routes are **not** guarded. Every transition except home is a fade.
- Tabs switched via GetX index (screen instances persist). Selected tab index is not reset on logout (defect).

## Target structure (React Navigation, typed params)

```text
RootStack
├── AuthStack                      (shown when session == null)
│   ├── Login
│   ├── Registration
│   └── ForgotPassword             [UNKNOWN — AUTH-04]
└── AppStack                       (shown when session != null)
    ├── MainTabs (bottom tabs, state preserved, reset on logout)
    │   ├── DashboardTab  → Dashboard
    │   ├── FilesTab      → FilesTopTabs (Documents | Pending)
    │   ├── AnnouncementsTab → AnnouncementsList
    │   └── FinanceTab    → Finance
    ├── AnnouncementDetails {announcementId}
    ├── PendingDetails {crewdocId}
    ├── PdfViewer {source: url | asset, title}
    ├── UploadDocument {mode: 'new'} / UpdateDocument {crewdocId}   (modal)
    ├── TodoList
    ├── ChangePassword
    ├── CashAdvance
    ├── PayslipList {kind: 'allotment' | 'final'}
    ├── PayslipDetail {kind: 'regular'|'special'|'final', datePro}
    └── ServicesStack              [UNKNOWN — SVC-00; feature-flagged]
        ├── ServicesHome → AstraMenu → Pomodoro, FocusRest → Sounds, RiskManagement,
        │                  Rca → Whys, PmepeMain → Pmepe, Scaril, MilitaryEmails → ToAndCc, Raid, Bluf, NextSteps
        └── CallItDashboard → CallItCreateReport
```

## Rules

1. **Auth gate by state, not route:** session change swaps `AuthStack` ↔ `AppStack`; no manual `navigate('Login')`. Logout and 401 both clear the session and reset navigation state.
2. Dashboard shortcuts: Upload Documents → `UploadDocument` modal; View Finances → FinanceTab; To-do → `TodoList`; Documents → FilesTab; bell → AnnouncementsTab.
3. Payslip routes take `kind` + `datePro` only (matches the API). Allotment list routes to `regular` vs `special` detail by normalised `Remarks` (case-insensitive contains "regular"); default = special. See OPEN-QUESTIONS Q-11.
4. Privacy gate is invoked **before** navigating to `PayslipList` (Allotment, Final Pay), not inside it, and unlock state is session-scoped in memory (re-lock policy: OPEN-QUESTIONS Q-10).
5. Settings menu (header right): Change Password, Delete Account [UNKNOWN], Privacy Policy (external browser; handle `canOpenURL` failure with a message), Log out (confirm dialog).
6. Android hardware back: pops stack; at tab root exits app; no custom interception.
7. Deep links / push: **none** in Flutter. None planned (Q-19).
8. Orientation: portrait by default; landscape supported only if layouts verified (Flutter allowed landscape but used fixed heights).
9. Transitions: platform default (do not replicate global fade).
