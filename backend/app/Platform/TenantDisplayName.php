<?php

namespace App\Platform;

use App\Models\Tenant;
use App\Models\TenantSetting;

/** The name an organization chose to show (its `display_name` setting), read before any tenant context exists. */
final class TenantDisplayName
{
    public static function of(Tenant $tenant): string
    {
        $value = TenantSetting::withoutTenantScope()->where('tenant_id', $tenant->getKey())->where('key', 'display_name')->first()?->value;

        return is_string($value) && $value !== '' ? $value : $tenant->name;
    }
}
