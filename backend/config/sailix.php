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

    'web_origins' => array_values(array_filter(explode(',', (string) env('SAILIX_WEB_ORIGINS', 'http://localhost:5173')))),
];
