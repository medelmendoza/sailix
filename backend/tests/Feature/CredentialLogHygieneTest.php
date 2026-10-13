<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Support\Settings\SettingsRegistry;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * No credential, token or upstream body may ever reach a log line (mandatory condition: never log credentials or tokens).
 * Exercises every failure path of the gateway and inspects EVERYTHING logged, including exception traces.
 */
class CredentialLogHygieneTest extends TestCase
{
    private const SECRETS = ['tala-pass-123', 'access-token-secret', 'refresh-token-secret', 'upstream-body-secret'];

    /** @var list<string> */
    private array $logged = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']]);
        SettingsRegistry::setPlatform('tala_api_base_url', 'https://tala.example.com');
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->provisionModule($tenant, 'TEAM-1');
        Event::listen(MessageLogged::class, function (MessageLogged $e) {
            $exception = $e->context['exception'] ?? null;
            $trace = $exception instanceof \Throwable ? $exception->getMessage().' '.$exception->getTraceAsString() : '';
            $this->logged[] = $e->message.' '.json_encode($e->context, JSON_PARTIAL_OUTPUT_ON_ERROR).' '.$trace;
        });
    }

    private function fake(array $stubs): void
    {
        Http::swap(new Factory);
        Http::preventStrayRequests();
        Http::fake($stubs);
    }

    public function test_no_secret_reaches_the_logs_on_any_failure_path(): void
    {
        $this->app['auth']->forgetGuards();
        $h = $this->bearer($this->tokenFor('crew1'));
        $link = fn () => $this->postJson('/api/v1/modules/tala/link', ['username' => 'maria', 'password' => 'tala-pass-123'], $h);
        $b = 'https://tala.example.com/api/v1';

        $this->fake([$b.'/login' => Http::response(['message' => 'upstream-body-secret'], 401)]);
        $link()->assertStatus(422);
        $this->fake([$b.'/login' => Http::response('upstream-body-secret', 500)]);
        $link()->assertStatus(503);
        $this->fake([$b.'/login' => fn () => throw new ConnectionException('cURL error 28 upstream-body-secret')]);
        $link()->assertStatus(503);
        $this->fake([$b.'/login' => Http::response(['accessToken' => 'access-token-secret', 'refreshToken' => 'refresh-token-secret', 'userId' => 'u1']), $b.'/auth/users/u1/teams' => Http::response([['teamId' => 'OTHER']])]);
        $link()->assertStatus(422); // team not in organization
        $this->fake([$b.'/login' => Http::response(['accessToken' => 'access-token-secret', 'refreshToken' => 'refresh-token-secret', 'userId' => 'u1']), $b.'/auth/users/u1/teams' => Http::response([['teamId' => 'TEAM-1']]), $b.'/auth/users/u1/teams/TEAM-1/courses' => Http::response(['error' => 'upstream-body-secret'], 401)]);
        $link()->assertOk();
        $this->getJson('/api/v1/modules/tala/courses', $h)->assertStatus(409); // rejected token -> relink

        $joined = implode("\n", $this->logged);
        foreach (self::SECRETS as $secret) {
            $this->assertStringNotContainsString($secret, $joined, "[$secret] was logged");
        }
    }

    public function test_expected_api_failures_are_not_reported_as_errors_at_all(): void
    {
        $this->postJson('/api/v1/auth/token', ['username' => 'crew1', 'password' => 'wrong-wrong-wrong', 'device_name' => 'd'])->assertStatus(401);

        $this->assertSame([], array_filter($this->logged, fn ($l) => str_contains($l, 'wrong-wrong-wrong')));
        $this->assertSame([], array_filter($this->logged, fn ($l) => str_contains($l, 'credentials are incorrect')));
    }
}
