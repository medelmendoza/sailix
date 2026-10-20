<?php

namespace Tests\Feature;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Models\Membership;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Tenancy\DomainVerifier;
use Tests\TestCase;

class TenantAddressingTest extends TestCase
{
    private Tenant $a;

    private Tenant $b;

    protected function setUp(): void
    {
        parent::setUp();
        // a relative test URL resolves against the LAST request's host: pin it, or one request's address leaks into the next
        $this->app['url']->forceRootUrl('http://localhost');
        $this->a = $this->makeTenant('AAA');
        $this->b = $this->makeTenant('BBB');
    }

    private function look(string $url, array $headers = [])
    {
        return $this->withHeaders($headers)->getJson($url);
    }

    public function test_every_organization_has_a_slug_that_starts_as_its_agency_code(): void
    {
        $this->assertSame('aaa', $this->a->slug);
        $this->assertSame('ab-org', $this->makeTenant('AB')->slug); // too short on its own
        $this->assertSame('platform-org', $this->makeTenant('PLATFORM')->slug); // reserved
        $this->assertNotSame($this->a->slug, $this->makeTenant('AAA2')->slug);
    }

    public function test_the_host_picks_the_organization_by_its_default_subdomain(): void
    {
        $this->look('http://aaa.sailix.test/api/v1/public/tenant')->assertOk()->assertJsonPath('data.slug', 'aaa')->assertJsonPath('data.name', 'AAA Agency');
        $this->look('http://bbb.sailix.test/api/v1/public/tenant')->assertOk()->assertJsonPath('data.slug', 'bbb');
        $this->look('http://AAA.Sailix.Test:8443/api/v1/public/tenant')->assertOk()->assertJsonPath('data.slug', 'aaa'); // case and port
    }

    public function test_an_unknown_host_names_no_organization_and_so_does_the_shared_address(): void
    {
        $this->look('http://nobody.sailix.test/api/v1/public/tenant')->assertNotFound()->assertJsonPath('code', 'tenant_not_found');
        $this->look('http://sailix.test/api/v1/public/tenant')->assertNotFound();
        $this->look('http://deep.aaa.sailix.test/api/v1/public/tenant')->assertNotFound(); // one label only
        $this->look('http://elsewhere.example/api/v1/public/tenant')->assertNotFound();
    }

    public function test_the_public_answer_carries_only_the_look_never_ids_or_people(): void
    {
        $data = $this->look('http://aaa.sailix.test/api/v1/public/tenant')->assertOk()->json('data');

        $this->assertEqualsCanonicalizing(['slug', 'name', 'short_name', 'tagline', 'login_welcome_message', 'logo_url', 'favicon_url', 'login_logo_url', 'login_background_url', 'primary_color', 'secondary_color', 'accent_color', 'background_color', 'text_color', 'font_preset', 'version'], array_keys($data));
        $this->assertStringNotContainsString($this->a->id, json_encode($data));
    }

    public function test_the_host_header_of_a_split_deployment_is_used_only_when_the_real_host_matches_nothing(): void
    {
        $this->look('http://api.sailix.test/api/v1/public/tenant', ['X-Tenant-Host' => 'bbb.sailix.test'])->assertOk()->assertJsonPath('data.slug', 'bbb');
        // the real host wins: a forged header cannot move a request to another organization
        $this->look('http://aaa.sailix.test/api/v1/public/tenant', ['X-Tenant-Host' => 'bbb.sailix.test'])->assertOk()->assertJsonPath('data.slug', 'aaa');
        $this->look('http://api.sailix.test/api/v1/public/tenant', ['X-Tenant-Host' => 'nobody.sailix.test'])->assertNotFound();

        config(['sailix.tenancy.allow_host_header' => false]);
        $this->look('http://api.sailix.test/api/v1/public/tenant', ['X-Tenant-Host' => 'bbb.sailix.test'])->assertNotFound();
    }

    public function test_the_slug_header_is_off_by_default_and_never_beats_a_real_address(): void
    {
        $this->look('http://sailix.test/api/v1/public/tenant', ['X-Tenant-Slug' => 'aaa'])->assertNotFound(); // off

        config(['sailix.tenancy.allow_slug_header' => true]);
        $this->look('http://sailix.test/api/v1/public/tenant', ['X-Tenant-Slug' => 'AAA'])->assertOk()->assertJsonPath('data.slug', 'aaa');
        $this->look('http://sailix.test/api/v1/public/tenant', ['X-Tenant-Slug' => 'nobody'])->assertNotFound();
        $this->look('http://sailix.test/api/v1/public/tenant', ['X-Tenant-Slug' => "aaa'; drop table tenants"])->assertNotFound(); // shape checked first
        $this->look('http://bbb.sailix.test/api/v1/public/tenant', ['X-Tenant-Slug' => 'aaa'])->assertOk()->assertJsonPath('data.slug', 'bbb');
    }

    public function test_slug_dot_localhost_works_only_in_development_mode(): void
    {
        $this->look('http://aaa.localhost/api/v1/public/tenant')->assertNotFound();

        config(['sailix.tenancy.dev_mode' => true]);
        $this->look('http://aaa.localhost:5173/api/v1/public/tenant')->assertOk()->assertJsonPath('data.slug', 'aaa');
        $this->look('http://localhost/api/v1/public/tenant')->assertNotFound();
    }

    public function test_the_dev_switches_do_nothing_outside_a_development_machine(): void
    {
        config(['sailix.tenancy.dev_mode' => true]);
        $this->app->detectEnvironment(fn () => 'production');

        $this->look('http://aaa.localhost/api/v1/public/tenant')->assertNotFound();
    }

    public function test_a_suspended_organizations_address_is_refused_and_so_are_its_images(): void
    {
        $this->b->forceFill(['status' => TenantStatus::Suspended])->save();

        $this->look('http://bbb.sailix.test/api/v1/public/tenant')->assertForbidden()->assertJsonPath('code', 'tenant_unavailable');
        $this->postJson('http://bbb.sailix.test/api/v1/auth/forgot-password', ['email' => 'x@example.test'])->assertStatus(403); // any route on that address
        $this->look('http://api.sailix.test/api/v1/public/tenants/bbb/logo')->assertNotFound();
        $this->look('http://aaa.sailix.test/api/v1/public/tenant')->assertOk(); // others are untouched
    }

    public function test_an_organization_still_being_set_up_can_be_reached_for_its_first_sign_in(): void
    {
        $this->b->forceFill(['status' => TenantStatus::Provisioning])->save();
        $this->look('http://bbb.sailix.test/api/v1/public/tenant')->assertOk();
    }

    private function member(string $username, Tenant ...$tenants): void
    {
        $user = $this->makeUser($username);
        foreach ($tenants as $tenant) {
            $this->makeMembership($tenant, $user, Role::Crew);
        }
    }

    private function signIn(string $url, array $body)
    {
        $this->app['cache']->store()->flush();

        return $this->postJson($url, $body + ['password' => self::PASSWORD, 'device_name' => 'test']);
    }

    public function test_signing_in_on_an_organizations_own_address_needs_no_agency_code(): void
    {
        $this->member('maria', $this->a, $this->b);

        $r = $this->signIn('http://aaa.sailix.test/api/v1/auth/token', ['username' => 'maria'])->assertOk();
        $this->assertNotNull($r->json('data.token'));
        $this->assertSame($this->a->id, $this->getJson('/api/v1/me', $this->bearer($r->json('data.token')))->json('data.tenant.id')); // not asked which: the address decides

        $r = $this->signIn('http://bbb.sailix.test/api/v1/auth/token', ['username' => 'maria'])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->assertSame($this->b->id, $this->getJson('/api/v1/me', $this->bearer($r->json('data.token')))->json('data.tenant.id'));
    }

    public function test_without_an_address_nothing_changes_and_the_agency_code_still_decides(): void
    {
        $this->member('maria', $this->a, $this->b);

        $this->signIn('http://sailix.test/api/v1/auth/token', ['username' => 'maria'])->assertOk()->assertJsonPath('data.requires_tenant_selection', true);
        $this->signIn('http://sailix.test/api/v1/auth/token', ['username' => 'maria', 'agency_code' => 'BBB'])->assertOk()->assertJsonMissingPath('data.requires_tenant_selection');
    }

    public function test_an_agency_code_for_another_organization_is_refused_on_an_address(): void
    {
        $this->member('maria', $this->a, $this->b);

        $this->signIn('http://aaa.sailix.test/api/v1/auth/token', ['username' => 'maria', 'agency_code' => 'BBB'])
            ->assertStatus(422)->assertJsonPath('code', 'tenant_mismatch');
        $this->signIn('http://aaa.sailix.test/api/v1/auth/token', ['username' => 'maria', 'agency_code' => 'aaa'])->assertOk(); // its own code is fine
    }

    public function test_someone_without_a_membership_there_cannot_sign_in_on_that_address(): void
    {
        $this->member('onlyb', $this->b);

        $this->signIn('http://aaa.sailix.test/api/v1/auth/token', ['username' => 'onlyb'])->assertStatus(403);
        $this->signIn('http://bbb.sailix.test/api/v1/auth/token', ['username' => 'onlyb'])->assertOk();
    }

    public function test_the_same_username_in_two_organizations_is_two_logins_by_address(): void
    {
        $this->member('maria', $this->a);
        $this->signIn('http://bbb.sailix.test/api/v1/auth/token', ['username' => 'maria'])->assertStatus(403); // her account is not a member of B
    }

    public function test_a_token_is_good_only_on_its_own_organizations_address(): void
    {
        $this->member('maria', $this->a, $this->b);
        $token = $this->signIn('http://aaa.sailix.test/api/v1/auth/token', ['username' => 'maria'])->json('data.token');
        $headers = $this->bearer($token);

        $this->app['auth']->forgetGuards();
        $this->getJson('http://aaa.sailix.test/api/v1/me', $headers)->assertOk();
        $this->app['auth']->forgetGuards();
        $this->getJson('http://bbb.sailix.test/api/v1/me', $headers)->assertUnauthorized(); // replayed on another organization
        $this->app['auth']->forgetGuards();
        $this->getJson('http://api.sailix.test/api/v1/me', $headers + ['X-Tenant-Host' => 'bbb.sailix.test'])->assertUnauthorized(); // and through the split-host header
        $this->app['auth']->forgetGuards();
        $this->getJson('http://sailix.test/api/v1/me', $headers)->assertOk(); // the mobile app has no address and is unaffected
    }

    public function test_registering_on_an_address_joins_that_organization(): void
    {
        $body = ['username' => 'newcrew', 'email' => 'newcrew@example.test', 'password' => 'Str0ng-Passw0rd!x', 'password_confirmation' => 'Str0ng-Passw0rd!x', 'first_name' => 'New', 'last_name' => 'Crew'];

        $this->postJson('http://bbb.sailix.test/api/v1/auth/register', $body)->assertStatus(202);
        $joined = Membership::withoutTenantScope()->whereHas('user', fn ($u) => $u->where('username', 'newcrew'))->firstOrFail();
        $this->assertSame($this->b->id, $joined->tenant_id);
        $this->assertSame(MembershipStatus::Pending, $joined->status);

        $this->postJson('http://aaa.sailix.test/api/v1/auth/register', ['username' => 'other', 'email' => 'other@example.test', 'agency_code' => 'BBB'] + $body)
            ->assertStatus(422)->assertJsonValidationErrors('agency_code');
    }

    private function fakeDns(array $records): void
    {
        $this->app->instance(DomainVerifier::class, new class($records) implements DomainVerifier
        {
            public function __construct(private array $records) {}

            public function txtRecords(string $name): array
            {
                return $this->records[$name] ?? [];
            }
        });
    }

    private function addDomain(string $as, string $domain)
    {
        return $this->postJson('/api/v1/tenant/domains', ['domain' => $domain], $this->as($as));
    }

    public function test_a_custom_domain_routes_nothing_until_it_is_proved(): void
    {
        $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        $r = $this->addDomain('adminA', 'WWW.School-A.example.com:443')->assertCreated();

        $this->assertSame('school-a.example.com', $r->json('data.domain'));
        $this->assertFalse($r->json('data.verified'));
        $this->assertSame('_sailix-challenge.school-a.example.com', $r->json('data.txt_name'));
        $this->assertStringStartsWith('sx-', $r->json('data.txt_value'));
        $this->assertSame('aaa.sailix.test', $r->json('data.cname_target'));

        $this->look('http://school-a.example.com/api/v1/public/tenant')->assertNotFound(); // unverified: no traffic
    }

    public function test_verifying_needs_the_dns_record_and_then_the_domain_routes(): void
    {
        $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        $row = $this->addDomain('adminA', 'school-a.example.com')->json('data');
        $verify = fn () => $this->postJson('/api/v1/tenant/domains/'.$row['id'].'/verify', [], $this->as('adminA'));

        $this->fakeDns([]);
        $verify()->assertStatus(422)->assertJsonPath('code', 'verification_failed');
        $this->fakeDns(['_sailix-challenge.school-a.example.com' => ['someone-elses-token']]);
        $verify()->assertStatus(422);

        $this->fakeDns(['_sailix-challenge.school-a.example.com' => [$row['txt_value']]]);
        $verify()->assertOk()->assertJsonPath('data.verified', true)->assertJsonPath('data.txt_value', null);

        $this->look('http://school-a.example.com/api/v1/public/tenant')->assertOk()->assertJsonPath('data.slug', 'aaa');
        $this->look('http://www.School-A.example.com/api/v1/public/tenant')->assertOk()->assertJsonPath('data.slug', 'aaa'); // www and case are the same domain
    }

    public function test_a_verified_domain_cannot_be_claimed_by_another_and_an_unverified_claim_gives_no_rights(): void
    {
        $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        $this->makeMember($this->b, Role::TenantAdmin, 'adminB');
        $claimA = $this->addDomain('adminA', 'shared.example.com')->json('data'); // both claim it, neither is proved
        $claimB = $this->addDomain('adminB', 'shared.example.com')->assertCreated()->json('data');
        $this->assertNotSame($claimA['txt_value'], $claimB['txt_value']);

        $this->fakeDns(['_sailix-challenge.shared.example.com' => [$claimB['txt_value']]]); // B proves it first
        $this->postJson('/api/v1/tenant/domains/'.$claimB['id'].'/verify', [], $this->as('adminB'))->assertOk();

        $this->look('http://shared.example.com/api/v1/public/tenant')->assertOk()->assertJsonPath('data.slug', 'bbb');
        $this->assertSame(0, TenantDomain::where('tenant_id', $this->a->id)->count()); // A's unverified claim is gone
        $this->addDomain('adminA', 'shared.example.com')->assertStatus(409)->assertJsonPath('code', 'domain_taken');
    }

    public function test_domains_are_checked_before_they_are_accepted(): void
    {
        $this->makeMember($this->a, Role::TenantAdmin, 'adminA');

        foreach (['', 'localhost', 'school.localhost', '192.168.0.1', 'intranet', 'not a domain', 'aaa.sailix.test', 'sailix.test'] as $bad) {
            $this->addDomain('adminA', $bad)->assertStatus(422);
        }
        $this->addDomain('adminA', 'ok.example.com')->assertCreated();
        $this->addDomain('adminA', 'OK.example.com')->assertStatus(409)->assertJsonPath('code', 'domain_exists');
    }

    public function test_an_organization_may_hold_only_so_many_domains(): void
    {
        $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        for ($i = 1; $i <= 10; $i++) {
            $this->addDomain('adminA', "d$i.example.com")->assertCreated();
        }
        $this->addDomain('adminA', 'd11.example.com')->assertStatus(409)->assertJsonPath('code', 'too_many_domains');
    }

    public function test_domains_are_listed_removed_and_kept_apart_between_organizations(): void
    {
        $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        $this->makeMember($this->b, Role::TenantAdmin, 'adminB');
        $this->makeMember($this->a, Role::Crew, 'crewA');
        $mine = $this->addDomain('adminA', 'mine.example.com')->json('data');

        $list = $this->getJson('/api/v1/tenant/domains', $this->as('adminA'))->assertOk();
        $this->assertSame('aaa.sailix.test', $list->json('data.default_address'));
        $this->assertSame(['mine.example.com'], array_column($list->json('data.domains'), 'domain'));
        $this->assertSame([], $this->getJson('/api/v1/tenant/domains', $this->as('adminB'))->json('data.domains'));

        $this->postJson('/api/v1/tenant/domains/'.$mine['id'].'/verify', [], $this->as('adminB'))->assertNotFound();
        $this->deleteJson('/api/v1/tenant/domains/'.$mine['id'], [], $this->as('adminB'))->assertNotFound();
        $this->getJson('/api/v1/tenant/domains', $this->as('crewA'))->assertForbidden();
        $this->addDomain('crewA', 'crew.example.com')->assertForbidden();

        $this->deleteJson('/api/v1/tenant/domains/'.$mine['id'], [], $this->as('adminA'))->assertNoContent();
        $this->assertSame(0, TenantDomain::count());
    }

    public function test_browsers_on_an_organizations_own_addresses_are_allowed_but_strangers_are_not(): void
    {
        $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        $row = $this->addDomain('adminA', 'school-a.example.com')->json('data');
        $preflight = fn (string $origin) => $this->call('OPTIONS', 'http://api.sailix.test/api/v1/auth/session', [], [], [], [
            'HTTP_ORIGIN' => $origin, 'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST', 'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,x-tenant-host',
        ]);

        $preflight('https://aaa.sailix.test')->assertHeader('Access-Control-Allow-Origin', 'https://aaa.sailix.test'); // the default address
        $preflight('https://school-a.example.com')->assertHeaderMissing('Access-Control-Allow-Origin'); // not proved yet

        $this->fakeDns(['_sailix-challenge.school-a.example.com' => [$row['txt_value']]]);
        $this->postJson('/api/v1/tenant/domains/'.$row['id'].'/verify', [], $this->as('adminA'))->assertOk();

        $preflight('https://school-a.example.com')->assertHeader('Access-Control-Allow-Origin', 'https://school-a.example.com')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
        $preflight('https://evil.example.org')->assertHeaderMissing('Access-Control-Allow-Origin');
        $preflight('https://nobody.sailix.test')->assertHeaderMissing('Access-Control-Allow-Origin'); // a subdomain of no organization
    }
}
