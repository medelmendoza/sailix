<?php

namespace Tests\Feature;

use App\Models\Tenant;
use Tests\TestCase;

class PlatformTenantAddressTest extends TestCase
{
    private function platformAdmin(): array
    {
        [, $secret] = $this->makePlatformAdmin();
        $r = $this->spa()->postJson('/api/v1/platform/auth/session', ['email' => 'root@example.test', 'password' => self::PASSWORD, 'otp' => $this->otp($secret)])->assertOk();
        $this->carrySession($r);
        $this->app['auth']->forgetGuards();

        return [];
    }

    public function test_an_organization_created_without_a_slug_gets_one_from_its_agency_code(): void
    {
        $this->platformAdmin();
        $r = $this->spa()->postJson('/api/v1/platform/tenants', ['code' => 'SOUTHFIELD', 'name' => 'Southfield Agencies'])->assertCreated();

        $this->assertSame('southfield', $r->json('data.slug'));
        $this->assertSame('southfield.sailix.test', $r->json('data.default_address'));
    }

    public function test_the_superadmin_can_choose_the_slug_when_creating_and_it_is_checked(): void
    {
        $this->platformAdmin();
        $this->spa()->postJson('/api/v1/platform/tenants', ['code' => 'ONE', 'name' => 'One', 'slug' => 'Blue-Harbor'])->assertCreated()->assertJsonPath('data.slug', 'blue-harbor');

        foreach (['ab', 'www', 'platform', 'bad_slug', '-x-', 'a--b', 'blue-harbor'] as $bad) {
            $this->spa()->postJson('/api/v1/platform/tenants', ['code' => 'T'.strlen($bad).substr(md5($bad), 0, 4), 'name' => 'Two', 'slug' => $bad])->assertStatus(422)->assertJsonValidationErrors('slug');
        }
    }

    public function test_the_slug_cannot_be_changed_afterwards(): void
    {
        $this->platformAdmin();
        $tenant = $this->makeTenant('KEEP');

        $this->spa()->patchJson('/api/v1/platform/tenants/'.$tenant->id, ['name' => 'Renamed', 'slug' => 'moved'])->assertOk();
        $this->assertSame('keep', $tenant->refresh()->slug);
        $this->assertSame('Renamed', $tenant->name);
    }

    public function test_the_superadmin_sets_branding_and_domains_of_any_organization(): void
    {
        $this->platformAdmin();
        $tenant = $this->makeTenant('ANY');

        $this->spa()->patchJson('/api/v1/platform/tenants/'.$tenant->id.'/branding', ['tagline' => 'Set by the platform', 'primary_color' => '#355dad'])
            ->assertOk()->assertJsonPath('data.tagline', 'Set by the platform');
        $this->getJson('http://any.sailix.test/api/v1/public/tenant')->assertOk()->assertJsonPath('data.primary_color', '#355DAD');

        $this->spa()->postJson('/api/v1/platform/tenants/'.$tenant->id.'/branding/reset')->assertOk()->assertJsonPath('data.tagline', null);

        $domain = $this->spa()->postJson('/api/v1/platform/tenants/'.$tenant->id.'/domains', ['domain' => 'any.example.com'])->assertCreated()->json('data');
        $this->spa()->getJson('/api/v1/platform/tenants/'.$tenant->id.'/domains')->assertOk()->assertJsonPath('data.domains.0.domain', 'any.example.com');
        $this->spa()->deleteJson('/api/v1/platform/tenants/'.$tenant->id.'/domains/'.$domain['id'])->assertNoContent();
    }

    public function test_these_endpoints_are_for_the_superadmin_only(): void
    {
        $tenant = Tenant::count() ? Tenant::first() : $this->makeTenant('NOPE');
        $this->spa()->getJson('/api/v1/platform/tenants/'.$tenant->id.'/branding')->assertUnauthorized();
        $this->spa()->postJson('/api/v1/platform/tenants/'.$tenant->id.'/domains', ['domain' => 'x.example.com'])->assertUnauthorized();
    }
}
