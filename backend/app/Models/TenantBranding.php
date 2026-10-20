<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * How an organization looks. Platform-level (not tenant-scoped), one optional row per organization, every field
 * optional: empty means the platform default.
 *
 * @property string $tenant_id
 * @property string|null $tagline
 * @property string|null $primary_color
 * @property string|null $secondary_color
 * @property string|null $logo_path
 * @property string|null $logo_mime
 * @property string|null $favicon_path
 * @property string|null $favicon_mime
 * @property int $version
 */
class TenantBranding extends Model
{
    protected $table = 'tenant_branding';

    protected $primaryKey = 'tenant_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = ['*'];
}
