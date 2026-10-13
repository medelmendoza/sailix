<?php

namespace App\Policies;

use App\Models\Membership;
use App\Models\User;
use App\Support\Tenancy\TenantContext;

/** Same-tenant AND role-based. Foreign-tenant records never resolve (global scope ⇒ 404). */
class MembershipPolicy
{
    public function __construct(private TenantContext $context) {}

    public function viewAny(User $user): bool
    {
        return $this->context->has() && $this->context->role()->can('users.view');
    }

    public function update(User $user, Membership $target): bool
    {
        return $this->context->has()
            && $target->tenant_id === $this->context->tenantId()
            && $this->context->role()->can('users.manage')
            // may only manage members whose role does not outrank the actor
            && $this->context->role()->rank() >= $target->role->rank();
    }
}
