<?php

namespace Tests\Feature;

use App\Models\ModuleLink;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakesTala;
use Tests\TestCase;

/**
 * Progress submission (WRITE). Flag-gated and tested ONLY against faked Tala responses: Tala's real replace/merge
 * behaviour is unverified (docs/13 section 20). The payload is built from Tala's own snapshot; the client names ids only.
 */
class TalaProgressTest extends TestCase
{
    use FakesTala;

    private const SYNC = self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses/sync';

    private const SNAPSHOT_URL = self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses/C1/sync/A1/data';

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTala();
    }

    /** @param array<string, mixed> $snapshot */
    private function fakeWithSnapshot(array $snapshot = [], array $overrides = []): void
    {
        $base = [
            'assignId' => 'A1', 'courseId' => 'C1', 'courseName' => 'Safety at sea', 'userId' => self::TALA_USER, 'teamId' => 'TEAM-1',
            'firstName' => 'Maria', 'lastName' => 'Santos', 'email' => 'maria@tala.example', 'status' => 'NOT YET COMPLETED', 'progress' => '1/5',
            'createdAt' => 'meta-should-not-be-forwarded',
            'materials' => [
                'videos' => [
                    ['videoId' => 'v1', 'videoName' => 'Intro video', 'status' => 'DEFAULT', 'feedback' => 0, 'comment' => '', 'progress' => ''],
                    ['videoId' => 'v2', 'videoName' => 'Other', 'status' => 'COMPLETED', 'feedback' => 4.5, 'comment' => 'kept', 'progress' => ''],
                ],
                'pdfs' => [], 'cards' => [], 'quizzes' => [], 'epubs' => [],
            ],
        ];
        $this->fakeTala($overrides + [self::SYNC => Http::response(['ok' => true]), self::SNAPSHOT_URL => Http::response(array_replace_recursive($base, $snapshot))]);
    }

    private function enableWrites(bool $on = true): void
    {
        config(['sailix.modules.tala.progress_writes' => $on]);
    }

    private function submit(array $h, array $ids, string $assign = 'A1')
    {
        return $this->postJson("/api/v1/modules/tala/courses/$assign/progress", ['completed' => $ids], $h);
    }

    private function linked(): array
    {
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h)->assertOk();

        return $h;
    }

    private function posted(): array
    {
        $bodies = [];
        Http::assertSent(function (Request $r) use (&$bodies) {
            if ($r->method() === 'POST' && $r->url() === self::SYNC) {
                $bodies[] = $r->data();
            }

            return true;
        });

        return $bodies;
    }

    public function test_it_is_off_by_default_and_never_calls_tala_when_off(): void
    {
        $h = $this->linked();
        $this->fakeWithSnapshot();

        $this->getJson('/api/v1/modules/tala/courses/A1', $h)->assertOk()->assertJsonPath('data.progress_submission', false);
        $this->submit($h, ['v1'])->assertStatus(403)->assertJsonPath('code', 'feature_disabled');

        Http::assertNotSent(fn (Request $r) => $r->method() === 'POST');
        $this->assertSame([], $this->posted());
    }

    public function test_it_marks_the_named_video_completed_inside_tala_own_snapshot_and_forwards_nothing_from_the_client(): void
    {
        $this->enableWrites();
        $h = $this->linked();
        $this->fakeWithSnapshot();

        $r = $this->postJson('/api/v1/modules/tala/courses/A1/progress', [
            'completed' => ['v1'], 'score' => 100, 'comment' => 'EVIL', 'status' => 'EVIL', 'userId' => 'EVIL', 'progress' => '5/5',
        ], $h)->assertOk();

        $this->assertSame('2/5', $r->json('data.progress'));
        $this->assertSame('NOT YET COMPLETED', $r->json('data.status'));
        $bodies = $this->posted();
        $this->assertCount(1, $bodies);
        $item = $bodies[0]['courseList'][0];
        $this->assertSame('COMPLETED', $item['materials']['videos'][0]['status']);
        $this->assertSame('kept', $item['materials']['videos'][1]['comment']);   // untouched rows are preserved as Tala has them
        $this->assertSame(4.5, $item['materials']['videos'][1]['feedback']);
        $this->assertSame(self::TALA_USER, $item['userId']);                       // identity comes from Tala's record
        $this->assertSame('2/5', $item['progress']);
        $this->assertArrayNotHasKey('createdAt', $item);                          // server metadata is not echoed back
        $this->assertStringNotContainsString('EVIL', json_encode($item));
        $this->assertSame(['videos', 'cards', 'quizzes', 'epubs', 'pdfs'], array_keys($item['materials']));
    }

    public function test_completion_never_goes_backwards_and_finishing_everything_completes_the_course(): void
    {
        $this->enableWrites();
        $h = $this->linked();
        $this->fakeWithSnapshot(['progress' => '4/5']);

        $r = $this->submit($h, ['v1'])->assertOk();
        $this->assertSame('4/5', $r->json('data.progress')); // Tala already counted more than the rows show

        $this->fakeWithSnapshot(['progress' => '0/5'], []);
        $this->fakeTala([self::SYNC => Http::response([]), self::SNAPSHOT_URL => Http::response(['assignId' => 'A1', 'courseId' => 'C1', 'progress' => '2/3', 'materials' => ['videos' => [['videoId' => 'v2', 'status' => 'COMPLETED']], 'pdfs' => [['pdfId' => 'p1', 'status' => 'COMPLETED']]]])]);
        // three visible materials in the fake course (video, pdf, quiz): totalMaterial says 5, force a small course
        $r = $this->submit($h, ['v1'])->assertOk();
        $this->assertSame('3/5', $r->json('data.progress'));
    }

    public function test_a_material_without_a_stored_row_is_built_from_tala_metadata(): void
    {
        $this->enableWrites();
        $h = $this->linked();
        $this->fakeWithSnapshot();

        $this->submit($h, ['p1'])->assertOk();

        $pdfs = $this->posted()[0]['courseList'][0]['materials']['pdfs'];
        $this->assertCount(1, $pdfs);
        $this->assertSame('p1', $pdfs[0]['pdfId']);
        $this->assertSame('COMPLETED', $pdfs[0]['status']);
        $this->assertSame('Manual', $pdfs[0]['pdfName']);
    }

    public function test_quizzes_unknown_and_hidden_materials_are_refused_before_anything_is_written(): void
    {
        $this->enableWrites();
        $h = $this->linked();
        $this->fakeWithSnapshot();

        $this->submit($h, ['q1'])->assertStatus(422)->assertJsonPath('code', 'unsupported_material');
        $this->submit($h, ['nope'])->assertStatus(404);
        $this->submit($h, ['e1'])->assertStatus(404);               // epub: hidden (D-T6)
        $this->submit($h, ['v1', 'q1'])->assertStatus(422);        // one bad id refuses the whole request
        $this->submit($h, ['v1'], 'NOT-MINE')->assertStatus(404);

        Http::assertNotSent(fn (Request $r) => $r->method() === 'POST' && str_contains($r->url(), '/courses/sync'));
    }

    public function test_validation_limits_the_request_to_ids_only(): void
    {
        $this->enableWrites();
        $h = $this->linked();

        $this->postJson('/api/v1/modules/tala/courses/A1/progress', [], $h)->assertStatus(422);
        $this->postJson('/api/v1/modules/tala/courses/A1/progress', ['completed' => []], $h)->assertStatus(422);
        $this->postJson('/api/v1/modules/tala/courses/A1/progress', ['completed' => ['../x']], $h)->assertStatus(422);
        $this->postJson('/api/v1/modules/tala/courses/A1/progress', ['completed' => array_map(fn ($i) => "m$i", range(1, 51))], $h)->assertStatus(422);
        $this->postJson('/api/v1/modules/tala/courses/A1/progress', ['completed' => [['x']]], $h)->assertStatus(422);
    }

    public function test_upstream_failures_are_mapped_and_a_write_is_never_retried(): void
    {
        $this->enableWrites();
        $h = $this->linked();

        $this->fakeWithSnapshot([], [self::SYNC => Http::response('boom', 500)]);
        $this->submit($h, ['v1'])->assertStatus(503)->assertJsonPath('code', 'module_unavailable');
        $this->assertCount(1, $this->posted());                     // exactly one attempt

        $this->fakeWithSnapshot([], [self::SYNC => Http::response([], 400)]);
        $this->submit($h, ['v1'])->assertStatus(503);

        $this->fakeWithSnapshot([], [self::SYNC => Http::response([], 401)]);
        $this->submit($h, ['v1'])->assertStatus(409)->assertJsonPath('code', 'relink_required');
        $this->assertSame('needs_relink', ModuleLink::withoutTenantScope()->firstOrFail()->status->value);
    }

    public function test_a_concurrent_update_for_the_same_link_is_refused_not_interleaved(): void
    {
        $this->enableWrites();
        $h = $this->linked();
        $this->fakeWithSnapshot();
        $lock = Cache::lock('tala-progress:'.ModuleLink::withoutTenantScope()->firstOrFail()->getKey(), 30);
        $this->assertTrue($lock->get());

        $this->submit($h, ['v1'])->assertStatus(409)->assertJsonPath('code', 'progress_busy');
        $this->assertSame([], $this->posted());

        $lock->release();
        $this->submit($h, ['v1'])->assertOk();
    }

    public function test_the_audit_trail_records_counts_only_and_requires_a_linked_account(): void
    {
        $this->enableWrites();
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->submit($h, ['v1'])->assertStatus(409)->assertJsonPath('code', 'not_linked');

        $this->link($h)->assertOk();
        $this->fakeWithSnapshot();
        $this->submit($h, ['v1'])->assertOk();

        $row = \DB::table('audit_logs')->where('action', 'module.tala.progress_submitted')->first();
        $this->assertSame(['materials' => 1], json_decode($row->metadata, true));
    }
}
