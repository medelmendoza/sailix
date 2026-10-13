<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsTest extends TestCase
{
    public function test_configured_web_origin_is_allowed_with_credentials(): void
    {
        $this->assertSame(['http://localhost:5173'], config('cors.allowed_origins'));

        $this->call('OPTIONS', '/api/v1/auth/session', [], [], [], [
            'HTTP_ORIGIN' => 'http://localhost:5173',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,x-xsrf-token',
        ])->assertSuccessful()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    public function test_unlisted_origins_are_never_echoed_and_wildcard_is_never_used(): void
    {
        $response = $this->call('OPTIONS', '/api/v1/auth/session', [], [], [], [
            'HTTP_ORIGIN' => 'http://evil.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
        ]);

        // The library answers with the single configured origin; a browser on another origin rejects it.
        $this->assertNotSame('http://evil.example', $response->headers->get('Access-Control-Allow-Origin'));
        $this->assertNotSame('*', $response->headers->get('Access-Control-Allow-Origin'));
        $this->assertNotContains('*', config('cors.allowed_origins'));
    }
}
