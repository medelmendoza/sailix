<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\UpdateTenantRequest;
use App\Models\Tenant;
use App\Support\Audit;
use App\Support\Settings\SettingsRegistry;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class TenantController extends Controller
{
    public function show(TenantContext $context): JsonResponse
    {
        Gate::authorize('tenant.view');

        return response()->json(['data' => $this->payload($context)]);
    }

    public function update(UpdateTenantRequest $request, TenantContext $context): JsonResponse
    {
        $values = $request->settings();
        foreach ($values as $key => $value) {
            SettingsRegistry::setTenant($key, $value);
        }
        Audit::record('tenant.settings_updated', $context->tenantId(), null, ['keys' => array_keys($values)]);

        return response()->json(['data' => $this->payload($context)]);
    }

    /** @return array<string, mixed> */
    private function payload(TenantContext $context): array
    {
        $tenant = Tenant::findOrFail($context->tenantId());
        $settings = [];
        foreach (SettingsRegistry::definitions() as $key => $def) {
            if (in_array($def['scope'], ['tenant', 'both'], true)) {
                $settings[$key] = SettingsRegistry::tenant($key);
            }
        }

        return ['id' => $tenant->id, 'code' => $tenant->code, 'name' => $tenant->name, 'status' => $tenant->status->value, 'settings' => $settings];
    }
}
