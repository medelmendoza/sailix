# 06 — Web Portal Architecture

Status: PROPOSED. One React + TypeScript SPA for **superadmin** and **tenant administrators**. Crew do not use it (default). Tenant-admin functionality is **inferred** from the need to produce the data crew consume (gap G-01/G-20) and must be confirmed before Phase F.

## 1. Stack
Vite + React + TypeScript (strict) · React Router (data routers, route guards) · TanStack Query · Axios (single client, `withCredentials`, XSRF handling) · Zod (form validation + runtime parsing of API errors; response types from generated OpenAPI types) · react-hook-form · Tailwind CSS + Radix primitives (accessible, own component layer; brand tokens from existing palette: navy `#002352`, accent `#2364AA`) · Vitest + React Testing Library + MSW · Playwright (E2E) · ESLint + Prettier. No Redux; no UI mega-framework.

## 2. Structure
```
web/src/
├── app/            router/, providers/ (Query, Auth, Theme), config/ (env)
├── components/     ui/ (Button, Field, Table, Dialog, Toast, EmptyState, ErrorState, Skeleton)
├── layouts/        PublicLayout, PlatformLayout, TenantLayout
├── features/
│   ├── authentication/   login, MFA, forgot/reset, session bootstrap
│   ├── platform/         tenants, tenant-admins, platform-settings, audit
│   └── tenant/           dashboard, users, announcements, todos, documents-review, finance, settings, audit
├── services/       api client, generated types (from contracts/openapi.yaml)
├── hooks/  schemas/  types/  utils/
└── tests/
```

## 3. Experiences

### Superadmin (`/platform/*`) — separate guard and layout
Platform dashboard (tenant counts by status) · Organization directory (search, filter by status, pagination) · Organization details + lifecycle actions with confirmation dialogs and mandatory reason (activate/suspend/reactivate/deactivate/archive) · Provision/invite tenant admin · Platform settings · Platform audit log · Platform admin management. **Not included until evidenced:** plans/subscriptions/billing.

### Tenant admin (`/app/*`)
Dashboard (pending registrations, pending document reviews, expiring documents — from tenant data) · Users (invite, approve registration, activate/suspend, role) · Announcements (compose, attach PDF/image, audience per G-03) · To-dos (assign, due date, status) · Document review queue (approve/reject with reason, view PDF) · Document types · Finance data (payslips/loans: import or manage per D-1) · Organization profile & settings (branding, payslip step-up mode, services flag) · Audit log · Account settings (password, MFA).

## 4. Auth & routing
- Session bootstrap calls `GET /api/v1/me` (tenant) or `/platform/me`; response includes role, tenant summary, abilities list. Router guards render by **role + abilities**, redirect unauthenticated to login, and show a non-leaky 403 page.
- Superadmin routes are code-split into a separate chunk and never loaded for tenant sessions (reduces surface; not a security control).
- Menu entries derive from abilities; **every action is re-checked server-side** — a tampered client gains nothing.
- Tenant context: displayed from the session; the SPA never sends a tenant id as authority. If a user has several memberships, a picker calls `POST /auth/session/membership` (server validates and rotates session).
- Suspended tenant / revoked session: 401/403 interceptor clears Query cache and redirects with a notice.
- CSRF: fetch `/sanctum/csrf-cookie` before login; Axios `xsrfCookieName/HeaderName` configured. CSP strict (no inline scripts), no tokens in `localStorage`.

## 5. UX requirements
Loading skeletons, empty states, error states with retry, confirm dialogs for destructive/lifecycle actions, server-side pagination/search/sort in tables, accessible forms (labels, error association, keyboard), responsive from 360 px to desktop, consistent tokens, dates formatted per locale with ISO preserved in data.

## 6. Tests (see 10)
Component + form validation, route-guard matrix (anonymous / crew / tenant admin / superadmin), tenant switch clears cache, API error mapping, Playwright flows for lifecycle and cross-role denial.
