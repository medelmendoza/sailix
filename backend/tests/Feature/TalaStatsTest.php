<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\Support\FakesTala;
use Tests\TestCase;

/** My Stats and due dates: what the gateway derives from Tala's course list and stored rows (formats observed in T0g). */
class TalaStatsTest extends TestCase
{
    use FakesTala;

    private const U = self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1';

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTala();
    }

    private function assignment(string $id, array $over = [], int $total = 4): array
    {
        return array_replace([
            'assignId' => $id, 'courseId' => "C-$id", 'dateFrom' => '2026-01-01', 'dateTo' => '2026-12-31', 'status' => 'NOT YET COMPLETED', 'progress' => '1/4',
            'course' => ['courseName' => "Course $id", 'totalMaterial' => (string) $total, 'materialDetails' => [
                ['materialId' => 'v1', 'materialType' => 'video', 'materialName' => 'Video'],
                ['materialId' => 'p1', 'materialType' => 'pdf', 'materialName' => 'Doc'],
                ['materialId' => 'q1', 'materialType' => 'up_quiz', 'materialName' => 'Quiz'],
                ['materialId' => 'c1', 'materialType' => 'up_card', 'materialName' => 'Cards'],
            ]],
        ], $over);
    }

    private function courses(array $list): array
    {
        $this->fakeTala([self::U.'/courses' => Http::response($list)]);
        $h = $this->as('crew1');
        $this->link($h)->assertOk();

        return collect($this->getJson('/api/v1/modules/tala/courses', $h)->assertOk()->json('data'))->keyBy('id')->all();
    }

    public function test_progress_dates_and_state_are_derived_from_what_tala_actually_returns(): void
    {
        $c = $this->courses([
            $this->assignment('A1'),                                                                            // 1/4 in progress
            $this->assignment('A2', ['status' => 'INACTIVE', 'progress' => null]),                              // never started
            $this->assignment('A3', ['status' => 'COMPLETED', 'progress' => '4/4']),
            $this->assignment('A4', ['progress' => '9/4']),                                                    // more than the total: clamped
            $this->assignment('A5', ['progress' => 'garbage', 'dateTo' => '31/12/2026', 'dateFrom' => '2026-02-30']), // not guessed at
            $this->assignment('A6', ['progress' => '0/4']),
        ]);

        $this->assertSame([1, 4, 25, 'in_progress', '2026-12-31'], [$c['A1']['completed'], $c['A1']['total'], $c['A1']['percent'], $c['A1']['state'], $c['A1']['date_to']]);
        $this->assertSame([0, 4, 0, 'not_started', 'INACTIVE', null], [$c['A2']['completed'], $c['A2']['total'], $c['A2']['percent'], $c['A2']['state'], $c['A2']['status'], $c['A2']['progress']]);
        $this->assertSame([4, 100, 'completed'], [$c['A3']['completed'], $c['A3']['percent'], $c['A3']['state']]);
        $this->assertSame([9, 100], [$c['A4']['completed'], $c['A4']['percent']]);
        $this->assertSame([0, 4, 0, null, null], [$c['A5']['completed'], $c['A5']['total'], $c['A5']['percent'], $c['A5']['date_to'], $c['A5']['date_from']]);
        $this->assertSame('not_started', $c['A6']['state']);
    }

    public function test_a_course_without_a_total_does_not_divide_by_zero(): void
    {
        $c = $this->courses([$this->assignment('A1', ['progress' => null, 'status' => 'INACTIVE'], total: 0)]);
        $this->assertSame([0, 0, 0], [$c['A1']['completed'], $c['A1']['total'], $c['A1']['percent']]);
    }

    public function test_material_stats_come_from_tala_stored_rows(): void
    {
        $this->fakeTala([
            self::U.'/courses' => Http::response([$this->assignment('A1')]),
            self::U.'/courses/C-A1/sync/A1/data' => Http::response(['materials' => [
                'videos' => [['videoId' => 'v1', 'status' => 'COMPLETED', 'feedback' => 4.5, 'comment' => 'private text']],
                'quizzes' => [['quizId' => 'q1', 'status' => 'COMPLETED', 'correct' => 8, 'wrong' => 2, 'average' => 80.004, 'remarks' => 'PASSED']],
                'cards' => [['cardId' => 'c1', 'status' => 'COMPLETED', 'easy' => 5, 'medium' => 7, 'hard' => 8, 'notseen' => 0]],
                'pdfs' => [['pdfId' => 'p1', 'status' => 'COMPLETED']],
            ]]),
        ]);
        config(['sailix.modules.tala.progress_writes' => true]);
        $h = $this->as('crew1');
        $this->link($h)->assertOk();

        $r = $this->getJson('/api/v1/modules/tala/courses/A1', $h)->assertOk();
        $m = collect($r->json('data.materials'))->keyBy('id');

        $this->assertSame(['rating' => 4.5], $m['v1']['stats']);
        $this->assertEquals(['correct' => 8, 'wrong' => 2, 'average' => 80, 'remarks' => 'PASSED'], $m['q1']['stats']); // 80.004 rounded; JSON has no 80.0
        $this->assertSame(['easy' => 5, 'medium' => 7, 'hard' => 8, 'notseen' => 0], $m['c1']['stats']);
        $this->assertNull($m['p1']['stats']);
        $this->assertSame('COMPLETED', $m['c1']['status']);          // flashcard sets now report their stored status too
        $this->assertStringNotContainsString('private text', $r->getContent()); // comments are never echoed
    }

    public function test_stats_are_empty_where_nothing_is_stored_and_tolerate_odd_values(): void
    {
        $this->fakeTala([
            self::U.'/courses' => Http::response([$this->assignment('A1')]),
            self::U.'/courses/C-A1/sync/A1/data' => Http::response(['materials' => [
                'videos' => [['videoId' => 'v1', 'feedback' => 0.0]],                                   // default 0.0 = no rating given
                'quizzes' => [['quizId' => 'q1', 'correct' => 'x', 'wrong' => -3, 'average' => 'n/a', 'remarks' => 'MAYBE']],
            ]]),
        ]);
        $h = $this->as('crew1');
        $this->link($h)->assertOk();

        $m = collect($this->getJson('/api/v1/modules/tala/courses/A1', $h)->assertOk()->json('data.materials'))->keyBy('id');
        $this->assertSame(['rating' => null], $m['v1']['stats']);
        $this->assertSame(['correct' => 0, 'wrong' => 0, 'average' => null, 'remarks' => null], $m['q1']['stats']);
        $this->assertNull($m['p1']['stats']);
        $this->assertNull($m['c1']['stats']);
    }

    public function test_a_never_synced_course_shows_empty_stats_not_an_error(): void
    {
        $this->fakeTala([
            self::U.'/courses' => Http::response([$this->assignment('A1', ['status' => 'INACTIVE', 'progress' => null])]),
            self::U.'/courses/C-A1/sync/A1/data' => Http::response(['message' => 'nf'], 404),
        ]);
        $h = $this->as('crew1');
        $this->link($h)->assertOk();

        $d = $this->getJson('/api/v1/modules/tala/courses/A1', $h)->assertOk();
        $this->assertSame('not_started', $d->json('data.state'));
        $this->assertSame([null, null, null, null], array_column($d->json('data.materials'), 'stats'));
    }
}
