<?php

namespace App\Models;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/** (user, tenant, role, status). Authorization always evaluates this, never a global role. */
/**
 * @property string $id
 * @property string $tenant_id
 * @property string $user_id
 * @property Role $role
 * @property MembershipStatus $status
 * @property Carbon $created_at
 * @property Tenant $tenant
 */
#[Fillable(['user_id', 'role', 'status'])]
class Membership extends Model
{
    use BelongsToTenant, HasUuids;

    protected function casts(): array
    {
        return [
            'role' => Role::class,
            'status' => MembershipStatus::class,
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->status === MembershipStatus::Active;
    }
}
