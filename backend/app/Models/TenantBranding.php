<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * How an organization looks. Platform-level (not tenant-scoped), one optional row per organization, every field
 * optional: empty means the platform default.
 *
 * @property string $tenant_id
 * @property string|null $short_name
 * @property string|null $tagline
 * @property string|null $login_welcome_message
 * @property string|null $primary_color
 * @property string|null $secondary_color
 * @property string|null $accent_color
 * @property string|null $background_color
 * @property string|null $text_color
 * @property string|null $font_preset
 * @property string|null $logo_path
 * @property string|null $logo_mime
 * @property string|null $favicon_path
 * @property string|null $favicon_mime
 * @property string|null $login_logo_path
 * @property string|null $login_logo_mime
 * @property string|null $login_background_path
 * @property string|null $login_background_mime
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
