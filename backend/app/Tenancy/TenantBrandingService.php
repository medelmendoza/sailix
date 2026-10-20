<?php

namespace App\Tenancy;

use App\Models\Tenant;
use App\Models\TenantBranding;
use App\Platform\TenantDisplayName;
use App\Support\Audit;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/** An organization's look: tagline, two colours, logo and favicon. Every field optional; empty = platform default. */
final class TenantBrandingService
{
    public function row(Tenant $tenant): TenantBranding
    {
        return TenantBranding::find($tenant->getKey()) ?? (new TenantBranding)->forceFill(['tenant_id' => $tenant->getKey(), 'version' => 1]);
    }

    /** @param  array{tagline?: ?string, primary_color?: ?string, secondary_color?: ?string}  $data */
    public function update(Tenant $tenant, array $data): TenantBranding
    {
        $values = [];
        if (array_key_exists('tagline', $data)) {
            $values['tagline'] = $data['tagline'] !== null && trim($data['tagline']) !== '' ? trim($data['tagline']) : null;
        }
        foreach (['primary_color', 'secondary_color'] as $key) {
            if (array_key_exists($key, $data)) {
                $color = $data[$key] !== null && trim($data[$key]) !== '' ? strtoupper(trim($data[$key])) : null;
                if ($color !== null && ! ColorContrast::isHex($color)) {
                    throw ValidationException::withMessages([$key => 'Use a colour like #355DAD.']);
                }
                if ($color !== null && ColorContrast::againstWhite($color) < 4.5) {
                    throw ValidationException::withMessages([$key => 'That colour is too light for white button text. Choose a darker one.']);
                }
                $values[$key] = $color;
            }
        }

        return $this->save($tenant, $values, 'tenant.branding_updated', array_keys($values));
    }

    public function setImage(Tenant $tenant, string $kind, UploadedFile $file): TenantBranding
    {
        $stored = BrandingImages::store($file, $tenant->getKey(), $kind);
        BrandingImages::delete($this->row($tenant)->{$kind.'_path'});

        return $this->save($tenant, [$kind.'_path' => $stored['path'], $kind.'_mime' => $stored['mime']], 'tenant.branding_updated', [$kind]);
    }

    public function removeImage(Tenant $tenant, string $kind): TenantBranding
    {
        BrandingImages::delete($this->row($tenant)->{$kind.'_path'});

        return $this->save($tenant, [$kind.'_path' => null, $kind.'_mime' => null], 'tenant.branding_updated', [$kind]);
    }

    /** Back to the platform look. Nothing else about the organization changes. */
    public function reset(Tenant $tenant): void
    {
        $row = TenantBranding::find($tenant->getKey());
        if ($row) {
            BrandingImages::delete($row->logo_path);
            BrandingImages::delete($row->favicon_path);
            $row->delete();
            Audit::record('tenant.branding_reset', $tenant->getKey(), $tenant);
        }
    }

    /** What anybody may see before signing in. */
    public function publicPayload(Tenant $tenant): array
    {
        $b = $this->row($tenant);
        $image = fn (?string $path, string $kind) => $path !== null
            ? url("/api/v1/public/tenants/{$tenant->slug}/{$kind}").'?v='.$b->version : null;

        return [
            'slug' => $tenant->slug,
            'name' => TenantDisplayName::of($tenant),
            'tagline' => $b->tagline,
            'logo_url' => $image($b->logo_path, 'logo'),
            'favicon_url' => $image($b->favicon_path, 'favicon'),
            'primary_color' => $b->primary_color,
            'secondary_color' => $b->secondary_color,
            'version' => (int) $b->version,
        ];
    }

    /** The settings an administrator edits (the same fields, plus whether the images are set). */
    public function adminPayload(Tenant $tenant): array
    {
        return $this->publicPayload($tenant);
    }

    /** @param  array<string, mixed>  $values  @param  list<string>  $fields */
    private function save(Tenant $tenant, array $values, string $audit, array $fields): TenantBranding
    {
        $row = $this->row($tenant);
        $row->forceFill($values + ['version' => ((int) $row->version) + 1])->save();
        Audit::record($audit, $tenant->getKey(), $tenant, ['fields' => $fields]); // names of the fields, never their values

        return $row;
    }
}
