<?php

namespace App\Http\Controllers\Api\V1\Me;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\DeletionRequestResource;
use App\Mail\DeletionRequested;
use App\Models\DeletionRequest;
use App\Models\Membership;
use App\Models\Tenant;
use App\Support\Audit;
use App\Support\SafeMailer;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Q-3: records the request and tells the organization's administrators. Nothing is deleted or anonymized
 * and access is unchanged: processing semantics and retention are still an open decision.
 */
class DeletionRequestController extends Controller
{
    public function store(Request $request, TenantContext $context): JsonResponse
    {
        $membershipId = $context->membershipId();

        $existing = DeletionRequest::where('membership_id', $membershipId)->first();
        if ($existing === null) {
            try {
                $existing = (new DeletionRequest)->forceFill([
                    'membership_id' => $membershipId, 'status' => 'pending', 'requested_at' => now(),
                ]);
                $existing->save(); // tenant_id is stamped from the context
            } catch (QueryException) {
                // lost a race with a concurrent identical request: return the winner
                $existing = DeletionRequest::where('membership_id', $membershipId)->firstOrFail();
            }

            Audit::record('deletion.requested', $context->tenantId(), $existing);
            $organization = Tenant::findOrFail($context->tenantId())->name;
            Membership::with('user')->where('role', Role::TenantAdmin)->where('status', MembershipStatus::Active)->get()
                ->each(fn (Membership $admin) => SafeMailer::send($admin->user->email, new DeletionRequested($organization)));
        }

        return (new DeletionRequestResource($existing))->response()->setStatusCode(202);
    }
}
