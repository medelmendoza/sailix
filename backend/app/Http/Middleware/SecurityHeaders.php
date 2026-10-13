<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Defensive headers on every response (this application serves JSON only; no HTML, scripts or frames).
 * Also applied to errors and 404s because it is global middleware. The web portal (a static SPA served elsewhere)
 * gets its own CSP at the hosting layer: docs/14.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('X-Frame-Options', 'DENY');
        // Nothing this API returns is a document: forbid loading anything from it and framing it.
        $response->headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        // Responses carry personal data and sometimes credentials: never stored by browsers or shared caches.
        $response->headers->set('Cache-Control', 'no-store, private');
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
