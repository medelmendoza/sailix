<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\Settings\SettingsRegistry;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request, TenantContext $context): JsonResponse
    {
        $user = $request->user();
        $membership = $request->attributes->get('membership');

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
            ],
            'abilities' => $context->role()->abilities(),
            'features' => ['services_enabled' => (bool) SettingsRegistry::tenant('services_enabled')],
        ]]);
    }
}
