<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

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
 */
class CrewProfile extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = ['*'];
}
