<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\UpdateCrewRequest;
use App\Http\Resources\CrewResource;
use App\Models\CrewProfile;
use App\Models\Membership;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Password;

/** The organization's crew: who they are, where they serve, and the account actions an administrator may take. */
class CrewController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Membership::class);

        $like = fn (string $key) => is_string($request->input($key)) && trim($request->input($key)) !== ''
            ? '%'.addcslashes(trim($request->input($key)), '%_\\').'%' : null;
        $last = $like('filter.last_name');
        $first = $like('filter.first_name');
        $number = $like('filter.crew_number');
        $name = $like('filter.name');
        $status = MembershipStatus::tryFrom((string) $request->input('filter.status'));

        $q = Membership::with(['user', 'profile'])
            ->where('role', Role::Crew)
            ->where('status', '!=', MembershipStatus::Invited)
            ->when($status, fn ($b, $v) => $b->where('status', $v))
            // one box for "who": matches the first or last name, or both together as typed ("maria santos")
            ->when($name, fn ($b, $v) => $b->where(fn ($w) => $w
                ->whereHas('profile', fn ($p) => $p->where(fn ($n) => $n->where('first_name', 'like', $v)->orWhere('last_name', 'like', $v)
                    ->orWhereRaw("concat(first_name, ' ', last_name) like ?", [$v])))
                ->orWhereHas('user', fn ($u) => $u->where('username', 'like', $v))))
            ->when($last, fn ($b, $v) => $b->whereHas('profile', fn ($p) => $p->where('last_name', 'like', $v)))
            ->when($first, fn ($b, $v) => $b->whereHas('profile', fn ($p) => $p->where('first_name', 'like', $v)))
            ->when($number, fn ($b, $v) => $b->whereHas('profile', fn ($p) => $p->where('crew_number', 'like', $v)))
            ->orderBy(CrewProfile::select('last_name')->whereColumn('crew_profiles.membership_id', 'memberships.id')->limit(1))
            ->orderBy(CrewProfile::select('first_name')->whereColumn('crew_profiles.membership_id', 'memberships.id')->limit(1))
            ->orderBy('memberships.id');

        return CrewResource::collection($q->paginate(min((int) $request->input('per_page', 20), 100)));
    }

    public function show(Membership $membership): CrewResource
    {
        Gate::authorize('viewAny', Membership::class);

        return new CrewResource($this->crew($membership));
    }

    public function update(UpdateCrewRequest $request, Membership $membership, TenantContext $context): CrewResource
    {
        Gate::authorize('update', $membership);
        $this->crew($membership);

        $values = $request->validated();
        $profile = $membership->profile;
        if (! $profile) {
            $profile = (new CrewProfile)->forceFill([
                'tenant_id' => $context->tenantId(), 'membership_id' => $membership->getKey(),
                'first_name' => $values['first_name'] ?? '', 'last_name' => $values['last_name'] ?? '',
            ]);
            if ($profile->first_name === '' || $profile->last_name === '') {
                throw ApiProblem::invalid('profile_required', 'First and last name are required.');
            }
        }
        foreach (['crew_number', 'rank', 'fleet', 'vessel', 'employment_status', 'middle_name', 'suffix', 'mobile'] as $field) {
            if (array_key_exists($field, $values) && is_string($values[$field])) {
                $values[$field] = trim($values[$field]) === '' ? null : trim($values[$field]);
            }
        }
        $profile->forceFill($values)->save();

        // Which fields changed, never their values (names, birthday and crew number are personal data).
        Audit::record('crew.updated', $context->tenantId(), $membership, ['fields' => array_keys($values)]);

        return new CrewResource($this->crew($membership->refresh()));
    }

    /** Sends the member the normal reset-by-email link. An administrator never sees or sets a password. */
    public function passwordReset(Membership $membership, TenantContext $context): JsonResponse
    {
        Gate::authorize('update', $membership);
        $crew = $this->crew($membership);

        if ($crew->status !== MembershipStatus::Active) {
            throw ApiProblem::conflict('not_active', 'Only an active member can be sent a password reset.');
        }

        $status = Password::sendResetLink(['email' => $crew->user->email, 'status' => 'active']);
        if ($status === Password::RESET_THROTTLED) {
            throw new ApiProblem(429, 'throttled', 'A reset link was sent a moment ago. Wait a minute and try again.');
        }
        Audit::record('crew.password_reset_sent', $context->tenantId(), $crew);

        return response()->json(['data' => ['status' => 'sent']], 202);
    }

    private function crew(Membership $membership): Membership
    {
        if ($membership->role !== Role::Crew) {
            throw ApiProblem::notFound('Crew member not found.'); // administrators are managed on the Members page
        }

        return $membership->load(['user', 'profile']);
    }
}
