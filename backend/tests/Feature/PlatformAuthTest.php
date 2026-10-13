<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use Tests\TestCase;

class PlatformAuthTest extends TestCase
{
    private function login(array $overrides = [])
    {
        return $this->spa()->postJson('/api/v1/platform/auth/session', $overrides + ['email' => 'root@example.test', 'password' => self::PASSWORD]);
    }

    public function test_login_requires_valid_totp(): void
    {
        [, $secret] = $this->makePlatformAdmin();

        $this->login(['otp' => '000000'])->assertStatus(401)->assertJsonPath('code', 'invalid_credentials');
        $r = $this->login(['otp' => $this->otp($secret)])->assertOk();

        $this->carrySession($r);
        $this->app['auth']->forgetGuards();
        $this->spa()->getJson('/api/v1/platform/me')->assertOk()->assertJsonPath('data.email', 'root@example.test');
    }

    public function test_otp_cannot_be_replayed(): void
    {
        [, $secret] = $this->makePlatformAdmin();
        $code = $this->otp($secret);

        $this->login(['otp' => $code])->assertOk();
        $this->login(['otp' => $code])->assertStatus(401);
    }

    public function test_wrong_password_with_valid_code_fails_identically(): void
    {
        [, $secret] = $this->makePlatformAdmin();

        $this->login(['password' => 'wrong-wrong-wrong', 'otp' => $this->otp($secret)])->assertStatus(401)->assertJsonPath('code', 'invalid_credentials');
        $this->login(['email' => 'nobody@example.test', 'otp' => '123456'])->assertStatus(401)->assertJsonPath('code', 'invalid_credentials');
    }

    public function test_admin_without_enrolled_mfa_cannot_sign_in(): void
    {
        [$admin] = $this->makePlatformAdmin();
        $admin->forceFill(['totp_confirmed_at' => null])->save();

        $this->login(['otp' => '123456'])->assertStatus(403)->assertJsonPath('code', 'mfa_not_enrolled');
    }

    public function test_suspended_admin_cannot_sign_in(): void
    {
        [$admin, $secret] = $this->makePlatformAdmin();
        $admin->forceFill(['status' => UserStatus::Suspended])->save();

        $this->login(['otp' => $this->otp($secret)])->assertStatus(403)->assertJsonPath('code', 'account_suspended');
    }

    public function test_tenant_admin_credentials_do_not_work_on_the_platform_login(): void
    {
        $this->makeMember($this->makeTenant(), Role::TenantAdmin, 'admin1');

        $this->spa()->postJson('/api/v1/platform/auth/session', ['email' => 'admin1@example.test', 'password' => self::PASSWORD, 'otp' => '123456'])->assertStatus(401);
    }

    public function test_platform_routes_reject_anonymous_and_bearer_tokens(): void
    {
        $this->getJson('/api/v1/platform/tenants')->assertStatus(401);

        $this->makeMember($this->makeTenant(), Role::TenantAdmin, 'admin1');
        $token = $this->tokenFor('admin1');
        $this->getJson('/api/v1/platform/tenants', $this->bearer($token))->assertStatus(401);
    }

    public function test_idle_platform_session_expires(): void
    {
        [, $secret] = $this->makePlatformAdmin();
        $r = $this->login(['otp' => $this->otp($secret)]);
        $client = $this->carrySession($r);

        $this->travel(config('sailix.platform_idle_minutes') + 1)->minutes();
        $this->app['auth']->forgetGuards();

        $client->spa()->getJson('/api/v1/platform/me')->assertStatus(401);
    }
}
