<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * An administrator's request that one crew member submit (or renew) a kind of document. Open until the member
 * submits one of that kind; the request then stays on record as fulfilled.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $membership_id
 * @property string $document_type_id
 * @property string|null $requested_by_membership_id
 * @property Carbon|null $fulfilled_at
 */
class DocumentAssignment extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['fulfilled_at' => 'datetime'];
    }

    /** @return BelongsTo<DocumentType, $this> */
    public function type(): BelongsTo
    {
        return $this->belongsTo(DocumentType::class, 'document_type_id');
    }

    /** The member just submitted a document of this kind: close any open request for it. */
    public static function fulfil(string $membershipId, string $documentTypeId): void
    {
        static::where('membership_id', $membershipId)->where('document_type_id', $documentTypeId)
            ->whereNull('fulfilled_at')->update(['fulfilled_at' => now()]);
    }
}
