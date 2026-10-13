<?php

namespace App\Http\Middleware;

use App\Models\TenantModule;
use App\Modules\Module;
use App\Support\ApiProblem;
use App\Support\Settings\SettingsRegistry;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/**
 * `module:tala` — must run after `tenant.context` (which already refuses suspended/inactive tenants).
 * Checks, server-side on every request and from the established context only:
 *   module provisioned AND enabled for the organization ⇒ else 403 module_disabled;
 *   the membership's role holds module.<code>.use      ⇒ else 403 module_forbidden;
 *   the platform has an approved upstream endpoint     ⇒ else 503 module_unavailable.
 * Nothing the client sends (ids, roles, headers) participates in this decision.
 */
class RequireModule
{
    public function handle(Request $request, Closure $next, string $module): Response
    {
        $module = Module::tryFrom($module) ?? throw new \InvalidArgumentException("Unknown module [$module].");

        $entitlement = TenantModule::where('module', $module->value)->first();
        if ($entitlement === null || ! $entitlement->isEnabled()) {
            throw ApiProblem::forbidden('module_disabled', 'This module is not available for your organization.');
        }
        // Single enforcement point: the same Gate abilities derived from the role map (Role::abilities()).
        if (! Gate::allows($module->useAbility())) {
            throw ApiProblem::forbidden('module_forbidden', 'Your role cannot use this module.');
        }

        // Fail closed until the platform has configured an approved HTTPS endpoint (docs/13 D-T2: production
        // HTTPS is unverified, so nothing may reach the upstream by default).
        $setting = $module->endpointSetting();
        if ($setting !== null && SettingsRegistry::platform($setting) === null) {
            throw new ApiProblem(503, 'module_unavailable', 'This module is not available yet.');
        }

        return $next($request);
    }
}
