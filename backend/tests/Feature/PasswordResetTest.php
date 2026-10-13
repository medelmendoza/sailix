<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Identity\SessionRevoker;
use App\Mail\PasswordResetLink;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\Settings\SettingsRegistry;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    private function forgot(string $email)
    {
        return $this->postJson('/api/v1/auth/forgot-password', ['email' => $email]);
    }

    /** @return array{token: string, email: string, url: string} */
    private function emailedLink(string $to): array
    {
        $mail = Mail::queued(PasswordResetLink::class, fn ($m) => $m->hasTo($to))->last();
        $this->assertNotNull($mail, "no reset mail was sent to $to");
        parse_str((string) parse_url($mail->url, PHP_URL_QUERY), $q);

        return ['token' => $q['token'], 'email' => $q['email'], 'url' => $mail->url];
    }

    private function reset(array $link, string $password = 'brand-new-password', ?string $confirm = null)
    {
        return $this->postJson('/api/v1/auth/reset-password', [
            'email' => $link['email'], 'token' => $link['token'], 'password' => $password, 'password_confirmation' => $confirm ?? $password,
        ]);
    }

    public function test_an_active_account_gets_a_single_use_link_and_unknown_emails_get_the_same_answer(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');

        $known = $this->forgot('crew1@example.test')->assertStatus(202);
        $unknown = $this->forgot('nobody@example.test')->assertStatus(202);

        $this->assertSame($known->getContent(), $unknown->getContent());
        $this->assertSame(['data' => ['status' => 'received']], $known->json());
        Mail::assertQueued(PasswordResetLink::class, 1);
        Mail::assertQueued(PasswordResetLink::class, fn ($m) => $m->hasTo('crew1@example.test'));
    }

    public function test_the_link_points_at_the_configured_web_page_and_never_contains_a_password(): void
    {
        config(['sailix.reset_password_url' => 'https://portal.example.test/reset-password']);
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        $this->forgot('crew1@example.test');

        $link = $this->emailedLink('crew1@example.test');
        $this->assertStringStartsWith('https://portal.example.test/reset-password?', $link['url']);
        $this->assertSame('crew1@example.test', $link['email']);
        $this->assertNotSame('', $link['token']);
        $this->assertStringNotContainsString(self::PASSWORD, $link['url']);
    }

    public function test_only_active_accounts_receive_links(): void
    {
        $this->makeUser('suspended', UserStatus::Suspended);
        $this->makeUser('invited', UserStatus::Invited);

        $this->forgot('suspended@example.test')->assertStatus(202);
        $this->forgot('invited@example.test')->assertStatus(202);

        Mail::assertNothingQueued();
        $this->assertDatabaseCount('password_reset_tokens', 0);
    }

    public function test_resetting_sets_the_new_password_revokes_every_token_and_proves_the_mailbox(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        $oldToken = $this->tokenFor('crew1');
        $this->forgot('crew1@example.test');
        $link = $this->emailedLink('crew1@example.test');

        $this->reset($link)->assertNoContent();

        $user = User::where('username', 'crew1')->firstOrFail();
        $this->assertTrue(Hash::check('brand-new-password', $user->password));
        $this->assertFalse(Hash::check(self::PASSWORD, $user->password));
        $this->assertNotNull($user->email_verified_at);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseCount('password_reset_tokens', 0);

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/me', $this->bearer($oldToken))->assertStatus(401);
        $this->postJson('/api/v1/auth/token', ['username' => 'crew1', 'password' => self::PASSWORD, 'device_name' => 'd'])->assertStatus(401);
        $this->postJson('/api/v1/auth/token', ['username' => 'crew1', 'password' => 'brand-new-password', 'device_name' => 'd'])->assertOk();
    }

    public function test_a_link_works_once(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        $this->forgot('crew1@example.test');
        $link = $this->emailedLink('crew1@example.test');

        $this->reset($link)->assertNoContent();
        $this->reset($link, 'another-new-password')->assertStatus(422)->assertJsonPath('code', 'invalid_reset_token');
        $this->assertTrue(Hash::check('brand-new-password', User::where('username', 'crew1')->firstOrFail()->password));
    }

    public function test_bad_expired_foreign_and_inactive_tokens_are_indistinguishable(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        $this->makeMember($this->makeTenant('OTHER'), Role::Crew, 'crew2');
        $this->forgot('crew1@example.test');
        $link = $this->emailedLink('crew1@example.test');

        $bodies = [
            $this->reset(['token' => 'wrong-token', 'email' => 'crew1@example.test'])->assertStatus(422)->getContent(),
            $this->reset(['token' => $link['token'], 'email' => 'crew2@example.test'])->assertStatus(422)->getContent(), // another user's email
            $this->reset(['token' => $link['token'], 'email' => 'nobody@example.test'])->assertStatus(422)->getContent(),
        ];
        $this->travel(61)->minutes();
        $bodies[] = $this->reset($link)->assertStatus(422)->getContent(); // expired

        $messages = array_map(fn ($b) => json_decode($b, true)['code'].json_decode($b, true)['detail'], $bodies);
        $this->assertCount(1, array_unique($messages));
        $this->assertSame('invalid_reset_token', json_decode($bodies[0], true)['code']);
        $this->assertTrue(Hash::check(self::PASSWORD, User::where('username', 'crew1')->firstOrFail()->password), 'password unchanged');
    }

    public function test_a_user_suspended_after_requesting_a_link_cannot_use_it(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        $this->forgot('crew1@example.test');
        $link = $this->emailedLink('crew1@example.test');
        User::where('username', 'crew1')->firstOrFail()->forceFill(['status' => UserStatus::Suspended])->save();

        $this->reset($link)->assertStatus(422)->assertJsonPath('code', 'invalid_reset_token');
    }

    public function test_the_password_policy_applies_including_stricter_organization_minimums(): void
    {
        $strict = $this->makeTenant('STRICT');
        [, $m] = $this->makeMember($strict, Role::Crew, 'crew1');
        app(TenantContext::class)->runAs($strict->id, $m->id, $m->user_id, Role::Crew, fn () => SettingsRegistry::setTenant('password_min_length', 12));
        $this->forgot('crew1@example.test');
        $link = $this->emailedLink('crew1@example.test');

        $this->reset($link, 'tenchars10')->assertStatus(422)->assertJsonStructure(['errors' => ['password']]);
        $this->reset($link, 'short', 'short')->assertStatus(422);
        $this->reset($link, 'brand-new-password', 'different-password')->assertStatus(422);
        $this->reset($link, 'twelve-chars!')->assertNoContent(); // the token survived the failed attempts
    }

    public function test_browser_sessions_are_ended_by_a_reset(): void
    {
        config(['session.driver' => 'database']);
        [$user] = $this->makeMember($this->makeTenant('SFAI'), Role::TenantAdmin, 'admin1');
        $other = $this->makeUser('bystander');
        foreach ([['s1', $user->id], ['s2', $user->id], ['s3', $other->id]] as [$id, $uid]) {
            DB::table('sessions')->insert(['id' => $id, 'user_id' => $uid, 'payload' => 'x', 'last_activity' => time()]);
        }

        $this->assertSame(2, app(SessionRevoker::class)->revokeForUser($user));
        $this->assertSame(['s3'], DB::table('sessions')->pluck('id')->all());

        DB::table('sessions')->insert(['id' => 's4', 'user_id' => $other->id, 'payload' => 'x', 'last_activity' => time()]);
        $this->assertSame(1, app(SessionRevoker::class)->revokeForUser($other, 's3')); // keep the caller's own session
        $this->assertSame(['s3'], DB::table('sessions')->pluck('id')->all());
    }

    public function test_forgot_password_is_throttled_per_email(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');

        for ($i = 0; $i < 3; $i++) {
            $this->forgot('crew1@example.test')->assertStatus(202);
        }
        $this->forgot('crew1@example.test')->assertStatus(429)->assertJsonPath('code', 'throttled');
    }

    public function test_requests_are_audited_without_tokens_or_addresses(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        $this->forgot('crew1@example.test');
        $link = $this->emailedLink('crew1@example.test');
        $this->reset($link)->assertNoContent();

        app(TenantContext::class)->markPlatform();
        $actions = AuditLog::pluck('action')->all();
        $this->assertContains('auth.password_reset_requested', $actions);
        $this->assertContains('auth.password_reset', $actions);
        $dump = AuditLog::all()->toJson();
        $this->assertStringNotContainsString($link['token'], $dump);
        $this->assertStringNotContainsString('crew1@example.test', $dump);
    }

    public function test_input_is_validated_and_a_mail_outage_changes_nothing_visible(): void
    {
        $this->forgot('not-an-email')->assertStatus(422);
        $this->postJson('/api/v1/auth/forgot-password', [])->assertStatus(422);
        $this->postJson('/api/v1/auth/reset-password', [])->assertStatus(422)->assertJsonStructure(['errors' => ['email', 'token', 'password']]);

        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('smtp down'));
        $this->forgot('crew1@example.test')->assertStatus(202)->assertExactJson(['data' => ['status' => 'received']]);
    }
}
