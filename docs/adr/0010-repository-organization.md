# ADR-0010 — Repository organization
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Context:** Three apps sharing one API contract; likely the same small team; different toolchains (PHP, Vite, Expo/EAS) and release cadences.
**Options:** (1) monorepo with `backend/ web/ mobile/ contracts/ docs/`; (2) three repos; (3) monorepo with a JS workspace tool.
**Recommended:** (1) single git repo, three independent projects, **no shared JS workspace** (Expo/Metro + workspaces adds friction), path-filtered CI, contract + generated types as the only shared artifact.
**Trade-offs:** Atomic contract changes and one review flow vs. coarser access control and a larger repo; mobile builds still release independently via EAS.
**Security implications:** Single place for secret scanning/policy; no per-app repo permissions.
**Consequences:** Split later is cheap (folders already independent).
**Open questions:** ownership/team split; whether `sailix-rn` history (none yet) matters.
