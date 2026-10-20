<?php

namespace App\Tenancy;

use App\Models\Tenant;
use App\Models\TenantDomain;
use Illuminate\Http\Request;

/**
 * Which organization a request is addressed to:
 *   host -> verified domain, or <slug>.<base domain>  (in development also <slug>.localhost)
 *   X-Tenant-Host  (web portal and API on different hosts; only when the API's own host matches nothing)
 *   X-Tenant-Slug  (shared-address demos; only when switched on, and only after the others found nothing)
 * Only a VERIFIED domain routes traffic. Resolution never authorizes anything.
 */
final class TenantAddress
{
    public const SLUG_HEADER = 'X-Tenant-Slug';

    public const HOST_HEADER = 'X-Tenant-Host';

    public function resolve(Request $request): ?Tenant
    {
        $byHost = $this->resolveHost($request->getHost());
        if ($byHost) {
            return $byHost;
        }

        if (config('sailix.tenancy.allow_host_header')) {
            $header = $request->header(self::HOST_HEADER);
            if (is_string($header) && ($byHeader = $this->resolveHost($header))) {
                return $byHeader;
            }
        }

        if (config('sailix.tenancy.allow_slug_header')) {
            $slug = $request->header(self::SLUG_HEADER);
            if (is_string($slug) && TenantSlugs::isValid(strtolower($slug))) {
                return Tenant::where('slug', strtolower($slug))->first();
            }
        }

        return null;
    }

    public function resolveHost(?string $raw): ?Tenant
    {
        $host = DomainNormalizer::normalize($raw);
        if ($host === null) {
            return null;
        }

        $domain = TenantDomain::where('verified_domain', $host)->first();
        if ($domain) {
            return $domain->tenant;
        }

        // The default address is worked out from the slug itself, so it keeps working if the base domain setting changes.
        $base = DomainNormalizer::normalize((string) config('sailix.tenancy.base_domain'));
        if ($base !== null && $base !== 'localhost' && str_ends_with($host, '.'.$base)) {
            $slug = substr($host, 0, -strlen($base) - 1);

            return str_contains($slug, '.') ? null : Tenant::where('slug', $slug)->first();
        }

        if (config('sailix.tenancy.dev_mode') && app()->environment(['local', 'testing']) && str_ends_with($host, '.localhost')) {
            $slug = substr($host, 0, -strlen('.localhost'));

            return str_contains($slug, '.') ? null : Tenant::where('slug', $slug)->first();
        }

        return null;
    }
}
