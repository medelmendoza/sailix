<?php

namespace App\Modules\Tala;

use App\Support\Net\HostResolver;
use App\Support\Net\PublicAddress;

/**
 * The only way a Tala base URL is accepted (settings) and, from M3 on, used (gateway, on EVERY request).
 * Scheme validation alone is not enough (SSRF), so this checks:
 *   1. https only, origin only (no userinfo, port other than 443, query, fragment, path, control chars);
 *   2. hostname form: ASCII DNS name with a letter TLD; no IP literals in any notation, no internal suffixes;
 *   3. the host is on the deployment allow-list (config sailix.modules.tala.allowed_hosts, env-controlled,
 *      NOT editable through the API, so a compromised admin cannot point the gateway elsewhere);
 *   4. every address the host currently resolves to is a public unicast address.
 *
 * M3 requirements (documented in docs/04 §4): call assertSafe() per request, connect to one of the returned
 * addresses (IP pinning, defeats DNS rebinding between check and use), and disable redirects.
 */
final class TalaEndpointGuard
{
    private const BLOCKED_SUFFIXES = [
        'localhost', 'local', 'localdomain', 'internal', 'intranet', 'lan', 'home', 'corp', 'private', 'test', 'invalid', 'example', 'arpa',
    ];

    public function __construct(private HostResolver $resolver) {}

    /** Validate and normalize to a bare origin (`https://host`). Resolves DNS. */
    public function validate(string $url): string
    {
        return $this->assertSafe($url)['origin'];
    }

    /**
     * @return array{origin: string, host: string, addresses: list<string>}
     *
     * @throws UnsafeEndpoint
     */
    public function assertSafe(string $url): array
    {
        $host = $this->parseHost($url);

        $this->assertHostForm($host);
        $this->assertAllowListed($host);

        $addresses = $this->resolver->resolve($host);
        if ($addresses === []) {
            throw new UnsafeEndpoint('unresolvable', 'The host does not resolve.');
        }
        foreach ($addresses as $ip) {
            if (! PublicAddress::isPublic($ip)) {
                throw new UnsafeEndpoint('non_public_destination', 'The host resolves to a non-public address.');
            }
        }

        return ['origin' => "https://$host", 'host' => $host, 'addresses' => $addresses];
    }

    private function parseHost(string $url): string
    {
        if ($url === '' || strlen($url) > 255 || preg_match('/[\x00-\x20\x7F\\\\]/', $url) || ! mb_check_encoding($url, 'ASCII')) {
            throw new UnsafeEndpoint('malformed', 'The URL is malformed.');
        }
        $parts = parse_url($url);
        if ($parts === false || ! isset($parts['scheme'], $parts['host'])) {
            throw new UnsafeEndpoint('malformed', 'The URL is malformed.');
        }
        if (strtolower($parts['scheme']) !== 'https') {
            throw new UnsafeEndpoint('not_https', 'Only https:// endpoints are allowed.');
        }
        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new UnsafeEndpoint('userinfo', 'Credentials in the URL are not allowed.');
        }
        if (isset($parts['port']) && $parts['port'] !== 443) {
            throw new UnsafeEndpoint('port', 'Only the default HTTPS port is allowed.');
        }
        if (isset($parts['query']) || isset($parts['fragment'])) {
            throw new UnsafeEndpoint('malformed', 'Query and fragment are not allowed.');
        }
        if (isset($parts['path']) && ! in_array($parts['path'], ['', '/'], true)) {
            throw new UnsafeEndpoint('path', 'Only a bare origin is allowed.');
        }

        return strtolower($parts['host']);
    }

    private function assertHostForm(string $host): void
    {
        if (str_contains($host, ':') || str_contains($host, '[') || str_ends_with($host, '.')) {
            throw new UnsafeEndpoint('ip_literal', 'IP literals are not allowed.');
        }
        // Other IPv4 notations ("127.1", "2130706433", "0x7f.1") have no letter TLD and fail the pattern below.
        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            throw new UnsafeEndpoint('ip_literal', 'IP literals are not allowed.');
        }
        if (preg_match('/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/', $host) !== 1) {
            throw new UnsafeEndpoint('bad_host', 'The host name is not valid.');
        }
        $tld = substr($host, (int) strrpos($host, '.') + 1);
        if (in_array($tld, self::BLOCKED_SUFFIXES, true)) {
            throw new UnsafeEndpoint('internal_host', 'Internal host names are not allowed.');
        }
    }

    private function assertAllowListed(string $host): void
    {
        /** @var list<string> $allowed */
        $allowed = array_map('strtolower', (array) config('sailix.modules.tala.allowed_hosts', []));

        if (! in_array($host, $allowed, true)) {
            throw new UnsafeEndpoint('not_allow_listed', 'The host is not on the approved Tala host list.');
        }
    }
}
