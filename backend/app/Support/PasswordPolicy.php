<?php

namespace App\Support;

use App\Support\Settings\SettingsRegistry;
use App\Support\Tenancy\TenantContext;
use Illuminate\Validation\Rules\Password;

/** Default: min 8 (Q-5 pending). Platform sets the floor; a tenant may only raise it. */
final class PasswordPolicy
{
    public static function rule(?string $tenantId = null): Password
    {
        $context = app(TenantContext::class);
        $min = $context->has() && ($tenantId === null || $tenantId === $context->tenantId())
            ? (int) SettingsRegistry::tenant('password_min_length')
            : (int) SettingsRegistry::platform('password_min_length');

        return Password::min($min);
    }
}
