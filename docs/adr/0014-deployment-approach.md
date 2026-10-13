# ADR-0014 — Deployment approach
Status: **APPROVED 2026-10-13 (user approved architecture with the documented defaults)**
**Recommended:** Containerized API/workers/scheduler, static web build, managed MySQL + Redis + S3-compatible storage, EAS for mobile; dev/staging/prod separation; expand/contract migrations; quarterly restore drills. No provider-specific code.
**Trade-offs:** Portability over provider-native convenience.
**Security implications:** Secrets in a manager, TLS/HSTS, private storage, encrypted backups.
**Open questions:** provider, region, RTO/RPO, email provider.
