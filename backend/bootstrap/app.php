<?php

use App\Exceptions\ProblemRenderer;
use App\Http\Middleware\EnsurePlatformContext;
use App\Http\Middleware\RequestId;
use App\Http\Middleware\RequireModule;
use App\Http\Middleware\ResolveTenantContext;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api_v1.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        // API only: an unauthenticated request is a 401 problem document, never a redirect to a web login route
        // (there is none; without this a request lacking `Accept: application/json` became a 500).
        $middleware->redirectGuestsTo(fn () => null);
        $middleware->api(prepend: [RequestId::class]);
        $middleware->alias([
            'tenant.context' => ResolveTenantContext::class,
            'platform.context' => EnsurePlatformContext::class,
            'module' => RequireModule::class,
        ]);
        // The tenant/platform context must exist BEFORE implicit route-model binding runs,
        // otherwise a scoped model cannot be resolved (and a foreign id could never 404 correctly).
        $middleware->prependToPriorityList(before: SubstituteBindings::class, prepend: ResolveTenantContext::class);
        $middleware->prependToPriorityList(before: SubstituteBindings::class, prepend: EnsurePlatformContext::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());
        $exceptions->render(fn (Throwable $e, Request $request) => $request->is('api/*') || $request->expectsJson()
            ? ProblemRenderer::render($e, $request)
            : null);
    })->create();
