<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Personal data of a member within ONE organization (tenant-owned PII).
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $membership_id
 * @property string $first_name
 * @property string|null $middle_name
 * @property string $last_name
 * @property string|null $suffix
 * @property string|null $mobile
 * @property string|null $crew_number
 * @property string|null $rank
 * @property string|null $fleet
 * @property string|null $vessel
 * @property string|null $employment_status
 * @property Carbon|null $date_arrive
 * @property Carbon|null $date_depart
 * @property Carbon|null $birthday
 */
class CrewProfile extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['date_arrive' => 'date', 'date_depart' => 'date', 'birthday' => 'date'];
    }
}
