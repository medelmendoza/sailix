# 08 — Local Storage

## Flutter (observed)

| Key | Store | Content | Written | Read | Deleted | Sensitivity |
|---|---|---|---|---|---|---|
| `userData` | SharedPreferences (plaintext) | JSON `{userId, crewId, lastName, firstName, middleName, fullName, userName, email, contactNo, birthDate, clientCode}` — **no token** | after login+getUser | app start (auto-login) | `prefs.clear()` on logout | **PII**; `birthDate` doubles as the payslip password |
| `attAsked` | SharedPreferences | bool (iOS tracking prompt asked) | Dashboard | Dashboard | wiped by `clear()` on logout (prompt re-shown) | low |
| (files) | App documents / external dir | PDFs picked for upload, copied under original name, never deleted | upload | update flow | never | **identity/seafarer documents**, unencrypted |
| (temp) | temp dir | ASTRA PDFs copied from assets; scan outputs | — | — | OS | low |

No token persistence, no secure storage, no offline data cache, PDF cache disabled.

## RN target

| Data | Store | Rationale |
|---|---|---|
| Access token | `expo-secure-store` (Keychain / Keystore) | Secret. `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. |
| Profile (`UserProfile`) | `expo-secure-store` (single small JSON) | Contains PII incl. DOB; small. Avoid duplicating beyond what screens need. |
| Server data (lists, details) | TanStack Query **in-memory** cache only | Financial/PII data must not persist unencrypted. Cleared on logout. |
| UI prefs (last tab, sort order) | `@react-native-async-storage/async-storage` | Non-sensitive. Tab not restored across logins. |
| Picked/scanned files | App cache dir; **delete after successful upload or on cancel** | Fixes Flutter storage leak/PII residue. |
| ATT flag | none | ATT prompt removed (DASH-06, pending confirmation). |
| Payslip unlock state | memory only (Zustand, not persisted) | Re-lock on background/timeout (Q-10). |

### Lifecycle rules
1. Login success → write token + profile atomically; failure of profile fetch → write nothing.
2. Launch → read token+profile; missing either → logged out.
3. Logout / 401 → delete secure items, `queryClient.clear()`, reset stores, delete cached upload files.
4. No data is ever written to logs.
5. Android: set `allowBackup=false` (or exclude secure-store) so tokens aren't restored from backups; iOS: Keychain item not synced.

## ASTRA (if shipped)
No persistence in Flutter (state lost on leaving). Optional improvement: remember last chosen sound/duration in AsyncStorage (non-sensitive).
