<?php

namespace App\Platform;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Enums\UserStatus;
use App\Identity\TokenIssuer;
use App\Models\Membership;
use App\Models\PlatformAdmin;
use App\Models\Tenant;
use App\Support\ApiProblem;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

final class TenantLifecycle
{
    public function __construct(private TokenIssuer $tokens) {}

    public function apply(Tenant $tenant, TenantTransition $transition, ?string $reason, PlatformAdmin $actor): Tenant
    {
        if ($transition->requiresReason() && trim((string) $reason) === '') {
            throw new ApiProblem(422, 'validation', 'A reason is required.', ['reason' => ['A reason is required for this action.']]);
        }

        return DB::transaction(function () use ($tenant, $transition, $reason, $actor) {
            $locked = Tenant::whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();

            if (! in_array($locked->status, $transition->allowedFrom(), true)) {
                throw ApiProblem::conflict('invalid_transition', "Cannot {$transition->value} a tenant that is {$locked->status->value}.");
            }

            if ($transition === TenantTransition::Activate && ! $this->hasActiveAdmin($locked)) {
                throw ApiProblem::invalid('no_active_admin', 'Activation requires at least one active tenant administrator.');
            }

            $from = $locked->status;
            $locked->status = $transition->to();
            if ($transition === TenantTransition::Activate) {
                $locked->activated_at = now();
            }
            if ($transition === TenantTransition::Archive) {
                $locked->archived_at = now();
            }
            $locked->save();

            if ($transition->revokesAccess()) {
                $this->tokens->revokeForTenant($locked->getKey());
            }

            Audit::record("tenant.{$transition->value}", $locked->getKey(), $locked, [
                'from' => $from->value, 'to' => $locked->status->value, 'reason' => $reason,
            ], $actor);

            return $locked;
        });
    }

    private function hasActiveAdmin(Tenant $tenant): bool
    {
        return Membership::withoutTenantScope()
            ->where('tenant_id', $tenant->getKey())
            ->where('role', Role::TenantAdmin)
            ->where('status', MembershipStatus::Active)
            ->whereHas('user', fn ($q) => $q->where('status', UserStatus::Active))
            ->exists();
    }
}
