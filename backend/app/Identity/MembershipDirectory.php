<?php

namespace App\Identity;

use App\Models\Membership;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Cross-tenant identity lookups that must happen BEFORE a tenant context exists
 * (login, token resolution). One of the two places allowed to use withoutTenantScope().
 */
final class MembershipDirectory
{
    /** @return Collection<int, Membership> memberships (tenant eager-loaded) */
    public function forUser(User $user, ?string $agencyCode = null): Collection
    {
        return Membership::withoutTenantScope()
            ->with('tenant')
            ->where('user_id', $user->getKey())
            ->when($agencyCode !== null, fn ($q) => $q->whereHas('tenant', fn ($t) => $t->where('code', strtoupper($agencyCode))))
            ->get();
    }

    public function findForUser(string $membershipId, User $user): ?Membership
    {
        return Membership::withoutTenantScope()
            ->with('tenant')
            ->whereKey($membershipId)
            ->where('user_id', $user->getKey())
            ->first();
    }

    /** Active membership in an active tenant. */
    public static function isUsable(Membership $membership): bool
    {
        return $membership->isActive() && $membership->tenant->isActive();
    }
}
