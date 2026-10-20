<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProfileResource;
use App\Identity\MembershipDirectory;
use App\Models\Membership;
use App\Modules\ModuleAccess;
use App\Support\Settings\SettingsRegistry;
use App\Support\Tenancy\TenantContext;
use App\Tenancy\TenantBrandingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request, TenantContext $context, ModuleAccess $modules, MembershipDirectory $directory): JsonResponse
    {
        $user = $request->user();
        $membership = $request->attributes->get('membership');
        $membership->load('profile'); // tenant-scoped relation: the context is established

        return response()->json(['data' => [
            'user' => [
                'id' => $user->getKey(),
                'username' => $user->username,
                'email' => $user->email,
                'display_name' => $user->display_name,
            ],
            'membership' => ['id' => $membership->getKey(), 'role' => $membership->role->value, 'status' => $membership->status->value],
            'tenant' => [
                'id' => $membership->tenant->getKey(),
                'code' => $membership->tenant->code,
                'name' => SettingsRegistry::tenant('display_name') ?? $membership->tenant->name,
                // how the organization looks (colours, logo), for clients that have no address to ask the public endpoint with
                'look' => app(TenantBrandingService::class)->publicPayload($membership->tenant),
            ],
            'profile' => $membership->profile ? (new ProfileResource($membership->profile))->resolve() : null,
            'abilities' => $context->role()->abilities(),
            'modules' => $modules->forMembership($membership),
            'memberships' => $directory->forUser($user)
                ->filter(fn (Membership $m) => MembershipDirectory::isUsable($m))
                ->map(fn (Membership $m) => [
                    'id' => $m->getKey(),
                    'role' => $m->role->value,
                    'tenant' => ['id' => $m->tenant->getKey(), 'code' => $m->tenant->code, 'name' => $m->tenant->name],
                    'current' => $m->is($membership),
                ])
                ->values()
                ->all(),
        ]]);
    }
}
