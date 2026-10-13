<?php

namespace Tests\Feature;

use App\Enums\Role;
use Illuminate\Http\Middleware\TrustProxies;
use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    private function assertHardened($response, bool $https = false): void
    {
        $h = $response->headers;
        $this->assertSame('nosniff', $h->get('X-Content-Type-Options'));
        $this->assertSame('no-referrer', $h->get('Referrer-Policy'));
        $this->assertSame('DENY', $h->get('X-Frame-Options'));
        $this->assertSame("default-src 'none'; frame-ancestors 'none'", $h->get('Content-Security-Policy'));
        $this->assertStringContainsString('no-store', (string) $h->get('Cache-Control'));
        $this->assertSame($https ? 'max-age=31536000; includeSubDomains' : null, $h->get('Strict-Transport-Security'));
    }

    public function test_success_validation_auth_and_not_found_responses_all_carry_the_headers(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        $token = $this->tokenFor('crew1');

        $this->assertHardened($this->getJson('/api/v1/me', $this->bearer($token))->assertOk());
        $this->assertHardened($this->postJson('/api/v1/auth/token', [])->assertStatus(422));
        $this->app['auth']->forgetGuards();
        $this->assertHardened($this->getJson('/api/v1/me')->assertStatus(401));
        $this->assertHardened($this->getJson('/api/v1/does-not-exist')->assertStatus(404));
        $this->assertHardened($this->get('/up'));
    }

    public function test_hsts_is_sent_only_over_https(): void
    {
        $this->assertHardened($this->getJson('https://localhost/api/v1/me'), https: true);
    }

    public function test_forwarded_https_is_honoured_only_from_a_trusted_proxy(): void
    {
        $forwarded = ['X-Forwarded-Proto' => 'https', 'X-Forwarded-For' => '203.0.113.7'];

        // no trusted proxy configured: spoofed forwarding headers change nothing
        $this->assertHardened($this->getJson('/api/v1/me', $forwarded));

        // the balancer is trusted: the request counts as HTTPS
        TrustProxies::at('*');
        try {
            $this->assertHardened($this->getJson('/api/v1/me', $forwarded), https: true);
        } finally {
            TrustProxies::flushState();
        }
    }
}
