<?php

namespace Tests\Feature;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Mail\MembershipActivated;
use App\Mail\RegistrationNotice;
use App\Models\AuditLog;
use App\Models\CrewProfile;
use App\Models\Membership;
use App\Models\User;
use App\Support\Settings\SettingsRegistry;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'agency_code' => 'SFAI', 'username' => 'juan.delacruz', 'email' => 'juan@example.test',
            'password' => 'a-long-enough-pass', 'password_confirmation' => 'a-long-enough-pass',
            'first_name' => 'Juan', 'last_name' => 'Dela Cruz', 'middle_name' => 'Santos', 'suffix' => 'Jr', 'mobile' => '+63 917 123 4567',
        ];
    }

    private function register(array $overrides = [])
    {
        return $this->postJson('/api/v1/auth/register', $this->payload($overrides));
    }

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    public function test_registration_creates_a_pending_crew_membership_with_a_profile_and_issues_no_token(): void
    {
        $tenant = $this->makeTenant('SFAI');

        $this->register()->assertStatus(202)->assertExactJson(['data' => ['status' => 'received']]);

        $user = User::where('username', 'juan.delacruz')->firstOrFail();
        $this->assertSame('active', $user->status->value);
        $membership = Membership::withoutTenantScope()->where('user_id', $user->id)->firstOrFail();
        $this->assertSame($tenant->id, $membership->tenant_id);
        $this->assertSame(Role::Crew, $membership->role);
        $this->assertSame(MembershipStatus::Pending, $membership->status);

        $profile = CrewProfile::withoutTenantScope()->where('membership_id', $membership->id)->firstOrFail();
        $this->assertSame(['Juan', 'Santos', 'Dela Cruz', 'Jr', '+63 917 123 4567'], [$profile->first_name, $profile->middle_name, $profile->last_name, $profile->suffix, $profile->mobile]);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertSame(0, \DB::table('sessions')->count());
    }

    public function test_a_pending_member_cannot_sign_in_until_an_admin_activates_them(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->register()->assertStatus(202);

        $login = ['username' => 'juan.delacruz', 'password' => 'a-long-enough-pass', 'device_name' => 'phone'];
        $this->postJson('/api/v1/auth/token', $login)->assertStatus(403)->assertJsonPath('code', 'membership_pending');
        $this->postJson('/api/v1/auth/session', ['username' => 'juan.delacruz', 'password' => 'a-long-enough-pass'])->assertStatus(403);

        // the admin sees the registration WITH the personal data needed to decide
        $this->app['auth']->forgetGuards();
        $h = $this->bearer($this->tokenFor('admin1'));
        $list = $this->getJson('/api/v1/tenant/users?filter[status]=pending', $h)->assertOk()->assertJsonCount(1, 'data');
        $this->assertSame('Juan', $list->json('data.0.profile.first_name'));
        $this->assertSame('juan@example.test', $list->json('data.0.user.email'));
        $id = $list->json('data.0.id');

        $this->app['auth']->forgetGuards();
        $this->patchJson("/api/v1/tenant/users/$id", ['status' => 'active'], $h)->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.profile.last_name', 'Dela Cruz');
        Mail::assertSent(MembershipActivated::class, fn ($m) => $m->hasTo('juan@example.test') && $m->organization === 'SFAI Agency');

        $this->app['auth']->forgetGuards();
        $token = $this->postJson('/api/v1/auth/token', $login)->assertOk()->json('data.token');
        $this->app['auth']->forgetGuards();
        $me = $this->getJson('/api/v1/me', $this->bearer($token))->assertOk();
        $this->assertSame('Juan', $me->json('data.profile.first_name'));
        $this->assertSame('crew', $me->json('data.membership.role'));
    }

    public function test_activating_an_already_active_member_does_not_send_another_email(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        [, $crew] = $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->app['auth']->forgetGuards();

        $this->patchJson("/api/v1/tenant/users/{$crew->id}", ['role' => 'crew'], $this->bearer($this->tokenFor('admin1')))->assertOk();
        Mail::assertNotSent(MembershipActivated::class);
    }

    public function test_a_rejected_registration_stays_blocked(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->register()->assertStatus(202);
        $id = Membership::withoutTenantScope()->where('status', 'pending')->firstOrFail()->id;

        $this->app['auth']->forgetGuards();
        $this->patchJson("/api/v1/tenant/users/$id", ['status' => 'suspended'], $this->bearer($this->tokenFor('admin1')))->assertOk();

        $this->postJson('/api/v1/auth/token', ['username' => 'juan.delacruz', 'password' => 'a-long-enough-pass', 'device_name' => 'p'])->assertStatus(403);
        Mail::assertNotSent(MembershipActivated::class);
    }

    public function test_the_client_cannot_choose_role_status_or_tenant(): void
    {
        $a = $this->makeTenant('SFAI');
        $b = $this->makeTenant('OTHER');

        $this->register([
            'role' => 'tenant_admin', 'status' => 'active', 'membership_status' => 'active', 'tenant_id' => $b->id,
            'user_status' => 'suspended', 'is_admin' => true, 'email_verified_at' => now()->toISOString(), 'birth_date' => '1990-01-01',
        ])->assertStatus(202);

        $membership = Membership::withoutTenantScope()->firstOrFail();
        $this->assertSame($a->id, $membership->tenant_id, 'tenant comes from the agency code only');
        $this->assertSame(Role::Crew, $membership->role);
        $this->assertSame(MembershipStatus::Pending, $membership->status);
        $user = User::firstOrFail();
        $this->assertSame('active', $user->status->value);
        $this->assertNull($user->email_verified_at);
        $this->assertArrayNotHasKey('birth_date', CrewProfile::withoutTenantScope()->firstOrFail()->getAttributes(), 'date of birth is never collected');
    }

    public function test_agency_code_must_name_an_active_organization(): void
    {
        $this->makeTenant('SFAI');
        $this->makeTenant('SUSP', TenantStatus::Suspended);
        $this->makeTenant('PROV', TenantStatus::Provisioning);

        foreach (['NOPE', 'SUSP', 'PROV'] as $i => $code) {
            $this->register(['agency_code' => $code, 'email' => "code$i@example.test"])->assertStatus(422)->assertJsonPath('code', 'invalid_agency_code')->assertJsonStructure(['errors' => ['agency_code']]);
        }
        $this->register(['agency_code' => 'bad code!', 'email' => 'bad@example.test'])->assertStatus(422)->assertJsonPath('code', 'validation');
        $this->assertSame(0, User::count());

        $this->register(['agency_code' => 'sfai', 'email' => 'ok@example.test'])->assertStatus(202); // case-insensitive
        $this->assertSame(1, User::count());
    }

    public function test_an_existing_email_gets_the_same_response_no_second_account_and_a_notice_email(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->register()->assertStatus(202);
        $baseline = [User::count(), Membership::withoutTenantScope()->count(), CrewProfile::withoutTenantScope()->count()];

        $fresh = $this->register(['username' => 'someone.else', 'email' => 'brand-new@example.test']);
        $again = $this->register(['username' => 'another.name', 'email' => 'JUAN@Example.test']); // same mailbox, different case

        $this->assertSame($fresh->getContent(), $again->getContent(), 'no enumeration of registered emails');
        $this->assertSame($fresh->status(), $again->status());
        $this->assertSame(
            [$baseline[0] + 1, $baseline[1] + 1, $baseline[2] + 1],
            [User::count(), Membership::withoutTenantScope()->count(), CrewProfile::withoutTenantScope()->count()],
            'only the genuinely new email created an account',
        );
        $this->assertNull(User::where('username', 'another.name')->first());
        Mail::assertSent(RegistrationNotice::class, fn ($m) => $m->hasTo('JUAN@Example.test') || $m->hasTo('juan@example.test'));
        Mail::assertSent(RegistrationNotice::class, 1);
    }

    public function test_a_taken_username_is_a_validation_error_and_creates_nothing(): void
    {
        $this->makeTenant('SFAI');
        $this->register()->assertStatus(202);

        $this->register(['email' => 'other@example.test'])->assertStatus(422)->assertJsonStructure(['errors' => ['username']]);
        $this->assertSame(1, User::count());
    }

    public function test_password_policy_applies_with_the_organizations_stricter_minimum(): void
    {
        $strict = $this->makeTenant('STRICT');
        $this->makeTenant('SFAI');
        app(TenantContext::class)->runAs($strict->id, 'm', 'u', Role::TenantAdmin, fn () => SettingsRegistry::setTenant('password_min_length', 12));

        $ten = 'abcdefghij';
        $this->register(['agency_code' => 'STRICT', 'email' => 'p1@example.test', 'password' => $ten, 'password_confirmation' => $ten])->assertStatus(422)->assertJsonStructure(['errors' => ['password']]);
        $this->register(['agency_code' => 'SFAI', 'email' => 'p2@example.test', 'password' => $ten, 'password_confirmation' => $ten])->assertStatus(202); // platform floor is 8
        $this->register(['agency_code' => 'STRICT', 'username' => 'user.two', 'email' => 'p3@example.test', 'password' => 'twelve-chars!', 'password_confirmation' => 'twelve-chars!'])->assertStatus(202);

        $this->register(['username' => 'user.three', 'email' => 'p4@example.test', 'password' => 'short', 'password_confirmation' => 'short'])->assertStatus(422);
        $this->register(['username' => 'user.four', 'email' => 'p5@example.test', 'password_confirmation' => 'mismatch-pass'])->assertStatus(422);
    }

    public function test_input_is_validated(): void
    {
        $this->makeTenant('SFAI');

        $this->postJson('/api/v1/auth/register', [])->assertStatus(422)->assertJsonStructure(['errors' => ['agency_code', 'username', 'email', 'password', 'first_name', 'last_name']]);
        foreach ([['email' => 'not-an-email'], ['username' => 'a b', 'email' => 'v1@example.test'], ['username' => 'ab', 'email' => 'v2@example.test'], ['mobile' => 'call me', 'email' => 'v3@example.test'], ['first_name' => str_repeat('x', 101), 'email' => 'v4@example.test']] as $bad) {
            $this->app['cache']->store()->flush(); // validation is under test here, not the throttle
            $this->register($bad)->assertStatus(422);
        }
        $this->assertSame(0, User::count());
    }

    public function test_a_mail_outage_never_fails_registration_or_leaks_account_existence(): void
    {
        $this->makeTenant('SFAI');
        $this->register()->assertStatus(202);

        Mail::shouldReceive('to')->andThrow(new \RuntimeException('smtp down'));
        $this->register(['username' => 'dup', 'email' => 'juan@example.test'])->assertStatus(202)->assertExactJson(['data' => ['status' => 'received']]);
    }

    public function test_registration_is_throttled_per_email(): void
    {
        $this->makeTenant('SFAI');

        for ($i = 0; $i < 3; $i++) {
            $this->register(['username' => "user$i"])->assertStatus(202); // same email, 3/hour allowed
        }
        $this->register(['username' => 'user3'])->assertStatus(429)->assertJsonPath('code', 'throttled')->assertHeader('Retry-After');
    }

    public function test_registration_is_throttled_per_address(): void
    {
        $this->makeTenant('SFAI');

        for ($i = 0; $i < 5; $i++) {
            $this->register(['username' => "ipuser$i", 'email' => "ip$i@example.test"])->assertStatus(202);
        }
        $this->register(['username' => 'ipuser5', 'email' => 'ip5@example.test'])->assertStatus(429);
        $this->assertSame(5, User::count());
    }

    public function test_registration_is_audited_without_personal_data(): void
    {
        $this->makeTenant('SFAI');
        $this->register()->assertStatus(202);

        app(TenantContext::class)->markPlatform();
        $entry = AuditLog::where('action', 'auth.registered')->firstOrFail();
        $this->assertNotNull($entry->tenant_id);
        $dump = strtolower($entry->toJson());
        foreach (['juan', 'password', 'example.test', 'dela cruz'] as $secret) {
            $this->assertStringNotContainsString($secret, $dump);
        }
    }
}
