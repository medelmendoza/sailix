<?php

namespace App\Models;

use App\Enums\Feature;
use App\Enums\TenantStatus;
use App\Tenancy\TenantSlugs;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/** Platform-level record (not tenant-scoped): the organization itself. */
/**
 * @property string $id
 * @property string $code
 * @property string $slug
 * @property string $name
 * @property list<string>|null $disabled_features
 * @property TenantStatus $status
 * @property Carbon|null $activated_at
 * @property Carbon|null $archived_at
 * @property Carbon $created_at
 */
#[Fillable(['code', 'name', 'slug'])]
class Tenant extends Model
{
    use HasUuids;

    protected static function booted(): void
    {
        // Every organization has a slug: when none is given it starts as the (valid, unique) lowercase agency code.
        static::creating(function (Tenant $tenant) {
            if (! is_string($tenant->slug) || $tenant->slug === '') {
                $tenant->slug = TenantSlugs::suggest((string) $tenant->code);
            }
        });
    }

    /** @return HasMany<TenantDomain, $this> */
    public function domains(): HasMany
    {
        return $this->hasMany(TenantDomain::class);
    }

    /** @return HasOne<TenantBranding, $this> */
    public function branding(): HasOne
    {
        return $this->hasOne(TenantBranding::class);
    }

    protected function casts(): array
    {
        return [
            'status' => TenantStatus::class,
            'activated_at' => 'datetime',
            'archived_at' => 'datetime',
            'disabled_features' => 'array',
        ];
    }

    public function featureEnabled(Feature $feature): bool
    {
        return ! in_array($feature->value, $this->disabled_features ?? [], true);
    }

    public function isActive(): bool
    {
        return $this->status === TenantStatus::Active;
    }
}
