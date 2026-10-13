<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['key', 'value'])]
class TenantSetting extends Model
{
    use BelongsToTenant, HasUuids;

    protected function casts(): array
    {
        return ['value' => 'array'];
    }
}
