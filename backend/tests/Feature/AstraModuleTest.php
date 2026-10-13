<?php

namespace Tests\Feature;

use App\Enums\ModuleStatus;
use App\Enums\Role;
use App\Models\TenantModule;
use App\Modules\Module;
use Tests\TestCase;

/** Astra is built into the app: no upstream system, no team to map, nothing to link. */
class AstraModuleTest extends TestCase
{
    private function as(string $username): array
    {
        $this->app['auth']->forgetGuards();

        return $this->bearer($this->tokenFor($username));
    }

    public function test_the_platform_provisions_astra_without_a_team_and_refuses_one(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->platformSession();
        $url = "/api/v1/platform/tenants/{$tenant->id}/modules/astra";

        $this->platform()->putJson($url, ['enabled' => true])
            ->assertOk()->assertJsonPath('data.code', 'astra')->assertJsonPath('data.entitled', true)
            ->assertJsonPath('data.enabled', true)->assertJsonPath('data.external_team_id', null);
        $this->platform()->putJson($url, ['external_team_id' => 'TEAM-1', 'enabled' => true])->assertStatus(422);

        // Tala still needs its team
        $this->platform()->putJson("/api/v1/platform/tenants/{$tenant->id}/modules/tala", ['enabled' => true])->assertStatus(422);
    }

    public function test_several_organizations_can_have_astra_at_once(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $this->platformSession();

        $this->platform()->putJson("/api/v1/platform/tenants/{$a->id}/modules/astra", ['enabled' => true])->assertOk();
        $this->platform()->putJson("/api/v1/platform/tenants/{$b->id}/modules/astra", ['enabled' => true])->assertOk(); // no "team already mapped"
    }

    public function test_a_member_sees_astra_as_available_only_when_the_organization_has_it_switched_on(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $this->makeMember($a, Role::Crew, 'crewA');
        $this->makeMember($b, Role::Crew, 'crewB');
        foreach ([[$a, ModuleStatus::Enabled], [$b, ModuleStatus::Disabled]] as [$tenant, $status]) {
            (new TenantModule)->forceFill(['tenant_id' => $tenant->id, 'module' => Module::Astra, 'status' => $status])->save();
        }

        $mine = collect($this->getJson('/api/v1/me', $this->as('crewA'))->assertOk()->json('data.modules'))->firstWhere('code', 'astra');
        $this->assertSame('available', $mine['status']);
        $this->assertTrue($mine['enabled']);

        $off = collect($this->getJson('/api/v1/me', $this->as('crewB'))->json('data.modules'))->firstWhere('code', 'astra');
        $this->assertSame('disabled', $off['status']);
        $this->assertFalse($off['enabled']);
    }

    public function test_an_organization_without_astra_does_not_list_it(): void
    {
        $this->makeMember($this->makeTenant('CCC'), Role::Crew, 'crewC');

        $codes = array_column($this->getJson('/api/v1/me', $this->as('crewC'))->json('data.modules'), 'code');
        $this->assertNotContains('astra', $codes);
    }
}
