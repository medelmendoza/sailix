<?php

namespace App\Models;

use App\Enums\LinkStatus;
use App\Modules\Module;
use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A membership's link to its external account, pinned to the organization's mapped team.
 * Tokens are encrypted at rest, hidden from serialization, and are never returned by any API.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $membership_id
 * @property Module $module
 * @property string $external_identity_id
 * @property string $external_team_id
 * @property LinkStatus $status
 * @property string|null $access_token
 * @property string|null $refresh_token
 * @property Carbon|null $token_expires_at
 * @property Carbon|null $linked_at
 * @property Carbon|null $last_verified_at
 */
#[Hidden(['access_token', 'refresh_token'])]
class ModuleLink extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return [
            'module' => Module::class,
            'status' => LinkStatus::class,
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'token_expires_at' => 'datetime',
            'linked_at' => 'datetime',
            'last_verified_at' => 'datetime',
        ];
    }
}
