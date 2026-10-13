<?php

namespace App\Support\Settings;

use App\Models\PlatformSetting;
use App\Models\TenantSetting;
use App\Modules\Tala\ApprovedTalaEndpoint;
use App\Modules\Tala\TalaEndpointGuard;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;

/**
 * Typed settings registry (docs/02 §5): tenant → platform → code default.
 * Unknown keys are rejected. `tighten` settings: a tenant value may only be stricter than the platform's.
 */
final class SettingsRegistry
{
    /** @return array<string, array{scope: 'platform'|'tenant'|'both', default: mixed, rules: list<mixed>, tighten?: 'min'}> */
    public static function definitions(): array
    {
        return [
            'display_name' => ['scope' => 'tenant', 'default' => null, 'rules' => ['nullable', 'string', 'max:120']],
            'privacy_policy_url' => ['scope' => 'tenant', 'default' => null, 'rules' => ['nullable', 'url:https', 'max:255']],
            'payslip_step_up' => ['scope' => 'tenant', 'default' => 'password', 'rules' => ['in:none,password']],
            'password_min_length' => ['scope' => 'both', 'default' => 8, 'rules' => ['integer', 'min:8', 'max:128'], 'tighten' => 'min'],
            // Platform-only (never tenant-configurable): approved HTTPS origin of the Tala API (docs/04 §4).
            'tala_api_base_url' => ['scope' => 'platform', 'default' => null, 'rules' => ['nullable', new ApprovedTalaEndpoint]],
            'upload_max_mb' => ['scope' => 'both', 'default' => 10, 'rules' => ['integer', 'min:1', 'max:50']],
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed> validated key => value for the given scope
     */
    public static function validate(array $input, string $scope): array
    {
        $defs = collect(self::definitions())->filter(fn ($d) => in_array($d['scope'], [$scope, 'both'], true));
        $unknown = array_diff(array_keys($input), $defs->keys()->all());
        $validator = Validator::make(
            $input,
            $defs->map(fn ($d) => $d['rules'])->all(),
        );
        $validator->after(function ($v) use ($unknown): void {
            foreach ($unknown as $key) {
                $v->errors()->add($key, 'Unknown setting.');
            }
        });

        return $validator->validate();
    }

    public static function platform(string $key): mixed
    {
        $def = self::def($key);
        $row = Cache::remember("g:setting:$key", 60, fn () => PlatformSetting::find($key)?->value);

        return $row ?? $def['default'];
    }

    /** Resolved for the active tenant context. */
    public static function tenant(string $key): mixed
    {
        $def = self::def($key);
        $tenantId = app(TenantContext::class)->tenantId();
        $value = Cache::remember("t:$tenantId:setting:$key", 60, fn () => TenantSetting::where('key', $key)->first()->value ?? '__unset__');
        $platform = self::platform($key);

        if ($value === '__unset__' || $def['scope'] === 'platform') {
            return $platform;
        }
        if (($def['tighten'] ?? null) === 'min') {
            return max((int) $value, (int) $platform);
        }

        return $value;
    }

    public static function setTenant(string $key, mixed $value): void
    {
        $tenantId = app(TenantContext::class)->tenantId();
        if ($value === null) {
            TenantSetting::where('key', $key)->delete(); // null = unset, fall back to platform/default
        } else {
            TenantSetting::updateOrCreate(['key' => $key], ['value' => $value]);
        }
        Cache::forget("t:$tenantId:setting:$key");
    }

    public static function setPlatform(string $key, mixed $value): void
    {
        if ($key === 'tala_api_base_url' && is_string($value)) {
            $value = app(TalaEndpointGuard::class)->validate($value); // normalize to the bare origin
        }

        if ($value === null) {
            PlatformSetting::whereKey($key)->delete(); // null = unset, fall back to the code default
        } else {
            PlatformSetting::updateOrCreate(['key' => $key], ['value' => $value]);
        }
        Cache::forget("g:setting:$key");
    }

    /** @return array{scope: string, default: mixed, rules: list<mixed>, tighten?: 'min'} */
    private static function def(string $key): array
    {
        return self::definitions()[$key] ?? throw new \InvalidArgumentException("Unknown setting [$key].");
    }
}
