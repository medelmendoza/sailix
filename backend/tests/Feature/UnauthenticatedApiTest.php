<?php

namespace Tests\Feature;

use Tests\TestCase;

/** Found by the browser e2e suite: a guest request without `Accept: application/json` was a 500 ("Route [login] not defined"). */
class UnauthenticatedApiTest extends TestCase
{
    public function test_guest_request_without_json_accept_header_is_a_401_problem_not_a_500(): void
    {
        foreach (['/api/v1/me', '/api/v1/tenant/users', '/api/v1/platform/me'] as $path) {
            $response = $this->call('GET', $path);

            $response->assertStatus(401);
            $this->assertStringContainsString('problem+json', (string) $response->headers->get('Content-Type'), $path);
            $this->assertNull($response->headers->get('Location'), $path);
        }
    }
}
