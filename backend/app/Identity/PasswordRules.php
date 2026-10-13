<?php

namespace App\Identity;

use App\Models\Membership;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Models\User;
use App\Support\Settings\SettingsRegistry;
use Illuminate\Validation\Rules\Password;

/**
 * Password policy where NO tenant context exists yet (registration, reset): the platform minimum, raised by any
 * stricter minimum of the organizations involved (a tenant may only tighten; Q-5 default 8).
 * Cross-tenant setting reads are why this lives in app/Identity.
 */
final class PasswordRules
{
    /** @param list<string> $tenantIds */
    public static function forTenantIds(array $tenantIds): Password
    {
        $min = (int) SettingsRegistry::platform('password_min_length');

        if ($tenantIds !== []) {
            foreach (TenantSetting::withoutTenantScope()->whereIn('tenant_id', $tenantIds)->where('key', 'password_min_length')->get() as $row) {
                $min = max($min, (int) $row->value);
            }
        }

        return Password::min($min);
    }

    public static function forAgencyCode(?string $code): Password
    {
        $tenantId = $code === null ? null : Tenant::where('code', strtoupper(trim($code)))->value('id');

        return self::forTenantIds($tenantId === null ? [] : [$tenantId]);
    }

    public static function forEmail(?string $email): Password
    {
        $user = $email === null ? null : User::where('email', $email)->first();

        return self::forUser($user);
    }

    public static function forUser(?User $user): Password
    {
        if ($user === null) {
            return self::forTenantIds([]);
        }

        return self::forTenantIds(
            Membership::withoutTenantScope()->where('user_id', $user->getKey())->pluck('tenant_id')->all(),
        );
    }
}
