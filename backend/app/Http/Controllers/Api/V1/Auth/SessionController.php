<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SelectMembershipRequest;
use App\Http\Requests\Auth\SessionLoginRequest;
use App\Identity\LoginFlow;
use App\Models\Membership;
use App\Models\User;
use App\Support\Audit;
use App\Tenancy\AddressedTenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

/** Web tenant-admin cookie session (Sanctum SPA). The chosen membership lives only in the server-side session. */
class SessionController extends Controller
{
    public function __construct(private LoginFlow $flow) {}

    public function store(SessionLoginRequest $request): JsonResponse
    {
        $result = $this->flow->begin(
            $request->string('username')->toString(),
            $request->string('password')->toString(),
            app(AddressedTenant::class)->agencyCodeFor($request->input('agency_code')),
            'session',
        );

        if ($result['membership'] === null) {
            return response()->json(['data' => [
                'requires_tenant_selection' => true,
                'ticket' => $result['ticket'],
                'memberships' => $result['memberships']->map(fn (Membership $m) => [
                    'id' => $m->getKey(), 'role' => $m->role->value,
                    'tenant' => ['code' => $m->tenant->code, 'name' => $m->tenant->name],
                ])->all(),
            ]]);
        }

        return $this->start($request, $result['user'], $result['membership']);
    }

    public function select(SelectMembershipRequest $request): JsonResponse
    {
        $result = $this->flow->complete($request->string('ticket')->toString(), $request->string('membership_id')->toString(), 'session');

        return $this->start($request, $result['user'], $result['membership']);
    }

    public function destroy(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    private function start(Request $request, User $user, Membership $membership): JsonResponse
    {
        // A browser session holds either a tenant login or a platform login, never both.
        Auth::guard('platform')->logout();
        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->put('membership_id', $membership->getKey());
        $user->forceFill(['last_login_at' => now()])->save();
        Audit::record('auth.session_login', $membership->tenant_id, $membership, [], $user);

        return response()->json(['data' => [
            'membership' => ['id' => $membership->getKey(), 'role' => $membership->role->value],
            'tenant' => ['code' => $membership->tenant->code, 'name' => $membership->tenant->name],
        ]]);
    }
}
