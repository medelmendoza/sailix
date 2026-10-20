<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A domain an organization wants to be reached on. Platform-level (not tenant-scoped): looked up by host before any
 * tenant is known. It routes traffic only once verified.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $domain
 * @property string $verification_token
 * @property Carbon|null $verified_at
 * @property string|null $verified_domain
 */
class TenantDomain extends Model
{
    use HasUuids;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['verified_at' => 'datetime'];
    }

    public function isVerified(): bool
    {
        return $this->verified_at !== null;
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
