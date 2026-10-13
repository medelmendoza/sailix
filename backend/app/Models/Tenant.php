<?php

namespace App\Models;

use App\Enums\TenantStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/** Platform-level record (not tenant-scoped): the organization itself. */
/**
 * @property string $id
 * @property string $code
 * @property string $name
 * @property TenantStatus $status
 * @property Carbon|null $activated_at
 * @property Carbon|null $archived_at
 * @property Carbon $created_at
 */
#[Fillable(['code', 'name'])]
class Tenant extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'status' => TenantStatus::class,
            'activated_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === TenantStatus::Active;
    }
}
