<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * An announcement from an organization's administrators to its members.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string|null $created_by_membership_id
 * @property string $title
 * @property string $body
 * @property bool $is_active
 * @property Carbon|null $expires_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property string|null $file_disk
 * @property string|null $file_path
 * @property string|null $file_original_name
 * @property string|null $file_mime
 * @property int|null $file_size
 */
class Announcement extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'expires_at' => 'datetime'];
    }

    /**
     * What members see: switched on and not past its end date.
     *
     * @param  Builder<Announcement>  $query
     * @return Builder<Announcement>
     */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('is_active', true)
            ->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    /**
     * What this member may see: visible, and either for everyone or addressed to the fleet on their crew record.
     * A member with no fleet on record gets only what is for everyone.
     *
     * @param  Builder<Announcement>  $query
     * @return Builder<Announcement>
     */
    public function scopeVisibleTo(Builder $query, string $membershipId): Builder
    {
        $fleet = CrewProfile::where('membership_id', $membershipId)->value('fleet');

        return $query->visible()->where(fn (Builder $q) => $q
            ->whereDoesntHave('fleets')
            ->when($fleet !== null && $fleet !== '', fn (Builder $w) => $w->orWhereHas('fleets', fn ($f) => $f->where('fleet', $fleet))));
    }

    /** @return HasMany<AnnouncementFleet, $this> */
    public function fleets(): HasMany
    {
        return $this->hasMany(AnnouncementFleet::class);
    }

    /** @return BelongsTo<Membership, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(Membership::class, 'created_by_membership_id');
    }

    /** @return HasMany<AnnouncementRead, $this> */
    public function reads(): HasMany
    {
        return $this->hasMany(AnnouncementRead::class);
    }
}
