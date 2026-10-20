<?php

namespace App\Tenancy;

use App\Enums\FontPreset;
use App\Models\Tenant;
use App\Models\TenantBranding;
use App\Platform\TenantDisplayName;
use App\Support\Audit;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/** An organization's look: names, colours, font style, logo, favicon and sign-in page. Every field optional; empty = platform default. */
final class TenantBrandingService
{
    public function row(Tenant $tenant): TenantBranding
    {
        return TenantBranding::find($tenant->getKey()) ?? (new TenantBranding)->forceFill(['tenant_id' => $tenant->getKey(), 'version' => 1]);
    }

    /** Text with no markup and no control characters; empty becomes null. */
    private function text(?string $value): ?string
    {
        $value = $value !== null ? trim($value) : null;

        return $value === '' ? null : $value;
    }

    private function colour(string $key, ?string $value): ?string
    {
        $color = $value !== null && trim($value) !== '' ? strtoupper(trim($value)) : null;
        if ($color !== null && ! ColorContrast::isHex($color)) {
            throw ValidationException::withMessages([$key => 'Use a colour like #355DAD.']);
        }

        return $color;
    }

    /** @param  array<string, mixed>  $data */
    public function update(Tenant $tenant, array $data): TenantBranding
    {
        $values = [];
        foreach (['tagline', 'short_name', 'login_welcome_message'] as $key) {
            if (array_key_exists($key, $data)) {
                $values[$key] = $this->text($data[$key]);
            }
        }
        foreach (['primary_color', 'secondary_color', 'accent_color', 'background_color', 'text_color'] as $key) {
            if (array_key_exists($key, $data)) {
                $values[$key] = $this->colour($key, $data[$key]);
            }
        }
        if (array_key_exists('font_preset', $data)) {
            $values['font_preset'] = $data['font_preset'] !== null && $data['font_preset'] !== '' ? FontPreset::from($data['font_preset'])->value : null;
        }

        // White text sits on the brand colours; the accent only has to be visible (focus rings, links).
        foreach (['primary_color', 'secondary_color'] as $key) {
            if (($values[$key] ?? null) !== null && ColorContrast::againstWhite($values[$key]) < 4.5) {
                throw ValidationException::withMessages([$key => 'That colour is too light for white button text. Choose a darker one.']);
            }
        }
        if (($values['accent_color'] ?? null) !== null && ColorContrast::againstWhite($values['accent_color']) < 3) {
            throw ValidationException::withMessages(['accent_color' => 'That colour is too light to see on white. Choose a darker one.']);
        }
        // Text must read on the page background; an unset side is the Sailix default.
        if (array_key_exists('text_color', $values) || array_key_exists('background_color', $values)) {
            $row = $this->row($tenant);
            $text = array_key_exists('text_color', $values) ? $values['text_color'] : $row->text_color;
            $background = array_key_exists('background_color', $values) ? $values['background_color'] : $row->background_color;
            if (ColorContrast::between($text ?? '#12243D', $background ?? '#F4F7FB') < 4.5) {
                $field = array_key_exists('text_color', $values) ? 'text_color' : 'background_color';
                throw ValidationException::withMessages([$field => 'The text colour does not read well on that background. Choose colours that contrast more.']);
            }
        }

        return $this->save($tenant, $values, 'tenant.branding_updated', array_keys($values));
    }

    public function setImage(Tenant $tenant, string $kind, UploadedFile $file): TenantBranding
    {
        $stored = BrandingImages::store($file, $tenant->getKey(), $kind);
        $column = BrandingImages::column($kind);
        BrandingImages::delete($this->row($tenant)->{$column.'_path'});

        return $this->save($tenant, [$column.'_path' => $stored['path'], $column.'_mime' => $stored['mime']], 'tenant.branding_updated', [$kind]);
    }

    public function removeImage(Tenant $tenant, string $kind): TenantBranding
    {
        $column = BrandingImages::column($kind);
        BrandingImages::delete($this->row($tenant)->{$column.'_path'});

        return $this->save($tenant, [$column.'_path' => null, $column.'_mime' => null], 'tenant.branding_updated', [$kind]);
    }

    /** Back to the platform look. Nothing else about the organization changes. */
    public function reset(Tenant $tenant): void
    {
        $row = TenantBranding::find($tenant->getKey());
        if ($row) {
            foreach (BrandingImages::KINDS as [$column]) {
                BrandingImages::delete($row->{$column.'_path'});
            }
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
            'short_name' => $b->short_name,
            'tagline' => $b->tagline,
            'login_welcome_message' => $b->login_welcome_message,
            'logo_url' => $image($b->logo_path, 'logo'),
            'favicon_url' => $image($b->favicon_path, 'favicon'),
            'login_logo_url' => $image($b->login_logo_path, 'login-logo'),
            'login_background_url' => $image($b->login_background_path, 'login-background'),
            'primary_color' => $b->primary_color,
            'secondary_color' => $b->secondary_color,
            'accent_color' => $b->accent_color,
            'background_color' => $b->background_color,
            'text_color' => $b->text_color,
            'font_preset' => $b->font_preset,
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
