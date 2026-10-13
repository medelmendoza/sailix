<?php

namespace App\Modules;

use App\Enums\ModuleStatus;
use App\Models\TenantModule;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

/**
 * Tenant-admin toggle of a module the PLATFORM has provisioned. Cannot create entitlements and cannot
 * touch the team mapping (those are platform decisions, see App\Platform\TenantModules).
 */
final class SetModuleEnabled
{
    public function __construct(private TenantContext $context) {}

    public function __invoke(Module $module, bool $enabled): TenantModule
    {
        return DB::transaction(function () use ($module, $enabled) {
            $entitlement = TenantModule::where('module', $module->value)->lockForUpdate()->first();

            if ($entitlement === null || $entitlement->external_team_id === null) {
                throw ApiProblem::conflict('module_not_provisioned', 'This module has not been provisioned for your organization by the platform.');
            }

            $before = $entitlement->status;
            $entitlement->status = $enabled ? ModuleStatus::Enabled : ModuleStatus::Disabled;
            $entitlement->save();

            if ($before !== $entitlement->status) {
                Audit::record($enabled ? 'module.enabled' : 'module.disabled', $this->context->tenantId(), $entitlement, ['module' => $module->value]);
            }

            return $entitlement;
        });
    }
}
