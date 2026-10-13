<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Support\Settings\SettingsRegistry;
use Illuminate\Support\Facades\Cache;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Mandatory condition 5: platform-controlled, approved HTTPS endpoint, never tenant-configurable. */
class PlatformTalaSettingTest extends TestCase
{
    private function patchSettings(array $settings)
    {
        return $this->platform()->patchJson('/api/v1/platform/settings', ['settings' => $settings]);
    }

    public function test_accepts_an_approved_https_host_and_stores_the_normalized_origin(): void
    {
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']]);
        $this->platformSession();

        $this->patchSettings(['tala_api_base_url' => 'https://Tala.Example.com/'])->assertOk()->assertJsonPath('data.tala_api_base_url', 'https://tala.example.com');

        Cache::flush();
        $this->assertSame('https://tala.example.com', SettingsRegistry::platform('tala_api_base_url'));
        $this->platform()->getJson('/api/v1/platform/settings')->assertOk()->assertJsonPath('data.tala_api_base_url', 'https://tala.example.com');
    }

    /** @return array<string, array{string}> */
    public static function rejected(): array
    {
        return [
            'http' => ['http://tala.example.com'], 'ip literal' => ['https://93.184.216.34'], 'loopback' => ['https://127.0.0.1'],
            'localhost' => ['https://localhost'], 'userinfo' => ['https://a:b@tala.example.com'], 'port' => ['https://tala.example.com:8443'],
            'path' => ['https://tala.example.com/api'], 'not allow-listed' => ['https://evil.example.org'], 'metadata' => ['https://169.254.169.254'],
            'garbage' => ['not a url'],
        ];
    }

    #[DataProvider('rejected')]
    public function test_rejects_unapproved_endpoints_over_http(string $url): void
    {
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34'], 'evil.example.org' => ['93.184.216.35']], allowed: ['tala.example.com']);
        $this->platformSession();

        $this->patchSettings(['tala_api_base_url' => $url])->assertStatus(422)->assertJsonStructure(['errors' => ['tala_api_base_url']]);
        Cache::flush();
        $this->assertNull(SettingsRegistry::platform('tala_api_base_url'));
    }

    public function test_an_allow_listed_host_that_resolves_to_a_private_address_is_rejected(): void
    {
        $this->fakeTalaDns(['tala.example.com' => ['10.1.2.3']]);
        $this->platformSession();

        $this->patchSettings(['tala_api_base_url' => 'https://tala.example.com'])->assertStatus(422);
    }

    public function test_nothing_is_accepted_when_no_hosts_are_approved(): void
    {
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']], allowed: []);
        $this->platformSession();

        $this->patchSettings(['tala_api_base_url' => 'https://tala.example.com'])->assertStatus(422);
    }

    public function test_a_tenant_admin_can_never_set_it(): void
    {
        $this->fakeTalaDns();
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->app['auth']->forgetGuards();
        $h = $this->bearer($this->tokenFor('admin1'));

        $this->patchJson('/api/v1/tenant', ['settings' => ['tala_api_base_url' => 'https://tala.example.com']], $h)
            ->assertStatus(422)->assertJsonStructure(['errors' => ['tala_api_base_url']]);
        $this->app['auth']->forgetGuards();
        $this->patchJson('/api/v1/platform/settings', ['settings' => ['tala_api_base_url' => 'https://tala.example.com']], $h)->assertStatus(401);

        Cache::flush();
        $this->assertNull(SettingsRegistry::platform('tala_api_base_url'));
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/tenant', $h)->assertOk()->assertJsonMissingPath('data.settings.tala_api_base_url');
    }

    public function test_the_setting_can_be_cleared(): void
    {
        $this->fakeTalaDns();
        $this->platformSession();
        $this->patchSettings(['tala_api_base_url' => 'https://tala.example.com'])->assertOk();

        $this->patchSettings(['tala_api_base_url' => null])->assertOk()->assertJsonPath('data.tala_api_base_url', null);
        Cache::flush();
        $this->assertNull(SettingsRegistry::platform('tala_api_base_url'));
        $this->assertDatabaseMissing('platform_settings', ['key' => 'tala_api_base_url']);
    }
}
