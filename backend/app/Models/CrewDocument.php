<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A document a member submitted. It is `pending` until the agency reviews it, then `approved` or `rejected`.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $membership_id
 * @property string $document_type_id
 * @property string|null $number
 * @property string|null $grade
 * @property string|null $location
 * @property string|null $school
 * @property Carbon|null $issued_on
 * @property Carbon|null $expires_on
 * @property string $status
 * @property string|null $rejection_reason
 * @property string|null $reviewed_by_membership_id
 * @property Carbon|null $reviewed_at
 * @property string $file_disk
 * @property string $file_path
 * @property string $file_original_name
 * @property string $file_mime
 * @property int $file_size
 * @property Carbon $submitted_at
 */
class CrewDocument extends Model
{
    use BelongsToTenant, HasUuids;

    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    /** A document that runs out within this many days is shown as "expiring". */
    public const EXPIRING_DAYS = 90;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['issued_on' => 'date', 'expires_on' => 'date', 'reviewed_at' => 'datetime', 'submitted_at' => 'datetime'];
    }

    /** @return BelongsTo<DocumentType, $this> */
    public function type(): BelongsTo
    {
        return $this->belongsTo(DocumentType::class, 'document_type_id');
    }

    /** @return BelongsTo<Membership, $this> */
    public function membership(): BelongsTo
    {
        return $this->belongsTo(Membership::class);
    }

    /** `none` (no expiry date), `valid`, `expiring` or `expired`. Always computed on the server (spec BR-20). */
    public function expiryStatus(?Carbon $today = null): string
    {
        if ($this->expires_on === null) {
            return 'none';
        }
        $today ??= now();
        if ($this->expires_on->lt($today->copy()->startOfDay())) {
            return 'expired';
        }

        return $this->expires_on->lte($today->copy()->startOfDay()->addDays(self::EXPIRING_DAYS)) ? 'expiring' : 'valid';
    }
}
