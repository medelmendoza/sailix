<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A safety observation or incident report written by a member. It is a `draft` (only the reporter sees it), then
 * `submitted` to the organization's administrators, then `reviewed` by one of them.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $membership_id
 * @property string|null $classification
 * @property string|null $sub_classification
 * @property string|null $location
 * @property string|null $location_other
 * @property string|null $vessel
 * @property string|null $details
 * @property bool $intervened
 * @property string|null $intervention_details
 * @property bool $official_report
 * @property string $status
 * @property Carbon|null $submitted_at
 * @property Carbon|null $reviewed_at
 * @property string|null $reviewed_by_membership_id
 * @property string|null $file_disk
 * @property string|null $file_path
 * @property string|null $file_original_name
 * @property string|null $file_mime
 * @property int|null $file_size
 */
class CallItReport extends Model
{
    use BelongsToTenant, HasUuids;

    public const DRAFT = 'draft';

    public const SUBMITTED = 'submitted';

    public const REVIEWED = 'reviewed';

    public const CLASSIFICATIONS = ['unsafe_acts', 'unsafe_conditions', 'unsafe_behaviour'];

    public const SUB_CLASSIFICATIONS = ['people', 'materials', 'processes', 'equipment', 'environment'];

    public const LOCATIONS = ['accommodation', 'main_deck', 'poop_deck', 'cargo_space', 'ballast_space', 'hold_space', 'machinery_space', 'others'];

    protected $table = 'callit_reports';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['intervened' => 'boolean', 'official_report' => 'boolean', 'submitted_at' => 'datetime', 'reviewed_at' => 'datetime'];
    }

    /** @return BelongsTo<Membership, $this> */
    public function membership(): BelongsTo
    {
        return $this->belongsTo(Membership::class);
    }

    public function hasFile(): bool
    {
        return $this->file_path !== null;
    }
}
