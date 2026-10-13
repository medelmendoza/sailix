<?php

namespace App\Models;

use Illuminate\Support\Carbon;
use Laravel\Sanctum\PersonalAccessToken as SanctumToken;

/**
 * Sanctum token bound to a membership (docs/04). tenant_id/membership_id are set by
 * App\Identity\TokenIssuer only. Auth infrastructure: exempt from BelongsToTenant by design;
 * a composite FK guarantees (tenant_id, membership_id) consistency.
 */
/**
 * @property string|null $tenant_id
 * @property string|null $membership_id
 * @property Carbon|null $chain_started_at
 */
class PersonalAccessToken extends SanctumToken
{
    protected function casts(): array
    {
        return array_merge(parent::casts(), ['chain_started_at' => 'datetime']);
    }
}
