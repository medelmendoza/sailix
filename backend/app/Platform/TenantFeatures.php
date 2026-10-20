<?php

namespace App\Platform;

use App\Enums\Feature;
use App\Models\Tenant;
use App\Support\Audit;

/** Platform-side switches for the core features of one organization. */
final class TenantFeatures
{
    /** @return list<array{code: string, label: string, description: string, enabled: bool}> */
    public function list(Tenant $tenant): array
    {
        return array_map(fn (Feature $f) => [
            'code' => $f->value,
            'label' => $f->label(),
            'description' => $f->description(),
            'enabled' => $tenant->featureEnabled($f),
        ], Feature::cases());
    }

    /** @param array<string, bool> $switches feature code => enabled; features not named keep their state */
    public function update(Tenant $tenant, array $switches): void
    {
        $disabled = collect($tenant->disabled_features ?? []);
        foreach ($switches as $code => $enabled) {
            $disabled = $enabled ? $disabled->reject(fn ($c) => $c === $code) : $disabled->push($code);
        }
        $new = $disabled->unique()->sort()->values()->all();
        if ($new === collect($tenant->disabled_features ?? [])->sort()->values()->all()) {
            return;
        }

        $before = $tenant->disabled_features ?? [];
        $tenant->forceFill(['disabled_features' => $new === [] ? null : $new])->save();
        Audit::record('tenant.features_changed', $tenant->getKey(), $tenant, ['disabled' => $new, 'previously_disabled' => $before]);
    }
}
