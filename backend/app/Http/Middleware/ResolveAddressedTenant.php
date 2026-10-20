<?php

namespace App\Http\Middleware;

use App\Enums\TenantStatus;
use App\Support\ApiProblem;
use App\Tenancy\AddressedTenant;
use App\Tenancy\TenantAddress;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Works out which organization the request's address names (if any) and refuses addresses of organizations that are
 * switched off. A request with no organization in its address is fine: it is the shared sign-in, the mobile app, or the
 * platform. The superadmin routes ignore the address altogether.
 */
class ResolveAddressedTenant
{
    public function __construct(private TenantAddress $address, private AddressedTenant $addressed) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('api/v1/platform/*')) {
            return $next($request);
        }

        $tenant = $this->address->resolve($request);
        if ($tenant && ! in_array($tenant->status, [TenantStatus::Active, TenantStatus::Provisioning], true)) {
            throw ApiProblem::forbidden('tenant_unavailable', 'This organization is not available right now.');
        }
        $this->addressed->set($tenant);

        return $next($request);
    }
}
