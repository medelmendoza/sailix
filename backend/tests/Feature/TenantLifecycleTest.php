<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Mail\TenantAdminInvitation;
use App\Models\AuditLog;
use App\Models\PersonalAccessToken;
use App\Models\Tenant;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class TenantLifecycleTest extends TestCase
{
    private function platformLogin(): static
    {
        [, $secret] = $this->makePlatformAdmin();
        $r = $this->spa()->postJson('/api/v1/platform/auth/session', ['email' => 'root@example.test', 'password' => self::PASSWORD, 'otp' => $this->otp($secret)])->assertOk();

        return $this->carrySession($r);
    }

    private function p(): static
    {
        $this->app['auth']->forgetGuards();

        return $this->spa();
    }

    private function createTenant(string $code = 'SFAI'): string
    {
        return $this->p()->postJson('/api/v1/platform/tenants', ['code' => $code, 'name' => 'Southfield'])
            ->assertCreated()->assertJsonPath('data.status', 'provisioning')->json('data.id');
    }

    public function test_full_provisioning_flow_from_creation_to_admin_login(): void
    {
        Mail::fake();
        $this->platformLogin();
        $id = $this->createTenant('sfai');

        // cannot activate without an admin
        $this->p()->postJson("/api/v1/platform/tenants/$id/activate")->assertStatus(422)->assertJsonPath('code', 'no_active_admin');

        $invite = $this->p()->postJson("/api/v1/platform/tenants/$id/admins", ['email' => 'boss@example.test', 'username' => 'boss', 'display_name' => 'Boss'])
            ->assertCreated()->assertJsonPath('data.status', 'invited');
        $token = $invite->json('meta.invitation_token');
        $this->assertNotEmpty($token);
        Mail::assertSent(TenantAdminInvitation::class, fn ($m) => $m->hasTo('boss@example.test'));

        // invited admin cannot sign in yet
        $this->postJson('/api/v1/auth/session', ['username' => 'boss', 'password' => 'whatever-whatever'])->assertStatus(401);

        $this->postJson('/api/v1/auth/invitations/accept', ['token' => $token, 'password' => 'Str0ng-passphrase-1', 'password_confirmation' => 'Str0ng-passphrase-1'])->assertNoContent();
        // single use
        $this->postJson('/api/v1/auth/invitations/accept', ['token' => $token, 'password' => 'Str0ng-passphrase-2', 'password_confirmation' => 'Str0ng-passphrase-2'])->assertStatus(422)->assertJsonPath('code', 'invalid_invitation');

        // tenant still provisioning → admin cannot sign in
        $this->postJson('/api/v1/auth/session', ['username' => 'boss', 'password' => 'Str0ng-passphrase-1'])->assertStatus(403)->assertJsonPath('code', 'tenant_suspended');

        $this->p()->postJson("/api/v1/platform/tenants/$id/activate")->assertOk()->assertJsonPath('data.status', 'active');
        $this->postJson('/api/v1/auth/session', ['username' => 'boss', 'password' => 'Str0ng-passphrase-1'])->assertOk()->assertJsonPath('data.tenant.code', 'SFAI');

        $actions = AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())->pluck('action')->all();
        $this->assertContains('tenant.created', $actions);
        $this->assertContains('tenant.admin_invited', $actions);
        $this->assertContains('tenant.admin_activated', $actions);
        $this->assertContains('tenant.activate', $actions);
    }

    public function test_invalid_and_expired_invitations_are_rejected(): void
    {
        Mail::fake();
        $this->platformLogin();
        $id = $this->createTenant();
        $token = $this->p()->postJson("/api/v1/platform/tenants/$id/admins", ['email' => 'boss@example.test'])->json('meta.invitation_token');

        $this->postJson('/api/v1/auth/invitations/accept', ['token' => $token.'x', 'password' => 'Str0ng-passphrase-1', 'password_confirmation' => 'Str0ng-passphrase-1'])->assertStatus(422);
        $this->postJson('/api/v1/auth/invitations/accept', ['token' => 'garbage', 'password' => 'Str0ng-passphrase-1', 'password_confirmation' => 'Str0ng-passphrase-1'])->assertStatus(422);

        $this->travel(config('sailix.invitation_ttl_hours') + 1)->hours();
        $this->postJson('/api/v1/auth/invitations/accept', ['token' => $token, 'password' => 'Str0ng-passphrase-1', 'password_confirmation' => 'Str0ng-passphrase-1'])->assertStatus(422);
    }

    public function test_weak_password_is_rejected_on_invitation(): void
    {
        Mail::fake();
        $this->platformLogin();
        $id = $this->createTenant();
        $token = $this->p()->postJson("/api/v1/platform/tenants/$id/admins", ['email' => 'boss@example.test'])->json('meta.invitation_token');

        $this->postJson('/api/v1/auth/invitations/accept', ['token' => $token, 'password' => 'short', 'password_confirmation' => 'short'])
            ->assertStatus(422)->assertJsonStructure(['errors' => ['password']]);
    }

    public function test_illegal_transitions_and_required_reasons(): void
    {
        $this->platformLogin();
        $tenant = $this->makeTenant('LIVE');
        $this->makeMember($tenant, Role::TenantAdmin);

        $this->p()->postJson("/api/v1/platform/tenants/{$tenant->id}/reactivate")->assertStatus(409)->assertJsonPath('code', 'invalid_transition');
        $this->p()->postJson("/api/v1/platform/tenants/{$tenant->id}/archive", ['reason' => 'x'])->assertStatus(409);
        $this->p()->postJson("/api/v1/platform/tenants/{$tenant->id}/suspend")->assertStatus(422)->assertJsonStructure(['errors' => ['reason']]);
        $this->p()->postJson("/api/v1/platform/tenants/{$tenant->id}/explode")->assertStatus(404);

        $this->p()->postJson("/api/v1/platform/tenants/{$tenant->id}/suspend", ['reason' => 'non-payment'])->assertOk()->assertJsonPath('data.status', 'suspended');
        $this->p()->postJson("/api/v1/platform/tenants/{$tenant->id}/reactivate")->assertOk()->assertJsonPath('data.status', 'active');
        $this->p()->postJson("/api/v1/platform/tenants/{$tenant->id}/deactivate", ['reason' => 'contract ended'])->assertOk();
        $this->p()->postJson("/api/v1/platform/tenants/{$tenant->id}/archive", ['reason' => 'retention window passed'])->assertOk()->assertJsonPath('data.status', 'archived');
        // archived is terminal
        $this->p()->postJson("/api/v1/platform/tenants/{$tenant->id}/reactivate")->assertStatus(409);
    }

    public function test_suspending_a_tenant_revokes_its_tokens_and_reactivation_does_not_resurrect_them(): void
    {
        $this->platformLogin();
        $tenant = $this->makeTenant('LIVE');
        $other = $this->makeTenant('OTHER');
        $this->makeMember($tenant, Role::Crew, 'c1');
        $this->makeMember($other, Role::Crew, 'c2');
        $t1 = $this->tokenFor('c1');
        $t2 = $this->tokenFor('c2');
        $this->assertDatabaseCount('personal_access_tokens', 2);

        $this->p()->postJson("/api/v1/platform/tenants/{$tenant->id}/suspend", ['reason' => 'abuse'])->assertOk();

        $this->assertSame(0, PersonalAccessToken::where('tenant_id', $tenant->id)->count());
        $this->assertSame(1, PersonalAccessToken::where('tenant_id', $other->id)->count());

        $this->p()->postJson("/api/v1/platform/tenants/{$tenant->id}/reactivate")->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withHeaders($this->bearer($t1))->getJson('/api/v1/me')->assertStatus(401);
        $this->app['auth']->forgetGuards();
        $this->withHeaders($this->bearer($t2))->getJson('/api/v1/me')->assertOk();
    }

    public function test_tenant_code_validation_and_uniqueness(): void
    {
        $this->platformLogin();
        $this->createTenant('SFAI');

        $this->p()->postJson('/api/v1/platform/tenants', ['code' => 'sfai', 'name' => 'dup'])->assertStatus(422)->assertJsonStructure(['errors' => ['code']]);
        $this->p()->postJson('/api/v1/platform/tenants', ['code' => 'bad code!', 'name' => 'x'])->assertStatus(422);
    }

    public function test_directory_filters_and_pagination(): void
    {
        $this->platformLogin();
        $this->makeTenant('AAA');
        $this->makeTenant('BBB', TenantStatus::Suspended);

        $this->p()->getJson('/api/v1/platform/tenants?filter[status]=suspended')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.code', 'BBB');
        $this->p()->getJson('/api/v1/platform/tenants?filter[q]=aa&per_page=1')->assertOk()->assertJsonPath('meta.per_page', 1)->assertJsonPath('data.0.code', 'AAA');
    }

    public function test_platform_admin_cannot_be_used_to_create_a_tenant_without_auth(): void
    {
        $this->postJson('/api/v1/platform/tenants', ['code' => 'NOPE', 'name' => 'x'])->assertStatus(401);
        $this->assertSame(0, Tenant::count());
    }
}
