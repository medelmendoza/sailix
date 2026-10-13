<?php

namespace App\Platform;

use App\Enums\ModuleStatus;
use App\Models\ModuleLink;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Modules\Module;
use App\Support\ApiProblem;
use App\Support\Audit;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/** Platform-side module provisioning (sanctioned cross-tenant code: ADR-0016). */
final class TenantModules
{
    /**
     * @return list<array{code: string, label: string, entitled: bool, enabled: bool, external_team_id: string|null, links_count: int}>
     */
    public function list(Tenant $tenant): array
    {
        $entitlements = TenantModule::withoutTenantScope()->where('tenant_id', $tenant->getKey())->get()->keyBy(fn (TenantModule $t) => $t->module->value);

        return array_map(fn (Module $module) => $this->present($tenant, $module, $entitlements->get($module->value)), Module::cases());
    }

    /** @return array{code: string, label: string, entitled: bool, enabled: bool, external_team_id: string|null, links_count: int} */
    public function provision(Tenant $tenant, Module $module, ?string $externalTeamId, bool $enabled): array
    {
        try {
            DB::transaction(function () use ($tenant, $module, $externalTeamId, $enabled) {
                $row = TenantModule::withoutTenantScope()
                    ->where('tenant_id', $tenant->getKey())->where('module', $module->value)->lockForUpdate()->first();

                $linksExist = $row !== null && ModuleLink::withoutTenantScope()
                    ->where('tenant_id', $tenant->getKey())->where('module', $module->value)->exists();
                if ($row !== null && $row->external_team_id !== $externalTeamId && $linksExist) {
                    throw ApiProblem::conflict('links_exist', 'The team mapping cannot change while accounts are linked. Unlink them first.');
                }

                $taken = $externalTeamId !== null && TenantModule::withoutTenantScope()
                    ->where('module', $module->value)->where('external_team_id', $externalTeamId)
                    ->where('tenant_id', '!=', $tenant->getKey())->exists();
                if ($taken) {
                    throw ApiProblem::conflict('team_already_mapped', 'That team is already mapped to another organization.');
                }

                $row ??= (new TenantModule)->forceFill(['tenant_id' => $tenant->getKey(), 'module' => $module]);
                $previousTeam = $row->external_team_id;
                $row->forceFill([
                    'external_team_id' => $externalTeamId,
                    'status' => $enabled ? ModuleStatus::Enabled : ModuleStatus::Disabled,
                ])->save();

                Audit::record('module.provisioned', $tenant->getKey(), $row, [
                    'module' => $module->value, 'external_team_id' => $externalTeamId,
                    'previous_team_id' => $previousTeam, 'enabled' => $enabled,
                ]);
            });
        } catch (QueryException $e) {
            // Last line of defence: the (module, external_team_id) unique key won a race.
            if (str_contains($e->getMessage(), 'tenant_modules_module_external_team_id_unique')) {
                throw ApiProblem::conflict('team_already_mapped', 'That team is already mapped to another organization.');
            }
            throw $e;
        }

        return $this->present($tenant, $module, TenantModule::withoutTenantScope()->where('tenant_id', $tenant->getKey())->where('module', $module->value)->first());
    }

    /** @return array{code: string, label: string, entitled: bool, enabled: bool, external_team_id: string|null, links_count: int} */
    private function present(Tenant $tenant, Module $module, ?TenantModule $row): array
    {
        return [
            'code' => $module->value,
            'label' => $module->label(),
            'entitled' => $row !== null,
            'enabled' => $row?->isEnabled() ?? false,
            'external_team_id' => $row?->external_team_id,
            'links_count' => ModuleLink::withoutTenantScope()->where('tenant_id', $tenant->getKey())->where('module', $module->value)->count(),
        ];
    }
}
