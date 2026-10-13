<?php

namespace Tests\Feature;

use App\Models\ModuleLink;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakesTala;
use Tests\TestCase;

/** Quizzes through the gateway: questions without answers, server-side scoring, result written to Tala (faked here). */
class TalaQuizGatewayTest extends TestCase
{
    use FakesTala;

    private const SYNC = self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses/sync';

    private const QUIZ_URL = self::BASE.'/api/v1/auth/users/teams/TEAM-1/up_quizzes/q1';

    private const SNAPSHOT_URL = self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses/C1/sync/A1/data';

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTala();
    }

    private function quiz(array $over = []): array
    {
        return $over + [
            'quizId' => 'q1', 'quizName' => 'Final quiz', 'quizDescription' => 'd', 'quizPercentage' => '70', 'tags' => '',
            'arraySection' => [['sectionId' => 's1', 'sectionTitle' => 'Part 1', 'pagePerSection' => '1', 'data' => [
                ['questionType' => 'multipleChoice', 'numQuestion' => '1', 'question' => 'Which colour is a lifebuoy?', 'answer' => '1', 'choices' => 'blue:orange:green:black', 'required' => 'true'],
                ['questionType' => 'multipleChoice', 'numQuestion' => '2', 'question' => 'Pick the safe action', 'answer' => '3', 'choices' => 'run:hide:wait:call', 'required' => 'true'],
            ]]],
        ];
    }

    private function fakeAll(array $quiz = [], array $snapshot = [], array $overrides = []): void
    {
        $base = [
            'assignId' => 'A1', 'courseId' => 'C1', 'courseName' => 'Safety at sea', 'userId' => self::TALA_USER, 'teamId' => 'TEAM-1',
            'firstName' => 'Maria', 'status' => 'NOT YET COMPLETED', 'progress' => '1/5',
            'materials' => [
                'videos' => [['videoId' => 'v1', 'status' => 'COMPLETED', 'comment' => 'kept']],
                'pdfs' => [], 'cards' => [], 'epubs' => [],
                'quizzes' => [['quizId' => 'q-other', 'status' => 'COMPLETED', 'correct' => 4]],
            ],
        ];
        $this->fakeTala($overrides + [
            self::QUIZ_URL => Http::response($this->quiz($quiz)),
            self::SYNC => Http::response(['message' => 'ok']),
            self::SNAPSHOT_URL => Http::response(array_replace_recursive($base, $snapshot)),
        ]);
    }

    private function ready(bool $writes = true): array
    {
        config(['sailix.modules.tala.progress_writes' => $writes]);
        $this->fakeTala();
        $h = $this->as('crew1');
        $this->link($h)->assertOk();

        return $h;
    }

    private function attempt(array $h, array $answers, ?string $version = null, string $quizId = 'q1', string $assign = 'A1')
    {
        return $this->postJson("/api/v1/modules/tala/courses/$assign/quizzes/$quizId/attempts", ['version' => $version, 'answers' => $answers], $h);
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

    public function test_quizzes_are_closed_while_writes_are_off_and_never_reach_tala(): void
    {
        $h = $this->ready(writes: false);
        $this->fakeAll();

        $this->getJson('/api/v1/modules/tala/courses/A1/quizzes/q1', $h)->assertStatus(403)->assertJsonPath('code', 'feature_disabled');
        $this->attempt($h, [['ref' => '0.0', 'value' => '1']])->assertStatus(403);
        $quiz = collect($this->getJson('/api/v1/modules/tala/courses/A1', $h)->json('data.materials'))->firstWhere('type', 'quiz');
        $this->assertFalse($quiz['viewable']);

        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), 'up_quizzes') || $r->method() === 'POST');
    }

    public function test_questions_are_delivered_without_any_answer(): void
    {
        $h = $this->ready();
        $this->fakeAll();

        $quiz = collect($this->getJson('/api/v1/modules/tala/courses/A1', $h)->json('data.materials'))->firstWhere('type', 'quiz');
        $this->assertTrue($quiz['viewable']);

        $r = $this->getJson('/api/v1/modules/tala/courses/A1/quizzes/q1', $h)->assertOk();
        $this->assertSame(['0.0', '0.1'], array_column($r->json('data.sections.0.questions'), 'ref'));
        $this->assertSame(['blue', 'orange', 'green', 'black'], $r->json('data.sections.0.questions.0.choices'));
        $this->assertStringNotContainsString('answer', strtolower($r->getContent()));
        $this->assertNotEmpty($r->json('data.version'));
        $this->assertSame([], $this->posted());
    }

    public function test_the_server_scores_ignores_client_scores_and_writes_the_result_into_tala_own_snapshot(): void
    {
        $h = $this->ready();
        $this->fakeAll();
        $version = $this->getJson('/api/v1/modules/tala/courses/A1/quizzes/q1', $h)->json('data.version');

        $r = $this->postJson('/api/v1/modules/tala/courses/A1/quizzes/q1/attempts', [
            'version' => $version,
            'answers' => [['ref' => '0.0', 'value' => '1'], ['ref' => '0.1', 'value' => '0']],
            'score' => 100, 'correct' => 2, 'result' => 'PASSED', 'status' => 'COMPLETED', 'userId' => 'EVIL',
        ], $h)->assertOk();

        $this->assertSame(['correct' => 1, 'wrong' => 1, 'total' => 2, 'average' => 50, 'passed' => false], $r->json('data') ? array_intersect_key($r->json('data'), array_flip(['correct', 'wrong', 'total', 'average', 'passed'])) : []);
        $this->assertSame('3/5', $r->json('data.progress'));   // completed items: the video, the other quiz, and this quiz
        // totals only: not one answer, not which question was wrong
        foreach (['"answer"', 'orange', 'call', '0.0'] as $leak) {
            $this->assertStringNotContainsString($leak, $r->getContent());
        }

        $item = $this->posted()[0]['courseList'][0];
        $rows = collect($item['materials']['quizzes'])->keyBy('quizId');
        $this->assertSame(['q-other', 'q1'], $rows->keys()->all());           // the other stored quiz is preserved
        $this->assertSame(4, $rows['q-other']['correct']);
        $this->assertSame('COMPLETED', $rows['q1']['status']);
        $this->assertSame([1, 1, 50.0, 'FAILED'], [$rows['q1']['correct'], $rows['q1']['wrong'], $rows['q1']['average'], $rows['q1']['remarks']]);
        $this->assertSame(['CORRECT', 'WRONG'], array_column($rows['q1']['sections'][0]['data'], 'result'));
        $this->assertSame(['orange', 'run'], array_column($rows['q1']['sections'][0]['data'], 'userAnswer'));
        $this->assertSame('kept', $item['materials']['videos'][0]['comment']);
        $this->assertStringNotContainsString('EVIL', json_encode($item));
        $this->assertSame(self::TALA_USER, $item['userId']);
    }

    public function test_a_retake_replaces_the_stored_attempt_and_a_perfect_score_passes(): void
    {
        $h = $this->ready();
        $this->fakeAll(snapshot: ['materials' => ['quizzes' => [['quizId' => 'q-other', 'status' => 'COMPLETED', 'correct' => 4], ['quizId' => 'q1', 'status' => 'COMPLETED', 'correct' => 0, 'wrong' => 2]]]]);

        $r = $this->attempt($h, [['ref' => '0.0', 'value' => '1'], ['ref' => '0.1', 'value' => '3']])->assertOk();

        $this->assertSame([2, 0, 100, true], [$r->json('data.correct'), $r->json('data.wrong'), $r->json('data.average'), $r->json('data.passed')]);
        $quizzes = $this->posted()[0]['courseList'][0]['materials']['quizzes'];
        $this->assertCount(2, $quizzes);                                       // q-other + q1 (replaced, not appended)
        $this->assertSame(2, collect($quizzes)->firstWhere('quizId', 'q1')['correct']);
    }

    public function test_bad_requests_are_refused_before_anything_is_written(): void
    {
        $h = $this->ready();
        $this->fakeAll();

        $this->attempt($h, [['ref' => '0.0', 'value' => '1']])->assertStatus(422)->assertJsonPath('code', 'incomplete_answers');
        $this->attempt($h, [['ref' => '0.0', 'value' => '1'], ['ref' => '0.1', 'value' => '9']])->assertStatus(422)->assertJsonPath('code', 'invalid_answers');
        $this->attempt($h, [['ref' => '0.0', 'value' => '1'], ['ref' => '0.0', 'value' => '1']])->assertStatus(422);
        $this->postJson('/api/v1/modules/tala/courses/A1/quizzes/q1/attempts', ['answers' => [['ref' => '0.0', 'value' => '1', 'score' => 100]]], $h)->assertStatus(422); // extra key inside an answer
        $this->postJson('/api/v1/modules/tala/courses/A1/quizzes/q1/attempts', ['answers' => [['ref' => '../x', 'value' => '1']]], $h)->assertStatus(422);
        $this->postJson('/api/v1/modules/tala/courses/A1/quizzes/q1/attempts', [], $h)->assertStatus(422);
        $this->attempt($h, [['ref' => '0.0', 'value' => '1'], ['ref' => '0.1', 'value' => '3']], 'stale-version')->assertStatus(409)->assertJsonPath('code', 'quiz_changed');
        $this->attempt($h, [['ref' => '0.0', 'value' => '1']], null, 'not-a-quiz')->assertStatus(404);
        $this->attempt($h, [['ref' => '0.0', 'value' => '1']], null, 'v1')->assertStatus(404);          // a video id is not a quiz
        $this->attempt($h, [['ref' => '0.0', 'value' => '1']], null, 'q1', 'NOT-MINE')->assertStatus(404);

        $this->assertSame([], $this->posted());
    }

    public function test_a_quiz_that_cannot_be_scored_with_certainty_is_refused(): void
    {
        $h = $this->ready();
        $broken = $this->quiz();
        $broken['arraySection'][0]['data'][0]['answer'] = '4'; // 1-based style key: not scored on a guess
        $this->fakeAll($broken);

        $this->getJson('/api/v1/modules/tala/courses/A1/quizzes/q1', $h)->assertStatus(422)->assertJsonPath('code', 'unsupported_quiz');
        $this->attempt($h, [['ref' => '0.0', 'value' => '1'], ['ref' => '0.1', 'value' => '3']])->assertStatus(422)->assertJsonPath('code', 'unsupported_quiz');
        $this->assertSame([], $this->posted());
    }

    public function test_upstream_failures_and_concurrency_are_handled_and_attempts_are_throttled(): void
    {
        $h = $this->ready();
        $answers = [['ref' => '0.0', 'value' => '1'], ['ref' => '0.1', 'value' => '3']];

        $this->fakeAll(overrides: [self::SYNC => Http::response('boom', 500)]);
        $this->attempt($h, $answers)->assertStatus(503)->assertJsonPath('code', 'module_unavailable');
        $this->assertCount(1, $this->posted()); // one attempt, never retried

        $this->fakeAll(overrides: [self::SYNC => Http::response([], 401)]);
        $this->attempt($h, $answers)->assertStatus(409)->assertJsonPath('code', 'relink_required');
        $this->assertSame('needs_relink', ModuleLink::withoutTenantScope()->firstOrFail()->status->value);
    }

    public function test_quiz_attempts_are_limited_to_ten_per_hour_per_quiz(): void
    {
        $h = $this->ready();
        $this->fakeAll();
        $answers = [['ref' => '0.0', 'value' => '1'], ['ref' => '0.1', 'value' => '3']];

        for ($i = 0; $i < 10; $i++) {
            $this->attempt($h, $answers)->assertOk();
        }
        $this->attempt($h, $answers)->assertStatus(429);
    }
}
