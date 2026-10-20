<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * One fleet an announcement is addressed to. An announcement with none is for everyone.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $announcement_id
 * @property string $fleet
 */
class AnnouncementFleet extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = ['*'];
}
