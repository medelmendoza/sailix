<?php

namespace Tests\Feature;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Models\TenantModule;
use App\Support\Settings\SettingsRegistry;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/** Gateway access rules (mandatory security conditions 2 and 4), exercised on a test-only route. */
class RequireModuleTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // An approved upstream endpoint is configured (the default is NOT configured: see the 503 test below).
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']]);
        SettingsRegistry::setPlatform('tala_api_base_url', 'https://tala.example.com');

        // Stand-in for a future gateway endpoint: reports only what the SERVER established.
        Route::middleware(['api', 'auth:sanctum', 'tenant.context', 'module:tala'])->get('/api/v1/__test/tala', function (Request $request, TenantContext $context) {
            $entitlement = TenantModule::firstOrFail();

            return response()->json([
                'tenant_id' => $context->tenantId(),
                'membership_id' => $context->membershipId(),
                'role' => $context->role()->value,
                'team' => $entitlement->external_team_id,
            ]);
        });
    }

    private function gateway(string $username, array $query = [], array $headers = [])
    {
        $this->app['auth']->forgetGuards();
        $token = $this->tokenFor($username);
        $this->app['auth']->forgetGuards();

        return $this->getJson('/api/v1/__test/tala?'.http_build_query($query), $this->bearer($token) + $headers);
    }

    public function test_enabled_module_and_permitted_role_pass(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->provisionModule($tenant, 'TEAM-1');

        $this->gateway('crew1')->assertOk()->assertJsonPath('team', 'TEAM-1')->assertJsonPath('role', 'crew');
    }

    public function test_not_provisioned_or_disabled_module_is_blocked(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');

        $this->gateway('crew1')->assertStatus(403)->assertJsonPath('code', 'module_disabled');

        $row = $this->provisionModule($tenant, 'TEAM-1', enabled: false);
        $this->gateway('crew1')->assertStatus(403)->assertJsonPath('code', 'module_disabled');

        $row->forceFill(['status' => 'enabled'])->save();
        $this->gateway('crew1')->assertOk();
    }

    /** Mandatory condition 4a: disabling the module blocks the very next request with the SAME token. */
    public function test_disabling_the_module_blocks_subsequent_requests_with_an_existing_token(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->provisionModule($tenant, 'TEAM-1');

        $this->app['auth']->forgetGuards();
        $crewToken = $this->tokenFor('crew1');
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/__test/tala', $this->bearer($crewToken))->assertOk();

        $this->app['auth']->forgetGuards();
        $adminToken = $this->tokenFor('admin1');
        $this->app['auth']->forgetGuards();
        $this->putJson('/api/v1/tenant/modules/tala', ['enabled' => false], $this->bearer($adminToken))->assertOk();

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/__test/tala', $this->bearer($crewToken))->assertStatus(403)->assertJsonPath('code', 'module_disabled');
    }

    /** Mandatory condition 4b: suspending/deactivating the organization blocks gateway access server-side. */
    public function test_suspended_organization_blocks_gateway_access_even_with_an_enabled_module(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->provisionModule($tenant, 'TEAM-1');
        $this->app['auth']->forgetGuards();
        $token = $this->tokenFor('crew1');

        foreach ([TenantStatus::Suspended, TenantStatus::Deactivated, TenantStatus::Archived] as $status) {
            $tenant->forceFill(['status' => $status])->save();
            $this->app['auth']->forgetGuards();
            $this->getJson('/api/v1/__test/tala', $this->bearer($token))->assertStatus(403)->assertJsonPath('code', 'tenant_suspended');
        }
    }

    public function test_suspended_member_is_blocked(): void
    {
        $tenant = $this->makeTenant('SFAI');
        [, $m] = $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->provisionModule($tenant, 'TEAM-1');
        $this->app['auth']->forgetGuards();
        $token = $this->tokenFor('crew1');

        $m->forceFill(['status' => MembershipStatus::Suspended])->save();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/__test/tala', $this->bearer($token))->assertStatus(403)->assertJsonPath('code', 'membership_suspended');
    }

    public function test_a_role_without_the_use_ability_is_forbidden(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->provisionModule($tenant, 'TEAM-1');

        Gate::define('module.tala.use', fn () => false); // simulate a role/policy that lacks the ability

        $this->gateway('crew1')->assertStatus(403)->assertJsonPath('code', 'module_forbidden');
    }

    public function test_unauthenticated_requests_never_reach_the_module_check(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->provisionModule($tenant, 'TEAM-1');

        $this->getJson('/api/v1/__test/tala')->assertStatus(401);
    }

    /** Mandatory condition 2: client-supplied userId/teamId/tenant/role values never influence access. */
    public function test_client_supplied_identity_values_are_ignored(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        [, $crewA] = $this->makeMember($a, Role::Crew, 'crewA');
        [, $adminB] = $this->makeMember($b, Role::TenantAdmin, 'adminB');
        $this->provisionModule($a, 'TEAM-A');
        $this->provisionModule($b, 'TEAM-B');

        $res = $this->gateway('crewA', [
            'userId' => 'someone-else', 'teamId' => 'TEAM-B', 'tenant_id' => $b->id, 'tenantId' => $b->id,
            'membership_id' => $adminB->id, 'role' => 'tenant_admin',
        ]);

        $res->assertOk()->assertJsonPath('tenant_id', $a->id)->assertJsonPath('membership_id', $crewA->id)
            ->assertJsonPath('role', 'crew')->assertJsonPath('team', 'TEAM-A');
    }

    public function test_spoofed_tenant_headers_are_rejected(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $this->makeMember($a, Role::Crew, 'crewA');
        $this->provisionModule($a, 'TEAM-A');
        $this->provisionModule($b, 'TEAM-B');

        $this->gateway('crewA', headers: ['X-Tenant-Hint' => $b->id])->assertStatus(409)->assertJsonPath('code', 'tenant_mismatch');
        $this->gateway('crewA', headers: ['X-Tenant-Hint' => 'BBB'])->assertStatus(409);
    }

    public function test_a_module_enabled_in_another_organization_does_not_help(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $this->makeMember($a, Role::Crew, 'crewA');
        $this->provisionModule($b, 'TEAM-B'); // only B is entitled

        $this->gateway('crewA')->assertStatus(403)->assertJsonPath('code', 'module_disabled');
    }

    /** Mandatory condition 1: no endpoint verified as HTTPS ⇒ nothing reaches the upstream. */
    public function test_module_is_unavailable_until_an_approved_https_endpoint_is_configured(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->provisionModule($tenant, 'TEAM-1');

        SettingsRegistry::setPlatform('tala_api_base_url', null);
        Cache::flush();
        $this->gateway('crew1')->assertStatus(503)->assertJsonPath('code', 'module_unavailable');

        SettingsRegistry::setPlatform('tala_api_base_url', 'https://tala.example.com');
        Cache::flush();
        $this->gateway('crew1')->assertOk();
    }
}
