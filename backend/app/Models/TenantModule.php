<?php

namespace App\Models;

use App\Enums\ModuleStatus;
use App\Modules\Module;
use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Platform-provisioned module entitlement for one organization.
 * Written only by Platform\TenantModules (provision) and Modules\SetModuleEnabled (tenant toggle).
 *
 * @property string $id
 * @property string $tenant_id
 * @property Module $module
 * @property ModuleStatus $status
 * @property string|null $external_team_id
 * @property array<string, mixed>|null $config
 */
class TenantModule extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return [
            'module' => Module::class,
            'status' => ModuleStatus::class,
            'config' => 'array',
        ];
    }

    public function isEnabled(): bool
    {
        return $this->status === ModuleStatus::Enabled;
    }
}
