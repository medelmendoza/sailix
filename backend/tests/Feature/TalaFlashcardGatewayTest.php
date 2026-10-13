<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakesTala;
use Tests\TestCase;

/** Flashcards through the gateway (write path faked) and video feedback on completion. */
class TalaFlashcardGatewayTest extends TestCase
{
    use FakesTala;

    private const U = self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1';

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTala();
    }

    private function deck(): array
    {
        return ['cardId' => 'c1', 'cardName' => 'Knots', 'cardDescription' => 'd', 'cardThumbnailUrl' => '', 'tags' => '', 'data' => [
            ['tags' => '', 'question' => 'Bowline?', 'questionMediaType' => 'image', 'questionMediaUploaded' => 'https://cdn.example.com/b.png', 'answer' => 'Rescue loop', 'answerMediaType' => '', 'answerMediaUploaded' => ''],
            ['tags' => '', 'question' => 'Reef knot?', 'questionMediaType' => '', 'questionMediaUploaded' => '', 'answer' => 'Joins two ropes', 'answerMediaType' => '', 'answerMediaUploaded' => ''],
        ]];
    }

    private function fakeAll(array $snapshot = [], array $overrides = []): void
    {
        $assignment = ['assignId' => 'A1', 'courseId' => 'C1', 'status' => 'ongoing', 'progress' => '0/3', 'course' => ['courseName' => 'Seamanship', 'totalMaterial' => '3', 'materialDetails' => [
            ['materialId' => 'c1', 'materialType' => 'up_card', 'materialName' => 'Knots'],
            ['materialId' => 'v1', 'materialType' => 'video', 'materialName' => 'Intro'],
            ['materialId' => 'v2', 'materialType' => 'video', 'materialName' => 'Second'],
        ]]];
        $base = ['assignId' => 'A1', 'courseId' => 'C1', 'userId' => self::TALA_USER, 'teamId' => 'TEAM-1', 'status' => 'NOT YET COMPLETED', 'progress' => '0/3',
            'materials' => ['videos' => [['videoId' => 'v1', 'videoName' => 'Intro', 'status' => 'DEFAULT', 'feedback' => 0, 'comment' => 'N/A']], 'cards' => [], 'quizzes' => [], 'epubs' => [], 'pdfs' => []]];
        $this->fakeTala($overrides + [
            self::U.'/courses' => Http::response([$assignment]),
            self::U.'/courses/C1/sync/A1/data' => Http::response(array_replace_recursive($base, $snapshot)),
            self::BASE.'/api/v1/auth/users/teams/TEAM-1/upgraded_cards/c1' => Http::response($this->deck()),
            self::BASE.'/api/v1/auth/users/teams/TEAM-1/videos/v2' => Http::response(['videoName' => 'Second', 'videoFileUrl' => 'https://f.example.com/v2.mp4']),
            self::U.'/courses/sync' => Http::response(['message' => 'ok']),
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

    private function posted(): array
    {
        $b = [];
        Http::assertSent(function (Request $r) use (&$b) {
            if ($r->method() === 'POST' && $r->url() === self::U.'/courses/sync') {
                $b[] = $r->data();
            }

            return true;
        });

        return $b;
    }

    private function rate(array $h, array $ratings, ?string $version = null, string $card = 'c1')
    {
        return $this->postJson("/api/v1/modules/tala/courses/A1/flashcards/$card/ratings", ['version' => $version, 'ratings' => $ratings], $h);
    }

    public function test_flashcards_are_closed_while_writes_are_off(): void
    {
        $h = $this->ready(writes: false);
        $this->fakeAll();

        $this->getJson('/api/v1/modules/tala/courses/A1/flashcards/c1', $h)->assertStatus(403)->assertJsonPath('code', 'feature_disabled');
        $this->rate($h, [['index' => 0, 'rating' => 'easy'], ['index' => 1, 'rating' => 'hard']])->assertStatus(403);
        $set = collect($this->getJson('/api/v1/modules/tala/courses/A1', $h)->json('data.materials'))->firstWhere('type', 'flashcards');
        $this->assertFalse($set['viewable']);
        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), 'upgraded_cards'));
    }

    public function test_the_deck_is_delivered_and_resumes_earlier_ratings(): void
    {
        $h = $this->ready();
        $this->fakeAll(['materials' => ['cards' => [['cardId' => 'c1', 'data' => [['result' => 'HARD'], ['result' => 'NOT SEEN']]]]]]);

        $set = collect($this->getJson('/api/v1/modules/tala/courses/A1', $h)->json('data.materials'))->firstWhere('type', 'flashcards');
        $this->assertTrue($set['viewable']);

        $r = $this->getJson('/api/v1/modules/tala/courses/A1/flashcards/c1', $h)->assertOk();
        $this->assertSame(['Bowline?', 'Reef knot?'], array_column($r->json('data.cards'), 'question'));
        $this->assertSame(['hard', null], array_column($r->json('data.cards'), 'rating'));
        $this->assertSame('https://cdn.example.com/b.png', $r->json('data.cards.0.question_media.url'));
        $this->assertSame([], $this->posted());
    }

    public function test_a_complete_set_of_ratings_is_written_as_tala_row_and_other_rows_are_kept(): void
    {
        $h = $this->ready();
        $this->fakeAll(['materials' => ['videos' => [['videoId' => 'v1', 'status' => 'COMPLETED', 'comment' => 'kept']]]]);
        $version = $this->getJson('/api/v1/modules/tala/courses/A1/flashcards/c1', $h)->json('data.version');

        $r = $this->postJson('/api/v1/modules/tala/courses/A1/flashcards/c1/ratings', [
            'version' => $version, 'ratings' => [['index' => 1, 'rating' => 'hard'], ['index' => 0, 'rating' => 'easy']],
        ], $h)->assertOk();

        $this->assertSame([1, 0, 1], [$r->json('data.easy'), $r->json('data.medium'), $r->json('data.hard')]);
        $this->assertSame('2/3', $r->json('data.progress'));   // the video + the set
        $item = $this->posted()[0]['courseList'][0];
        $row = $item['materials']['cards'][0];
        $this->assertSame(['COMPLETED', 0, 1, 0, 1], [$row['status'], $row['notseen'], $row['easy'], $row['medium'], $row['hard']]);
        $this->assertSame(['EASY', 'HARD'], array_column($row['data'], 'result'));
        $this->assertSame('Bowline?', $row['data'][0]['question']);
        $this->assertSame('kept', $item['materials']['videos'][0]['comment']);
    }

    public function test_incomplete_invalid_stale_and_unknown_requests_write_nothing(): void
    {
        $h = $this->ready();
        $this->fakeAll();
        $all = [['index' => 0, 'rating' => 'easy'], ['index' => 1, 'rating' => 'hard']];

        $this->rate($h, [$all[0]])->assertStatus(422)->assertJsonPath('code', 'incomplete_ratings');
        $this->rate($h, [$all[0], ['index' => 1, 'rating' => 'meh']])->assertStatus(422);                  // request validation
        $this->rate($h, [$all[0], ['index' => 0, 'rating' => 'hard']])->assertStatus(422)->assertJsonPath('code', 'invalid_ratings');
        $this->rate($h, $all, 'stale')->assertStatus(409)->assertJsonPath('code', 'deck_changed');
        $this->rate($h, $all, null, 'v1')->assertStatus(404);                                            // a video id is not a deck
        $this->rate($h, $all, null, 'nope')->assertStatus(404);
        $this->postJson('/api/v1/modules/tala/courses/A1/flashcards/c1/ratings', ['ratings' => [['index' => 0, 'rating' => 'easy', 'result' => 'EASY']]], $h)->assertStatus(422); // extra key
        $this->postJson('/api/v1/modules/tala/courses/A1/flashcards/c1/ratings', [], $h)->assertStatus(422);

        $this->assertSame([], $this->posted());
    }

    public function test_video_feedback_is_stored_with_the_completion(): void
    {
        $h = $this->ready();
        $this->fakeAll();

        $this->postJson('/api/v1/modules/tala/courses/A1/progress', [
            'completed' => ['v1', 'v2'],
            'feedback' => ['v1' => ['rating' => 4.5, 'comment' => "  Great\x00 video\x07  "], 'v2' => ['rating' => 3]],
        ], $h)->assertOk();

        $videos = collect($this->posted()[0]['courseList'][0]['materials']['videos'])->keyBy('videoId');
        $this->assertSame([4.5, 'Great video', 'COMPLETED'], [$videos['v1']['feedback'], $videos['v1']['comment'], $videos['v1']['status']]);
        $this->assertSame([3.0, 'N/A', 'COMPLETED'], [$videos['v2']['feedback'], $videos['v2']['comment'], $videos['v2']['status']]); // a new row gets the Tala default comment
    }

    public function test_invalid_feedback_is_refused_before_anything_is_written(): void
    {
        $h = $this->ready();
        $this->fakeAll();
        $post = fn (array $body) => $this->postJson('/api/v1/modules/tala/courses/A1/progress', $body, $h);

        $post(['completed' => ['v1'], 'feedback' => ['v1' => ['rating' => 0.5]]])->assertStatus(422);              // below 1
        $post(['completed' => ['v1'], 'feedback' => ['v1' => ['rating' => 5.5]]])->assertStatus(422);
        $post(['completed' => ['v1'], 'feedback' => ['v1' => ['rating' => 3.3]]])->assertStatus(422)->assertJsonPath('code', 'invalid_feedback'); // not a half step
        $post(['completed' => ['v1'], 'feedback' => ['v2' => ['rating' => 3]]])->assertStatus(422)->assertJsonPath('code', 'invalid_feedback');   // not being completed
        $post(['completed' => ['v1'], 'feedback' => ['c1' => ['rating' => 3]]])->assertStatus(422);                  // not a video
        $post(['completed' => ['v1'], 'feedback' => ['v1' => ['rating' => 3, 'score' => 9]]])->assertStatus(422);    // unknown key
        $post(['completed' => ['v1'], 'feedback' => ['v1' => ['rating' => 3, 'comment' => str_repeat('x', 1001)]]])->assertStatus(422);
        $post(['completed' => ['c1']])->assertStatus(422)->assertJsonPath('code', 'unsupported_material');             // decks have their own endpoint

        $this->assertSame([], $this->posted());
    }

    public function test_a_course_the_user_never_synced_works_end_to_end(): void
    {
        // Tala answers 404 for the stored progress of a never-synced course (observed live): not an outage.
        $h = $this->ready();
        $this->fakeAll(overrides: [self::U.'/courses/C1/sync/A1/data' => Http::response(['message' => 'not found'], 404)]);
        $assignment = ['assignId' => 'A1', 'courseId' => 'C1', 'userId' => self::TALA_USER, 'teamId' => 'TEAM-1', 'firstName' => 'Maria', 'lastName' => 'Santos', 'email' => 'm@t.example', 'dateFrom' => '2026-01-01', 'status' => 'ongoing', 'progress' => null, 'userTags' => 'u',
            'course' => ['courseName' => 'Seamanship', 'courseDescription' => 'cd', 'tags' => 'ct', 'totalMaterial' => '3', 'materialDetails' => [['materialId' => 'c1', 'materialType' => 'up_card', 'materialName' => 'Knots'], ['materialId' => 'v1', 'materialType' => 'video', 'materialName' => 'Intro']]]];
        $this->fakeAll(overrides: [self::U.'/courses' => Http::response([$assignment]), self::U.'/courses/C1/sync/A1/data' => Http::response(['message' => 'not found'], 404), self::BASE.'/api/v1/auth/users/teams/TEAM-1/videos/v1' => Http::response(['videoName' => 'Intro', 'videoFileUrl' => 'https://f.example.com/v.mp4'])]);

        $this->getJson('/api/v1/modules/tala/courses/A1', $h)->assertOk();                                  // detail without stored progress
        $this->getJson('/api/v1/modules/tala/courses/A1/flashcards/c1', $h)->assertOk()->assertJsonPath('data.cards.0.rating', null);
        $this->postJson('/api/v1/modules/tala/courses/A1/progress', ['completed' => ['v1'], 'feedback' => ['v1' => ['rating' => 5]]], $h)->assertOk()->assertJsonPath('data.progress', '1/3');

        $item = $this->posted()[0]['courseList'][0];
        $this->assertSame(['Seamanship', 'cd', 'ct', 'u', self::TALA_USER, 'TEAM-1', 'Maria', 'm@t.example', '1/3', 'NOT YET COMPLETED'], [$item['courseName'], $item['courseDescription'], $item['courseTags'], $item['userTags'], $item['userId'], $item['teamId'], $item['firstName'], $item['email'], $item['progress'], $item['status']]);
        $this->assertSame(['videos', 'cards', 'quizzes', 'epubs', 'pdfs'], array_keys($item['materials']));
        $this->assertSame([], $item['materials']['cards']);
        $this->assertSame([5.0, 'N/A', 'COMPLETED'], [$item['materials']['videos'][0]['feedback'], $item['materials']['videos'][0]['comment'], $item['materials']['videos'][0]['status']]);
    }
}
