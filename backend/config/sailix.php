<?php

return [
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
