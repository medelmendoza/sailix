<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\SetModuleEnabledRequest;
use App\Modules\Module;
use App\Modules\ModuleAccess;
use App\Modules\SetModuleEnabled;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class ModuleController extends Controller
{
    public function index(ModuleAccess $access): JsonResponse
    {
        Gate::authorize('tenant.view');

        return response()->json(['data' => $access->forTenant()]);
    }

    public function update(SetModuleEnabledRequest $request, Module $module, SetModuleEnabled $toggle, ModuleAccess $access): JsonResponse
    {
        $toggle($module, $request->boolean('enabled'));

        return response()->json(['data' => collect($access->forTenant())->firstWhere('code', $module->value)]);
    }
}
