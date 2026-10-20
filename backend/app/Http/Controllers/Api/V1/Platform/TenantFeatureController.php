<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\UpdateFeaturesRequest;
use App\Models\Tenant;
use App\Platform\TenantFeatures;
use Illuminate\Http\JsonResponse;

class TenantFeatureController extends Controller
{
    public function index(Tenant $tenant, TenantFeatures $features): JsonResponse
    {
        return response()->json(['data' => $features->list($tenant)]);
    }

    public function update(UpdateFeaturesRequest $request, Tenant $tenant, TenantFeatures $features): JsonResponse
    {
        $features->update($tenant, array_map('boolval', $request->validated('features')));

        return response()->json(['data' => $features->list($tenant->refresh())]);
    }
}
