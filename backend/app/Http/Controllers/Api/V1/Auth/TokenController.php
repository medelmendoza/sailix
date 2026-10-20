<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SelectMembershipRequest;
use App\Http\Requests\Auth\SwitchMembershipRequest;
use App\Http\Requests\Auth\TokenLoginRequest;
use App\Identity\LoginFlow;
use App\Identity\MembershipDirectory;
use App\Identity\TokenIssuer;
use App\Models\Membership;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Tenancy\AddressedTenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Mobile token auth (docs/04, docs/08 §1). Tokens are bound to one membership. */
class TokenController extends Controller
{
    public function __construct(private LoginFlow $flow, private TokenIssuer $issuer, private MembershipDirectory $directory) {}

    public function store(TokenLoginRequest $request): JsonResponse
    {
        $result = $this->flow->begin(
            $request->string('username')->toString(),
            $request->string('password')->toString(),
            app(AddressedTenant::class)->agencyCodeFor($request->input('agency_code')),
            'token',
        );

        if ($result['membership'] === null) {
            return $this->selection($result);
        }

        return $this->issue($result['user'], $result['membership'], $request->string('device_name')->toString(), 'auth.token_login');
    }

    public function select(SelectMembershipRequest $request): JsonResponse
    {
        $result = $this->flow->complete($request->string('ticket')->toString(), $request->string('membership_id')->toString(), 'token');

        return $this->issue($result['user'], $result['membership'], 'mobile', 'auth.token_login');
    }

    public function refresh(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $current = $user->currentAccessToken();
        if (! $current instanceof PersonalAccessToken) {
            throw ApiProblem::unauthenticated();
        }
        $started = $current->chain_started_at ?? $current->created_at;
        if ($started->copy()->addDays(config('sailix.token_max_days'))->isPast()) {
            throw ApiProblem::unauthenticated('Session lifetime exceeded; sign in again.');
        }

        $membership = $request->attributes->get('membership');
        $new = $this->issuer->issue($user, $membership, $current->name, $started);
        $current->delete();

        return $this->tokenResponse($new, $membership);
    }

    public function switch(SwitchMembershipRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $current = $user->currentAccessToken();
        $target = $this->directory->findForUser($request->string('membership_id')->toString(), $user);

        if (! $current instanceof PersonalAccessToken || ! $target || ! MembershipDirectory::isUsable($target)) {
            throw ApiProblem::forbidden('forbidden', 'You cannot switch to that organization.');
        }

        $new = $this->issuer->issue($user, $target, $current->name, $current->chain_started_at);
        $current->delete();
        Audit::record('auth.tenant_switched', $target->tenant_id, $target);

        return $this->tokenResponse($new, $target);
    }

    public function destroy(Request $request): Response
    {
        $token = $request->user()->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->noContent();
    }

    private function issue(User $user, Membership $membership, string $device, string $audit): JsonResponse
    {
        $user->forceFill(['last_login_at' => now()])->save();
        $new = $this->issuer->issue($user, $membership, $device);
        Audit::record($audit, $membership->tenant_id, $membership, [], $user);

        return $this->tokenResponse($new, $membership);
    }

    /** @param array{plain: string, token: PersonalAccessToken} $new */
    private function tokenResponse(array $new, Membership $membership): JsonResponse
    {
        return response()->json(['data' => [
            'token' => $new['plain'],
            'expires_at' => $new['token']->expires_at?->toIso8601String(),
            'membership' => $this->membershipSummary($membership),
        ]]);
    }

    /** @param array<string, mixed> $result */
    private function selection(array $result): JsonResponse
    {
        return response()->json(['data' => [
            'requires_tenant_selection' => true,
            'ticket' => $result['ticket'],
            'memberships' => $result['memberships']->map(fn (Membership $m) => $this->membershipSummary($m))->all(),
        ]]);
    }

    /** @return array<string, mixed> */
    private function membershipSummary(Membership $m): array
    {
        return [
            'id' => $m->getKey(),
            'role' => $m->role->value,
            'tenant' => ['id' => $m->tenant->getKey(), 'code' => $m->tenant->code, 'name' => $m->tenant->name],
        ];
    }
}
