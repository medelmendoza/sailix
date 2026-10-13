<?php

namespace Tests\Support;

use App\Enums\MembershipStatus;
use App\Enums\ModuleStatus;
use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Enums\UserStatus;
use App\Models\Membership;
use App\Models\PlatformAdmin;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use App\Modules\Module;
use App\Support\Net\HostResolver;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PragmaRX\Google2FA\Google2FA;

/** Test data builders. Use only in tests: they bypass HTTP and set statuses directly. */
trait Fixtures
{
    public const PASSWORD = 'correct-horse-battery';

    protected function makeTenant(string $code = 'ACME', TenantStatus $status = TenantStatus::Active): Tenant
    {
        $tenant = new Tenant(['code' => $code, 'name' => "$code Agency"]);
        $tenant->forceFill(['status' => $status, 'activated_at' => $status === TenantStatus::Active ? now() : null])->save();

        return $tenant;
    }

    protected function makeUser(?string $username = null, UserStatus $status = UserStatus::Active): User
    {
        $username ??= 'user'.Str::lower(Str::random(8));
        $user = new User(['username' => $username, 'email' => "$username@example.test", 'password' => self::PASSWORD]);
        $user->forceFill(['status' => $status])->save();

        return $user;
    }

    protected function makeMembership(Tenant $tenant, User $user, Role $role = Role::Crew, MembershipStatus $status = MembershipStatus::Active): Membership
    {
        $m = (new Membership)->forceFill(['tenant_id' => $tenant->getKey(), 'user_id' => $user->getKey(), 'role' => $role, 'status' => $status]);
        $m->save();

        return $m;
    }

    /** @return array{0: User, 1: Membership} */
    protected function makeMember(Tenant $tenant, Role $role = Role::Crew, ?string $username = null, MembershipStatus $status = MembershipStatus::Active): array
    {
        $user = $this->makeUser($username);

        return [$user, $this->makeMembership($tenant, $user, $role, $status)];
    }

    /** @return array{0: PlatformAdmin, 1: string} admin and TOTP secret */
    protected function makePlatformAdmin(string $email = 'root@example.test'): array
    {
        $secret = (new Google2FA)->generateSecretKey(32);
        $admin = new PlatformAdmin(['name' => 'Root', 'email' => $email, 'password' => self::PASSWORD]);
        $admin->forceFill(['status' => UserStatus::Active, 'totp_secret' => $secret, 'totp_confirmed_at' => now()])->save();

        return [$admin, $secret];
    }

    protected function otp(string $secret): string
    {
        return (new Google2FA)->getCurrentOtp($secret);
    }

    /** Mobile login → bearer header. */
    protected function tokenFor(string $username, ?string $agency = null): string
    {
        $this->app['cache']->store()->flush(); // helper logins must not trip the login throttle
        $r = $this->postJson('/api/v1/auth/token', array_filter([
            'username' => $username, 'password' => self::PASSWORD, 'device_name' => 'test-device', 'agency_code' => $agency,
        ]))->assertOk();

        return $r->json('data.token');
    }

    /** @return array<string, string> */
    protected function bearer(string $token): array
    {
        return ['Authorization' => "Bearer $token"];
    }

    /** Headers marking a request as coming from the SPA (stateful, cookie auth). */
    protected function spa(): static
    {
        return $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/']);
    }

    /** Carry the session cookie from a response into subsequent requests of this test. */
    protected function carrySession(TestResponse $response): static
    {
        foreach ($response->headers->getCookies() as $cookie) {
            if ($cookie->getName() === config('session.cookie')) {
                return $this->withUnencryptedCookie($cookie->getName(), $cookie->getValue());
            }
        }

        return $this;
    }

    protected function provisionModule(Tenant $tenant, string $team = 'TEAM-1', bool $enabled = true, Module $module = Module::Tala): TenantModule
    {
        $row = (new TenantModule)->forceFill([
            'tenant_id' => $tenant->getKey(), 'module' => $module,
            'external_team_id' => $team, 'status' => $enabled ? ModuleStatus::Enabled : ModuleStatus::Disabled,
        ]);
        $row->save();

        return $row;
    }

    /** Approve hosts and fake their DNS. @param array<string, list<string>> $dns */
    protected function fakeTalaDns(array $dns = ['tala.example.com' => ['93.184.216.34']], ?array $allowed = null): void
    {
        config(['sailix.modules.tala.allowed_hosts' => $allowed ?? array_keys($dns)]);
        $this->app->instance(HostResolver::class, new FakeHostResolver($dns));
    }

    /** Sign in as a superadmin; returns this test with the session cookie carried. */
    protected function platformSession(string $email = 'root@example.test'): static
    {
        [, $secret] = $this->makePlatformAdmin($email);
        $r = $this->spa()->postJson('/api/v1/platform/auth/session', ['email' => $email, 'password' => self::PASSWORD, 'otp' => $this->otp($secret)])->assertOk();

        return $this->carrySession($r);
    }

    /** A fresh request context (guards forgotten) for the platform SPA. */
    protected function platform(): static
    {
        $this->app['auth']->forgetGuards();

        return $this->spa();
    }
}
