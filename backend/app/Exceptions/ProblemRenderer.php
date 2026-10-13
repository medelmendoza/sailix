<?php

namespace App\Exceptions;

use App\Support\ApiProblem;
use App\Support\Tenancy\MissingTenantContext;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/** Renders every API failure as RFC 9457 application/problem+json with a stable `code`. */
final class ProblemRenderer
{
    public static function render(Throwable $e, Request $request): JsonResponse
    {
        [$status, $code, $detail, $errors, $headers] = match (true) {
            $e instanceof ApiProblem => [$e->status, $e->problemCode, $e->getMessage(), $e->errors, $e->headers],
            $e instanceof ValidationException => [422, 'validation', 'The given data was invalid.', $e->errors(), []],
            $e instanceof AuthenticationException => [401, 'unauthenticated', 'Authentication is required.', [], []],
            $e instanceof TokenMismatchException => [419, 'csrf_mismatch', 'CSRF token mismatch.', [], []],
            $e instanceof MissingTenantContext => [403, 'tenant_context_missing', 'No organization context.', [], []],
            $e instanceof HttpExceptionInterface => self::fromHttp($e),
            default => [500, 'server_error', config('app.debug') ? $e->getMessage() : 'An unexpected error occurred.', [], []],
        };

        $body = [
            'type' => "urn:sailix:problem:$code",
            'title' => Response::$statusTexts[$status] ?? 'Error',
            'status' => $status,
            'code' => $code,
            'detail' => $detail,
            'request_id' => $request->attributes->get('request_id'),
        ];
        if ($errors !== []) {
            $body['errors'] = $errors;
        }

        return response()->json($body, $status, $headers + ['Content-Type' => 'application/problem+json']);
    }

    /** @return array{int, string, string, array<mixed>, array<string, string>} */
    private static function fromHttp(HttpExceptionInterface $e): array
    {
        $status = $e->getStatusCode();
        $code = match ($status) {
            401 => 'unauthenticated', 403 => 'forbidden', 404 => 'not_found', 405 => 'method_not_allowed',
            419 => 'csrf_mismatch', 429 => 'throttled', default => 'http_error',
        };
        $detail = match ($status) {
            403 => 'This action is not allowed.', 404 => 'Resource not found.', 429 => 'Too many requests.',
            default => $e->getMessage() ?: 'Request failed.',
        };

        return [$status, $code, $detail, [], array_intersect_key($e->getHeaders(), array_flip(['Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Allow']))];
    }
}
