# ADR-0007 — Expo vs bare React Native
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Context:** Required natives: scanner, PDF viewer, picker, secure storage, optional audio/biometrics; no push/background/custom SDKs.
**Options:** Expo dev builds + prebuild (CNG) + EAS; bare RN CLI.
**Recommended:** Expo (dev builds, not Expo Go), prebuild, EAS Build/Submit.
**Trade-offs:** Dependence on Expo SDK cadence; native module needs via config plugins/local modules.
**Security implications:** Managed signing fixes the debug-key release issue (Q-22).
**Consequences:** `ios/` `android/` generated; spikes S1/S2 are exit criteria.
**Open questions:** Q-22 store identity; S1–S3 outcomes.
