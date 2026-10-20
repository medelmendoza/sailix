<?php

return [
    // Crew documents are stored on a PRIVATE disk (never web-served). Switch to an s3 disk in production once the
    // storage decision is made (docs/16); nothing else changes.
    'documents' => ['disk' => env('SAILIX_DOCUMENTS_DISK', 'local')],

    // Superadmin one-time code. Only a local or testing environment can switch it off (see App\Support\PlatformMfa).
    'platform' => ['require_otp' => filter_var(env('SAILIX_PLATFORM_REQUIRE_OTP', true), FILTER_VALIDATE_BOOLEAN)],

    // How long a password re-entry unlocks the payslips (seconds). Applies when the organization's `payslip_step_up` is `password`.
    'finance_unlock_ttl' => (int) env('SAILIX_FINANCE_UNLOCK_TTL', 300),

    // Mobile token lifetime (sliding, rotated by /auth/token/refresh) and absolute chain limit.
    'token_ttl_days' => (int) env('SAILIX_TOKEN_TTL_DAYS', 30),
    'token_max_days' => (int) env('SAILIX_TOKEN_MAX_DAYS', 90),

    // Login ticket for multi-membership selection (seconds).
    'ticket_ttl' => 300,

    'invitation_ttl_hours' => 72,

    // Local/testing only: include the one-time invitation token in the API response.
    // Production delivers it by email (provider pending, decision D-11).
    'expose_invitation_token' => (bool) env('SAILIX_EXPOSE_INVITATION_TOKEN', false),

    // Platform (superadmin) session idle timeout in minutes (docs/04).
    'platform_idle_minutes' => (int) env('SAILIX_PLATFORM_IDLE_MINUTES', 30),

    // How organizations are addressed (docs: multi-tenancy). The host picks the organization:
    // <slug>.<base_domain>, or a customer's verified domain. Nothing here grants access: a signed-in credential must
    // still belong to the organization the request addresses.
    'tenancy' => [
        'base_domain' => strtolower((string) env('SAILIX_BASE_DOMAIN', 'localhost')),
        'platform_slug' => env('SAILIX_PLATFORM_SLUG', 'platform'),
        // `<slug>.localhost` addresses an organization. Honoured only in a local or testing environment.
        'dev_mode' => filter_var(env('SAILIX_TENANT_DEV_MODE', false), FILTER_VALIDATE_BOOLEAN),
        // When the web portal and the API are on different hosts, the portal says which host it is on (X-Tenant-Host).
        // Used only when the API's own host matches no organization.
        'allow_host_header' => filter_var(env('SAILIX_TENANT_ALLOW_HOST_HEADER', true), FILTER_VALIDATE_BOOLEAN),
        // Shared-address demos: `?tenant=<slug>` on the sign-in page becomes X-Tenant-Slug. DEMO ONLY: anyone can pick
        // an organization by slug. It chooses what a request addresses; it never authorizes anything.
        'allow_slug_header' => filter_var(env('SAILIX_TENANT_ALLOW_SLUG_HEADER', false), FILTER_VALIDATE_BOOLEAN),
        // Prefix of the DNS TXT record a customer publishes to prove they own a domain.
        'challenge_prefix' => '_sailix-challenge',
    ],

    // Optional client hint header; compared with the authenticated tenant, never trusted.
    'tenant_hint_header' => 'X-Tenant-Hint',

    // Module integration settings. Allow-lists are deployment configuration, never editable through the API.
    'modules' => [
        'tala' => [
            // Exact host names the Tala gateway may ever contact (HTTPS only). Empty = nothing is allowed.
            'allowed_hosts' => array_values(array_filter(array_map('trim', explode(',', (string) env('SAILIX_TALA_ALLOWED_HOSTS', ''))))),
            // Progress submission WRITES to Tala. Off until the owner has approved a write test and the server's
            // replace/merge behaviour is verified (docs/13 §20). Closed = no upstream call is ever made.
            'progress_writes' => (bool) env('SAILIX_TALA_PROGRESS_WRITES', false),
        ],
    ],

    // Page of the web portal that completes a password reset (emailed link target).
    'reset_password_url' => env('SAILIX_RESET_URL') ?: rtrim((string) (explode(',', (string) env('SAILIX_WEB_ORIGINS', 'http://localhost:5173'))[0]), '/').'/reset-password',

    'web_origins' => array_values(array_filter(explode(',', (string) env('SAILIX_WEB_ORIGINS', 'http://localhost:5173')))),
];
