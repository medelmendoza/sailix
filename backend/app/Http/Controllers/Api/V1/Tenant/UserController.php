<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\UpdateMembershipRequest;
use App\Http\Resources\MembershipResource;
use App\Identity\TokenIssuer;
use App\Models\Membership;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Membership::class);

        $q = Membership::with('user')
            ->when($request->input('filter.status'), fn ($b, $v) => $b->where('status', $v))
            ->when($request->input('filter.role'), fn ($b, $v) => $b->where('role', $v))
            ->when($request->input('filter.q'), fn ($b, $v) => $b->whereHas('user', fn ($u) => $u->where('username', 'like', '%'.addcslashes($v, '%_\\').'%')))
            ->orderBy('created_at')->orderBy('id');

        return MembershipResource::collection($q->paginate(min((int) $request->input('per_page', 20), 100)));
    }

    public function update(UpdateMembershipRequest $request, Membership $membership, TenantContext $context, TokenIssuer $tokens): MembershipResource
    {
        Gate::authorize('update', $membership);

        $newRole = $request->has('role') ? Role::from($request->input('role')) : null;
        $newStatus = $request->has('status') ? MembershipStatus::from($request->input('status')) : null;

        if ($newRole && $newRole->rank() > $context->role()->rank()) {
            throw ApiProblem::forbidden('forbidden', 'You cannot grant a role above your own.');
        }
        if (in_array($membership->status, [MembershipStatus::Invited], true)) {
            throw ApiProblem::conflict('invalid_transition', 'Invited members activate through their invitation.');
        }

        DB::transaction(function () use ($membership, $newRole, $newStatus, $context, $tokens) {
            $locked = Membership::whereKey($membership->getKey())->lockForUpdate()->firstOrFail();
            $before = ['role' => $locked->role->value, 'status' => $locked->status->value];

            $losesAdmin = $locked->role === Role::TenantAdmin && $locked->isActive()
                && (($newRole && $newRole !== Role::TenantAdmin) || $newStatus === MembershipStatus::Suspended);
            if ($losesAdmin) {
                $admins = Membership::where('role', Role::TenantAdmin)->where('status', MembershipStatus::Active)->lockForUpdate()->count();
                if ($admins <= 1) {
                    throw ApiProblem::conflict('last_admin', 'The last active administrator cannot be removed or suspended.');
                }
            }

            $locked->forceFill(array_filter(['role' => $newRole, 'status' => $newStatus]))->save();

            if ($newStatus === MembershipStatus::Suspended || ($newRole && $newRole->value !== $before['role'])) {
                $tokens->revokeForMembership($locked->getKey());
            }
            Audit::record('membership.updated', $context->tenantId(), $locked, ['before' => $before, 'after' => ['role' => $locked->role->value, 'status' => $locked->status->value]]);
        });

        return new MembershipResource($membership->refresh()->load('user'));
    }
}
