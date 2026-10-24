<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\InviteAdminRequest;
use App\Http\Resources\MembershipResource;
use App\Models\Tenant;
use App\Platform\TenantAdminInviter;
use App\Platform\TenantDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TenantAdminController extends Controller
{
    public function index(Tenant $tenant, TenantDirectory $directory): AnonymousResourceCollection
    {
        return MembershipResource::collection(
            $directory->admins($tenant)->paginate(50),
        );
    }

    public function store(InviteAdminRequest $request, Tenant $tenant, TenantAdminInviter $inviter): JsonResponse
    {
        $result = $inviter->invite($tenant, $request->string('email')->toString(), $request->input('username'), $request->input('display_name'));

        $body = ['data' => (new MembershipResource($result['membership']->load('user')))->resolve()];
        if (config('sailix.expose_invitation_token') && app()->environment(['local', 'testing'])) {
            $body['meta'] = ['invitation_token' => $result['token']]; // local/testing only
        }

        return response()->json($body, 201);
    }
}
