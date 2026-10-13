<?php

namespace App\Http\Middleware;

use App\Models\PlatformAdmin;
use App\Support\ApiProblem;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/** Platform (superadmin) routes: platform guard only, active admin, idle timeout, never a tenant context. */
class EnsurePlatformContext
{
    public function __construct(private TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        $admin = Auth::guard('platform')->user();
        if (! $admin instanceof PlatformAdmin) {
            throw ApiProblem::unauthenticated();
        }
        if (! $admin->isActive()) {
            Auth::guard('platform')->logout();
            throw ApiProblem::forbidden('account_suspended', 'This account is suspended.');
        }

        $session = $request->session();
        $last = (int) $session->get('platform_last_activity', now()->timestamp);
        if (now()->timestamp - $last > config('sailix.platform_idle_minutes') * 60) {
            Auth::guard('platform')->logout();
            $session->invalidate();
            throw ApiProblem::unauthenticated('Session expired.');
        }
        $session->put('platform_last_activity', now()->timestamp);

        $this->context->clear();
        $this->context->markPlatform();

        try {
            return $next($request);
        } finally {
            $this->context->clear();
        }
    }
}
