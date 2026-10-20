<?php

namespace App\Http\Middleware;

use App\Enums\Feature;
use App\Models\Tenant;
use App\Support\ApiProblem;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** `feature:crew` — after `tenant.context`: 403 feature_disabled when the platform switched the feature off for the organization. */
class RequireFeature
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $feature = Feature::tryFrom($feature) ?? throw new \InvalidArgumentException("Unknown feature [$feature].");

        $tenant = Tenant::findOrFail($this->context->tenantId());
        if (! $tenant->featureEnabled($feature)) {
            throw ApiProblem::forbidden('feature_disabled', 'This feature is not available for your organization.');
        }

        return $next($request);
    }
}
