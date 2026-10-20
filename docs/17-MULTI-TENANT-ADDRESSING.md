# Multi-tenant addressing and branding

How an organization is reached and how it looks. Isolation of the data itself is unchanged (docs/03): every tenant-owned table
carries `tenant_id`, models use `BelongsToTenant`, and the tenant context is established from the authenticated credential.
This adds three things on top: an **address** per organization, a **look** per organization, and a check that a credential is
used only on its own organization's address. The design follows the schoolhub system's, adapted to Sailix (one login can have
several memberships; the mobile app has no address).

## 1. Address

Every organization has a `slug` (3 to 40 characters, lowercase letters, digits and single hyphens, unique, not reserved:
`www api admin platform app mail …`). It starts as the lowercase agency code and cannot change after creation. Its default
address is `<slug>.<SAILIX_BASE_DOMAIN>`.

A customer may add **custom domains** (`tenant_domains`). A domain is normalized (lowercase, no port, no trailing dot, punycode,
no leading `www`, so `Example.com`, `www.example.com:443` and `example.com.` are one domain). It starts unverified and routes
nothing. The organization publishes a DNS TXT record `_sailix-challenge.<domain>` with a generated token; `POST …/verify` looks it
up. Only then does the domain route traffic. A verified domain belongs to one organization (a unique index over
`verified_domain`); another organization's unverified claim gives no rights, and verifying drops it.

### Which organization a request addresses (`TenantAddress`)
1. The Host header: a verified custom domain, else `<slug>.<base domain>` (in development also `<slug>.localhost`).
2. `X-Tenant-Host`: when the web portal and API are on different hosts the portal says which host it is on. Used only when
   the API's own host matches no organization.
3. `X-Tenant-Slug`: only when `SAILIX_TENANT_ALLOW_SLUG_HEADER=true` (shared-address **demos**), and only after 1 and 2 found nothing.

No match means "no organization addressed" (the shared sign-in, the mobile app, the platform): nothing breaks. An organization
that is suspended, deactivated or archived answers 403 `tenant_unavailable` on its address.

### Nothing here authorizes anything
- **Sign-in and registration** on an organization's own address need no agency code; a code naming another organization is
  refused (`422 tenant_mismatch`). Without an address the agency code decides, as before.
- **Credentials are bound to their organization.** A token or session used on another organization's address answers 401
  (including through `X-Tenant-Host`). The mobile app, which has no address, is unaffected. The superadmin routes ignore the address.
- The slug header only chooses what a request addresses. Knowing a slug grants no access.
- **Development switches** (`SAILIX_TENANT_DEV_MODE`) are honoured only in `local`/`testing`. `SAILIX_TENANT_ALLOW_SLUG_HEADER` is
  for demos; leave it off in production.

### Browsers (CORS and cookies)
Allowed origins are `SAILIX_WEB_ORIGINS` plus, per request, `https://<slug>.<base domain>` and any verified custom domain (never `*`;
credentials stay on). The same hosts count as first-party for the Sanctum session cookie. Plain `http` is for development only.

## 2. Look (branding)

`tenant_branding`: one optional row per organization, every field optional (empty = the Sailix default): tagline, primary and
secondary colour, logo, favicon, and a `version` that changes with every edit. The organization's name is its existing
`display_name` setting, falling back to the registered name.

- Colours are `#RRGGBB` and must have a contrast of at least 4.5:1 against white (they carry white button text). Text has no markup.
  There is no custom CSS, HTML or script.
- Logo and favicon: JPEG or PNG judged by content (no SVG), at most 5 MB, resized (512 / 128 px) and re-encoded (drops metadata),
  stored on the private disk under `branding/{tenantId}/` with a random name, replaced or removed together with the old file.
- `GET /api/v1/public/tenant` returns the name and look of the addressed organization (no ids, no people). Images are served at
  `/api/v1/public/tenants/{slug}/logo|favicon?v=<version>` (the sign-in page needs them before anyone is signed in); an organization
  that is switched off serves none.
- Web: the portal draws itself with CSS variables derived from the two colours and shows the logo and name; it caches the last look
  per address only to avoid a flash.
- **Who edits:** an organization's administrators (`tenant.manage`) on *Branding* and *Domains*; the superadmin on the organization page of the console (*Address and domains*, *Branding*, with a reset to the Sailix look), and
  can choose the address name when creating an organization.

## 3. Shared-address demos

`https://<host>/login?tenant=<slug>` stores the slug in the browser, removes it from the address and sends it as `X-Tenant-Slug`.
`?tenant=reset` forgets it. Built in only with `VITE_TENANT_SLUG_SWITCH=true` and honoured by the API only with
`SAILIX_TENANT_ALLOW_SLUG_HEADER=true`.

## 4. Deployment notes
- DNS: a wildcard `*.<base domain>` to the deployment; custom domains CNAME to `<slug>.<base domain>` after verification.
- The proxy must keep the Host (or send `X-Forwarded-Host` and list the proxy in `SAILIX_TRUSTED_PROXIES`).
- Set `VITE_TENANT_APEX_HOSTS` to the shared sign-in host(s); any other host is treated as an organization's own address.
- DNS verification runs from the API host and needs outbound DNS.

## 5. Not covered
Plans and limits, groups of organizations, per-organization colours in the mobile app (it shows no look yet), and choosing a primary domain for emailed links (they use `SAILIX_RESET_URL`).
