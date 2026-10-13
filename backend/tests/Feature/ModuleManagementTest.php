<?php

namespace Tests\Feature;

use App\Enums\LinkStatus;
use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\ExternalIdentity;
use App\Models\ModuleLink;
use App\Models\TenantModule;
use App\Modules\Module;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ModuleManagementTest extends TestCase
{
    private function asUser(string $username): array
    {
        $this->app['auth']->forgetGuards();

        return $this->bearer($this->tokenFor($username));
    }

    private function link(string $tenantId, string $membershipId, string $userId, string $team, LinkStatus $status = LinkStatus::Linked, string $external = 'tala-user-1'): ModuleLink
    {
        $identity = (new ExternalIdentity)->forceFill(['user_id' => $userId, 'module' => Module::Tala, 'external_user_id' => $external]);
        $identity->save();

        $link = (new ModuleLink)->forceFill([
            'tenant_id' => $tenantId, 'membership_id' => $membershipId, 'module' => Module::Tala,
            'external_identity_id' => $identity->getKey(), 'external_team_id' => $team, 'status' => $status,
            'access_token' => 'access-token-secret', 'refresh_token' => 'refresh-token-secret',
        ]);
        $link->save();

        return $link;
    }

    // ---- platform provisioning --------------------------------------------------------------------

    public function test_platform_provisions_a_module_with_team_mapping_and_audits_it(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->platformSession();

        $this->platform()->putJson("/api/v1/platform/tenants/{$tenant->id}/modules/tala", ['external_team_id' => 'TEAM-1'])
            ->assertOk()->assertJsonPath('data.entitled', true)->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.external_team_id', 'TEAM-1')->assertJsonPath('data.links_count', 0);

        $this->platform()->putJson("/api/v1/platform/tenants/{$tenant->id}/modules/tala", ['external_team_id' => 'TEAM-1', 'enabled' => true])
            ->assertOk()->assertJsonPath('data.enabled', true);

        $this->platform()->getJson("/api/v1/platform/tenants/{$tenant->id}/modules")->assertOk()
            ->assertJsonPath('data.0.code', 'tala')->assertJsonPath('data.0.external_team_id', 'TEAM-1');

        $logs = $this->platform()->getJson('/api/v1/platform/audit-logs?filter[action]=module.provisioned')->assertOk();
        $this->assertCount(2, $logs->json('data'));
        $this->assertSame('TEAM-1', $logs->json('data.0.metadata.external_team_id'));
        $this->assertSame($tenant->id, $logs->json('data.0.tenant_id'));
    }

    public function test_provisioning_validates_input_and_unknown_modules_or_tenants_are_404(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->platformSession();
        $url = "/api/v1/platform/tenants/{$tenant->id}/modules/tala";

        $this->platform()->putJson($url, [])->assertStatus(422)->assertJsonStructure(['errors' => ['external_team_id']]);
        foreach (['bad team!', '../x', str_repeat('a', 65), '', 'team id'] as $bad) {
            $this->platform()->putJson($url, ['external_team_id' => $bad])->assertStatus(422);
        }
        $this->platform()->putJson("/api/v1/platform/tenants/{$tenant->id}/modules/srt", ['external_team_id' => 'T'])->assertStatus(404);
        $this->platform()->putJson("/api/v1/platform/tenants/{$tenant->id}/modules/astra", ['external_team_id' => 'T'])->assertStatus(404);
        $this->platform()->putJson('/api/v1/platform/tenants/'.Str::uuid().'/modules/tala', ['external_team_id' => 'T'])->assertStatus(404);
        $this->assertSame(0, TenantModule::withoutTenantScope()->count());
    }

    public function test_a_team_cannot_be_mapped_to_two_organizations(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $this->platformSession();

        $this->platform()->putJson("/api/v1/platform/tenants/{$a->id}/modules/tala", ['external_team_id' => 'TEAM-X'])->assertOk();
        $this->platform()->putJson("/api/v1/platform/tenants/{$b->id}/modules/tala", ['external_team_id' => 'TEAM-X'])
            ->assertStatus(409)->assertJsonPath('code', 'team_already_mapped');

        $this->assertSame(1, TenantModule::withoutTenantScope()->where('external_team_id', 'TEAM-X')->count());
        // the same tenant may re-submit its own mapping
        $this->platform()->putJson("/api/v1/platform/tenants/{$a->id}/modules/tala", ['external_team_id' => 'TEAM-X'])->assertOk();
    }

    public function test_team_mapping_cannot_change_while_accounts_are_linked(): void
    {
        $tenant = $this->makeTenant('SFAI');
        [$user, $m] = $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->provisionModule($tenant, 'TEAM-1');
        $this->link($tenant->id, $m->id, $user->id, 'TEAM-1');
        $this->platformSession();

        $this->platform()->putJson("/api/v1/platform/tenants/{$tenant->id}/modules/tala", ['external_team_id' => 'TEAM-2'])
            ->assertStatus(409)->assertJsonPath('code', 'links_exist');
        $this->assertSame('TEAM-1', TenantModule::withoutTenantScope()->firstOrFail()->external_team_id);

        // same team is fine (e.g. toggling enabled)
        $this->platform()->putJson("/api/v1/platform/tenants/{$tenant->id}/modules/tala", ['external_team_id' => 'TEAM-1', 'enabled' => true])
            ->assertOk()->assertJsonPath('data.links_count', 1);
    }

    public function test_platform_module_routes_reject_tenant_credentials(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $h = $this->asUser('admin1');

        $this->putJson("/api/v1/platform/tenants/{$tenant->id}/modules/tala", ['external_team_id' => 'TEAM-1'], $h)->assertStatus(401);
        $this->getJson("/api/v1/platform/tenants/{$tenant->id}/modules", $this->asUser('admin1'))->assertStatus(401);
        $this->assertSame(0, TenantModule::withoutTenantScope()->count());
    }

    // ---- tenant toggle ----------------------------------------------------------------------------

    public function test_tenant_admin_toggles_a_provisioned_module_but_cannot_change_the_team(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->provisionModule($tenant, 'TEAM-1', enabled: false);

        $this->getJson('/api/v1/tenant/modules', $this->asUser('admin1'))->assertOk()
            ->assertJsonPath('data.0.entitled', true)->assertJsonPath('data.0.enabled', false);

        $this->putJson('/api/v1/tenant/modules/tala', ['enabled' => true, 'external_team_id' => 'EVIL-TEAM'], $this->asUser('admin1'))
            ->assertOk()->assertJsonPath('data.enabled', true)->assertJsonPath('data.external_team_id', 'TEAM-1');
        $this->assertSame('TEAM-1', TenantModule::withoutTenantScope()->firstOrFail()->external_team_id);

        $this->putJson('/api/v1/tenant/modules/tala', ['enabled' => false], $this->asUser('admin1'))->assertOk()->assertJsonPath('data.enabled', false);

        $actions = $this->getJson('/api/v1/tenant/audit-logs', $this->asUser('admin1'))->json('data.*.action');
        $this->assertContains('module.enabled', $actions);
        $this->assertContains('module.disabled', $actions);
    }

    public function test_tenant_cannot_enable_a_module_the_platform_has_not_provisioned(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::TenantAdmin, 'admin1');
        $h = $this->asUser('admin1');

        $this->putJson('/api/v1/tenant/modules/tala', ['enabled' => true], $h)->assertStatus(409)->assertJsonPath('code', 'module_not_provisioned');
        $this->assertSame(0, TenantModule::withoutTenantScope()->count());
        $this->getJson('/api/v1/tenant/modules', $this->asUser('admin1'))->assertJsonPath('data.0.entitled', false);
    }

    public function test_crew_cannot_manage_modules_and_inputs_are_validated(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->provisionModule($tenant, 'TEAM-1');

        $this->putJson('/api/v1/tenant/modules/tala', ['enabled' => false], $this->asUser('crew1'))->assertStatus(403);
        $this->getJson('/api/v1/tenant/modules', $this->asUser('crew1'))->assertStatus(403);
        $this->assertTrue(TenantModule::withoutTenantScope()->firstOrFail()->isEnabled());

        $this->putJson('/api/v1/tenant/modules/tala', [], $this->asUser('admin1'))->assertStatus(422);
        $this->putJson('/api/v1/tenant/modules/tala', ['enabled' => 'maybe'], $this->asUser('admin1'))->assertStatus(422);
        $this->putJson('/api/v1/tenant/modules/srt', ['enabled' => true], $this->asUser('admin1'))->assertStatus(404);
    }

    // ---- /me.modules ------------------------------------------------------------------------------

    public function test_me_lists_only_provisioned_modules_with_link_state_and_never_leaks_tokens(): void
    {
        $tenant = $this->makeTenant('SFAI');
        [$user, $m] = $this->makeMember($tenant, Role::Crew, 'crew1');

        $this->getJson('/api/v1/me', $this->asUser('crew1'))->assertOk()->assertJsonPath('data.modules', []);

        $this->provisionModule($tenant, 'TEAM-1');
        $this->getJson('/api/v1/me', $this->asUser('crew1'))
            ->assertJsonPath('data.modules.0', ['code' => 'tala', 'label' => 'Tala', 'enabled' => true, 'linked' => false, 'status' => 'not_linked']);

        $link = $this->link($tenant->id, $m->id, $user->id, 'TEAM-1');
        $res = $this->getJson('/api/v1/me', $this->asUser('crew1'))->assertJsonPath('data.modules.0.status', 'linked')->assertJsonPath('data.modules.0.linked', true);
        $this->assertStringNotContainsString('access-token-secret', $res->getContent());
        $this->assertStringNotContainsString('refresh-token-secret', $res->getContent());

        $link->forceFill(['status' => LinkStatus::NeedsRelink])->save();
        $this->getJson('/api/v1/me', $this->asUser('crew1'))->assertJsonPath('data.modules.0.status', 'needs_relink')->assertJsonPath('data.modules.0.linked', false);

        $link->forceFill(['status' => LinkStatus::Revoked])->save();
        $this->getJson('/api/v1/me', $this->asUser('crew1'))->assertJsonPath('data.modules.0.status', 'revoked');

        TenantModule::withoutTenantScope()->update(['status' => 'disabled']);
        $this->getJson('/api/v1/me', $this->asUser('crew1'))->assertJsonPath('data.modules.0.enabled', false)->assertJsonPath('data.modules.0.status', 'disabled');
    }

    public function test_me_no_longer_exposes_the_removed_features_object(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');

        $this->getJson('/api/v1/me', $this->asUser('crew1'))->assertOk()->assertJsonMissingPath('data.features')->assertJsonStructure(['data' => ['modules']]);
    }

    // ---- tokens at rest ---------------------------------------------------------------------------

    public function test_link_tokens_are_encrypted_at_rest_and_hidden_when_serialized(): void
    {
        $tenant = $this->makeTenant('SFAI');
        [$user, $m] = $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->provisionModule($tenant, 'TEAM-1');
        $link = $this->link($tenant->id, $m->id, $user->id, 'TEAM-1');

        $raw = DB::table('module_links')->where('id', $link->id)->first();
        $this->assertNotSame('access-token-secret', $raw->access_token);
        $this->assertStringNotContainsString('access-token-secret', (string) $raw->access_token);
        $this->assertStringNotContainsString('refresh-token-secret', (string) $raw->refresh_token);

        $loaded = app(TenantContext::class)->runAs($tenant->id, $m->id, $user->id, Role::Crew, fn () => ModuleLink::firstOrFail());
        $this->assertSame('access-token-secret', $loaded->access_token);
        $this->assertArrayNotHasKey('access_token', $loaded->toArray());
        $this->assertStringNotContainsString('secret', $loaded->toJson());
    }

    public function test_audit_entries_never_contain_secrets(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->platformSession();
        $this->platform()->putJson("/api/v1/platform/tenants/{$tenant->id}/modules/tala", ['external_team_id' => 'TEAM-1'])->assertOk();

        app(TenantContext::class)->markPlatform();
        $dump = AuditLog::all()->toJson();
        $this->assertStringNotContainsString('password', strtolower($dump));
        $this->assertStringNotContainsString('token', strtolower($dump));
    }
}
