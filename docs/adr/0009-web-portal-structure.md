# ADR-0009 — Web portal structure
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Options:** two SPAs (platform, tenant); one SPA with role-split routes.
**Recommended:** One Vite/React/TS SPA, `features/{authentication,platform,tenant}`, separate layouts/guards, platform chunk code-split, ability-driven navigation, Tailwind + Radix component layer.
**Trade-offs:** One bundle pipeline vs stronger physical separation of superadmin UI (backend still the enforcement point; a separate deployment can be split out later).
**Security implications:** No token in JS storage; strict CSP.
**Consequences:** Generated API types shared via contract tooling.
**Open questions:** UI kit preference.
