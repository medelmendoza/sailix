# React Native Platform Decision — Expo (development builds / prebuild) vs bare CLI

**Decision: Expo, using development builds and Continuous Native Generation (`expo prebuild`) with EAS Build. Not Expo Go. Not a hand-maintained bare project.**

Status: SPECIFIED (revisit if spike S1 or S2 fails — see "Exit criteria").

## What the Flutter app actually needs
Camera-based **document scanning**, **PDF rendering**, **file picking**, **audio playback**, **keep-awake**, secure storage, external URL open, file sharing/opening. No push, no background tasks, no Bluetooth, no custom native SDKs, no app extensions, no deep links, no native code in `AppDelegate.swift` (stock template), no Firebase.

## Evaluation

| Criterion | Expo (dev build + prebuild) | Bare RN CLI |
|---|---|---|
| Document picker, secure store, audio, keep-awake, image, sharing, print, web browser, netinfo, biometrics | First-party modules | Third-party libs, manual linking/config |
| Scanner (`react-native-document-scanner-plugin`), PDF (`react-native-pdf`) | Work via config plugins / prebuild in dev builds (not Expo Go) | Native, direct |
| Custom native code if a spike fails | Allowed: local modules / config plugins; `ios/` `android/` generated and can be ejected from CNG | Native |
| Build & signing | EAS Build/Submit; credentials managed (fixes debug-key release signing) | Manual Gradle/Xcode/Fastlane |
| Upgrades | SDK-versioned, templated | Manual diffs |
| OTA JS updates | EAS Update available (decide policy; Q-33) | Needs CodePush replacement |
| Team size/skills | Small team; less native maintenance | More native expertise needed |

No discovered capability requires bare RN. Both native-module dependencies are supported through Expo's prebuild model.

## Consequences
- Use `npx expo prebuild` (CNG): `android/`/`ios/` are **generated and git-ignored**; native config lives in `app.config.ts` + config plugins.
- Development uses a custom **dev client**; CI builds via EAS profiles `development`, `staging`, `production`.
- Use the **latest stable Expo SDK at project creation** (verify the version and New Architecture status then; do not pin from memory). Hermes + New Architecture default.
- Keep `com.btsolve.sailix2` identifiers only if Q-22 confirms continuity with the existing store listings.

## Exit criteria (switch to bare/`expo prebuild` + manual native only if…)
- S1 scanner cannot produce acceptable PDFs on both platforms with any maintained plugin **and** a local native module is cleaner outside CNG.
- S2 PDF viewer cannot meet memory/auth needs with Expo-compatible libs.
Even then, Expo prebuild with a local module is preferred before abandoning Expo.
