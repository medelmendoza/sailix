<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A task an administrator assigned to one member of their organization.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $membership_id
 * @property string|null $created_by_membership_id
 * @property string $description
 * @property Carbon|null $due_date
 * @property bool $is_done
 * @property Carbon|null $done_at
 * @property Carbon $created_at
 */
class Todo extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['due_date' => 'date', 'is_done' => 'boolean', 'done_at' => 'datetime'];
    }

    /** @return BelongsTo<Membership, $this> */
    public function membership(): BelongsTo
    {
        return $this->belongsTo(Membership::class);
    }
}
