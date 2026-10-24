<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\TenantStatus;
use Tests\TestCase;

class SessionAuthTest extends TestCase
{
    private function login(string $username)
    {
        return $this->spa()->postJson('/api/v1/auth/session', ['username' => $username, 'password' => self::PASSWORD]);
    }

    private function fresh(): static
    {
        $this->app['auth']->forgetGuards();

        return $this;
    }

    public function test_tenant_admin_can_sign_in_with_cookie_session_and_read_me(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::TenantAdmin, 'admin1');

        $r = $this->login('admin1')->assertOk()->assertJsonPath('data.tenant.code', 'SFAI');
        $this->assertNotEmpty($r->headers->getCookies());

        $this->carrySession($r)->fresh()->spa()->getJson('/api/v1/me')
            ->assertOk()->assertJsonPath('data.membership.role', 'tenant_admin')
            ->assertJsonPath('data.abilities.0', 'tenant.view');
    }

    public function test_session_login_returns_no_bearer_token(): void
    {
        $this->makeMember($this->makeTenant(), Role::TenantAdmin, 'admin1');

        $this->login('admin1')->assertOk()->assertJsonMissingPath('data.token');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_crew_can_sign_in_to_the_client_portal_but_never_reach_the_admin_endpoints(): void
    {
        $this->makeMember($this->makeTenant(), Role::Crew, 'crew1');

        $this->login('crew1')->assertOk()->assertJsonPath('data.membership.role', 'crew');
        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.membership.role', 'crew');
        $this->getJson('/api/v1/announcements')->assertOk();
        // the abilities, not the way of signing in, decide: a crew session is refused on every admin endpoint
        $this->getJson('/api/v1/tenant')->assertForbidden();
        $this->getJson('/api/v1/tenant/crew')->assertForbidden();
        $this->getJson('/api/v1/tenant/dashboard')->assertForbidden();
        $this->getJson('/api/v1/tenant/documents')->assertForbidden();
    }

    public function test_logout_ends_the_session(): void
    {
        $this->makeMember($this->makeTenant(), Role::TenantAdmin, 'admin1');
        $r = $this->login('admin1');
        $client = $this->carrySession($r);

        $out = $client->fresh()->spa()->deleteJson('/api/v1/auth/session')->assertNoContent();
        $client = $this->carrySession($out);

        $client->fresh()->spa()->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_multi_tenant_admin_must_select_membership(): void
    {
        $user = $this->makeUser('multi');
        $this->makeMembership($this->makeTenant('AAA'), $user, Role::TenantAdmin);
        $mb = $this->makeMembership($this->makeTenant('BBB'), $user, Role::TenantAdmin);

        $login = $this->login('multi')->assertOk()->assertJsonPath('data.requires_tenant_selection', true);
        $done = $this->fresh()->spa()->postJson('/api/v1/auth/session/select', [
            'ticket' => $login->json('data.ticket'), 'membership_id' => $mb->getKey(),
        ])->assertOk();

        $this->carrySession($done)->fresh()->spa()->getJson('/api/v1/me')->assertJsonPath('data.tenant.code', 'BBB');
    }

    public function test_tenant_session_cannot_reach_platform_routes_and_vice_versa(): void
    {
        $this->makeMember($this->makeTenant(), Role::TenantAdmin, 'admin1');
        $tenantSession = $this->carrySession($this->login('admin1'));
        $tenantSession->fresh()->spa()->getJson('/api/v1/platform/tenants')->assertStatus(401);

        [, $secret] = $this->makePlatformAdmin();
        $r = $this->fresh()->spa()->postJson('/api/v1/platform/auth/session', ['email' => 'root@example.test', 'password' => self::PASSWORD, 'otp' => $this->otp($secret)])->assertOk();
        $this->carrySession($r)->fresh()->spa()->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_suspended_tenant_session_is_rejected(): void
    {
        $tenant = $this->makeTenant();
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $client = $this->carrySession($this->login('admin1'));

        $tenant->forceFill(['status' => TenantStatus::Suspended])->save();

        $client->fresh()->spa()->getJson('/api/v1/me')->assertStatus(403)->assertJsonPath('code', 'tenant_suspended');
    }
}
