<?php

namespace Tests\Unit;

use App\Tenancy\DomainNormalizer;
use App\Tenancy\TenantSlugs;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class DomainNormalizerTest extends TestCase
{
    /** @return array<string, array{0: ?string, 1: ?string}> */
    public static function hosts(): array
    {
        return [
            'plain' => ['example.com', 'example.com'],
            'case' => ['Example.COM', 'example.com'],
            'port' => ['example.com:8443', 'example.com'],
            'trailing dot' => ['example.com.', 'example.com'],
            'www is dropped' => ['www.example.com', 'example.com'],
            'all of it' => ['  WWW.Example.com.:8443 ', 'example.com'],
            'one www only' => ['www.www.example.com', 'www.example.com'],
            'a subdomain stays' => ['school-a.sailix.app', 'school-a.sailix.app'],
            'unicode becomes punycode' => ['bücher.example', 'xn--bcher-kva.example'],
            'ip is still a host string' => ['192.168.0.1', '192.168.0.1'],
            'empty' => ['', null],
            'null' => [null, null],
            'a path' => ['example.com/path', null],
            'credentials' => ['user@example.com', null],
            'a space' => ['exa mple.com', null],
            'an ipv6 literal' => ['[::1]:8000', null],
            'bad characters' => ['exa_mple.com', null],
            'leading hyphen' => ['-example.com', null],
            'double dot' => ['a..example.com', null],
        ];
    }

    #[DataProvider('hosts')]
    public function test_it_gives_one_canonical_spelling(?string $raw, ?string $expected): void
    {
        $this->assertSame($expected, DomainNormalizer::normalize($raw));
    }

    public function test_only_a_name_a_customer_could_own_is_registrable(): void
    {
        foreach (['example.com', 'school.example.co.uk', 'xn--bcher-kva.example'] as $ok) {
            $this->assertTrue(DomainNormalizer::isRegistrable($ok), $ok);
        }
        foreach (['localhost', 'school.localhost', 'intranet', '192.168.0.1', 'a.b', 'exa_mple.com'] as $no) {
            $this->assertFalse(DomainNormalizer::isRegistrable($no), $no);
        }
    }

    public function test_slugs_are_three_to_forty_safe_characters_and_never_reserved(): void
    {
        foreach (['abc', 'southfield', 'a1-b2', str_repeat('a', 40)] as $ok) {
            $this->assertTrue(TenantSlugs::isValid($ok), $ok);
        }
        foreach (['ab', str_repeat('a', 41), '-abc', 'abc-', 'a--b', 'ABC', 'a_b', 'a.b', 'www', 'api', 'platform', 'admin', 'sailix'] as $no) {
            $this->assertFalse(TenantSlugs::isValid($no), $no);
        }
    }
}
