<?php

namespace App\Platform;

use App\Enums\Role;
use App\Models\Membership;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;

/** Platform-side cross-tenant reads (sanctioned withoutTenantScope() location). */
final class TenantDirectory
{
    /** @return Builder<Membership> */
    public function admins(Tenant $tenant): Builder
    {
        return Membership::withoutTenantScope()->with('user')
            ->where('tenant_id', $tenant->getKey())->where('role', Role::TenantAdmin)
            ->orderBy('created_at')->orderBy('id');
    }
}
