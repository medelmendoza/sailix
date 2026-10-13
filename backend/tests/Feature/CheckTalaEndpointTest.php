<?php

namespace Tests\Feature;

use App\Support\Settings\SettingsRegistry;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CheckTalaEndpointTest extends TestCase
{
    public function test_unset_endpoint_fails_closed(): void
    {
        $this->artisan('sailix:tala:check')->expectsOutputToContain('not set')->assertFailed();
    }

    public function test_an_approved_endpoint_passes_offline_and_sends_nothing(): void
    {
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']]);
        SettingsRegistry::setPlatform('tala_api_base_url', 'https://tala.example.com');

        $this->artisan('sailix:tala:check')->expectsOutputToContain('https, allow-listed')->assertSuccessful();

        Http::assertNothingSent();
    }

    public function test_a_host_that_stops_being_allow_listed_or_turns_private_fails(): void
    {
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']]);
        SettingsRegistry::setPlatform('tala_api_base_url', 'https://tala.example.com');

        $this->fakeTalaDns(['tala.example.com' => ['10.0.0.9']]);
        $this->artisan('sailix:tala:check')->expectsOutputToContain('non_public_destination')->assertFailed();

        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']], allowed: ['elsewhere.example.com']);
        $this->artisan('sailix:tala:check')->expectsOutputToContain('not_allow_listed')->assertFailed();
    }

    public function test_live_mode_makes_one_unauthenticated_request(): void
    {
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']]);
        SettingsRegistry::setPlatform('tala_api_base_url', 'https://tala.example.com');
        Http::fake(['https://tala.example.com/' => Http::response('ok', 200, ['Strict-Transport-Security' => 'max-age=1'])]);

        $this->artisan('sailix:tala:check', ['--live' => true])->expectsOutputToContain('upstream sends HSTS')->assertSuccessful();

        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => ! $r->hasHeader('Authorization'));
    }
}
