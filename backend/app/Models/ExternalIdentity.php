<?php

namespace App\Models;

use App\Modules\Module;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Identity-level (NOT tenant-scoped, by design: ADR-0017): a Sailix user's account in an external module.
 * Unique (module, external_user_id) so one external account cannot be claimed by two Sailix users,
 * in any organization. Created by the gateway link flow (M3) through App\Identity only.
 *
 * @property string $id
 * @property string $user_id
 * @property Module $module
 * @property string $external_user_id
 */
class ExternalIdentity extends Model
{
    use HasUuids;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['module' => Module::class];
    }
}
