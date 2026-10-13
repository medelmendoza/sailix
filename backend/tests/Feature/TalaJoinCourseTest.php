<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakesTala;
use Tests\TestCase;

/** Join a course by code (WRITE, flag-gated, faked Tala only: Tala's real answers are unverified). */
class TalaJoinCourseTest extends TestCase
{
    use FakesTala;

    private const APPLY = self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses/apply';

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTala();
    }

    private function linked(?array $apply = null): array
    {
        $this->fakeTala([self::APPLY => $apply ? Http::response(...$apply) : Http::response(['ok' => true])]);
        $h = $this->as('crew1');
        $this->link($h)->assertOk();

        return $h;
    }

    private function join(array $h, mixed $code = 'ABC-123')
    {
        return $this->postJson('/api/v1/modules/tala/courses/join', ['code' => $code], $h);
    }

    private function applied(): array
    {
        $bodies = [];
        Http::assertSent(function (Request $r) use (&$bodies) {
            if ($r->method() === 'POST' && $r->url() === self::APPLY) {
                $bodies[] = $r->data();
            }

            return true;
        });

        return $bodies;
    }

    public function test_it_is_off_by_default_and_never_calls_tala_when_off(): void
    {
        $h = $this->linked();

        $this->join($h)->assertStatus(403)->assertJsonPath('code', 'feature_disabled');

        $this->assertSame([], $this->applied());
    }

    public function test_it_sends_only_the_code_for_the_linked_user_and_team_and_never_retries(): void
    {
        config(['sailix.modules.tala.progress_writes' => true]);
        $h = $this->linked();

        // client-supplied ids are ignored
        $this->postJson('/api/v1/modules/tala/courses/join', ['code' => '  ABC-123 ', 'userId' => 'evil', 'teamId' => 'OTHER'], $h)
            ->assertStatus(202)->assertJsonPath('data.status', 'requested');

        $this->assertSame([['courseCode' => 'ABC-123']], $this->applied());
    }

    public function test_a_rejected_code_is_one_message_and_the_code_is_never_audited_or_echoed(): void
    {
        config(['sailix.modules.tala.progress_writes' => true]);
        $h = $this->linked([['message' => 'No such course SECRETCODE'], 404]);

        $r = $this->join($h, 'SECRETCODE')->assertStatus(422)->assertJsonPath('code', 'course_code_rejected');
        $this->assertStringNotContainsString('SECRETCODE', $r->getContent());
        $this->assertStringNotContainsString('SECRETCODE', json_encode(AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())->get()->toArray()));
    }

    public function test_validation_accepts_only_a_plain_code(): void
    {
        config(['sailix.modules.tala.progress_writes' => true]);
        $h = $this->linked();

        foreach ([null, '', 'ab', str_repeat('a', 65), 'has space', '../x', ['a']] as $bad) {
            $this->join($h, $bad)->assertStatus(422);
        }
        $this->assertSame([], $this->applied());
    }

    public function test_upstream_failures_are_mapped(): void
    {
        config(['sailix.modules.tala.progress_writes' => true]);

        $h = $this->linked([['error' => 'x'], 500]);
        $this->join($h)->assertStatus(503)->assertJsonPath('code', 'module_unavailable');

        $h = $this->linked([['error' => 'x'], 401]);
        $this->join($h)->assertStatus(409)->assertJsonPath('code', 'relink_required');
    }

    public function test_it_requires_a_linked_account_and_authentication(): void
    {
        config(['sailix.modules.tala.progress_writes' => true]);
        $this->fakeTala();
        $this->postJson('/api/v1/modules/tala/courses/join', ['code' => 'ABC-123'])->assertStatus(401);
        $this->join($this->as('crew1'))->assertStatus(409)->assertJsonPath('code', 'not_linked');
    }

    public function test_it_is_limited_to_ten_an_hour(): void
    {
        config(['sailix.modules.tala.progress_writes' => true]);
        $h = $this->linked([['error' => 'x'], 404]);
        for ($i = 0; $i < 10; $i++) {
            $this->join($h)->assertStatus(422);
        }
        $this->join($h)->assertStatus(429);
    }
}
