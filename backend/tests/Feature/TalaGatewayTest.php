<?php

namespace Tests\Feature;

use App\Enums\LinkStatus;
use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Models\ExternalIdentity;
use App\Models\ModuleLink;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Support\Settings\SettingsRegistry;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * M3: read-only Tala gateway. No test touches a network: DNS is faked, HTTP is faked and stray requests fail.
 * Fixtures mimic the SHAPES observed in T0 (docs/reference/tala-analysis/04), with invented values.
 */
class TalaGatewayTest extends TestCase
{
    private const BASE = 'https://tala.example.com';

    private const TALA_USER = 'tala-user-1';

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']]);
        SettingsRegistry::setPlatform('tala_api_base_url', self::BASE);
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->provisionModule($tenant, 'TEAM-1');
    }

    private function jwt(int $expiresIn = 31_536_000): string
    {
        $b64 = fn (array $a) => rtrim(strtr(base64_encode((string) json_encode($a)), '+/', '-_'), '=');

        return $b64(['alg' => 'HS384']).'.'.$b64(['sub' => self::TALA_USER, 'iat' => time(), 'exp' => time() + $expiresIn]).'.sig';
    }

    /** @param array<string, mixed> $overrides url-pattern => response */
    private function fakeTala(array $overrides = []): void
    {
        $assignment = [
            'assignId' => 'A1', 'courseId' => 'C1', 'dateFrom' => '2026-01-01', 'dateTo' => '2026-12-31', 'status' => 'ongoing', 'progress' => '50',
            'course' => [
                'courseName' => 'Safety at sea', 'courseDescription' => 'Basics', 'courseThumbnailUrl' => 'https://cdn.example.com/c.png', 'totalMaterial' => '5',
                'materialDetails' => [
                    ['materialId' => 'v1', 'materialType' => 'video', 'materialName' => 'Intro video', 'materialDescription' => 'd', 'materialThumbnailUrl' => 'https://cdn.example.com/v.png'],
                    ['materialId' => 'p1', 'materialType' => 'pdf', 'materialName' => 'Manual'],
                    ['materialId' => 'q1', 'materialType' => 'up_quiz', 'materialName' => 'Quiz'],
                    ['materialId' => 'e1', 'materialType' => 'epub', 'materialName' => 'Book'],
                    ['materialId' => 'l1', 'materialType' => 'quiz', 'materialName' => 'Legacy quiz'],
                ],
            ],
        ];
        // Each call REPLACES the previous fakes (Http::fake alone appends, and the first matching stub wins).
        Http::swap(new Factory);
        Http::preventStrayRequests();
        Http::fake($overrides + [
            self::BASE.'/api/v1/login' => Http::response(['accessToken' => $this->jwt(), 'refreshToken' => 'refresh-secret', 'userId' => self::TALA_USER]),
            self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams' => Http::response([['teamId' => 'TEAM-1', 'teamName' => 'x'], ['teamId' => 'OTHER', 'teamName' => 'y']]),
            self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses' => Http::response([$assignment]),
            self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses/C1/sync/A1/data' => Http::response([
                'materials' => ['videos' => [['videoId' => 'v1', 'progress' => '100', 'status' => 'done']], 'pdfs' => [], 'quizzes' => [], 'cards' => [], 'epubs' => []],
            ]),
            self::BASE.'/api/v1/auth/users/teams/TEAM-1/videos/v1' => Http::response([
                'videoName' => 'Intro video', 'videoDescription' => 'd', 'videoFileUrl' => 'https://files.example.com/v.mp4', 'videoThumbnailUrl' => 'http://insecure.example.com/t.png',
            ]),
            self::BASE.'/api/v1/auth/users/teams/TEAM-1/pdf/p1' => Http::response(['pdfName' => 'Manual', 'pdfFileUrl' => 'javascript:alert(1)']),
        ]);
    }

    private function as(string $username): array
    {
        $this->app['auth']->forgetGuards();
        $token = $this->tokenFor($username);
        $this->app['auth']->forgetGuards();

        return $this->bearer($token);
    }

    private function link(array $headers, array $extra = [])
    {
        return $this->postJson('/api/v1/modules/tala/link', ['username' => 'maria', 'password' => 'tala-pass-123'] + $extra, $headers);
    }

    public function test_linking_verifies_with_tala_and_stores_only_encrypted_tokens(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');

        $r = $this->link($h)->assertOk()->assertJsonPath('data.status', 'linked');

        // the response says nothing about tokens or Tala identifiers
        $this->assertSame(['status', 'linked_at', 'last_verified_at'], array_keys($r->json('data')));
        $this->assertStringNotContainsString(self::TALA_USER, $r->getContent());
        $this->assertStringNotContainsString('TEAM-1', $r->getContent());

        $row = DB::table('module_links')->first();
        $this->assertSame('TEAM-1', $row->external_team_id);
        $plain = Crypt::decryptString($row->access_token);
        $this->assertStringStartsWith('eyJ', $plain);
        $this->assertStringNotContainsString($plain, $row->access_token); // not readable at rest
        $this->assertSame('refresh-secret', Crypt::decryptString($row->refresh_token));
        $this->assertNotNull(ModuleLink::withoutTenantScope()->firstOrFail()->token_expires_at);

        // the password exists in memory only: it is in no table, no audit row
        foreach (['module_links', 'external_identities', 'audit_logs', 'personal_access_tokens', 'users'] as $table) {
            $this->assertStringNotContainsString('tala-pass-123', json_encode(DB::table($table)->get()), $table);
        }
        // and only https was used
        Http::assertSent(fn (Request $q) => str_starts_with($q->url(), 'https://') && ($q->url() !== self::BASE.'/api/v1/login' || $q->data() === ['username' => 'maria', 'password' => 'tala-pass-123']));
        $this->assertSame(1, ExternalIdentity::where('external_user_id', self::TALA_USER)->count());
    }

    public function test_client_supplied_ids_are_ignored_when_linking_and_reading(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');

        $this->link($h, ['userId' => 'evil-user', 'teamId' => 'EVIL-TEAM', 'tenant_id' => 'x', 'role' => 'tenant_admin'])->assertOk();
        $this->getJson('/api/v1/modules/tala/courses?userId=evil-user&teamId=EVIL-TEAM', $h)->assertOk();

        Http::assertNotSent(fn (Request $q) => str_contains($q->url(), 'evil') || str_contains($q->url(), 'EVIL'));
        Http::assertSent(fn (Request $q) => $q->url() === self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses');
    }

    public function test_an_account_outside_the_organizations_team_is_refused_and_nothing_is_stored(): void
    {
        $this->fakeTala([self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams' => Http::response([['teamId' => 'SOMEONE-ELSES']])]);

        $this->link($this->as('crew1'))->assertStatus(422)->assertJsonPath('code', 'team_not_in_organization');

        $this->assertSame(0, ModuleLink::withoutTenantScope()->count());
        $this->assertSame(0, ExternalIdentity::count());
    }

    public function test_wrong_credentials_and_upstream_failures_are_distinguished_without_leaking_bodies(): void
    {
        $h = $this->as('crew1');

        $this->fakeTala([self::BASE.'/api/v1/login' => Http::response(['message' => 'Bad credentials for maria'], 401)]);
        $r = $this->link($h)->assertStatus(422)->assertJsonPath('code', 'link_failed');
        $this->assertStringNotContainsString('maria', $r->getContent());

        $this->fakeTala([self::BASE.'/api/v1/login' => Http::response('stack trace with secrets', 500)]);
        $r = $this->link($h)->assertStatus(503)->assertJsonPath('code', 'module_unavailable');
        $this->assertStringNotContainsString('secrets', $r->getContent());

        $this->fakeTala([self::BASE.'/api/v1/login' => fn () => throw new ConnectionException('cURL error 7: connect to 93.184.216.34')]);
        $r = $this->link($h)->assertStatus(503);
        $this->assertStringNotContainsString('93.184', $r->getContent());
        $this->assertSame(0, ModuleLink::withoutTenantScope()->count());
    }

    public function test_a_tala_account_cannot_be_claimed_by_a_second_sailix_user_and_one_user_has_one_account(): void
    {
        $this->fakeTala();
        $this->link($this->as('crew1'))->assertOk();

        $this->makeMember(Tenant::where('code', 'SFAI')->firstOrFail(), Role::Crew, 'crew2');
        $this->link($this->as('crew2'))->assertStatus(409)->assertJsonPath('code', 'external_account_taken');

        // crew1 trying to link a DIFFERENT Tala account while one is linked
        $this->fakeTala([
            self::BASE.'/api/v1/login' => Http::response(['accessToken' => $this->jwt(), 'refreshToken' => 'r', 'userId' => 'tala-user-2']),
            self::BASE.'/api/v1/auth/users/tala-user-2/teams' => Http::response([['teamId' => 'TEAM-1']]),
        ]);
        $this->link($this->as('crew1'))->assertStatus(409)->assertJsonPath('code', 'different_account_linked');
        $this->assertSame(1, ExternalIdentity::count());
    }

    public function test_courses_are_mapped_filtered_and_use_only_the_stored_identity(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h)->assertOk();

        $r = $this->getJson('/api/v1/modules/tala/courses', $h)->assertOk();

        $this->assertSame([[
            'id' => 'A1', 'name' => 'Safety at sea', 'description' => 'Basics', 'thumbnail_url' => 'https://cdn.example.com/c.png',
            'date_from' => '2026-01-01', 'date_to' => '2026-12-31', 'status' => 'ongoing', 'progress' => '50', 'total_materials' => 3,
        ]], $r->json('data'));
        $this->assertStringNotContainsString(self::TALA_USER, $r->getContent());
        $this->assertStringNotContainsString('refresh', $r->getContent());
    }

    public function test_course_detail_merges_progress_hides_unsupported_kinds_and_never_offers_quizzes(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h);

        $d = $this->getJson('/api/v1/modules/tala/courses/A1', $h)->assertOk()->json('data');

        $this->assertSame(2, $d['hidden_materials']); // epub + legacy quiz (D-T6)
        $byId = collect($d['materials'])->keyBy('id');
        $this->assertSame(['v1', 'p1', 'q1'], $byId->keys()->all());
        $this->assertSame('100', $byId['v1']['progress']);
        $this->assertSame('done', $byId['v1']['status']);
        $this->assertTrue($byId['v1']['viewable']);
        $this->assertFalse($byId['q1']['viewable']);
        // quiz content (answer keys) was never requested from Tala
        Http::assertNotSent(fn (Request $q) => str_contains($q->url(), 'quiz'));
    }

    public function test_an_assignment_that_is_not_in_the_users_own_list_is_404_and_never_forwarded(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h);

        $this->getJson('/api/v1/modules/tala/courses/SOMEONE-ELSES', $h)->assertStatus(404);
        $this->getJson('/api/v1/modules/tala/courses/A1/materials/not-mine', $h)->assertStatus(404);
        $this->getJson('/api/v1/modules/tala/courses/A1/materials/e1', $h)->assertStatus(404); // hidden kind
        $this->getJson('/api/v1/modules/tala/courses/..%2F..%2Fx', $h)->assertStatus(404);

        Http::assertNotSent(fn (Request $q) => str_contains($q->url(), 'SOMEONE') || str_contains($q->url(), 'not-mine') || str_contains($q->url(), '..'));
    }

    public function test_material_returns_https_addresses_only_and_refuses_quizzes(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h);

        $v = $this->getJson('/api/v1/modules/tala/courses/A1/materials/v1', $h)->assertOk()->json('data');
        $this->assertSame('https://files.example.com/v.mp4', $v['file_url']);
        $this->assertNull($v['thumbnail_url']); // http:// thumbnail dropped

        $p = $this->getJson('/api/v1/modules/tala/courses/A1/materials/p1', $h)->assertOk()->json('data');
        $this->assertNull($p['file_url']); // javascript: dropped

        $this->getJson('/api/v1/modules/tala/courses/A1/materials/q1', $h)->assertStatus(422)->assertJsonPath('code', 'unsupported_material');
    }

    public function test_a_rejected_token_wipes_the_stored_tokens_and_asks_for_a_relink(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h);
        $this->fakeTala([self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses' => Http::response(['error' => 'x'], 401)]);

        $this->getJson('/api/v1/modules/tala/courses', $h)->assertStatus(409)->assertJsonPath('code', 'relink_required');

        $link = ModuleLink::withoutTenantScope()->firstOrFail();
        $this->assertSame(LinkStatus::NeedsRelink, $link->status);
        $this->assertNull(DB::table('module_links')->value('access_token'));
        $this->assertNull(DB::table('module_links')->value('refresh_token'));
        $this->getJson('/api/v1/me', $h)->assertJsonPath('data.modules.0.status', 'needs_relink');

        // relinking restores it
        $this->fakeTala();
        $this->link($h)->assertOk()->assertJsonPath('data.status', 'linked');
        $this->getJson('/api/v1/modules/tala/courses', $h)->assertOk();
    }

    public function test_an_expired_token_is_never_sent_to_tala(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h);
        ModuleLink::withoutTenantScope()->firstOrFail()->forceFill(['token_expires_at' => now()->subMinute()])->save();
        Http::swap(new Factory);
        Http::preventStrayRequests(); // from here on any request would fail the test and be recorded

        $this->getJson('/api/v1/modules/tala/courses', $h)->assertStatus(409)->assertJsonPath('code', 'relink_required');

        Http::assertNothingSent();
    }

    public function test_not_linked_state_and_other_organizations_do_not_see_each_others_links(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->getJson('/api/v1/modules/tala/link', $h)->assertOk()->assertJsonPath('data.status', 'not_linked');
        $this->getJson('/api/v1/modules/tala/courses', $h)->assertStatus(409)->assertJsonPath('code', 'not_linked');
        $this->link($h)->assertOk();

        $other = $this->makeTenant('ACME');
        $this->makeMember($other, Role::Crew, 'bob');
        $this->provisionModule($other, 'TEAM-2');
        $bob = $this->as('bob');
        $this->getJson('/api/v1/modules/tala/link', $bob)->assertJsonPath('data.status', 'not_linked');
        $this->getJson('/api/v1/modules/tala/courses', $bob)->assertStatus(409)->assertJsonPath('code', 'not_linked');
    }

    public function test_unlinking_removes_tokens_and_releases_the_account(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h);

        $this->deleteJson('/api/v1/modules/tala/link', [], $h)->assertNoContent();
        $this->deleteJson('/api/v1/modules/tala/link', [], $h)->assertNoContent(); // idempotent

        $this->assertSame(0, ModuleLink::withoutTenantScope()->count());
        $this->assertSame(0, ExternalIdentity::count());
        $this->makeMember(Tenant::where('code', 'SFAI')->firstOrFail(), Role::Crew, 'crew2');
        $this->link($this->as('crew2'))->assertOk(); // the account is free again
    }

    public function test_the_endpoint_guard_runs_on_every_request_and_nothing_is_sent_when_it_fails(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h);
        Http::swap(new Factory);
        Http::preventStrayRequests();

        // DNS now answers with a private address (rebinding)
        $this->fakeTalaDns(['tala.example.com' => ['10.0.0.5']]);
        $this->getJson('/api/v1/modules/tala/courses', $h)->assertStatus(503)->assertJsonPath('code', 'module_unavailable');
        // the host is removed from the deployment allow-list
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']], allowed: ['other.example.com']);
        $this->getJson('/api/v1/modules/tala/courses', $h)->assertStatus(503);
        $this->link($h)->assertStatus(503);

        Http::assertNothingSent();
        $this->assertSame(LinkStatus::Linked, ModuleLink::withoutTenantScope()->firstOrFail()->status); // an outage is not a relink
    }

    public function test_redirects_are_never_followed(): void
    {
        $this->fakeTala([self::BASE.'/api/v1/login' => Http::response('', 302, ['Location' => 'http://169.254.169.254/latest/meta-data'])]);

        $this->link($this->as('crew1'))->assertStatus(503);

        Http::assertSentCount(1);
        Http::assertNotSent(fn (Request $q) => str_contains($q->url(), '169.254'));
    }

    public function test_a_flaky_connection_is_retried_once_for_reads(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h);
        $calls = 0;
        $this->fakeTala([self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses' => function () use (&$calls) {
            if (++$calls === 1) {
                throw new ConnectionException('reset');
            }

            return Http::response([]);
        }]);

        $this->getJson('/api/v1/modules/tala/courses', $h)->assertOk()->assertJsonPath('data', []);
        $this->assertSame(2, $calls);
    }

    public function test_disabled_module_suspended_organization_and_unconfigured_platform_block_the_gateway(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h);
        Http::swap(new Factory);
        Http::preventStrayRequests();

        TenantModule::withoutTenantScope()->firstOrFail()->forceFill(['status' => 'disabled'])->save();
        $this->getJson('/api/v1/modules/tala/courses', $h)->assertStatus(403)->assertJsonPath('code', 'module_disabled');
        TenantModule::withoutTenantScope()->firstOrFail()->forceFill(['status' => 'enabled'])->save();

        SettingsRegistry::setPlatform('tala_api_base_url', null);
        $this->getJson('/api/v1/modules/tala/courses', $h)->assertStatus(503)->assertJsonPath('code', 'module_unavailable');
        SettingsRegistry::setPlatform('tala_api_base_url', self::BASE);

        Tenant::where('code', 'SFAI')->firstOrFail()->forceFill(['status' => TenantStatus::Suspended])->save();
        $this->getJson('/api/v1/modules/tala/courses', $h)->assertStatus(403);

        Http::assertNothingSent();
    }

    public function test_linking_is_throttled(): void
    {
        $this->fakeTala([self::BASE.'/api/v1/login' => Http::response([], 401)]);
        $h = $this->as('crew1');

        for ($i = 0; $i < 5; $i++) {
            $this->link($h)->assertStatus(422);
        }
        $this->link($h)->assertStatus(429);
    }

    public function test_gateway_reads_are_throttled_per_user(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h);

        for ($i = 0; $i < 60; $i++) {
            $this->getJson('/api/v1/modules/tala/courses', $h)->assertOk();
        }
        $this->getJson('/api/v1/modules/tala/courses', $h)->assertStatus(429);
        $this->getJson('/api/v1/modules/tala/link', $h)->assertOk(); // the link state is local, not upstream traffic
    }

    public function test_gateway_responses_never_contain_tokens(): void
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $bodies = [$this->link($h)->getContent()];
        foreach (['link', 'courses', 'courses/A1', 'courses/A1/materials/v1'] as $path) {
            $bodies[] = $this->getJson("/api/v1/modules/tala/$path", $h)->getContent();
        }
        $plain = Crypt::decryptString(DB::table('module_links')->value('access_token'));
        foreach ($bodies as $body) {
            $this->assertStringNotContainsString($plain, $body);
            $this->assertStringNotContainsString('refresh-secret', $body);
        }
    }
}
