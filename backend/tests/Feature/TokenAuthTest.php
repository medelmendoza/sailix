<?php

namespace Tests\Feature;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Models\PersonalAccessToken;
use Tests\TestCase;

class TokenAuthTest extends TestCase
{
    public function test_login_binds_token_to_membership_and_me_works(): void
    {
        $tenant = $this->makeTenant('SFAI');
        [$user, $membership] = $this->makeMember($tenant, Role::Crew, 'crew1');

        $r = $this->postJson('/api/v1/auth/token', ['username' => 'crew1', 'password' => self::PASSWORD, 'device_name' => 'iPhone'])
            ->assertOk()->assertJsonPath('data.membership.tenant.code', 'SFAI');

        $token = PersonalAccessToken::firstOrFail();
        $this->assertSame($membership->getKey(), $token->membership_id);
        $this->assertSame($tenant->getKey(), $token->tenant_id);
        $this->assertNotNull($token->expires_at);

        $this->getJson('/api/v1/me', $this->bearer($r->json('data.token')))
            ->assertOk()
            ->assertJsonPath('data.user.username', 'crew1')
            ->assertJsonPath('data.tenant.code', 'SFAI')
            ->assertJsonPath('data.membership.role', 'crew');
    }

    public function test_wrong_password_and_unknown_user_are_indistinguishable(): void
    {
        $this->makeMember($this->makeTenant(), Role::Crew, 'crew1');

        $a = $this->postJson('/api/v1/auth/token', ['username' => 'crew1', 'password' => 'nope-nope-nope', 'device_name' => 'd']);
        $b = $this->postJson('/api/v1/auth/token', ['username' => 'ghost', 'password' => 'nope-nope-nope', 'device_name' => 'd']);

        $a->assertStatus(401)->assertJsonPath('code', 'invalid_credentials');
        $b->assertStatus(401)->assertJsonPath('code', 'invalid_credentials');
        $this->assertSame($a->json('detail'), $b->json('detail'));
        $this->assertStringStartsWith('application/problem+json', $a->headers->get('Content-Type'));
    }

    public function test_unauthenticated_and_garbage_token_are_rejected(): void
    {
        $this->getJson('/api/v1/me')->assertStatus(401)->assertJsonPath('code', 'unauthenticated');
        $this->getJson('/api/v1/me', $this->bearer('1|garbage'))->assertStatus(401);
    }

    public function test_pending_membership_cannot_sign_in(): void
    {
        $this->makeMember($this->makeTenant(), Role::Crew, 'p1', MembershipStatus::Pending);

        $this->postJson('/api/v1/auth/token', ['username' => 'p1', 'password' => self::PASSWORD, 'device_name' => 'd'])
            ->assertStatus(403)->assertJsonPath('code', 'membership_pending');
    }

    public function test_suspended_tenant_blocks_login_and_existing_tokens(): void
    {
        $tenant = $this->makeTenant();
        $this->makeMember($tenant, Role::Crew, 'c1');
        $token = $this->tokenFor('c1');

        $tenant->forceFill(['status' => TenantStatus::Suspended])->save();

        $this->getJson('/api/v1/me', $this->bearer($token))->assertStatus(403)->assertJsonPath('code', 'tenant_suspended');
        $this->postJson('/api/v1/auth/token', ['username' => 'c1', 'password' => self::PASSWORD, 'device_name' => 'd'])
            ->assertStatus(403)->assertJsonPath('code', 'tenant_suspended');
    }

    public function test_suspended_membership_is_rejected_immediately(): void
    {
        $tenant = $this->makeTenant();
        [, $m] = $this->makeMember($tenant, Role::Crew, 'c1');
        $token = $this->tokenFor('c1');

        $m->forceFill(['status' => MembershipStatus::Suspended])->save();

        $this->getJson('/api/v1/me', $this->bearer($token))->assertStatus(403)->assertJsonPath('code', 'membership_suspended');
    }

    public function test_multiple_memberships_require_selection_and_ticket_is_single_use(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $user = $this->makeUser('multi');
        $ma = $this->makeMembership($a, $user);
        $this->makeMembership($b, $user);

        $login = $this->postJson('/api/v1/auth/token', ['username' => 'multi', 'password' => self::PASSWORD, 'device_name' => 'd'])
            ->assertOk()->assertJsonPath('data.requires_tenant_selection', true);
        $this->assertCount(2, $login->json('data.memberships'));
        $this->assertDatabaseCount('personal_access_tokens', 0);

        $ticket = $login->json('data.ticket');
        $done = $this->postJson('/api/v1/auth/token/select', ['ticket' => $ticket, 'membership_id' => $ma->getKey()])->assertOk();
        $this->getJson('/api/v1/me', $this->bearer($done->json('data.token')))->assertJsonPath('data.tenant.code', 'AAA');

        $this->postJson('/api/v1/auth/token/select', ['ticket' => $ticket, 'membership_id' => $ma->getKey()])
            ->assertStatus(401)->assertJsonPath('code', 'invalid_ticket');
    }

    public function test_agency_code_narrows_login_to_that_tenant(): void
    {
        $user = $this->makeUser('multi');
        $this->makeMembership($this->makeTenant('AAA'), $user);
        $this->makeMembership($this->makeTenant('BBB'), $user);

        $token = $this->tokenFor('multi', 'bbb');
        $this->getJson('/api/v1/me', $this->bearer($token))->assertJsonPath('data.tenant.code', 'BBB');
    }

    public function test_ticket_cannot_select_a_membership_that_was_not_offered(): void
    {
        $user = $this->makeUser('multi');
        $this->makeMembership($this->makeTenant('AAA'), $user);
        $this->makeMembership($this->makeTenant('BBB'), $user);
        [, $foreign] = $this->makeMember($this->makeTenant('CCC'), Role::Crew, 'other');

        $ticket = $this->postJson('/api/v1/auth/token', ['username' => 'multi', 'password' => self::PASSWORD, 'device_name' => 'd'])->json('data.ticket');
        $this->postJson('/api/v1/auth/token/select', ['ticket' => $ticket, 'membership_id' => $foreign->getKey()])->assertStatus(403);
    }

    public function test_refresh_rotates_token_and_revokes_the_old_one(): void
    {
        $this->makeMember($this->makeTenant(), Role::Crew, 'c1');
        $old = $this->tokenFor('c1');

        $new = $this->postJson('/api/v1/auth/token/refresh', [], $this->bearer($old))->assertOk()->json('data.token');

        $this->assertNotSame($old, $new);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($old))->assertStatus(401);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($new))->assertOk();
    }

    public function test_refresh_is_refused_after_the_absolute_session_limit(): void
    {
        $this->makeMember($this->makeTenant(), Role::Crew, 'c1');
        $token = $this->tokenFor('c1');
        PersonalAccessToken::query()->update(['chain_started_at' => now()->subDays(config('sailix.token_max_days') + 1)]);

        $this->postJson('/api/v1/auth/token/refresh', [], $this->bearer($token))->assertStatus(401);
    }

    public function test_switch_issues_a_new_bound_token_and_revokes_the_old(): void
    {
        $user = $this->makeUser('multi');
        $ma = $this->makeMembership($this->makeTenant('AAA'), $user);
        $mb = $this->makeMembership($this->makeTenant('BBB'), $user);
        $tokenA = $this->tokenFor('multi', 'AAA');

        $r = $this->postJson('/api/v1/auth/token/switch', ['membership_id' => $mb->getKey()], $this->bearer($tokenA))->assertOk();
        $tokenB = $r->json('data.token');

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($tokenB))->assertJsonPath('data.tenant.code', 'BBB');
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($tokenA))->assertStatus(401);
        $this->assertNotSame($ma->getKey(), PersonalAccessToken::firstOrFail()->membership_id);
    }

    public function test_cannot_switch_to_someone_elses_membership(): void
    {
        $this->makeMember($this->makeTenant('AAA'), Role::Crew, 'me');
        [, $other] = $this->makeMember($this->makeTenant('BBB'), Role::Crew, 'other');
        $token = $this->tokenFor('me');

        $this->postJson('/api/v1/auth/token/switch', ['membership_id' => $other->getKey()], $this->bearer($token))->assertStatus(403);
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $this->makeMember($this->makeTenant(), Role::Crew, 'c1');
        $one = $this->tokenFor('c1');
        $two = $this->tokenFor('c1');

        $this->deleteJson('/api/v1/auth/token', [], $this->bearer($one))->assertNoContent();

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($one))->assertStatus(401);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($two))->assertOk();
    }

    public function test_login_is_throttled(): void
    {
        $this->makeMember($this->makeTenant(), Role::Crew, 'c1');

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/token', ['username' => 'c1', 'password' => 'bad-bad-bad', 'device_name' => 'd'])->assertStatus(401);
        }
        $this->postJson('/api/v1/auth/token', ['username' => 'c1', 'password' => self::PASSWORD, 'device_name' => 'd'])
            ->assertStatus(429)->assertJsonPath('code', 'throttled')->assertHeader('Retry-After');
    }

    public function test_validation_errors_are_problem_json(): void
    {
        $this->postJson('/api/v1/auth/token', [])->assertStatus(422)
            ->assertJsonPath('code', 'validation')->assertJsonStructure(['errors' => ['username', 'password', 'device_name'], 'request_id']);
    }
}
