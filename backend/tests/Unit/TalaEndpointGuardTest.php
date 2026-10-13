<?php

namespace Tests\Unit;

use App\Modules\Tala\TalaEndpointGuard;
use App\Modules\Tala\UnsafeEndpoint;
use App\Support\Net\PublicAddress;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\FakeHostResolver;
use Tests\TestCase;

class TalaEndpointGuardTest extends TestCase
{
    private function guard(array $dns = ['tala.example.com' => ['93.184.216.34']], ?array $allowed = null): TalaEndpointGuard
    {
        config(['sailix.modules.tala.allowed_hosts' => $allowed ?? array_keys($dns)]);

        return new TalaEndpointGuard(new FakeHostResolver($dns));
    }

    public function test_accepts_an_allow_listed_public_https_origin_and_normalizes_it(): void
    {
        $guard = $this->guard(['tala.example.com' => ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']]);

        $this->assertSame('https://tala.example.com', $guard->validate('https://Tala.Example.com/'));
        $this->assertSame('https://tala.example.com', $guard->validate('https://tala.example.com:443'));
        $result = $guard->assertSafe('https://tala.example.com');
        $this->assertSame(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'], $result['addresses']);
    }

    /** @return array<string, array{string, string}> url => expected reason */
    public static function badUrls(): array
    {
        return [
            'http scheme' => ['http://tala.example.com', 'not_https'],
            'ftp scheme' => ['ftp://tala.example.com', 'not_https'],
            'no scheme' => ['tala.example.com', 'malformed'],
            'schemeless //' => ['//tala.example.com', 'malformed'],
            'empty' => ['', 'malformed'],
            'userinfo' => ['https://user:pw@tala.example.com', 'userinfo'],
            'userinfo trick' => ['https://tala.example.com@evil.example.org', 'userinfo'],
            'custom port' => ['https://tala.example.com:8443', 'port'],
            'port 80' => ['https://tala.example.com:80', 'port'],
            'path' => ['https://tala.example.com/api', 'path'],
            'query' => ['https://tala.example.com/?a=1', 'malformed'],
            'fragment' => ['https://tala.example.com/#x', 'malformed'],
            'backslash' => ['https://tala.example.com\\@evil.example.org', 'malformed'],
            'whitespace' => ['https://tala.example.com /', 'malformed'],
            'newline' => ["https://tala.example.com\n.evil.example.org", 'malformed'],
            'ipv4 literal' => ['https://93.184.216.34', 'ip_literal'],
            'loopback literal' => ['https://127.0.0.1', 'ip_literal'],
            'metadata literal' => ['https://169.254.169.254', 'ip_literal'],
            'ipv6 literal' => ['https://[::1]', 'ip_literal'],
            'decimal ip' => ['https://2130706433', 'bad_host'],
            'short ip' => ['https://127.1', 'bad_host'],
            'hex ip' => ['https://0x7f.1', 'bad_host'],
            'trailing dot' => ['https://tala.example.com.', 'ip_literal'],
            'localhost' => ['https://localhost', 'bad_host'],
            'localhost suffix' => ['https://app.localhost', 'internal_host'],
            'internal suffix' => ['https://tala.internal', 'internal_host'],
            'local suffix' => ['https://tala.local', 'internal_host'],
            'idn' => ['https://täla.example.com', 'malformed'],
            'not allow-listed' => ['https://evil.example.org', 'not_allow_listed'],
            'subdomain of allowed' => ['https://x.tala.example.com', 'not_allow_listed'],
            'look-alike' => ['https://tala.example.com.evil.example.org', 'not_allow_listed'],
        ];
    }

    #[DataProvider('badUrls')]
    public function test_rejects_unsafe_urls(string $url, string $reason): void
    {
        $guard = $this->guard(['tala.example.com' => ['93.184.216.34']]);

        try {
            $guard->assertSafe($url);
            $this->fail("Expected [$url] to be rejected ($reason)");
        } catch (UnsafeEndpoint $e) {
            $this->assertSame($reason, $e->reason, $url);
        }
    }

    public function test_empty_allow_list_rejects_everything(): void
    {
        $guard = $this->guard(['tala.example.com' => ['93.184.216.34']], allowed: []);

        try {
            $guard->assertSafe('https://tala.example.com');
            $this->fail('an empty allow-list must reject every host');
        } catch (UnsafeEndpoint $e) {
            $this->assertSame('not_allow_listed', $e->reason);
        }
    }

    /** @return array<string, array{string}> */
    public static function nonPublicAddresses(): array
    {
        return [
            'loopback' => ['127.0.0.1'], 'loopback range' => ['127.8.8.8'], 'any' => ['0.0.0.0'],
            '10/8' => ['10.0.0.5'], '172.16/12' => ['172.16.5.5'], '172.31' => ['172.31.255.254'], '192.168/16' => ['192.168.1.10'],
            'link-local/metadata' => ['169.254.169.254'], 'cgnat' => ['100.64.0.1'], 'cgnat top' => ['100.127.255.254'],
            'benchmark' => ['198.18.0.1'], 'test-net-1' => ['192.0.2.7'], 'multicast' => ['224.0.0.1'], 'reserved' => ['240.0.0.1'], 'broadcast' => ['255.255.255.255'],
            'ipv6 loopback' => ['::1'], 'ipv6 unspecified' => ['::'], 'ipv6 ULA' => ['fc00::1'], 'ipv6 ULA fd' => ['fd12:3456::1'],
            'ipv6 link-local' => ['fe80::1'], 'ipv4-mapped loopback' => ['::ffff:127.0.0.1'], 'ipv4-mapped private' => ['::ffff:10.0.0.1'],
            'nat64' => ['64:ff9b::7f00:1'], 'ipv6 doc' => ['2001:db8::1'], 'ipv6 multicast' => ['ff02::1'], 'garbage' => ['not-an-ip'],
        ];
    }

    #[DataProvider('nonPublicAddresses')]
    public function test_public_address_check_rejects_non_public_destinations(string $ip): void
    {
        $this->assertFalse(PublicAddress::isPublic($ip), $ip);
    }

    /** @return array<string, array{string}> */
    public static function publicAddresses(): array
    {
        return ['v4 a' => ['93.184.216.34'], 'v4 b' => ['8.8.8.8'], 'v4 edge 172.15' => ['172.15.0.1'], 'v4 edge 172.32' => ['172.32.0.1'], 'v4 100.63' => ['100.63.255.255'], 'v4 100.128' => ['100.128.0.1'], 'v6' => ['2606:2800:220:1:248:1893:25c8:1946']];
    }

    #[DataProvider('publicAddresses')]
    public function test_public_address_check_accepts_global_unicast(string $ip): void
    {
        $this->assertTrue(PublicAddress::isPublic($ip), $ip);
    }

    #[DataProvider('nonPublicAddresses')]
    public function test_host_resolving_to_a_non_public_address_is_rejected(string $ip): void
    {
        $guard = $this->guard(['tala.example.com' => [$ip]]);

        try {
            $guard->assertSafe('https://tala.example.com');
            $this->fail("[$ip] must be rejected");
        } catch (UnsafeEndpoint $e) {
            $this->assertSame('non_public_destination', $e->reason);
        }
    }

    public function test_a_single_private_address_among_public_ones_is_enough_to_reject(): void
    {
        $guard = $this->guard(['tala.example.com' => ['93.184.216.34', '10.0.0.1']]);

        $this->expectException(UnsafeEndpoint::class);
        $guard->assertSafe('https://tala.example.com');
    }

    public function test_unresolvable_host_is_rejected(): void
    {
        $guard = $this->guard(['tala.example.com' => []], allowed: ['tala.example.com']);

        try {
            $guard->assertSafe('https://tala.example.com');
            $this->fail('unresolvable must be rejected');
        } catch (UnsafeEndpoint $e) {
            $this->assertSame('unresolvable', $e->reason);
        }
    }

    public function test_dns_rebinding_between_two_checks_is_caught_because_every_call_resolves_again(): void
    {
        config(['sailix.modules.tala.allowed_hosts' => ['tala.example.com']]);
        $first = new TalaEndpointGuard(new FakeHostResolver(['tala.example.com' => ['93.184.216.34']]));
        $second = new TalaEndpointGuard(new FakeHostResolver(['tala.example.com' => ['127.0.0.1']]));

        $first->assertSafe('https://tala.example.com');
        $this->expectException(UnsafeEndpoint::class);
        $second->assertSafe('https://tala.example.com');
    }
}
