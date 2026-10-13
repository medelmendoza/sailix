<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ChangePasswordTest extends TestCase
{
    private function change(array $h, array $body = [])
    {
        $this->app['auth']->forgetGuards();

        return $this->putJson('/api/v1/me/password', $body + [
            'current_password' => self::PASSWORD, 'password' => 'a-much-better-pass', 'password_confirmation' => 'a-much-better-pass',
        ], $h);
    }

    public function test_changing_the_password_signs_out_other_devices_but_not_this_one(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        $phone = $this->tokenFor('crew1');
        $tablet = $this->tokenFor('crew1');

        $this->change($this->bearer($phone))->assertNoContent();

        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($phone))->assertOk();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($tablet))->assertStatus(401);

        $this->postJson('/api/v1/auth/token', ['username' => 'crew1', 'password' => self::PASSWORD, 'device_name' => 'd'])->assertStatus(401);
        $this->postJson('/api/v1/auth/token', ['username' => 'crew1', 'password' => 'a-much-better-pass', 'device_name' => 'd'])->assertOk();
    }

    public function test_the_current_password_is_required_and_checked(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        $h = $this->bearer($this->tokenFor('crew1'));

        $this->change($h, ['current_password' => 'wrong-wrong-wrong'])->assertStatus(422)->assertJsonPath('code', 'invalid_current_password')->assertJsonStructure(['errors' => ['current_password']]);
        $this->change($h, ['current_password' => ''])->assertStatus(422);
        $this->assertTrue(Hash::check(self::PASSWORD, User::where('username', 'crew1')->firstOrFail()->password));
    }

    public function test_the_new_password_must_differ_match_and_meet_the_policy(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        $h = $this->bearer($this->tokenFor('crew1'));

        $this->change($h, ['password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD])->assertStatus(422)->assertJsonStructure(['errors' => ['password']]);
        $this->change($h, ['password' => 'short', 'password_confirmation' => 'short'])->assertStatus(422);
        $this->change($h, ['password_confirmation' => 'mismatch-mismatch'])->assertStatus(422);
        $this->assertTrue(Hash::check(self::PASSWORD, User::where('username', 'crew1')->firstOrFail()->password));
    }

    public function test_it_requires_authentication_and_an_active_organization(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $h = $this->bearer($this->tokenFor('crew1'));

        $this->change([])->assertStatus(401);
        $this->change($this->bearer('1|garbage'))->assertStatus(401);

        $tenant->forceFill(['status' => 'suspended'])->save();
        $this->change($h)->assertStatus(403)->assertJsonPath('code', 'tenant_suspended');
        $this->assertTrue(Hash::check(self::PASSWORD, User::where('username', 'crew1')->firstOrFail()->password));
    }

    public function test_it_is_throttled(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        $h = $this->bearer($this->tokenFor('crew1'));

        for ($i = 0; $i < 5; $i++) {
            $this->change($h, ['current_password' => 'wrong-wrong-wrong'])->assertStatus(422);
        }
        $this->change($h)->assertStatus(429)->assertJsonPath('code', 'throttled');
        $this->assertTrue(Hash::check(self::PASSWORD, User::where('username', 'crew1')->firstOrFail()->password));
    }

    public function test_a_web_session_stays_signed_in_while_tokens_are_revoked(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::TenantAdmin, 'admin1');
        $token = $this->tokenFor('admin1');
        $this->app['auth']->forgetGuards();
        $login = $this->spa()->postJson('/api/v1/auth/session', ['username' => 'admin1', 'password' => self::PASSWORD])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->carrySession($login)->spa()->putJson('/api/v1/me/password', [
            'current_password' => self::PASSWORD, 'password' => 'a-much-better-pass', 'password_confirmation' => 'a-much-better-pass',
        ])->assertNoContent();

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->app['auth']->forgetGuards();
        $this->carrySession($login)->spa()->getJson('/api/v1/me')->assertOk(); // the browser session survives
        $this->assertDatabaseMissing('personal_access_tokens', ['name' => 'test-device']); // the token did not
    }

    public function test_the_change_is_audited_without_secrets_and_responses_never_echo_passwords(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $res = $this->change($this->bearer($this->tokenFor('crew1')));
        $this->assertSame('', $res->getContent());

        app(TenantContext::class)->markPlatform();
        $entry = AuditLog::where('action', 'auth.password_changed')->firstOrFail();
        $this->assertSame($tenant->id, $entry->tenant_id);
        $this->assertStringNotContainsString('better', strtolower($entry->toJson()));
    }
}
