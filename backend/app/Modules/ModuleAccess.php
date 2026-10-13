<?php

namespace App\Modules;

use App\Enums\LinkStatus;
use App\Enums\Role;
use App\Models\Membership;
use App\Models\ModuleLink;
use App\Models\TenantModule;

/** Read model for `/me.modules` and `/tenant/modules` (tenant context must be established). */
final class ModuleAccess
{
    /**
     * Modules provisioned for the tenant AND usable by the membership's role, with the caller's link state.
     *
     * @return list<array{code: string, label: string, enabled: bool, linked: bool, status: string}>
     */
    public function forMembership(Membership $membership): array
    {
        $entitlements = TenantModule::get()->keyBy(fn (TenantModule $t) => $t->module->value);
        $links = ModuleLink::where('membership_id', $membership->getKey())->get()->keyBy(fn (ModuleLink $l) => $l->module->value);

        $out = [];
        foreach (Module::cases() as $module) {
            $entitlement = $entitlements->get($module->value);
            if ($entitlement === null || ! $membership->role->can($module->useAbility())) {
                continue;
            }
            $link = $links->get($module->value);

            $out[] = [
                'code' => $module->value,
                'label' => $module->label(),
                'enabled' => $entitlement->isEnabled(),
                'linked' => $link?->status === LinkStatus::Linked,
                'status' => ! $entitlement->isEnabled() ? 'disabled' : ($link?->status->value ?? 'not_linked'),
            ];
        }

        return $out;
    }

    /**
     * Every registry module with the tenant's entitlement state (tenant-admin view).
     *
     * @return list<array{code: string, label: string, entitled: bool, enabled: bool, external_team_id: string|null}>
     */
    public function forTenant(): array
    {
        $entitlements = TenantModule::get()->keyBy(fn (TenantModule $t) => $t->module->value);

        return array_map(function (Module $module) use ($entitlements) {
            $e = $entitlements->get($module->value);

            return [
                'code' => $module->value,
                'label' => $module->label(),
                'entitled' => $e !== null,
                'enabled' => $e?->isEnabled() ?? false,
                'external_team_id' => $e?->external_team_id,
            ];
        }, Module::cases());
    }
}
