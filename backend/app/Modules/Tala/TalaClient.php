<?php

namespace App\Modules\Tala;

use App\Support\Settings\SettingsRegistry;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * The only code that talks to Tala (ADR-0018, read-only in the MVP). On EVERY request it:
 *   - takes the base URL from the platform setting (never from a tenant or a client) and re-validates it with
 *     TalaEndpointGuard (https only, allow-listed host, every resolved address public),
 *   - connects to the address that was just validated (IP pinning: DNS cannot change between check and use),
 *   - refuses redirects, sets connect/total timeouts, caps the response size,
 *   - never logs or returns credentials, tokens or upstream bodies (errors carry only a category).
 * Paths are built only from ids passed in by the gateway (taken from the stored link), URL-encoded.
 */
final class TalaClient
{
    private const MAX_BYTES = 5_000_000;

    public function __construct(private TalaEndpointGuard $guard) {}

    /** @return array{access_token: string, refresh_token: string|null, user_id: string} */
    public function login(string $username, string $password): array
    {
        $response = $this->send($this->request(), 'POST', '/api/v1/login', ['username' => $username, 'password' => $password]);
        if ($response->status() >= 400 && $response->status() < 500) {
            throw new TalaLoginRejected;
        }
        $data = $this->json($response);
        $access = $data['accessToken'] ?? null;
        $user = $data['userId'] ?? null;
        if (! is_string($access) || $access === '' || ! is_string($user) || $user === '') {
            throw new TalaUnavailable('login payload');
        }

        return ['access_token' => $access, 'refresh_token' => is_string($data['refreshToken'] ?? null) ? $data['refreshToken'] : null, 'user_id' => $user];
    }

    /** @return list<string> ids of the teams the account belongs to */
    public function teamIds(string $token, string $userId): array
    {
        $rows = $this->getList($token, '/api/v1/auth/users/'.$this->seg($userId).'/teams');

        return array_values(array_filter(array_map(fn ($r) => is_array($r) && is_string($r['teamId'] ?? null) ? $r['teamId'] : null, $rows)));
    }

    /** @return list<array<string, mixed>> raw assignments (the gateway maps them) */
    public function courses(string $token, string $userId, string $teamId): array
    {
        return $this->getList($token, '/api/v1/auth/users/'.$this->seg($userId).'/teams/'.$this->seg($teamId).'/courses');
    }

    /** @return array<string, mixed> */
    public function progress(string $token, string $userId, string $teamId, string $courseId, string $assignId): array
    {
        return $this->getObject($token, '/api/v1/auth/users/'.$this->seg($userId).'/teams/'.$this->seg($teamId)
            .'/courses/'.$this->seg($courseId).'/sync/'.$this->seg($assignId).'/data');
    }

    /**
     * @param  'videos'|'pdf'  $kind
     * @return array<string, mixed>
     */
    public function material(string $token, string $teamId, string $kind, string $materialId): array
    {
        return $this->getObject($token, '/api/v1/auth/users/teams/'.$this->seg($teamId).'/'.$kind.'/'.$this->seg($materialId));
    }

    /** @return list<mixed> */
    private function getList(string $token, string $path): array
    {
        $data = $this->json($this->authed($token, $path));

        return array_is_list($data) ? $data : throw new TalaUnavailable('list payload');
    }

    /** @return array<string, mixed> */
    private function getObject(string $token, string $path): array
    {
        $data = $this->json($this->authed($token, $path));

        return array_is_list($data) && $data !== [] ? throw new TalaUnavailable('object payload') : $data;
    }

    private function authed(string $token, string $path): Response
    {
        $response = $this->send($this->request()->withToken($token), 'GET', $path);
        if (in_array($response->status(), [401, 403], true)) {
            throw new TalaUnauthorized;
        }

        return $response;
    }

    private function request(): PendingRequest
    {
        $base = SettingsRegistry::platform('tala_api_base_url');
        if (! is_string($base) || $base === '') {
            throw new TalaUnavailable('not configured');
        }
        try {
            $safe = $this->guard->assertSafe($base);
        } catch (UnsafeEndpoint) {
            throw new TalaUnavailable('unsafe endpoint');
        }

        return Http::baseUrl($safe['origin'])
            ->acceptJson()
            ->connectTimeout(5)->timeout(15)
            ->withOptions([
                'allow_redirects' => false,
                'verify' => true,
                // Pin the connection to an address validated a moment ago.
                'curl' => [CURLOPT_RESOLVE => ["{$safe['host']}:443:{$safe['addresses'][0]}"]],
            ]);
    }

    /** @param array<string, mixed>|null $body */
    private function send(PendingRequest $request, string $method, string $path, ?array $body = null): Response
    {
        try {
            $response = $method === 'GET'
                ? $request->retry(2, 200, fn ($e) => $e instanceof ConnectionException, throw: false)->get($path)
                : $request->asJson()->post($path, $body ?? []);
        } catch (ConnectionException) {
            throw new TalaUnavailable('connection');
        }

        // Redirects are never followed (SSRF); 5xx is an upstream failure, not an authorization answer.
        if ($response->status() >= 300 && $response->status() < 400 || $response->status() >= 500) {
            throw new TalaUnavailable('status');
        }
        if ((int) $response->header('Content-Length') > self::MAX_BYTES || strlen($response->body()) > self::MAX_BYTES) {
            throw new TalaUnavailable('too large');
        }

        return $response;
    }

    /** @return array<mixed> */
    private function json(Response $response): array
    {
        if ($response->status() >= 400) {
            throw new TalaUnavailable('client error');
        }
        $data = json_decode($response->body(), true);

        return is_array($data) ? $data : throw new TalaUnavailable('not json');
    }

    private function seg(string $id): string
    {
        return rawurlencode($id);
    }
}
