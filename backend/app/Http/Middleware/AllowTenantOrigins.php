<?php

namespace App\Http\Middleware;

use App\Tenancy\DomainNormalizer;
use App\Tenancy\TenantAddress;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds an organization's own addresses to the allowed browser origins for this request: `https://<slug>.<base domain>`
 * and any VERIFIED custom domain (never `*`, credentials stay on). Static origins come from SAILIX_WEB_ORIGINS. It must
 * run before Laravel's CORS handling, which reads the configuration when it handles the request.
 */
class AllowTenantOrigins
{
    public function __construct(private TenantAddress $address) {}

    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->headers->get('Origin');
        if (is_string($origin) && $origin !== '' && ($request->is('api/*') || $request->is('sanctum/csrf-cookie'))) {
            $this->allow($origin);
        }

        return $next($request);
    }

    private function allow(string $origin): void
    {
        $parts = parse_url($origin);
        $scheme = $parts['scheme'] ?? null;
        $host = $parts['host'] ?? null;
        if (! is_string($host) || ! in_array($scheme, ['https', 'http'], true) || ($parts['path'] ?? '') !== '' && ($parts['path'] ?? '') !== '/') {
            return;
        }
        // Plain http is for development machines only.
        if ($scheme === 'http' && ! app()->environment(['local', 'testing'])) {
            return;
        }
        $known = (array) config('cors.allowed_origins', []);
        if (in_array($origin, $known, true) || DomainNormalizer::normalize($host) === null) {
            return;
        }
        if ($this->address->resolveHost($host) === null) {
            return;
        }

        $origin = $scheme.'://'.$host.(isset($parts['port']) ? ':'.$parts['port'] : '');
        config(['cors.allowed_origins' => [...$known, $origin]]);
        // The browser session (cookie) login of that address must count as the first-party web portal too.
        config(['sanctum.stateful' => [...(array) config('sanctum.stateful', []), $host.(isset($parts['port']) ? ':'.$parts['port'] : '')]]);
    }
}
