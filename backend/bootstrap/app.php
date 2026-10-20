<?php

use App\Exceptions\ProblemRenderer;
use App\Http\Middleware\AllowTenantOrigins;
use App\Http\Middleware\EnsurePlatformContext;
use App\Http\Middleware\RequestId;
use App\Http\Middleware\RequireFeature;
use App\Http\Middleware\RequireModule;
use App\Http\Middleware\ResolveAddressedTenant;
use App\Http\Middleware\ResolveTenantContext;
use App\Http\Middleware\SecurityHeaders;
use App\Support\ApiProblem;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;

// Stack traces must never carry function arguments: they would put passwords, tokens and upstream data into logs
// (found by CredentialLogHygieneTest: the Tala password appeared in a logged trace). php.ini cannot be trusted for this.
ini_set('zend.exception_ignore_args', '1');

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api_v1.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Behind a TLS-terminating load balancer the app only knows the request was HTTPS if it trusts the balancer's
        // X-Forwarded-* headers. List the balancer addresses/CIDRs; '*' trusts every sender (spoofable client IPs: avoid).
        $proxies = array_values(array_filter(array_map('trim', explode(',', (string) env('SAILIX_TRUSTED_PROXIES', '')))));
        if ($proxies !== []) {
            $middleware->trustProxies(at: $proxies === ['*'] ? '*' : $proxies);
        }
        $middleware->append(SecurityHeaders::class);
        $middleware->prepend(AllowTenantOrigins::class); // before CORS handling reads the allowed origins
        $middleware->statefulApi();
        // API only: an unauthenticated request is a 401 problem document, never a redirect to a web login route
        // (there is none; without this a request lacking `Accept: application/json` became a 500).
        $middleware->redirectGuestsTo(fn () => null);
        $middleware->api(prepend: [RequestId::class, ResolveAddressedTenant::class]);
        $middleware->alias([
            'tenant.context' => ResolveTenantContext::class,
            'platform.context' => EnsurePlatformContext::class,
            'module' => RequireModule::class,
            'feature' => RequireFeature::class,
        ]);
        // The tenant/platform context must exist BEFORE implicit route-model binding runs,
        // otherwise a scoped model cannot be resolved (and a foreign id could never 404 correctly).
        $middleware->prependToPriorityList(before: SubstituteBindings::class, prepend: ResolveTenantContext::class);
        $middleware->prependToPriorityList(before: SubstituteBindings::class, prepend: EnsurePlatformContext::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Expected, user-facing failures (wrong password, validation, conflicts...) are answers, not errors worth a log line.
        $exceptions->dontReport(ApiProblem::class);
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());
        $exceptions->render(fn (Throwable $e, Request $request) => $request->is('api/*') || $request->expectsJson()
            ? ProblemRenderer::render($e, $request)
            : null);
    })->create();
