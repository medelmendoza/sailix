<?php

namespace Tests\Isolation;

use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Models\AuditLog;
use App\Models\Membership;
use App\Models\PersonalAccessToken;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Support\Settings\SettingsRegistry;
use App\Support\Tenancy\MissingTenantContext;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Phase B baseline for the isolation checks in docs/09 §2 against the modules that exist so far
 * (memberships, settings, audit, tokens, tenant/platform endpoints). Extended per module in Phase C/D.
 */
class TenantIsolationTest extends TestCase
{
    private Tenant $a;

    private Tenant $b;

    private Membership $adminA;

    private Membership $adminB;

    private Membership $crewB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->a = $this->makeTenant('AAA');
        $this->b = $this->makeTenant('BBB');
        [, $this->adminA] = $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        [, $this->adminB] = $this->makeMember($this->b, Role::TenantAdmin, 'adminB');
        [, $this->crewB] = $this->makeMember($this->b, Role::Crew, 'crewB');
    }

    private function asA(): array
    {
        $this->app['auth']->forgetGuards();

        return $this->bearer($this->tokenFor('adminA'));
    }

    // 1. cannot list
    public function test_a_cannot_list_bs_members(): void
    {
        $ids = collect($this->getJson('/api/v1/tenant/users', $this->asA())->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($this->adminA->id));
        $this->assertFalse($ids->contains($this->adminB->id));
        $this->assertFalse($ids->contains($this->crewB->id));
    }

    // 2. cannot retrieve/guess by id → 404 (not 403: no existence oracle)
    // 3. cannot modify
    public function test_a_cannot_read_or_modify_bs_membership_by_id(): void
    {
        $h = $this->asA();
        $this->patchJson("/api/v1/tenant/users/{$this->crewB->id}", ['status' => 'suspended'], $h)->assertStatus(404);
        $this->patchJson("/api/v1/tenant/users/{$this->adminB->id}", ['role' => 'crew'], $h)->assertStatus(404);
        $this->patchJson('/api/v1/tenant/users/'.Str::uuid(), ['status' => 'suspended'], $h)->assertStatus(404);

        $this->assertSame('active', $this->crewB->refresh()->status->value);
        $this->assertSame('tenant_admin', $this->adminB->refresh()->role->value);
    }

    // 4. cannot attach to the other tenant (database level)
    public function test_composite_foreign_key_rejects_cross_tenant_association(): void
    {
        $this->expectException(QueryException::class);

        // token claims tenant A but membership of tenant B
        PersonalAccessToken::query()->insert([
            'tokenable_type' => 'user', 'tokenable_id' => $this->adminA->user_id,
            'tenant_id' => $this->a->id, 'membership_id' => $this->crewB->id,
            'name' => 'x', 'token' => hash('sha256', 'x'), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    // 7/8. admin of a tenant cannot use platform functions
    public function test_tenant_admin_cannot_reach_any_platform_route(): void
    {
        $h = $this->asA();
        foreach ([['get', '/tenants'], ['post', '/tenants'], ['get', "/tenants/{$this->b->id}"], ['post', "/tenants/{$this->b->id}/suspend"],
            ['get', '/settings'], ['patch', '/settings'], ['get', '/audit-logs'], ['get', '/me']] as [$method, $path]) {
            $this->app['auth']->forgetGuards();
            $this->json($method, "/api/v1/platform$path", [], $h)->assertStatus(401);
        }
        $this->assertSame('active', $this->b->refresh()->status->value);
    }

    // 9. spoofed tenant identifiers are ignored or rejected
    public function test_tenant_hint_header_mismatch_is_rejected_and_never_selects_data(): void
    {
        $token = $this->tokenFor('adminA');

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($token) + ['X-Tenant-Hint' => $this->b->id])->assertStatus(409)->assertJsonPath('code', 'tenant_mismatch');
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($token) + ['X-Tenant-Hint' => 'BBB'])->assertStatus(409);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($token) + ['X-Tenant-Hint' => 'AAA'])->assertOk();
    }

    public function test_tenant_id_in_query_or_body_never_changes_the_tenant(): void
    {
        $h = $this->asA();
        $res = $this->getJson("/api/v1/tenant/users?tenant_id={$this->b->id}&filter[tenant_id]={$this->b->id}", $h)->assertOk();
        $this->assertNotContains($this->adminB->id, collect($res->json('data'))->pluck('id')->all());

        $this->patchJson('/api/v1/tenant', ['tenant_id' => $this->b->id, 'settings' => ['display_name' => 'Hijack']], $this->asA())->assertOk();
        $this->assertNull(TenantSetting::withoutTenantScope()->where('tenant_id', $this->b->id)->first());
        $this->assertSame(1, TenantSetting::withoutTenantScope()->where('tenant_id', $this->a->id)->count());
    }

    public function test_token_of_a_cannot_be_used_after_switching_context_to_b_without_membership(): void
    {
        $this->postJson('/api/v1/auth/token/switch', ['membership_id' => $this->adminB->id], $this->asA())->assertStatus(403);
    }

    // 10 / forgotten filter: an ordinary unfiltered query is still safe
    public function test_unfiltered_query_returns_only_the_active_tenant(): void
    {
        $context = app(TenantContext::class);

        $ids = $context->runAs($this->a->id, $this->adminA->id, $this->adminA->user_id, Role::TenantAdmin,
            fn () => Membership::all()->pluck('id')->all());

        $this->assertSame([$this->adminA->id], $ids);
    }

    public function test_tenant_models_fail_closed_without_a_context(): void
    {
        $this->expectException(MissingTenantContext::class);

        Membership::all();
    }

    public function test_audit_log_fails_closed_without_any_context(): void
    {
        $this->expectException(MissingTenantContext::class);

        AuditLog::count();
    }

    public function test_creating_a_record_for_another_tenant_inside_a_context_is_refused(): void
    {
        $context = app(TenantContext::class);

        $this->expectException(\LogicException::class);
        $context->runAs($this->a->id, $this->adminA->id, $this->adminA->user_id, Role::TenantAdmin, function () {
            (new TenantSetting(['key' => 'display_name', 'value' => 'x']))->forceFill(['tenant_id' => $this->b->id])->save();
        });
    }

    public function test_create_without_any_tenant_is_refused(): void
    {
        $this->expectException(MissingTenantContext::class);

        (new TenantSetting(['key' => 'display_name', 'value' => 'x']))->save();
    }

    public function test_tenant_id_is_not_mass_assignable(): void
    {
        $m = new Membership(['tenant_id' => $this->b->id, 'role' => 'tenant_admin', 'status' => 'active', 'user_id' => 'u']);

        $this->assertNull($m->tenant_id);
        $this->assertSame('tenant_admin', $m->role->value ?? $m->role); // role/status ARE fillable on Membership; guarded by policies/actions
    }

    public function test_audit_logs_are_scoped_per_tenant(): void
    {
        $h = $this->asA();
        $this->patchJson('/api/v1/tenant', ['settings' => ['display_name' => 'A']], $h)->assertOk();
        $this->app['auth']->forgetGuards();
        $this->patchJson('/api/v1/tenant', ['settings' => ['display_name' => 'B']], $this->bearer($this->tokenFor('adminB')))->assertOk();

        $res = $this->getJson('/api/v1/tenant/audit-logs', $this->asA())->assertOk();
        $tenantIds = collect($res->json('data'))->pluck('tenant_id')->unique()->all();
        $this->assertSame([$this->a->id], $tenantIds);
    }

    public function test_settings_and_cache_do_not_leak_between_tenants(): void
    {
        $context = app(TenantContext::class);
        $context->runAs($this->a->id, $this->adminA->id, $this->adminA->user_id, Role::TenantAdmin, fn () => SettingsRegistry::setTenant('display_name', 'Alpha'));
        $context->runAs($this->b->id, $this->adminB->id, $this->adminB->user_id, Role::TenantAdmin, fn () => SettingsRegistry::setTenant('display_name', 'Beta'));

        $a = $context->runAs($this->a->id, $this->adminA->id, $this->adminA->user_id, Role::TenantAdmin, fn () => SettingsRegistry::tenant('display_name'));
        $b = $context->runAs($this->b->id, $this->adminB->id, $this->adminB->user_id, Role::TenantAdmin, fn () => SettingsRegistry::tenant('display_name'));

        $this->assertSame(['Alpha', 'Beta'], [$a, $b]);
    }

    public function test_suspending_tenant_b_does_not_affect_tenant_a(): void
    {
        $this->b->forceFill(['status' => TenantStatus::Suspended])->save();

        $this->getJson('/api/v1/me', $this->asA())->assertOk();
    }
}
