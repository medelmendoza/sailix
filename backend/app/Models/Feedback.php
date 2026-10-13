<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A member's feedback about the Sailix app, readable by the organization's administrators.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $membership_id
 * @property string $category
 * @property string $message
 * @property Carbon $created_at
 */
class Feedback extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'feedback';

    protected $guarded = ['*'];

    /** @return BelongsTo<Membership, $this> */
    public function membership(): BelongsTo
    {
        return $this->belongsTo(Membership::class);
    }
}
