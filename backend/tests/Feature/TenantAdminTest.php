<?php

namespace Tests\Feature;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Models\PersonalAccessToken;
use App\Support\Settings\SettingsRegistry;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class TenantAdminTest extends TestCase
{
    public function test_crew_cannot_use_tenant_admin_endpoints(): void
    {
        $tenant = $this->makeTenant();
        [, $crew] = $this->makeMember($tenant, Role::Crew, 'crew1');
        $h = $this->as('crew1');

        $this->getJson('/api/v1/tenant', $h)->assertStatus(403)->assertJsonPath('code', 'forbidden');
        $this->patchJson('/api/v1/tenant', ['settings' => ['display_name' => 'x']], $h)->assertStatus(403);
        $this->getJson('/api/v1/tenant/users', $h)->assertStatus(403);
        $this->patchJson("/api/v1/tenant/users/{$crew->id}", ['status' => 'suspended'], $h)->assertStatus(403);
        $this->getJson('/api/v1/tenant/audit-logs', $h)->assertStatus(403);
    }

    public function test_admin_lists_only_own_tenant_members_with_filters(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $this->makeMember($a, Role::TenantAdmin, 'adminA');
        $this->makeMember($a, Role::Crew, 'crewA');
        $this->makeMember($b, Role::Crew, 'crewB');

        $res = $this->getJson('/api/v1/tenant/users', $this->as('adminA'))->assertOk();
        $this->assertEqualsCanonicalizing(['adminA', 'crewA'], collect($res->json('data'))->pluck('user.username')->all());

        $this->getJson('/api/v1/tenant/users?filter[role]=crew', $this->as('adminA'))->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/tenant/users?filter[q]=crew', $this->as('adminA'))->assertJsonCount(1, 'data');
    }

    public function test_admin_can_suspend_a_member_and_that_members_tokens_die(): void
    {
        $tenant = $this->makeTenant();
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        [, $crew] = $this->makeMember($tenant, Role::Crew, 'crew1');
        $crewToken = $this->tokenFor('crew1');

        $this->patchJson("/api/v1/tenant/users/{$crew->id}", ['status' => 'suspended'], $this->as('admin1'))
            ->assertOk()->assertJsonPath('data.status', 'suspended');

        $this->assertSame(0, PersonalAccessToken::where('membership_id', $crew->id)->count());
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($crewToken))->assertStatus(401);
    }

    public function test_pending_member_can_be_activated(): void
    {
        $tenant = $this->makeTenant();
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        [, $pending] = $this->makeMember($tenant, Role::Crew, 'pend', MembershipStatus::Pending);

        $this->patchJson("/api/v1/tenant/users/{$pending->id}", ['status' => 'active'], $this->as('admin1'))->assertOk()->assertJsonPath('data.status', 'active');
        $this->postJson('/api/v1/auth/token', ['username' => 'pend', 'password' => self::PASSWORD, 'device_name' => 'd'])->assertOk();
    }

    public function test_last_active_admin_cannot_be_demoted_or_suspended(): void
    {
        $tenant = $this->makeTenant();
        [, $admin] = $this->makeMember($tenant, Role::TenantAdmin, 'admin1');

        $this->patchJson("/api/v1/tenant/users/{$admin->id}", ['status' => 'suspended'], $this->as('admin1'))->assertStatus(409)->assertJsonPath('code', 'last_admin');
        $this->patchJson("/api/v1/tenant/users/{$admin->id}", ['role' => 'crew'], $this->as('admin1'))->assertStatus(409)->assertJsonPath('code', 'last_admin');

        // with a second admin the demotion is allowed
        $this->makeMember($tenant, Role::TenantAdmin, 'admin2');
        $this->patchJson("/api/v1/tenant/users/{$admin->id}", ['role' => 'crew'], $this->as('admin2'))->assertOk()->assertJsonPath('data.role', 'crew');
    }

    public function test_invited_membership_cannot_be_changed_through_the_users_endpoint(): void
    {
        $tenant = $this->makeTenant();
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        [, $invited] = $this->makeMember($tenant, Role::TenantAdmin, 'inv', MembershipStatus::Invited);

        $this->patchJson("/api/v1/tenant/users/{$invited->id}", ['status' => 'active'], $this->as('admin1'))->assertStatus(409);
    }

    public function test_invalid_role_or_status_values_are_rejected(): void
    {
        $tenant = $this->makeTenant();
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        [, $crew] = $this->makeMember($tenant, Role::Crew, 'crew1');
        $h = $this->as('admin1');

        $this->patchJson("/api/v1/tenant/users/{$crew->id}", ['role' => 'superadmin'], $h)->assertStatus(422);
        $this->patchJson("/api/v1/tenant/users/{$crew->id}", ['status' => 'invited'], $h)->assertStatus(422);
        $this->patchJson("/api/v1/tenant/users/{$crew->id}", ['tenant_id' => 'x', 'role' => 'crew'], $h)->assertOk();
        $this->assertSame($tenant->id, $crew->refresh()->tenant_id);
    }

    public function test_settings_are_typed_validated_and_audited(): void
    {
        $tenant = $this->makeTenant();
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $h = $this->as('admin1');

        $this->patchJson('/api/v1/tenant', ['settings' => ['privacy_policy_url' => 'https://example.com/privacy', 'display_name' => 'Southfield']], $h)
            ->assertOk()->assertJsonPath('data.settings.privacy_policy_url', 'https://example.com/privacy')->assertJsonPath('data.settings.display_name', 'Southfield');
        $this->getJson('/api/v1/me', $this->as('admin1'))->assertJsonPath('data.tenant.name', 'Southfield')->assertJsonMissingPath('data.features');

        $this->patchJson('/api/v1/tenant', ['settings' => ['nonsense' => 1]], $this->as('admin1'))->assertStatus(422)->assertJsonStructure(['errors' => ['nonsense']]);
        // removed in M1 (ADR-0016): superseded by module entitlements
        $this->patchJson('/api/v1/tenant', ['settings' => ['services_enabled' => true]], $this->as('admin1'))->assertStatus(422)->assertJsonStructure(['errors' => ['services_enabled']]);
        $this->patchJson('/api/v1/tenant', ['settings' => ['payslip_step_up' => 'fingerprint']], $this->as('admin1'))->assertStatus(422);
        $this->patchJson('/api/v1/tenant', ['settings' => ['privacy_policy_url' => 'http://insecure.test']], $this->as('admin1'))->assertStatus(422);

        $this->getJson('/api/v1/tenant/audit-logs?filter[action]=tenant.settings_updated', $this->as('admin1'))->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_tenant_may_raise_but_not_lower_the_platform_password_floor(): void
    {
        SettingsRegistry::setPlatform('password_min_length', 10);
        $tenant = $this->makeTenant();
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');

        $this->patchJson('/api/v1/tenant', ['settings' => ['password_min_length' => 8]], $this->as('admin1'))
            ->assertStatus(422)->assertJsonStructure(['errors' => ['password_min_length']]);
        $this->patchJson('/api/v1/tenant', ['settings' => ['password_min_length' => 12]], $this->as('admin1'))
            ->assertOk()->assertJsonPath('data.settings.password_min_length', 12);

        // a later, higher platform floor wins over a lower tenant value
        SettingsRegistry::setPlatform('password_min_length', 14);
        Cache::flush();
        $this->getJson('/api/v1/tenant', $this->as('admin1'))->assertJsonPath('data.settings.password_min_length', 14);
    }
}
