<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Support\PlatformMfa;
use App\Support\Tenancy\TenantContext;
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

    public function test_the_code_is_asked_for_by_default(): void
    {
        $this->makePlatformAdmin();

        $this->spa()->getJson('/api/v1/platform/auth/options')->assertOk()->assertExactJson(['data' => ['otp_required' => true]]);
        $this->login()->assertStatus(422)->assertJsonValidationErrors('otp'); // no code, no sign-in
    }

    public function test_a_development_machine_can_switch_the_code_off_and_the_password_is_still_checked(): void
    {
        config(['sailix.platform.require_otp' => false]);
        $this->makePlatformAdmin();

        $this->spa()->getJson('/api/v1/platform/auth/options')->assertOk()->assertExactJson(['data' => ['otp_required' => false]]);
        $this->login(['password' => 'wrong-wrong-wrong'])->assertStatus(401)->assertJsonPath('code', 'invalid_credentials');
        $this->login(['email' => 'nobody@example.test'])->assertStatus(401);

        $r = $this->login()->assertOk();
        $this->carrySession($r);
        $this->app['auth']->forgetGuards();
        $this->spa()->getJson('/api/v1/platform/me')->assertOk()->assertJsonPath('data.email', 'root@example.test');
    }

    public function test_a_code_that_is_sent_anyway_is_not_checked_while_it_is_switched_off_but_must_still_look_like_a_code(): void
    {
        config(['sailix.platform.require_otp' => false]);
        $this->makePlatformAdmin();

        $this->login(['otp' => 'abc'])->assertStatus(422)->assertJsonValidationErrors('otp');
        $this->login(['otp' => '000000'])->assertOk();
    }

    public function test_an_unenrolled_admin_can_sign_in_while_the_code_is_switched_off(): void
    {
        config(['sailix.platform.require_otp' => false]);
        [$admin] = $this->makePlatformAdmin();
        $admin->forceFill(['totp_confirmed_at' => null, 'totp_secret' => null])->save();

        $this->login()->assertOk();
    }

    public function test_the_switch_is_honoured_on_development_and_staging_machines_but_never_in_production(): void
    {
        config(['sailix.platform.require_otp' => false]);
        $this->assertFalse(PlatformMfa::required()); // testing: honoured

        $this->app->detectEnvironment(fn () => 'staging');
        $this->assertFalse(PlatformMfa::required());
        $this->spa()->getJson('/api/v1/platform/auth/options')->assertOk()->assertExactJson(['data' => ['otp_required' => false]]);

        foreach (['production', 'prod', 'live'] as $environment) {
            $this->app->detectEnvironment(fn () => $environment);
            $this->assertTrue(PlatformMfa::required(), $environment);
            $this->spa()->getJson('/api/v1/platform/auth/options')->assertOk()->assertExactJson(['data' => ['otp_required' => true]]);
        }
    }

    public function test_the_audit_trail_says_when_a_sign_in_skipped_the_code(): void
    {
        config(['sailix.platform.require_otp' => false]);
        $this->makePlatformAdmin();
        $this->login()->assertOk();

        $entry = AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())
            ->where('action', 'platform.login')->latest('id')->firstOrFail();
        $this->assertSame(['mfa' => 'skipped'], $entry->metadata);
    }
}
