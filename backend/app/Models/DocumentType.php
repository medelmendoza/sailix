<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * One kind of crew document an organization tracks (passport, seaman's book, medical certificate...).
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $name
 * @property string|null $short_name
 * @property bool $is_active
 */
class DocumentType extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
