<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ProvisionModuleRequest;
use App\Models\Tenant;
use App\Modules\Module;
use App\Platform\TenantModules;
use Illuminate\Http\JsonResponse;

class TenantModuleController extends Controller
{
    public function index(Tenant $tenant, TenantModules $modules): JsonResponse
    {
        return response()->json(['data' => $modules->list($tenant)]);
    }

    public function update(ProvisionModuleRequest $request, Tenant $tenant, Module $module, TenantModules $modules): JsonResponse
    {
        return response()->json(['data' => $modules->provision(
            $tenant,
            $module,
            $request->string('external_team_id')->toString(),
            $request->boolean('enabled'),
        )]);
    }
}
